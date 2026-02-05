import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Profile, ApiResponse, ProfileUpdate } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ProfileWithEnrollments extends Profile {
  enrollments_count?: number;
  events_enrolled?: Array<{
    id: string;
    title: string;
    start_time: string;
    status: string;
  }>;
}

/**
 * GET /api/admin/users/[id]
 * Dettaglio utente con iscrizioni (admin only)
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<ProfileWithEnrollments>>> {
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

    // Ottieni profilo
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Utente non trovato' },
          { status: 404 }
        );
      }
      throw profileError;
    }

    // Ottieni iscrizioni con dettagli eventi
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        created_at,
        events (
          id,
          title,
          start_time
        )
      `)
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (enrollmentsError) {
      console.error('Errore enrollments:', enrollmentsError);
    }

    const profileWithEnrollments: ProfileWithEnrollments = {
      ...(profile as Profile),
      enrollments_count: enrollments?.length || 0,
      events_enrolled: enrollments?.map((e) => {
        // Despite the many-to-one relationship, the build process infers `e.events` as an array.
        // We'll treat it as an array and take the first element to be safe.
        const event = (
          e.events as unknown as {
            id: string;
            title: string;
            start_time: string;
          }[]
        )?.[0];

        return {
          id: event?.id,
          title: event?.title,
          start_time: event?.start_time,
          status: e.status,
        };
      }),
    };

    return NextResponse.json({ data: profileWithEnrollments });
  } catch (error) {
    console.error('Errore GET /api/admin/users/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dell\'utente' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users/[id]
 * Aggiorna profilo utente (admin only)
 */
export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Profile>>> {
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

    const body: ProfileUpdate = await request.json();

    // Campi consentiti per l'aggiornamento
    const allowedFields: (keyof ProfileUpdate)[] = [
      'name',
      'surname',
      'first_name',
      'scout_group',
      'preferences',
      'avatar_config',
      'onboarding_completed',
      'avatar_completed',
      'preferences_set',
    ];

    const updateData: Partial<ProfileUpdate> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updateData as any)[field] = body[field];
      }
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Utente non trovato' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      data: data as Profile,
      message: 'Profilo aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore PUT /api/admin/users/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento del profilo' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Elimina utente (admin only)
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

    // Solo admin può eliminare utenti
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const role = (clerkUser.publicMetadata as { role?: string })?.role;

    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Solo gli admin possono eliminare utenti' },
        { status: 403 }
      );
    }

    const supabase = createServiceRoleClient();

    // Ottieni clerk_id prima di eliminare
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('clerk_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Utente non trovato' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // Elimina da Supabase (le iscrizioni verranno eliminate in cascata se configurato)
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    // Elimina da Clerk
    try {
      await client.users.deleteUser(profile.clerk_id);
    } catch (clerkError) {
      console.error('Errore eliminazione Clerk (utente già eliminato?):', clerkError);
    }

    return NextResponse.json({
      data: null,
      message: 'Utente eliminato con successo',
    });
  } catch (error) {
    console.error('Errore DELETE /api/admin/users/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione dell\'utente' },
      { status: 500 }
    );
  }
}
