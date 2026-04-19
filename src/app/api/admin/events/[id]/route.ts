import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Event, ApiResponse } from '@/types/database';
import { enrollAllProfilesToEvent } from '@/lib/events/enrollment';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper function to check admin role
async function checkAdminRole(userId: string | null): Promise<{ isAuthorized: boolean; role?: string }> {
  if (!userId) {
    return { isAuthorized: false };
  }
  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId);
  const role = (clerkUser.publicMetadata as { role?: string })?.role;
  return { isAuthorized: role === 'admin' || role === 'staff', role };
}

async function promoteWaitlist(
  supabase: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
  slots: number
) {
  if (slots <= 0) {
    return [] as { id: string; user_id: string }[];
  }

  const { data: waitlist, error } = await supabase
    .from('enrollments')
    .select('id, user_id')
    .eq('event_id', eventId)
    .eq('status', 'waitlist')
    .order('waitlist_position', { ascending: true, nullsFirst: false })
    .order('registration_time', { ascending: true })
    .limit(slots);

  if (error) {
    throw error;
  }

  if (!waitlist?.length) {
    return [] as { id: string; user_id: string }[];
  }

  const ids = waitlist.map((entry) => entry.id);
  const { error: updateError } = await supabase
    .from('enrollments')
    .update({ status: 'confirmed', waitlist_position: null })
    .in('id', ids);

  if (updateError) {
    throw updateError;
  }

  const { data: remaining, error: remainingError } = await supabase
    .from('enrollments')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'waitlist')
    .order('registration_time', { ascending: true });

  if (remainingError) {
    throw remainingError;
  }

  if (remaining?.length) {
    await Promise.all(
      remaining.map((entry, index) =>
        supabase
          .from('enrollments')
          .update({ waitlist_position: index + 1 })
          .eq('id', entry.id)
      )
    );
  }

  return waitlist as { id: string; user_id: string }[];
}

async function fillWaitlistIfCapacityIncreased(
  supabase: ReturnType<typeof createServiceRoleClient>,
  eventId: string,
  oldMax: number,
  newMax: number
) {
  if (newMax <= oldMax) {
    return [] as { id: string; user_id: string }[];
  }

  const { count: confirmedCount, error: countError } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'confirmed');

  if (countError) {
    throw countError;
  }

  const availableSlots = Math.max(newMax - (confirmedCount ?? 0), 0);
  return promoteWaitlist(supabase, eventId, availableSlots);
}

async function notifyWaitlistPromotions(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userIds: string[],
  eventId: string,
  eventTitle: string
) {
  if (!userIds.length) {
    return;
  }

  const notifications = userIds.map((userId) => ({
    user_id: userId,
    type: 'waitlist_promoted',
    title: 'Iscrizione confermata',
    body: `Che fortuna! Sei ora iscritto/a all'evento ${eventTitle} per cui eri in lista di attesa.`,
    action_url: `/events/${eventId}`,
    event_id: eventId,
    payload: {
      event_id: eventId,
      event_title: eventTitle,
    },
  }));

  const { error } = await supabase
    .from('notifications')
    .upsert(notifications, { onConflict: 'user_id,type,event_id' });

  if (error) {
    throw error;
  }
}

/**
 * GET /api/admin/events/[id]
 * Recupera un singolo evento (admin only)
 */
export async function GET(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Event>>> {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAuthorized } = await checkAdminRole(userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data: data as Event });
  } catch (error) {
    console.error('Errore GET /api/admin/events/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dell\'evento' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/events/[id]
 * Aggiorna completamente un evento (admin only)
 */
export async function PUT(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Event>>> {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAuthorized } = await checkAdminRole(userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    if (!body.title || !body.category || !body.start_time) {
      return NextResponse.json(
        { error: 'Titolo, categoria e data inizio sono obbligatori' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: existingEvent, error: existingError } = await supabase
      .from('events')
      .select('auto_enroll_all, max_posti')
      .eq('id', id)
      .single();

    if (existingError) {
      if (existingError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      throw existingError;
    }

    const eventData = {
      title: body.title,
      custom_id: body.custom_id || null,
      description: body.description || null,
      category: body.category,
      tags: body.tags || [],
      location_poi_id: body.location_poi_id || null,
      start_time: body.start_time,
      end_time: body.end_time || null,
      max_posti: body.max_posti || 50,
      speaker_name: body.speaker_name || null,
      speaker_bio: body.speaker_bio || null,
      is_published: body.is_published ?? false,
      publish_at: body.publish_at || null,
      auto_enroll_all: body.auto_enroll_all ?? false,
      checkin_enabled: body.checkin_enabled ?? false,
      user_can_upload_assets: body.user_can_upload_assets ?? false,
      visibility: body.visibility || 'public',
      workshop_groups_count: body.workshop_groups_count || 0,
      group_creation_mode: body.group_creation_mode || 'random',
      group_user_source: body.group_user_source || 'event_registrants',
      group_eligible_roles: body.group_eligible_roles || [],
      max_group_size: body.max_group_size || 10,
      avg_people_per_group: body.avg_people_per_group || null,
      auto_create_groups_at_start: body.auto_create_groups_at_start ?? false,
      registrations_open_at: body.registrations_open_at || null,
      registrations_close_at: body.registrations_close_at || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('events')
      .update(eventData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      throw error;
    }

    // Crea gruppi al salvataggio solo per bc_list (pre-determinati)
    const shouldCreateOnSave = (eventData.workshop_groups_count as number) > 0
      && eventData.group_creation_mode !== 'copy'
      && (eventData.group_user_source === 'bc_list' || eventData.auto_enroll_all);

    if (shouldCreateOnSave) {
      const { data: existingGroups } = await supabase
        .from('event_groups')
        .select('id')
        .eq('event_id', data.id);

      const currentCount = existingGroups?.length || 0;
      const targetCount = eventData.workshop_groups_count as number;
      if (currentCount < targetCount) {
        const groupsToCreate = Array.from({ length: targetCount - currentCount }).map((_, i) => ({
          event_id: data.id,
          name: `Gruppo ${currentCount + i + 1}`,
        }));
        await supabase.from('event_groups').insert(groupsToCreate);
      }
    }

    if (!existingEvent.auto_enroll_all && eventData.auto_enroll_all) {
      await enrollAllProfilesToEvent(supabase, data.id);
    }

    const promoted = await fillWaitlistIfCapacityIncreased(
      supabase,
      data.id,
      existingEvent.max_posti,
      eventData.max_posti
    );

    if (promoted.length) {
      await notifyWaitlistPromotions(
        supabase,
        promoted.map((entry) => entry.user_id),
        data.id,
        data.title
      );
    }

    return NextResponse.json({
      data: data as Event,
      message: 'Evento aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore PUT /api/admin/events/[id]:', error);
    const message = error instanceof Error ? error.message : 'Errore nell\'aggiornamento dell\'evento';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/events/[id]
 * Aggiorna parzialmente un evento (es. toggle publish)
 */
export async function PATCH(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<Event>>> {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAuthorized } = await checkAdminRole(userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const supabase = createServiceRoleClient();

    const { data: existingEvent, error: existingError } = await supabase
      .from('events')
      .select('auto_enroll_all, max_posti, category')
      .eq('id', id)
      .single();

    if (existingError) {
      if (existingError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      throw existingError;
    }

    // Costruisci oggetto update solo con i campi forniti
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.is_published !== undefined) updateData.is_published = body.is_published;
    if (body.publish_at !== undefined) updateData.publish_at = body.publish_at || null;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.custom_id !== undefined) updateData.custom_id = body.custom_id;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.location_poi_id !== undefined) updateData.location_poi_id = body.location_poi_id;
    if (body.start_time !== undefined) updateData.start_time = body.start_time;
    if (body.end_time !== undefined) updateData.end_time = body.end_time;
    if (body.max_posti !== undefined) updateData.max_posti = body.max_posti;
    if (body.speaker_name !== undefined) updateData.speaker_name = body.speaker_name;
    if (body.speaker_bio !== undefined) updateData.speaker_bio = body.speaker_bio;
    if (body.visibility !== undefined) updateData.visibility = body.visibility;
    if (body.auto_enroll_all !== undefined) updateData.auto_enroll_all = body.auto_enroll_all;
    if (body.checkin_enabled !== undefined) updateData.checkin_enabled = body.checkin_enabled;
    if (body.user_can_upload_assets !== undefined) updateData.user_can_upload_assets = body.user_can_upload_assets;
    if (body.workshop_groups_count !== undefined) updateData.workshop_groups_count = body.workshop_groups_count;
    if (body.group_creation_mode !== undefined) updateData.group_creation_mode = body.group_creation_mode;
    if (body.group_user_source !== undefined) updateData.group_user_source = body.group_user_source;
    if (body.source_event_id !== undefined) updateData.source_event_id = body.source_event_id;
    if (body.group_eligible_roles !== undefined) updateData.group_eligible_roles = body.group_eligible_roles;
    if (body.avg_people_per_group !== undefined) updateData.avg_people_per_group = body.avg_people_per_group || null;
    if (body.auto_create_groups_at_start !== undefined) updateData.auto_create_groups_at_start = body.auto_create_groups_at_start;
    if (body.registrations_open_at !== undefined) updateData.registrations_open_at = body.registrations_open_at || null;
    if (body.registrations_close_at !== undefined) updateData.registrations_close_at = body.registrations_close_at || null;

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      throw error;
    }

    // Crea gruppi solo per bc_list se il numero è aumentato
    const patchShouldCreate = updateData.workshop_groups_count
      && (updateData.workshop_groups_count as number) > 0
      && updateData.group_creation_mode !== 'copy'
      && (updateData.group_user_source === 'bc_list' || data.auto_enroll_all);

    if (patchShouldCreate) {
      const { data: existingGroups } = await supabase
        .from('event_groups').select('id').eq('event_id', data.id);
      const currentCount = existingGroups?.length || 0;
      const targetCount = updateData.workshop_groups_count as number;
      if (currentCount < targetCount) {
        const groupsToCreate = Array.from({ length: targetCount - currentCount }).map((_, i) => ({
          event_id: data.id,
          name: `Gruppo ${currentCount + i + 1}`,
        }));
        await supabase.from('event_groups').insert(groupsToCreate);
      }
    }

    if (!existingEvent.auto_enroll_all && body.auto_enroll_all === true) {
      await enrollAllProfilesToEvent(supabase, data.id);
    }

    if (body.max_posti !== undefined) {
      const promoted = await fillWaitlistIfCapacityIncreased(
        supabase,
        data.id,
        existingEvent.max_posti,
        body.max_posti
      );

      if (promoted.length) {
        await notifyWaitlistPromotions(
          supabase,
          promoted.map((entry) => entry.user_id),
          data.id,
          data.title
        );
      }
    }

    return NextResponse.json({
      data: data as Event,
      message: 'Evento aggiornato con successo',
    });
  } catch (error) {
    console.error('Errore PATCH /api/admin/events/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento dell\'evento' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/events/[id]
 * Elimina un evento (admin only)
 */
export async function DELETE(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const { id } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAuthorized } = await checkAdminRole(userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    // Prima elimina le iscrizioni associate
    await supabase.from('enrollments').delete().eq('event_id', id);

    // Poi elimina l'evento
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: { deleted: true },
      message: 'Evento eliminato con successo',
    });
  } catch (error) {
    console.error('Errore DELETE /api/admin/events/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione dell\'evento' },
      { status: 500 }
    );
  }
}
