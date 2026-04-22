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

    // Filtro ricerca globale
    if (search) {
      let orFilter = `name.ilike.%${search}%,surname.ilike.%${search}%,email.ilike.%${search}%,scout_group.ilike.%${search}%`;
      const parts = search.trim().split(/\s+/);
      if (parts.length >= 2) {
        const p1 = parts[0];
        const p2 = parts.slice(1).join(' ');
        orFilter += `,and(name.ilike.%${p1}%,surname.ilike.%${p2}%)`;
        orFilter += `,and(surname.ilike.%${p1}%,name.ilike.%${p2}%)`;
      }
      query = query.or(orFilter);
    }

    // Filtri per colonna dinamici (es. filter_role=admin)
    const filterableFields = [
      'name', 'surname', 'email', 'scout_group', 'static_group', 
      'role', 'is_medical_staff', 'fire_warden_level', 'codice_socio',
      'profile_setup_complete'
    ];

    searchParams.forEach((value, key) => {
      if (key.startsWith('filter_')) {
        const field = key.replace('filter_', '');
        if (filterableFields.includes(field)) {
          if (value === 'true' || value === 'false') {
            query = query.eq(field, value === 'true');
          } else if (value && value !== 'all') {
            query = query.ilike(field, `%${value}%`);
          }
        }
      }
    });

    // Filtri legacy/espliciti (per retrocompatibilità se usati in altre parti)
    if (roleFilter && ['user', 'staff', 'admin', 'guest'].includes(roleFilter)) {
      query = query.eq('role', roleFilter);
    }

    if (onboardingFilter === 'completed') {
      query = query.eq('profile_setup_complete', true);
    } else if (onboardingFilter === 'pending') {
      query = query.eq('profile_setup_complete', false);
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

    if (!['user', 'staff', 'admin', 'guest'].includes(newRole)) {
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

/**
 * PATCH /api/admin/users
 * Aggiorna stato profilo (singolo o massivo) - admin only
 * Body: { profileIds: string[], updates: { onboarding_completed?, profile_setup_complete?, avatar_completed? } }
 */
export async function PATCH(request: Request): Promise<NextResponse<ApiResponse<{ updated: number }>>> {
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
    const { profileIds, updates } = body;

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { error: 'profileIds è obbligatorio (array di ID)' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'updates è obbligatorio' },
        { status: 400 }
      );
    }

    // Sanitizza: accetta solo campi di stato consentiti
    const allowedFields = ['onboarding_completed', 'profile_setup_complete', 'avatar_completed', 'preferences_set'];
    const safeUpdates: Record<string, boolean> = {};
    for (const key of allowedFields) {
      if (typeof updates[key] === 'boolean') {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json(
        { error: 'Nessun campo valido da aggiornare. Campi consentiti: ' + allowedFields.join(', ') },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { error: updateError, count } = await supabase
      .from('profiles')
      .update(safeUpdates)
      .in('id', profileIds);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      data: { updated: count || profileIds.length },
      message: `${count || profileIds.length} profili aggiornati`,
    });
  } catch (error) {
    console.error('Errore PATCH /api/admin/users:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento dello stato' },
      { status: 500 }
    );
  }
}
