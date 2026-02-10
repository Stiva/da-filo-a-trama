import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Event, ApiResponse } from '@/types/database';

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

async function enrollAllProfilesToEvent(supabase: ReturnType<typeof createServiceRoleClient>, eventId: string) {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id');

  if (error) {
    throw error;
  }

  if (!profiles?.length) {
    return;
  }

  const enrollments = profiles.map((profile) => ({
    event_id: eventId,
    user_id: profile.id,
    status: 'confirmed',
    waitlist_position: null,
    registration_type: 'auto',
  }));

  const { error: insertError } = await supabase
    .from('enrollments')
    .upsert(enrollments, { onConflict: 'user_id,event_id', ignoreDuplicates: true });

  if (insertError) {
    throw insertError;
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
      description: body.description || null,
      category: body.category,
      tags: body.tags || [],
      location_details: body.location_details || body.location || null,
      start_time: body.start_time,
      end_time: body.end_time || null,
      max_posti: body.max_posti || 50,
      speaker_name: body.speaker_name || null,
      speaker_bio: body.speaker_bio || null,
      is_published: body.is_published || false,
      auto_enroll_all: body.auto_enroll_all || false,
      visibility: body.visibility || 'public',
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
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento dell\'evento' },
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
      .select('auto_enroll_all, max_posti')
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
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.location_details !== undefined) updateData.location_details = body.location_details;
    if (body.location !== undefined) updateData.location_details = body.location;
    if (body.start_time !== undefined) updateData.start_time = body.start_time;
    if (body.end_time !== undefined) updateData.end_time = body.end_time;
    if (body.max_posti !== undefined) updateData.max_posti = body.max_posti;
    if (body.speaker_name !== undefined) updateData.speaker_name = body.speaker_name;
    if (body.speaker_bio !== undefined) updateData.speaker_bio = body.speaker_bio;
    if (body.visibility !== undefined) updateData.visibility = body.visibility;
    if (body.auto_enroll_all !== undefined) updateData.auto_enroll_all = body.auto_enroll_all;

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
