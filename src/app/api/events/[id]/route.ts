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
    let userGroupName: string | null = null;
    let userGroupLocation: string | null = null;
    let userGroupModerators: { name: string; surname: string | null }[] = [];
    let isFavourited = false;

    if (userId) {
      // Recupera profile_id e codice_socio dell'utente
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, codice_socio')
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

        // Cerca se l'utente appartiene a un gruppo di lavoro (moderatore o membro)
        {
          const groupSelect = 'group_id, event_groups!inner(event_id, name, location_poi_id, poi:location_poi_id(nome))';

          const { data: modGroup } = await supabase
            .from('event_group_moderators')
            .select(groupSelect)
            .eq('user_id', profile.id)
            .eq('event_groups.event_id', id)
            .maybeSingle();

          if (modGroup) {
            userGroupId = modGroup.group_id;
            isGroupModerator = true;
            userGroupName = (modGroup.event_groups as any)?.name ?? null;
            userGroupLocation = (modGroup.event_groups as any)?.poi?.nome ?? null;
          } else {
            const { data: memberGroup } = await supabase
              .from('event_group_members')
              .select(groupSelect)
              .eq('user_id', profile.id)
              .eq('event_groups.event_id', id)
              .maybeSingle();

            if (memberGroup) {
              userGroupId = memberGroup.group_id;
              userGroupName = (memberGroup.event_groups as any)?.name ?? null;
              userGroupLocation = (memberGroup.event_groups as any)?.poi?.nome ?? null;
            } else if (profile.codice_socio) {
              // Fallback: static_crm mode — membership derived from participants.static_group
              const { data: participant } = await supabase
                .from('participants')
                .select('static_group')
                .eq('codice', profile.codice_socio)
                .eq('is_active_in_list', true)
                .maybeSingle();

              if (participant?.static_group) {
                const { data: staticGroup } = await supabase
                  .from('event_groups')
                  .select('id, name, location_poi_id, poi:location_poi_id(nome)')
                  .eq('event_id', id)
                  .eq('name', participant.static_group)
                  .maybeSingle();

                if (staticGroup) {
                  userGroupId = staticGroup.id;
                  userGroupName = staticGroup.name;
                  userGroupLocation = (staticGroup.poi as any)?.nome ?? null;
                }
              }
            }
          }

          // Fetch moderators for found group
          if (userGroupId) {
            const { data: mods } = await supabase
              .from('event_group_moderators')
              .select('profiles!inner(name, surname)')
              .eq('group_id', userGroupId);

            userGroupModerators = (mods || []).map((m: any) => ({
              name: m.profiles?.name ?? '',
              surname: m.profiles?.surname ?? null,
            }));
          }
        }

        // Check if user has favourited this event
        const { data: fav } = await supabase
          .from('event_favourites')
          .select('id')
          .eq('user_id', profile.id)
          .eq('event_id', id)
          .maybeSingle();

        isFavourited = !!fav;
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
      user_group_name: userGroupName ?? undefined,
      user_group_location: userGroupLocation,
      user_group_moderators: userGroupModerators,
      is_group_moderator: isGroupModerator,
      is_favourited: isFavourited,
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
