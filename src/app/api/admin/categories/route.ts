import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { EventCategoryRecord, ApiResponse } from '@/types/database';

/**
 * GET /api/admin/categories
 * Lista tutte le categorie evento (admin only)
 */
export async function GET(): Promise<NextResponse<ApiResponse<EventCategoryRecord[]>>> {
  try {
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
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data as EventCategoryRecord[] });
  } catch (error) {
    console.error('Errore GET /api/admin/categories:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero delle categorie' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/categories
 * Crea nuova categoria evento (admin only)
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<EventCategoryRecord>>> {
  try {
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

    if (!body.slug || !body.name) {
      return NextResponse.json(
        { error: 'Slug e nome sono obbligatori' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const categoryData = {
      slug: body.slug.toLowerCase().replace(/\s+/g, '-'),
      name: body.name,
      description: body.description || null,
      color: body.color || null,
      icon: body.icon || null,
      display_order: body.display_order || 0,
      is_active: body.is_active !== false,
    };

    const { data, error } = await supabase
      .from('event_categories')
      .insert(categoryData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Esiste già una categoria con questo slug' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      data: data as EventCategoryRecord,
      message: 'Categoria creata con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/categories:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione della categoria' },
      { status: 500 }
    );
  }
}
