import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Event, EventListItem, ApiResponse } from '@/types/database';

/**
 * GET /api/events
 * Lista eventi pubblicati con filtri opzionali
 * Query params: category, tag, date, recommended, poi, search, available
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<EventListItem[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    const date = searchParams.get('date');
    const recommended = searchParams.get('recommended');
    const poi = searchParams.get('poi');
    const search = searchParams.get('search');
    const available = searchParams.get('available');

    const { userId } = await auth();

    const supabase = createServiceRoleClient();

    // Query base: solo eventi pubblicati
    let query = supabase
      .from('events')
      .select('*, poi:location_poi_id ( id, nome, tipo )')
      .eq('is_published', true)
      .order('start_time', { ascending: true });

    // Filtro visibilita: visitatori vedono solo eventi pubblici
    if (!userId) {
      query = query.eq('visibility', 'public');
    }

    // Filtri opzionali
    if (category) {
      query = query.eq('category', category);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (date) {
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      query = query.gte('start_time', startOfDay).lte('start_time', endOfDay);
    }

    if (poi) {
      query = query.eq('location_poi_id', poi);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    // Filtro raccomandati: usa service role per leggere preferenze utente
    if (recommended === 'true' && userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('clerk_id', userId)
        .single();

      if (profile?.preferences && profile.preferences.length > 0) {
        query = query.overlaps('tags', profile.preferences);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const events = (data || []) as Event[];

    // Conteggio iscrizioni confermate per ogni evento
    let eventsWithCount: EventListItem[] = events.map(e => ({
      ...e,
      enrollment_count: 0,
    }));

    if (events.length > 0) {
      const eventIds = events.map(e => e.id);
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('status', 'confirmed');

      if (enrollments) {
        const countMap: Record<string, number> = {};
        enrollments.forEach(e => {
          countMap[e.event_id] = (countMap[e.event_id] || 0) + 1;
        });

        eventsWithCount = events.map(e => ({
          ...e,
          enrollment_count: countMap[e.id] || 0,
        }));
      }
    }

    // Filtro posti disponibili (post-query)
    if (available === 'true') {
      eventsWithCount = eventsWithCount.filter(e => e.enrollment_count < e.max_posti);
    }

    return NextResponse.json({ data: eventsWithCount });
  } catch (error) {
    console.error('Errore GET /api/events:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli eventi' },
      { status: 500 }
    );
  }
}
