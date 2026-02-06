import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Asset, AssetType, AssetVisibility, ApiResponse } from '@/types/database';

/**
 * GET /api/admin/assets
 * Lista assets con filtri (admin only)
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
    const fileType = searchParams.get('file_type') as AssetType | null;
    const eventId = searchParams.get('event_id');
    const visibilita = searchParams.get('visibilita') as AssetVisibility | null;

    let query = supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (fileType) {
      query = query.eq('file_type', fileType);
    }
    if (eventId) {
      query = query.eq('event_id', eventId);
    }
    if (visibilita) {
      query = query.eq('visibilita', visibilita);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data as Asset[] });
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
    if (!body.name || !body.file_url || !body.file_type) {
      return NextResponse.json(
        { error: 'Campi obbligatori mancanti: name, file_url, file_type' },
        { status: 400 }
      );
    }

    const insertData = {
      name: body.name,
      file_url: body.file_url,
      file_type: body.file_type,
      file_size: body.file_size || null,
      event_id: body.event_id || null,
      visibilita: body.visibilita || 'public',
    };

    const { data, error } = await supabase
      .from('assets')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: data as Asset,
      message: 'Asset creato con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/assets:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione dell\'asset' },
      { status: 500 }
    );
  }
}
