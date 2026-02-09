import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Asset, ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/assets/[id]
 * Dettaglio asset (admin only)
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Asset>>> {
  try {
    const { userId } = await auth();
    const { id } = await params;

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

    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Asset non trovato' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data: data as Asset });
  } catch (error) {
    console.error('Errore GET /api/admin/assets/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dell\'asset' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/assets/[id]
 * Aggiorna asset (admin only)
 */
export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Asset>>> {
  try {
    const { userId } = await auth();
    const { id } = await params;

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

    const updateData: Record<string, unknown> = {};

    // Campi consentiti per l'aggiornamento
    if (body.file_name !== undefined) updateData.file_name = body.file_name;
    if (body.file_url !== undefined) updateData.file_url = body.file_url;
    if (body.tipo !== undefined) updateData.tipo = body.tipo;
    if (body.file_size_bytes !== undefined) updateData.file_size_bytes = body.file_size_bytes;
    if (body.mime_type !== undefined) updateData.mime_type = body.mime_type;
    if (body.event_id !== undefined) updateData.event_id = body.event_id;
    if (body.poi_id !== undefined) updateData.poi_id = body.poi_id;
    if (body.visibilita !== undefined) updateData.visibilita = body.visibilita;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.sort_order !== undefined) updateData.sort_order = body.sort_order;

    const { data, error } = await supabase
      .from('assets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Asset non trovato' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      data: data as Asset,
      message: 'Asset aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore PUT /api/admin/assets/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento dell\'asset' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/assets/[id]
 * Elimina asset (admin only) - elimina anche il file da Storage
 */
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { userId } = await auth();
    const { id } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Solo admin può eliminare assets
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Solo gli admin possono eliminare assets' },
        { status: 403 }
      );
    }

    const supabase = createServiceRoleClient();

    // 1. Recupera l'asset per ottenere il file_url
    const { data: asset, error: fetchError } = await supabase
      .from('assets')
      .select('file_url')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Asset non trovato' }, { status: 404 });
      }
      throw fetchError;
    }

    // 2. Estrai il path dallo Storage URL e elimina il file
    if (asset?.file_url) {
      const storageUrl = asset.file_url;
      // URL formato: https://xxx.supabase.co/storage/v1/object/public/assets/uploads/123_file.pdf
      const match = storageUrl.match(/\/storage\/v1\/object\/public\/assets\/(.+)$/);

      if (match) {
        const filePath = match[1];
        const { error: storageError } = await supabase.storage
          .from('assets')
          .remove([filePath]);

        if (storageError) {
          console.error('Errore eliminazione file dallo Storage:', storageError);
          // Continua comunque con l'eliminazione del record DB
        }
      }
    }

    // 3. Elimina il record dal database
    const { error: deleteError } = await supabase
      .from('assets')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      data: null,
      message: 'Asset eliminato con successo',
    });
  } catch (error) {
    console.error('Errore DELETE /api/admin/assets/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione dell\'asset' },
      { status: 500 }
    );
  }
}
