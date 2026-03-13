import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Event, ApiResponse } from '@/types/database';

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
 * GET /api/admin/events
 * Lista tutti gli eventi (admin only)
 */
export async function GET(): Promise<NextResponse<ApiResponse<Event[]>>> {
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

    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_time', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data as Event[] });
  } catch (error) {
    console.error('Errore GET /api/admin/events:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli eventi' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/events
 * Crea un nuovo evento (admin only)
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<Event>>> {
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

    const body = await request.json();

    // Validazione base
    if (!body.title || !body.category || !body.start_time) {
      return NextResponse.json(
        { error: 'Titolo, categoria e data inizio sono obbligatori' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const isPlaceholder = body.is_placeholder ?? false;
    const occurrencesCount = parseInt(body.occurrences || '1', 10) || 1;
    
    // Check if we requested recurrence
    const eventsToInsert = [];
    
    for (let i = 0; i < occurrencesCount; i++) {
        // Calculate the start/end time for each occurrence (adding i days)
        const eventStart = new Date(body.start_time);
        eventStart.setDate(eventStart.getDate() + i);
        
        // Handling end time gracefully if missing
        let eventEnd = null;
        if (body.end_time) {
            eventEnd = new Date(body.end_time);
            eventEnd.setDate(eventEnd.getDate() + i);
        }

        eventsToInsert.push({
            title: body.title,
            description: body.description || null,
            category: body.category,
            tags: body.tags || [],
            location_poi_id: body.location_poi_id || null,
            start_time: eventStart.toISOString(),
            end_time: eventEnd ? eventEnd.toISOString() : null,
            max_posti: body.max_posti || 50,
            speaker_name: body.speaker_name || null,
            speaker_bio: body.speaker_bio || null,
            is_published: body.is_published ?? false,
            auto_enroll_all: isPlaceholder ? false : (body.auto_enroll_all ?? false),
            checkin_enabled: body.checkin_enabled ?? false,
            visibility: body.visibility || 'public',
            workshop_groups_count: isPlaceholder ? 0 : (body.workshop_groups_count || 0),
            group_creation_mode: body.group_creation_mode || 'random',
            source_event_id: body.group_creation_mode === 'copy' ? (body.source_event_id || null) : null,
            group_eligible_roles: body.group_eligible_roles || [],
            max_group_size: body.max_group_size || 10,
            is_placeholder: isPlaceholder,
        });
    }

    const { data, error } = await supabase
      .from('events')
      .insert(eventsToInsert)
      .select();

    if (error) {
      throw error;
    }

    // Process post-creation hooks (groups and auto-enroll) for each created event
    for (const createdEvent of data) {
      // Crea i gruppi di lavoro se previsti
      if (createdEvent.workshop_groups_count > 0 && createdEvent.group_creation_mode !== 'copy' && !isPlaceholder) {
        const groupsToCreate = Array.from({ length: createdEvent.workshop_groups_count }).map((_, i) => ({
          event_id: createdEvent.id,
          name: `Gruppo ${i + 1}`,
        }));
        await supabase.from('event_groups').insert(groupsToCreate);
      }

      if (createdEvent.auto_enroll_all && !isPlaceholder) {
        await enrollAllProfilesToEvent(supabase, createdEvent.id);
      }
    }

    // Return the first event as response data to keep the interface simple, or an array if needed
    // The current UI assumes a single event return, but for multiple we output the list.
    return NextResponse.json({
      data: occurrencesCount > 1 ? data : data[0],
      message: occurrencesCount > 1 ? `${occurrencesCount} eventi creati con successo` : 'Evento creato con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/events:', error);
    const message = error instanceof Error ? error.message : 'Errore nella creazione dell\'evento';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
