import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { PreferenceTagRecord, ApiResponse } from '@/types/database';

/**
 * GET /api/admin/tags
 * Lista tutti i tag preferenze (admin only)
 */
export async function GET(): Promise<NextResponse<ApiResponse<PreferenceTagRecord[]>>> {
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
      .from('preference_tags')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data as PreferenceTagRecord[] });
  } catch (error) {
    console.error('Errore GET /api/admin/tags:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei tag' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tags
 * Crea nuovo tag preferenze (admin only)
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<PreferenceTagRecord>>> {
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

    const tagData = {
      slug: body.slug.toLowerCase().replace(/\s+/g, '-'),
      name: body.name,
      description: body.description || null,
      category: body.category || null,
      color: body.color || null,
      display_order: body.display_order || 0,
      is_active: body.is_active !== false,
    };

    const { data, error } = await supabase
      .from('preference_tags')
      .insert(tagData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Esiste già un tag con questo slug' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      data: data as PreferenceTagRecord,
      message: 'Tag creato con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/tags:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione del tag' },
      { status: 500 }
    );
  }
}
