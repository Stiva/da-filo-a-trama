import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { sanitizeFolderPath } from '@/lib/folderPath';
import type { Asset, AssetType, AssetVisibility, ApiResponse } from '@/types/database';

/**
 * GET /api/admin/assets
 * Lista assets con filtri (admin only).
 * Query params opzionali:
 *  - tipo, event_id, visibilita: filtri base
 *  - ids=id1,id2,...: limita ai soli ID indicati (max 500)
 *  - enriched=1: includi info uploader, titolo evento e nome POI per export
 */
export async function GET(
  request: Request
): Promise<NextResponse<ApiResponse<Asset[]>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica ruolo admin via Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    // Parametri di filtro
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') as AssetType | null;
    const eventId = searchParams.get('event_id');
    const visibilita = searchParams.get('visibilita') as AssetVisibility | null;
    const enriched = searchParams.get('enriched') === '1';
    const idsParam = searchParams.get('ids');

    let query = supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (tipo) {
      query = query.eq('tipo', tipo);
    }
    if (eventId) {
      query = query.eq('event_id', eventId);
    }
    if (visibilita) {
      query = query.eq('visibilita', visibilita);
    }
    if (idsParam) {
      const ids = idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 500);
      if (ids.length === 0) {
        return NextResponse.json({ data: [] });
      }
      query = query.in('id', ids);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const assets = (data ?? []) as Asset[];

    if (!enriched || assets.length === 0) {
      return NextResponse.json({ data: assets });
    }

    // Enrichment: resolve uploader profiles, event titles and POI names in batch
    const uploaderIds = Array.from(
      new Set(
        assets
          .map((a) => a.uploaded_by)
          .filter((v): v is string => Boolean(v))
      )
    );
    const eventIds = Array.from(
      new Set(
        assets
          .map((a) => a.event_id)
          .filter((v): v is string => Boolean(v))
      )
    );
    const poiIds = Array.from(
      new Set(
        assets
          .map((a) => a.poi_id)
          .filter((v): v is string => Boolean(v))
      )
    );

    const [profilesRes, eventsRes, poisRes] = await Promise.all([
      uploaderIds.length
        ? supabase
            .from('profiles')
            .select('id, name, surname, first_name, email')
            .in('id', uploaderIds)
        : Promise.resolve({ data: [], error: null }),
      eventIds.length
        ? supabase.from('events').select('id, title').in('id', eventIds)
        : Promise.resolve({ data: [], error: null }),
      poiIds.length
        ? supabase.from('poi').select('id, nome').in('id', poiIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    type ProfileRow = { id: string; name: string | null; surname: string | null; first_name: string | null; email: string };
    type EventRow = { id: string; title: string };
    type PoiRow = { id: string; nome: string };

    const profilesMap = new Map<string, ProfileRow>();
    for (const p of (profilesRes.data ?? []) as ProfileRow[]) {
      profilesMap.set(p.id, p);
    }
    const eventsMap = new Map<string, string>();
    for (const e of (eventsRes.data ?? []) as EventRow[]) {
      eventsMap.set(e.id, e.title);
    }
    const poisMap = new Map<string, string>();
    for (const p of (poisRes.data ?? []) as PoiRow[]) {
      poisMap.set(p.id, p.nome);
    }

    const enrichedAssets = assets.map((a) => {
      const uploader = a.uploaded_by ? profilesMap.get(a.uploaded_by) : null;
      const uploaderName = uploader
        ? [uploader.first_name || uploader.name, uploader.surname]
            .filter(Boolean)
            .join(' ')
            .trim() || null
        : null;
      return {
        ...a,
        uploader_name: uploaderName,
        uploader_email: uploader?.email ?? null,
        event_title: a.event_id ? eventsMap.get(a.event_id) ?? null : null,
        poi_name: a.poi_id ? poisMap.get(a.poi_id) ?? null : null,
      };
    });

    return NextResponse.json({ data: enrichedAssets as Asset[] });
  } catch (error) {
    console.error('Errore GET /api/admin/assets:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli assets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/assets
 * Crea nuovo asset (admin only)
 */
export async function POST(
  request: Request
): Promise<NextResponse<ApiResponse<Asset>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica ruolo admin via Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = createServiceRoleClient();

    // Validazione campi obbligatori
    if (!body.file_name || !body.file_url || !body.tipo) {
      return NextResponse.json(
        { error: 'Campi obbligatori mancanti: file_name, file_url, tipo' },
        { status: 400 }
      );
    }

    const insertData = {
      file_name: body.file_name,
      file_url: body.file_url,
      tipo: body.tipo,
      file_size_bytes: body.file_size_bytes || null,
      mime_type: body.mime_type || null,
      event_id: body.event_id || null,
      poi_id: body.poi_id || null,
      visibilita: body.visibilita || 'public',
      title: body.title || null,
      description: body.description || null,
      sort_order: body.sort_order || 0,
      folder_path: sanitizeFolderPath(body.folder_path),
    };

    const { data, error } = await supabase
      .from('assets')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    return NextResponse.json({
      data: data as Asset,
      message: 'Asset creato con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/assets:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Errore nella creazione dell'asset: ${detail}` },
      { status: 500 }
    );
  }
}
