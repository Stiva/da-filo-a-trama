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
      events_enrolled: enrollments?.map((e: any) => {
        // Since supabase join with `events ( ... )` usually returns a single object for many-to-one
        // but Typescript might type it as an array if it doesn't know. We check if it's an array or object.
        const eventItem = Array.isArray(e.events) ? e.events[0] : e.events;

        return {
          id: eventItem?.id,
          title: eventItem?.title,
          start_time: eventItem?.start_time,
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
      'codice_socio',
      'scout_group',
      'preferences',
      'avatar_config',
      'onboarding_completed',
      'avatar_completed',
      'preferences_set',
      'is_medical_staff',
      'fire_warden_level',
    ];

    const updateData: Partial<ProfileUpdate> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        (updateData as any)[field] = body[field];
      }
    }

    // When admin marks onboarding complete, also mark profile as fully set up
    if (body.onboarding_completed === true) {
      (updateData as any).profile_setup_complete = true;
    }

    const supabase = createServiceRoleClient();

    // Fetch existing profile to determine if service_role needs auto-assignment from CRM
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, service_role, codice_socio')
      .eq('id', id)
      .single();

    // Validate codice_socio format early to give a clear error (4–8 digits)
    if (body.codice_socio && !/^[0-9]{4,8}$/.test(body.codice_socio)) {
      return NextResponse.json(
        { error: 'Formato codice socio non valido (deve contenere 4–8 cifre numeriche).' },
        { status: 400 }
      );
    }

    // Auto-populate service_role from CRM "participants" table if linking occurs
    const futureCodice = body.codice_socio !== undefined ? body.codice_socio : existingProfile?.codice_socio;
    const futureRole = (body as any).service_role !== undefined ? (body as any).service_role : existingProfile?.service_role;

    if (futureCodice && (!futureRole || !body.scout_group)) {
      const { data: crmData, error: crmError } = await supabase
        .from('participants')
        .select('ruolo, gruppo, static_group')
        .eq('codice', futureCodice)
        .single();

      if (crmError && crmError.code !== 'PGRST116') {
        console.error('Errore CRM lookup:', crmError);
      }

      if (crmData) {
        if (!futureRole && crmData.ruolo) {
          // Store raw text - avoid ServiceRole enum constraint by using scout_group instead
          (updateData as any).service_role = crmData.ruolo;
        }
        if (!body.scout_group && crmData.gruppo) {
          updateData.scout_group = crmData.gruppo;
        }
        if (crmData.static_group) {
          (updateData as any).static_group = crmData.static_group;
        }
      }
    }

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
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Codice Socio già associato ad un altro profilo.' },
          { status: 409 }
        );
      }
      if (error.code === '23514') {
        console.error('Constraint violation PUT admin/users/[id]:', error);
        const constraintDetail = (error.message || '') + (error.hint || '') + (error.details || '');
        // If the violation is on codice_socio format, return a clear 400
        if (constraintDetail.toLowerCase().includes('codice_socio') || constraintDetail.toLowerCase().includes('codice socio')) {
          return NextResponse.json(
            { error: 'Formato codice socio non valido (deve contenere 4–8 cifre numeriche).' },
            { status: 400 }
          );
        }
        // Otherwise assume it's service_role: retry without it
        delete (updateData as any).service_role;
        const { data: retryData, error: retryError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (retryError) {
          return NextResponse.json(
            { error: 'Errore nel salvataggio del profilo.', debug: { code: retryError.code, message: retryError.message } },
            { status: 500 }
          );
        }
        return NextResponse.json({
          data: retryData as Profile,
          message: 'Profilo aggiornato (ruolo di servizio non importato dal CRM).',
        });
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
