import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface EnrollmentWithProfile {
  id: string;
  user_id: string;
  status: string;
  waitlist_position: number | null;
  registration_time: string;
  profiles: {
    id: string;
    clerk_id: string;
    name: string | null;
    surname: string | null;
    email: string;
    scout_group: string | null;
  } | null;
}

interface EnrollmentsResponse {
  event: {
    id: string;
    title: string;
    max_posti: number;
  };
  enrollments: EnrollmentWithProfile[];
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

async function reorderWaitlist(supabase: ReturnType<typeof createServiceRoleClient>, eventId: string) {
  const { data: waitlist, error } = await supabase
    .from('enrollments')
    .select('id')
    .eq('event_id', eventId)
    .eq('status', 'waitlist')
    .order('registration_time', { ascending: true });

  if (error) {
    throw error;
  }

  if (!waitlist?.length) {
    return;
  }

  await Promise.all(
    waitlist.map((enrollment, index) =>
      supabase
        .from('enrollments')
        .update({ waitlist_position: index + 1 })
        .eq('id', enrollment.id)
    )
  );
}

async function notifyWaitlistPromotion(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  eventId: string,
  eventTitle: string
) {
  const { error } = await supabase
    .from('notifications')
    .upsert(
      {
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
      },
      { onConflict: 'user_id,type,event_id' }
    );

  if (error) {
    throw error;
  }
}

/**
 * GET /api/admin/events/[id]/enrollments
 * Lista iscrizioni per un evento (admin only)
 */
export async function GET(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<EnrollmentsResponse>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAuthorized } = await checkAdminRole(userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();

    // Fetch event info
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, max_posti, checkin_enabled')
      .eq('id', eventId)
      .single();

    if (eventError) {
      if (eventError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      throw eventError;
    }

    // Fetch enrollments with profile data
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select(`
        id,
        user_id,
        status,
        waitlist_position,
        registration_time,
        checked_in_at,
        profiles (
          id,
          clerk_id,
          name,
          surname,
          email,
          scout_group
        )
      `)
      .eq('event_id', eventId)
      .order('registration_time', { ascending: true });

    if (enrollmentsError) {
      throw enrollmentsError;
    }

    // Transform profiles from array to single object (Supabase returns array for joins)
    const transformedEnrollments: EnrollmentWithProfile[] = (enrollments ?? []).map((enrollment) => ({
      id: enrollment.id,
      user_id: enrollment.user_id,
      status: enrollment.status,
      waitlist_position: enrollment.waitlist_position,
      registration_time: enrollment.registration_time,
      profiles: Array.isArray(enrollment.profiles)
        ? enrollment.profiles[0] ?? null
        : enrollment.profiles,
    }));

    return NextResponse.json({
      data: {
        event,
        enrollments: transformedEnrollments,
      },
    });
  } catch (error) {
    console.error('Errore GET /api/admin/events/[id]/enrollments:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero delle iscrizioni' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/events/[id]/enrollments
 * Aggiunge manualmente un utente a un evento (admin only)
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAuthorized } = await checkAdminRole(userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: 'ID profilo richiesto' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Check if user is already enrolled
    const { data: existingEnrollment, error: existingError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', profileId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'Utente gia iscritto a questo evento' },
        { status: 409 }
      );
    }

    // Check event capacity
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('max_posti')
      .eq('id', eventId)
      .single();

    if (eventError) {
      throw eventError;
    }

    const { count: enrollmentCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'confirmed');

    const isFull = (enrollmentCount ?? 0) >= event.max_posti;

    // Insert enrollment
    const { data, error } = await supabase
      .from('enrollments')
      .insert({
        event_id: eventId,
        user_id: profileId,
        status: isFull ? 'waitlist' : 'confirmed',
        waitlist_position: isFull ? (enrollmentCount ?? 0) + 1 - event.max_posti : null,
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: { id: data.id },
      message: isFull
        ? 'Utente aggiunto in lista d\'attesa'
        : 'Utente iscritto con successo',
    });
  } catch (error) {
    console.error('Errore POST /api/admin/events/[id]/enrollments:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiunta dell\'iscrizione' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/events/[id]/enrollments
 * Rimuove un'iscrizione (admin only)
 * Body: { enrollmentId: string }
 */
export async function DELETE(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAuthorized } = await checkAdminRole(userId);
    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { enrollmentId } = body;

    if (!enrollmentId) {
      return NextResponse.json(
        { error: 'ID iscrizione richiesto' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('title')
      .eq('id', eventId)
      .single();

    if (eventError) {
      if (eventError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
      }
      throw eventError;
    }

    const { data: deletedEnrollment, error } = await supabase
      .from('enrollments')
      .delete()
      .eq('id', enrollmentId)
      .eq('event_id', eventId)
      .select('id,status')
      .maybeSingle();

    if (error) {
      throw error;
    }

    const deleted = deletedEnrollment;

    if (!deleted) {
      return NextResponse.json(
        { error: 'Iscrizione non trovata' },
        { status: 404 }
      );
    }

    if (deleted.status === 'confirmed') {
      const { data: waitlistTop, error: waitlistError } = await supabase
        .from('enrollments')
        .select('id, user_id')
        .eq('event_id', eventId)
        .eq('status', 'waitlist')
        .order('waitlist_position', { ascending: true, nullsFirst: false })
        .order('registration_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (waitlistError) {
        throw waitlistError;
      }

      if (waitlistTop?.id) {
        const { data: promoted, error: promoteError } = await supabase
          .from('enrollments')
          .update({ status: 'confirmed', waitlist_position: null })
          .eq('id', waitlistTop.id)
          .select('id')
          .maybeSingle();

        if (promoteError) {
          throw promoteError;
        }

        if (promoted) {
          await notifyWaitlistPromotion(supabase, waitlistTop.user_id, eventId, event.title);
          await reorderWaitlist(supabase, eventId);
        }
      }
    } else if (deleted.status === 'waitlist') {
      await reorderWaitlist(supabase, eventId);
    }

    return NextResponse.json({
      data: { deleted: true },
      message: 'Iscrizione rimossa con successo',
    });
  } catch (error) {
    console.error('Errore DELETE /api/admin/events/[id]/enrollments:', error);
    return NextResponse.json(
      { error: 'Errore nella rimozione dell\'iscrizione' },
      { status: 500 }
    );
  }
}
