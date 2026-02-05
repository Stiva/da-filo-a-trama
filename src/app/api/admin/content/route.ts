import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { DashboardContent, ApiResponse } from '@/types/database';

/**
 * GET /api/admin/content
 * Lista tutti i contenuti dashboard (admin only)
 */
export async function GET(): Promise<NextResponse<ApiResponse<DashboardContent[]>>> {
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

    const { data, error } = await supabase
      .from('dashboard_content')
      .select('*')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data as DashboardContent[] });
  } catch (error) {
    console.error('Errore GET /api/admin/content:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei contenuti' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/content
 * Crea nuovo contenuto dashboard (admin only)
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<DashboardContent>>> {
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

    // Validazione base
    if (!body.key || !body.content) {
      return NextResponse.json(
        { error: 'Key e content sono obbligatori' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const contentData = {
      key: body.key,
      title: body.title || null,
      content: body.content,
      target_state: body.target_state || 'all',
      display_order: body.display_order || 0,
      is_active: body.is_active !== false,
      updated_by: userId,
    };

    const { data, error } = await supabase
      .from('dashboard_content')
      .insert(contentData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Esiste già un contenuto con questa chiave' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      data: data as DashboardContent,
      message: 'Contenuto creato con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/content:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione del contenuto' },
      { status: 500 }
    );
  }
}
