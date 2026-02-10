import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { EventCategoryRecord, ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/categories/[id]
 * Dettaglio categoria (admin only)
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<EventCategoryRecord>>> {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('event_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Categoria non trovata' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data: data as EventCategoryRecord });
  } catch (error) {
    console.error('Errore GET /api/admin/categories/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero della categoria' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/categories/[id]
 * Aggiorna categoria (admin only)
 */
export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<EventCategoryRecord>>> {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin' && role !== 'staff') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const supabase = createServiceRoleClient();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.color !== undefined) updateData.color = body.color;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'Nessun campo da aggiornare' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('event_categories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Categoria non trovata' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({
      data: data as EventCategoryRecord,
      message: 'Categoria aggiornata con successo',
    });
  } catch (error) {
    console.error('Errore PUT /api/admin/categories/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento della categoria' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/categories/[id]
 * Elimina categoria (soft delete - imposta is_active = false)
 */
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Solo admin possono eliminare categorie' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    // Soft delete: imposta is_active = false
    const { error } = await supabase
      .from('event_categories')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: { deleted: true },
      message: 'Categoria disattivata con successo',
    });
  } catch (error) {
    console.error('Errore DELETE /api/admin/categories/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione della categoria' },
      { status: 500 }
    );
  }
}
