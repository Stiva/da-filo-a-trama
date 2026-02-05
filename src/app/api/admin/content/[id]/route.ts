import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { DashboardContent, ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/content/[id]
 * Dettaglio contenuto (admin only)
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<DashboardContent>>> {
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
      .from('dashboard_content')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Contenuto non trovato' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({ data: data as DashboardContent });
  } catch (error) {
    console.error('Errore GET /api/admin/content/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero del contenuto' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/content/[id]
 * Aggiorna contenuto (admin only)
 */
export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<DashboardContent>>> {
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

    const updateData: Record<string, unknown> = {
      updated_by: userId,
    };

    // Campi consentiti per l'aggiornamento
    if (body.title !== undefined) updateData.title = body.title;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.target_state !== undefined) updateData.target_state = body.target_state;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;

    const { data, error } = await supabase
      .from('dashboard_content')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Contenuto non trovato' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      data: data as DashboardContent,
      message: 'Contenuto aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore PUT /api/admin/content/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento del contenuto' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/content/[id]
 * Elimina contenuto (admin only)
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

    // Solo admin può eliminare contenuti
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Solo gli admin possono eliminare contenuti' },
        { status: 403 }
      );
    }

    const supabase = createServiceRoleClient();

    const { error } = await supabase
      .from('dashboard_content')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: null,
      message: 'Contenuto eliminato con successo',
    });
  } catch (error) {
    console.error('Errore DELETE /api/admin/content/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione del contenuto' },
      { status: 500 }
    );
  }
}
