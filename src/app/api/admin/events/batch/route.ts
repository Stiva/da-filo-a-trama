import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Event, ApiResponse } from '@/types/database';

/**
 * POST /api/admin/events/batch
 * Bulk creates multiple events from an array of payloads
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<Event[]>>> {
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

    const { events } = await request.json();

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Formato inviato non idoneo (array di eventi richiesto)' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Mapping over payload array and applying business logic constraints
    const eventsToInsert = events.map((eventPayload: any) => ({
      title: eventPayload.title,
      description: eventPayload.description || null,
      category: eventPayload.category,
      tags: eventPayload.tags || [],
      location_poi_id: eventPayload.location_poi_id || null, // Optional in DB although required logically
      start_time: new Date(eventPayload.start_time).toISOString(),
      end_time: eventPayload.end_time ? new Date(eventPayload.end_time).toISOString() : null,
      max_posti: parseInt(eventPayload.max_posti, 10) || 50,
      speaker_name: eventPayload.speaker_name || null,
      speaker_bio: eventPayload.speaker_bio || null,
      is_published: eventPayload.is_published ?? false,
      auto_enroll_all: eventPayload.auto_enroll_all ?? false,
      checkin_enabled: eventPayload.checkin_enabled ?? false,
      visibility: eventPayload.visibility || 'public',
      workshop_groups_count: eventPayload.workshop_groups_count || 0,
      group_creation_mode: eventPayload.group_creation_mode || 'random',
      source_event_id: null, // Batch uploaded events won't be copied
      group_eligible_roles: eventPayload.group_eligible_roles || [],
      max_group_size: eventPayload.max_group_size || 10,
      is_placeholder: eventPayload.is_placeholder ?? false,
    }));

    // Batch Insert All into Supabase
    const { data, error } = await supabase
      .from('events')
      .insert(eventsToInsert)
      .select();

    if (error) {
      throw error;
    }

    // After creation hooks for batches (E.g. groups logic)
    for (const createdEvent of data) {
      if (createdEvent.workshop_groups_count > 0 && !createdEvent.is_placeholder) {
        const groupsToCreate = Array.from({ length: createdEvent.workshop_groups_count }).map((_, i) => ({
          event_id: createdEvent.id,
          name: `Gruppo ${i + 1}`,
        }));
        await supabase.from('event_groups').insert(groupsToCreate);
      }
    }

    return NextResponse.json({
      data: data as Event[],
      message: `${data.length} eventi importati con successo`,
    });
  } catch (error) {
    console.error('Errore POST /api/admin/events/batch:', error);
    const message = error instanceof Error ? error.message : 'Errore nell\'importazione massiva';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
