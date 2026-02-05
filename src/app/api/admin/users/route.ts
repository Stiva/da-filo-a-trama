import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Profile, ApiResponse } from '@/types/database';

interface UsersListResponse {
  profiles: Profile[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * GET /api/admin/users
 * Lista tutti gli utenti (admin only)
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<UsersListResponse>>> {
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const roleFilter = searchParams.get('role');
    const onboardingFilter = searchParams.get('onboarding');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const supabase = createServiceRoleClient();

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });

    // Filtro ricerca
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,surname.ilike.%${search}%,email.ilike.%${search}%,scout_group.ilike.%${search}%`
      );
    }

    // Filtro ruolo
    if (roleFilter && ['user', 'staff', 'admin'].includes(roleFilter)) {
      query = query.eq('role', roleFilter);
    }

    // Filtro onboarding
    if (onboardingFilter === 'completed') {
      query = query.eq('onboarding_completed', true);
    } else if (onboardingFilter === 'pending') {
      query = query.eq('onboarding_completed', false);
    }

    // Paginazione
    const offset = (page - 1) * pageSize;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: {
        profiles: data as Profile[],
        total: count || 0,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Errore GET /api/admin/users:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli utenti' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Aggiorna ruolo utente (admin only)
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<Profile>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica ruolo admin via Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Solo gli admin possono modificare i ruoli' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { profileId, newRole } = body;

    if (!profileId || !newRole) {
      return NextResponse.json(
        { error: 'profileId e newRole sono obbligatori' },
        { status: 400 }
      );
    }

    if (!['user', 'staff', 'admin'].includes(newRole)) {
      return NextResponse.json(
        { error: 'Ruolo non valido' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Ottieni il profilo per avere il clerk_id
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('clerk_id')
      .eq('id', profileId)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json(
        { error: 'Profilo non trovato' },
        { status: 404 }
      );
    }

    // Aggiorna ruolo in Clerk
    await client.users.updateUser(profile.clerk_id, {
      publicMetadata: { role: newRole },
    });

    // Aggiorna ruolo in Supabase
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      data: updatedProfile as Profile,
      message: 'Ruolo aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/users:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento del ruolo' },
      { status: 500 }
    );
  }
}
