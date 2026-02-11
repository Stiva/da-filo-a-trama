import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Event, EnrollmentStatus, ApiResponse } from '@/types/database';

interface MyEvent extends Event {
  enrollment_status: EnrollmentStatus;
  enrollment_date: string;
  waitlist_position: number | null;
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

    // Recupera profile_id dell'utente
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
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
      .neq('status', 'cancelled')
      .order('registration_time', { ascending: false });

    // Filtro per status
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Trasforma i dati nel formato atteso
    const myEvents: MyEvent[] = (data || []).map((enrollment) => ({
      ...(enrollment.events as unknown as Event),
      enrollment_status: enrollment.status as EnrollmentStatus,
      enrollment_date: enrollment.registration_time,
      waitlist_position: enrollment.waitlist_position,
    }));

    return NextResponse.json({ data: myEvents });
  } catch (error) {
    console.error('Errore GET /api/events/my:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero delle iscrizioni' },
      { status: 500 }
    );
  }
}
