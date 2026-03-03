import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { EventWithEnrollment, ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/events/[id]
 * Dettaglio singolo evento con info iscrizione utente
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<EventWithEnrollment>>> {
  try {
    const { id } = await params;
    const { userId } = await auth();

    const supabase = createServiceRoleClient();

    // Recupera evento
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, poi:location_poi_id (*)')
      .eq('id', id)
      .eq('is_published', true)
      .single();

    if (eventError) {
      if (eventError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Evento non trovato' },
          { status: 404 }
        );
      }
      throw eventError;
    }

    // Conta iscrizioni confermate (escludendo admin e staff)
    const { count: enrollmentCount } = await supabase
      .from('enrollments')
      .select('*, profiles!inner(role)', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'confirmed')
      .eq('profiles.role', 'user');

    // Verifica se l'utente e' iscritto
    let isEnrolled = false;
    let enrollmentStatus = null;
    let waitlistPosition = null;
    let checkedInAt = null;
    let userGroupId = undefined;
    let isGroupModerator = false;

    if (userId) {
      // Recupera profile_id dell'utente
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('clerk_id', userId)
        .single();

      if (profile) {
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('status, waitlist_position, checked_in_at')
          .eq('event_id', id)
          .eq('user_id', profile.id)
          .in('status', ['confirmed', 'waitlist'])
          .limit(1)
          .maybeSingle();

        if (enrollment) {
          isEnrolled = true;
          enrollmentStatus = enrollment.status;
          waitlistPosition = enrollment.waitlist_position;
          checkedInAt = enrollment.checked_in_at;
        }

        // Se l'evento è diviso in gruppi, cerca se l'utente vi appartiene
        if (event.workshop_groups_count > 0) {
          // Controlla se è moderatore
          const { data: modGroup } = await supabase
            .from('event_group_moderators')
            .select('group_id, event_groups!inner(event_id)')
            .eq('user_id', profile.id)
            .eq('event_groups.event_id', id)
            .maybeSingle();

          if (modGroup) {
            userGroupId = modGroup.group_id;
            isGroupModerator = true;
          } else {
            // Controlla se è membro
            const { data: memberGroup } = await supabase
              .from('event_group_members')
              .select('group_id, event_groups!inner(event_id)')
              .eq('user_id', profile.id)
              .eq('event_groups.event_id', id)
              .maybeSingle();

            if (memberGroup) {
              userGroupId = memberGroup.group_id;
            }
          }
        }
      }
    }

    const eventWithEnrollment: EventWithEnrollment = {
      ...event,
      enrollment_count: enrollmentCount || 0,
      is_enrolled: isEnrolled,
      enrollment_status: enrollmentStatus,
      waitlist_position: waitlistPosition,
      checked_in_at: checkedInAt,
      user_group_id: userGroupId,
      is_group_moderator: isGroupModerator,
    };

    return NextResponse.json({ data: eventWithEnrollment });
  } catch (error) {
    console.error('Errore GET /api/events/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dell\'evento' },
      { status: 500 }
    );
  }
}
