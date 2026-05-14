import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Event, EnrollmentStatus, ApiResponse } from '@/types/database';

interface MyEvent extends Event {
  enrollment_status: EnrollmentStatus;
  enrollment_date: string;
  waitlist_position: number | null;
  user_group_name?: string | null;
  is_group_moderator?: boolean;
}

/**
 * GET /api/events/my
 * Lista eventi a cui l'utente e' iscritto
 * Query params: status (confirmed, waitlist, all)
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<MyEvent[]>>> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'all';

    const supabase = createServiceRoleClient();

    // Recupera profile_id e codice_socio dell'utente
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, codice_socio')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ data: [] as MyEvent[] });
    }

    // Query iscrizioni con join eventi
    let query = supabase
      .from('enrollments')
      .select(`
        status,
        waitlist_position,
        registration_time,
        events (*)
      `)
      .eq('user_id', profile.id)
      .neq('status', 'cancelled');

    // Filtro per status
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const myEvents: MyEvent[] = (data || []).map((enrollment) => ({
      ...(enrollment.events as unknown as Event),
      enrollment_status: enrollment.status as EnrollmentStatus,
      enrollment_date: enrollment.registration_time,
      waitlist_position: enrollment.waitlist_position,
    }));

    // Include auto_enroll_all events not yet in enrollments (e.g. created before user registered)
    if (statusFilter === 'all' || statusFilter === 'confirmed') {
      const enrolledEventIds = new Set(myEvents.map((e) => e.id));

      // Check for explicit cancellation from auto-enroll events
      const { data: cancelled } = await supabase
        .from('enrollments')
        .select('event_id')
        .eq('user_id', profile.id)
        .eq('status', 'cancelled');
      const cancelledIds = new Set((cancelled || []).map((c) => c.event_id));

      const { data: autoEvents } = await supabase
        .from('events')
        .select('*')
        .eq('auto_enroll_all', true)
        .eq('is_published', true);

      for (const ev of autoEvents || []) {
        if (!enrolledEventIds.has(ev.id) && !cancelledIds.has(ev.id)) {
          myEvents.push({
            ...(ev as unknown as Event),
            enrollment_status: 'confirmed' as EnrollmentStatus,
            enrollment_date: ev.created_at,
            waitlist_position: null,
          });
        }
      }
    }

    // Recupera l'appartenenza dell'utente ai gruppi di lavoro per gli eventi della lista
    const eventIds = myEvents.map((e) => e.id);
    const groupInfoByEvent = new Map<string, { name: string; isModerator: boolean }>();

    if (eventIds.length > 0) {
      const groupSelect = 'group_id, event_groups!inner(event_id, name)';

      const { data: modRows } = await supabase
        .from('event_group_moderators')
        .select(groupSelect)
        .eq('user_id', profile.id)
        .in('event_groups.event_id', eventIds);

      for (const row of modRows || []) {
        const eg = (row as any).event_groups;
        if (eg?.event_id && eg?.name) {
          groupInfoByEvent.set(eg.event_id, { name: eg.name, isModerator: true });
        }
      }

      const { data: memberRows } = await supabase
        .from('event_group_members')
        .select(groupSelect)
        .eq('user_id', profile.id)
        .in('event_groups.event_id', eventIds);

      for (const row of memberRows || []) {
        const eg = (row as any).event_groups;
        if (eg?.event_id && eg?.name && !groupInfoByEvent.has(eg.event_id)) {
          groupInfoByEvent.set(eg.event_id, { name: eg.name, isModerator: false });
        }
      }

      // Fallback static_crm: ricava il gruppo dal participants.static_group
      const remainingEventIds = eventIds.filter((id) => !groupInfoByEvent.has(id));
      if (remainingEventIds.length > 0 && profile.codice_socio) {
        const { data: participant } = await supabase
          .from('participants')
          .select('static_group')
          .eq('codice', profile.codice_socio)
          .eq('is_active_in_list', true)
          .maybeSingle();

        if (participant?.static_group) {
          const { data: staticGroups } = await supabase
            .from('event_groups')
            .select('event_id, name')
            .in('event_id', remainingEventIds)
            .eq('name', participant.static_group);

          for (const sg of staticGroups || []) {
            groupInfoByEvent.set(sg.event_id, { name: sg.name, isModerator: false });
          }
        }
      }
    }

    for (const ev of myEvents) {
      const info = groupInfoByEvent.get(ev.id);
      if (info) {
        ev.user_group_name = info.name;
        ev.is_group_moderator = info.isModerator;
      }
    }

    myEvents.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    return NextResponse.json({ data: myEvents });
  } catch (error) {
    console.error('Errore GET /api/events/my:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero delle iscrizioni' },
      { status: 500 }
    );
  }
}
