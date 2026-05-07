import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type {
  Profile,
  ApiResponse,
  ProfileUpdate,
  EventCategory,
  EnrollmentStatus,
} from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface AdminUserEvent {
  id: string;
  title: string;
  category: EventCategory;
  start_time: string;
  poi: { id: string; nome: string } | null;
  workshop_groups_count: number;
  enrollment_status: EnrollmentStatus;
  waitlist_position: number | null;
  user_group_name: string | null;
  user_group_location: string | null;
}

interface ProfileWithEnrollments extends Profile {
  enrollments_count?: number;
  events_enrolled?: AdminUserEvent[];
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

    // Ottieni iscrizioni con dettagli eventi e POI
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select(`
        id,
        status,
        waitlist_position,
        registration_time,
        events (
          id,
          title,
          category,
          start_time,
          workshop_groups_count,
          auto_enroll_all,
          is_published,
          poi:location_poi_id ( id, nome )
        )
      `)
      .eq('user_id', id)
      .neq('status', 'cancelled');

    if (enrollmentsError) {
      console.error('Errore enrollments:', enrollmentsError);
    }

    const events: AdminUserEvent[] = [];
    for (const e of (enrollments || []) as any[]) {
      const ev = Array.isArray(e.events) ? e.events[0] : e.events;
      if (!ev) continue;
      const poi = Array.isArray(ev.poi) ? ev.poi[0] : ev.poi;
      events.push({
        id: ev.id,
        title: ev.title,
        category: ev.category as EventCategory,
        start_time: ev.start_time,
        poi: poi ? { id: poi.id, nome: poi.nome } : null,
        workshop_groups_count: ev.workshop_groups_count ?? 0,
        enrollment_status: e.status as EnrollmentStatus,
        waitlist_position: e.waitlist_position ?? null,
        user_group_name: null,
        user_group_location: null,
      });
    }

    // Includi auto_enroll_all events non ancora in enrollments (escludendo cancellazioni esplicite)
    const enrolledEventIds = new Set(events.map((e) => e.id));
    const { data: cancelled } = await supabase
      .from('enrollments')
      .select('event_id')
      .eq('user_id', id)
      .eq('status', 'cancelled');
    const cancelledIds = new Set((cancelled || []).map((c: any) => c.event_id));

    const { data: autoEvents } = await supabase
      .from('events')
      .select('id, title, category, start_time, workshop_groups_count, poi:location_poi_id ( id, nome )')
      .eq('auto_enroll_all', true)
      .eq('is_published', true);

    for (const ev of (autoEvents || []) as any[]) {
      if (enrolledEventIds.has(ev.id) || cancelledIds.has(ev.id)) continue;
      const poi = Array.isArray(ev.poi) ? ev.poi[0] : ev.poi;
      events.push({
        id: ev.id,
        title: ev.title,
        category: ev.category as EventCategory,
        start_time: ev.start_time,
        poi: poi ? { id: poi.id, nome: poi.nome } : null,
        workshop_groups_count: ev.workshop_groups_count ?? 0,
        enrollment_status: 'confirmed' as EnrollmentStatus,
        waitlist_position: null,
        user_group_name: null,
        user_group_location: null,
      });
    }

    // Per gli eventi che prevedono gruppi di lavoro, recupera il gruppo dell'utente
    const groupEventIds = events.filter((e) => e.workshop_groups_count > 0).map((e) => e.id);

    if (groupEventIds.length > 0) {
      const groupSelect =
        'group_id, event_groups!inner(event_id, name, poi:location_poi_id(nome))';

      const [{ data: modGroups }, { data: memberGroups }] = await Promise.all([
        supabase
          .from('event_group_moderators')
          .select(groupSelect)
          .eq('user_id', id)
          .in('event_groups.event_id', groupEventIds),
        supabase
          .from('event_group_members')
          .select(groupSelect)
          .eq('user_id', id)
          .in('event_groups.event_id', groupEventIds),
      ]);

      const groupByEventId = new Map<string, { name: string; location: string | null }>();
      const collect = (rows: any[] | null) => {
        for (const row of rows || []) {
          const g = Array.isArray(row.event_groups) ? row.event_groups[0] : row.event_groups;
          if (!g?.event_id) continue;
          if (groupByEventId.has(g.event_id)) continue;
          const groupPoi = Array.isArray(g.poi) ? g.poi[0] : g.poi;
          groupByEventId.set(g.event_id, {
            name: g.name,
            location: groupPoi?.nome ?? null,
          });
        }
      };
      collect(modGroups as any[] | null);
      collect(memberGroups as any[] | null);

      // Fallback static_crm: deriva il gruppo dal participants.static_group dell'utente
      const missingGroupEventIds = groupEventIds.filter((eid) => !groupByEventId.has(eid));
      if (missingGroupEventIds.length > 0 && profile.codice_socio) {
        const { data: participant } = await supabase
          .from('participants')
          .select('static_group')
          .eq('codice', profile.codice_socio)
          .eq('is_active_in_list', true)
          .maybeSingle();

        if (participant?.static_group) {
          const { data: staticGroups } = await supabase
            .from('event_groups')
            .select('event_id, name, poi:location_poi_id(nome)')
            .in('event_id', missingGroupEventIds)
            .eq('name', participant.static_group);

          for (const sg of (staticGroups || []) as any[]) {
            if (groupByEventId.has(sg.event_id)) continue;
            const sgPoi = Array.isArray(sg.poi) ? sg.poi[0] : sg.poi;
            groupByEventId.set(sg.event_id, {
              name: sg.name,
              location: sgPoi?.nome ?? null,
            });
          }
        }
      }

      for (const ev of events) {
        const g = groupByEventId.get(ev.id);
        if (g) {
          ev.user_group_name = g.name;
          ev.user_group_location = g.location;
        }
      }
    }

    events.sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );

    const profileWithEnrollments: ProfileWithEnrollments = {
      ...(profile as Profile),
      enrollments_count: events.length,
      events_enrolled: events,
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
