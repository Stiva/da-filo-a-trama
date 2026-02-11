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

    // Recupera profilo utente
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
 * Utente carica un asset (file o link) per l'evento
 * Prerequisiti: user_can_upload_assets abilitato e check-in effettuato
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

    const supabase = createServiceRoleClient();

    // Recupera profilo utente
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

    // Verifica evento
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

    // Verifica check-in effettuato
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

    // Determina tipo di contenuto (file o link)
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Upload file
      return await handleFileUpload(request, supabase, profile.id, eventId);
    }

    // Link
    return await handleLinkUpload(request, supabase, profile.id, eventId);
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
 * Utente elimina un proprio asset
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

    // Recupera asset per verificare ownership e tipo
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

    // Se e un file, elimina anche da Storage
    if (asset.type === 'file' && asset.url) {
      const storagePathMatch = asset.url.match(/\/storage\/v1\/object\/public\/assets\/(.+)$/);
      if (storagePathMatch) {
        await supabase.storage
          .from('assets')
          .remove([storagePathMatch[1]]);
      }
    }

    // Elimina record
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

async function handleFileUpload(
  request: Request,
  supabase: ReturnType<typeof createServiceRoleClient>,
  profileId: string,
  eventId: string
): Promise<NextResponse<ApiResponse<UserEventAsset>>> {
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string) || '';

  if (!file) {
    return NextResponse.json(
      { error: 'Nessun file fornito' },
      { status: 400 }
    );
  }

  // Max 50MB
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: 'File troppo grande. Massimo 50MB.' },
      { status: 400 }
    );
  }

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `user-uploads/${eventId}/${timestamp}_${sanitizedName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('assets')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from('assets')
    .getPublicUrl(uploadData.path);

  const { data, error } = await supabase
    .from('user_event_assets')
    .insert({
      user_id: profileId,
      event_id: eventId,
      type: 'file',
      title: title || file.name,
      url: urlData.publicUrl,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
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

async function handleLinkUpload(
  request: Request,
  supabase: ReturnType<typeof createServiceRoleClient>,
  profileId: string,
  eventId: string
): Promise<NextResponse<ApiResponse<UserEventAsset>>> {
  const body = await request.json();

  if (!body.url || !body.title) {
    return NextResponse.json(
      { error: 'URL e titolo sono obbligatori' },
      { status: 400 }
    );
  }

  const linkType = body.link_type || 'other';

  const { data, error } = await supabase
    .from('user_event_assets')
    .insert({
      user_id: profileId,
      event_id: eventId,
      type: 'link',
      title: body.title,
      url: body.url,
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
