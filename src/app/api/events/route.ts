import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
import type { Event, ApiResponse } from '@/types/database';

interface EventsListParams {
  category?: string;
  tag?: string;
  date?: string;
  recommended?: string;
}

/**
 * GET /api/events
 * Lista eventi pubblicati con filtri opzionali
 * Query params: category, tag, date, recommended
 */
export async function GET(request: Request): Promise<NextResponse<ApiResponse<Event[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    const date = searchParams.get('date');
    const recommended = searchParams.get('recommended');

    // Per eventi raccomandati serve autenticazione
    const { userId } = await auth();

    // Usa service role per query pubbliche (bypass RLS per eventi pubblicati)
    const supabase = createServiceRoleClient();

    // Query base: solo eventi pubblicati
    let query = supabase
      .from('events')
      .select('*')
      .eq('is_published', true)
      .order('start_time', { ascending: true });

    // Filtri opzionali
    if (category) {
      query = query.eq('category', category);
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    if (date) {
      // Filtra per data specifica (formato: YYYY-MM-DD)
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      query = query.gte('start_time', startOfDay).lte('start_time', endOfDay);
    }

    // Se richiesti eventi raccomandati e utente autenticato
    if (recommended === 'true' && userId) {
      const supabaseAuth = await createServerSupabaseClient();

      // Recupera preferenze utente
      const { data: profile } = await supabaseAuth
        .from('profiles')
        .select('preferences')
        .eq('clerk_id', userId)
        .single();

      if (profile?.preferences && profile.preferences.length > 0) {
        // Filtra eventi che hanno almeno un tag in comune con le preferenze
        query = query.overlaps('tags', profile.preferences);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ data: data as Event[] });
  } catch (error) {
    console.error('Errore GET /api/events:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli eventi' },
      { status: 500 }
    );
  }
}
