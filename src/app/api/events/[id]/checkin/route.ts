import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

const CHECKIN_WINDOW_MINUTES = 15;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/events/[id]/checkin
 * Utente effettua check-in all'evento
 * Disponibile 15 minuti prima dell'inizio dell'evento
 */
export async function POST(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ checked_in_at: string }>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    // Recupera profilo utente
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, service_role')
      .eq('clerk_id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profilo non trovato' },
        { status: 404 }
      );
    }

    // Recupera evento
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, start_time, checkin_enabled, workshop_groups_count, group_creation_mode, group_eligible_roles')
      .eq('id', eventId)
      .eq('is_published', true)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Evento non trovato' },
        { status: 404 }
      );
    }

    // Verifica check-in abilitato
    if (!event.checkin_enabled) {
      return NextResponse.json(
        { error: 'Il check-in non e abilitato per questo evento' },
        { status: 400 }
      );
    }

    // Verifica finestra temporale: 15 min prima di start_time o dopo start_time
    const now = new Date();
    const startTime = new Date(event.start_time);
    const checkinOpensAt = new Date(startTime.getTime() - CHECKIN_WINDOW_MINUTES * 60 * 1000);

    if (now < checkinOpensAt) {
      return NextResponse.json(
        { error: `Il check-in apre ${CHECKIN_WINDOW_MINUTES} minuti prima dell'inizio dell'evento` },
        { status: 400 }
      );
    }

    // Recupera enrollment dell'utente
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, status, checked_in_at')
      .eq('event_id', eventId)
      .eq('user_id', profile.id)
      .single();

    if (enrollmentError || !enrollment) {
      return NextResponse.json(
        { error: 'Non sei iscritto a questo evento' },
        { status: 400 }
      );
    }

    // Verifica stato confirmed
    if (enrollment.status !== 'confirmed') {
      return NextResponse.json(
        { error: 'Il check-in e disponibile solo per iscrizioni confermate' },
        { status: 400 }
      );
    }

    // Verifica non gia checked-in
    if (enrollment.checked_in_at) {
      return NextResponse.json(
        { error: 'Hai gia effettuato il check-in' },
        { status: 400 }
      );
    }

    // Effettua check-in
    const checkedInAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('enrollments')
      .update({ checked_in_at: checkedInAt })
      .eq('id', enrollment.id);

    if (updateError) {
      throw updateError;
    }

    // Assegnazione automatica ai gruppi di lavoro per gli utenti (non admin/staff)
    const eligibleRoles: string[] = event.group_eligible_roles || [];
    const userIsEligible = eligibleRoles.length === 0 || (profile.service_role && eligibleRoles.includes(profile.service_role));
    if (event.workshop_groups_count > 0 && profile.role === 'user' && event.group_creation_mode === 'random' && userIsEligible) {
      const { data: groups, error: groupsError } = await supabase
        .from('event_groups')
        .select('id')
        .eq('event_id', eventId);

      if (!groupsError && groups && groups.length > 0) {
        let targetGroupId = groups[0].id; // Fallback to first group

        // Modalità random: gruppo meno affollato in assoluto
        const { data: members, error: membersError } = await supabase
          .from('event_group_members')
          .select('group_id')
          .in('group_id', groups.map(g => g.id));

        if (!membersError && members) {
          const counts: Record<string, number> = {};
          groups.forEach((g) => { counts[g.id] = 0; });

          members.forEach((m) => {
            if (counts[m.group_id] !== undefined) {
              counts[m.group_id]++;
            }
          });

          let minCount = Infinity;
          for (const groupId in counts) {
            if (counts[groupId] < minCount) {
              minCount = counts[groupId];
              targetGroupId = groupId;
            }
          }
        }

        // Assign the user to the target group
        await supabase
          .from('event_group_members')
          .upsert({
            group_id: targetGroupId,
            user_id: profile.id
          }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
      }
    }

    return NextResponse.json({
      data: { checked_in_at: checkedInAt },
      message: 'Check-in effettuato con successo!',
    });
  } catch (error) {
    console.error('Errore POST /api/events/[id]/checkin:', error);
    return NextResponse.json(
      { error: 'Errore durante il check-in' },
      { status: 500 }
    );
  }
}
