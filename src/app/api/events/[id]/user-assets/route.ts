import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { UserEventAsset, ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/events/[id]/user-assets
 * Lista asset caricati dall'utente per l'evento
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<UserEventAsset[]>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profilo non trovato' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('user_event_assets')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: (data || []) as UserEventAsset[] });
  } catch (error) {
    console.error('Errore GET /api/events/[id]/user-assets:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli asset' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[id]/user-assets
 * Registra un asset gia' caricato (file via signed URL) oppure un link.
 * Body JSON:
 *   - file:  { type: 'file', url, file_name, file_size_bytes, mime_type, title? }
 *   - link:  { type: 'link', url, title, link_type? }   (type opzionale per retrocompatibilita')
 * Prerequisiti: user_can_upload_assets abilitato e check-in effettuato.
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<UserEventAsset>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Body JSON non valido' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profilo non trovato' },
        { status: 404 }
      );
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, user_can_upload_assets')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Evento non trovato' },
        { status: 404 }
      );
    }

    if (!event.user_can_upload_assets) {
      return NextResponse.json(
        { error: 'Il caricamento di materiale non e abilitato per questo evento' },
        { status: 400 }
      );
    }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, checked_in_at')
      .eq('event_id', eventId)
      .eq('user_id', profile.id)
      .eq('status', 'confirmed')
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        { error: 'Non sei iscritto a questo evento' },
        { status: 400 }
      );
    }

    if (!enrollment.checked_in_at) {
      return NextResponse.json(
        { error: 'Devi effettuare il check-in prima di caricare materiale' },
        { status: 400 }
      );
    }

    const assetType = body.type === 'file' ? 'file' : 'link';

    if (assetType === 'file') {
      return await commitFileAsset(body, supabase, profile.id, eventId);
    }

    return await commitLinkAsset(body, supabase, profile.id, eventId);
  } catch (error) {
    console.error('Errore POST /api/events/[id]/user-assets:', error);
    return NextResponse.json(
      { error: 'Errore nel caricamento dell\'asset' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[id]/user-assets
 * Utente elimina un proprio asset.
 * Body: { asset_id: string }
 */
export async function DELETE(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profilo non trovato' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const assetId = body.asset_id;

    if (!assetId) {
      return NextResponse.json(
        { error: 'asset_id richiesto' },
        { status: 400 }
      );
    }

    const { data: asset, error: assetError } = await supabase
      .from('user_event_assets')
      .select('*')
      .eq('id', assetId)
      .eq('event_id', eventId)
      .eq('user_id', profile.id)
      .single();

    if (assetError || !asset) {
      return NextResponse.json(
        { error: 'Asset non trovato' },
        { status: 404 }
      );
    }

    if (asset.type === 'file' && asset.url) {
      const storagePathMatch = asset.url.match(/\/storage\/v1\/object\/public\/assets\/(.+)$/);
      if (storagePathMatch) {
        await supabase.storage
          .from('assets')
          .remove([storagePathMatch[1]]);
      }
    }

    const { error: deleteError } = await supabase
      .from('user_event_assets')
      .delete()
      .eq('id', assetId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      data: null,
      message: 'Asset eliminato con successo',
    });
  } catch (error) {
    console.error('Errore DELETE /api/events/[id]/user-assets:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione dell\'asset' },
      { status: 500 }
    );
  }
}

async function commitFileAsset(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>,
  profileId: string,
  eventId: string
): Promise<NextResponse<ApiResponse<UserEventAsset>>> {
  const url = typeof body.url === 'string' ? body.url : '';
  const fileName = typeof body.file_name === 'string' ? body.file_name : '';
  const fileSize = typeof body.file_size_bytes === 'number' ? body.file_size_bytes : null;
  const mimeType = typeof body.mime_type === 'string' ? body.mime_type : '';
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : fileName;

  if (!url || !fileName || !mimeType) {
    return NextResponse.json(
      { error: 'Parametri obbligatori: url, file_name, mime_type' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('user_event_assets')
    .insert({
      user_id: profileId,
      event_id: eventId,
      type: 'file',
      title,
      url,
      file_name: fileName,
      file_size_bytes: fileSize,
      mime_type: mimeType,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return NextResponse.json({
    data: data as UserEventAsset,
    message: 'File caricato con successo',
  });
}

async function commitLinkAsset(
  body: Record<string, unknown>,
  supabase: ReturnType<typeof createServiceRoleClient>,
  profileId: string,
  eventId: string
): Promise<NextResponse<ApiResponse<UserEventAsset>>> {
  const url = typeof body.url === 'string' ? body.url : '';
  const title = typeof body.title === 'string' ? body.title : '';

  if (!url || !title) {
    return NextResponse.json(
      { error: 'URL e titolo sono obbligatori' },
      { status: 400 }
    );
  }

  const linkType = typeof body.link_type === 'string' ? body.link_type : 'other';

  const { data, error } = await supabase
    .from('user_event_assets')
    .insert({
      user_id: profileId,
      event_id: eventId,
      type: 'link',
      title,
      url,
      link_type: linkType,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return NextResponse.json({
    data: data as UserEventAsset,
    message: 'Link aggiunto con successo',
  });
}
