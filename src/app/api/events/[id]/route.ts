import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';
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
      .select('*')
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

    // Conta iscrizioni confermate
    const { count: enrollmentCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'confirmed');

    // Verifica se l'utente e' iscritto
    let isEnrolled = false;
    let enrollmentStatus = null;

    if (userId) {
      const supabaseAuth = await createServerSupabaseClient();

      // Recupera profile_id dell'utente
      const { data: profile } = await supabaseAuth
        .from('profiles')
        .select('id')
        .eq('clerk_id', userId)
        .single();

      if (profile) {
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('status')
          .eq('event_id', id)
          .eq('user_id', profile.id)
          .neq('status', 'cancelled')
          .single();

        if (enrollment) {
          isEnrolled = true;
          enrollmentStatus = enrollment.status;
        }
      }
    }

    const eventWithEnrollment: EventWithEnrollment = {
      ...event,
      enrollment_count: enrollmentCount || 0,
      is_enrolled: isEnrolled,
      enrollment_status: enrollmentStatus,
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
