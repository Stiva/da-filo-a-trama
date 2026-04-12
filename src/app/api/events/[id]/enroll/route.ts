import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { EnrollmentResult, ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/events/[id]/enroll
 * Iscrizione a un evento (bypass RPC, usa service role)
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<EnrollmentResult>>> {
  try {
    const { id: eventId } = await params;
    
    // Parse query params for force/cancel flow
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === 'true';
    const cancelEventId = url.searchParams.get('cancelEventId');

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    // 1. Recupera profilo utente
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', userId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Completa prima il tuo profilo per iscriverti agli eventi' },
        { status: 400 }
      );
    }

    // 2. Recupera dati evento
    const { data: event } = await supabase
      .from('events')
      .select('max_posti, start_time, end_time, is_published, publish_at, title, registrations_open_at, registrations_close_at')
      .eq('id', eventId)
      .single();

    if (!event) {
      return NextResponse.json(
        { error: 'Evento non trovato' },
        { status: 404 }
      );
    }

    const now = new Date();

    if (!event.is_published) {
      return NextResponse.json(
        { error: 'Evento non ancora disponibile per le iscrizioni' },
        { status: 400 }
      );
    }

    // Verifica che la pubblicazione pianificata sia già avvenuta
    if (event.publish_at && new Date(event.publish_at) > now) {
      return NextResponse.json(
        { error: 'Evento non ancora disponibile per le iscrizioni' },
        { status: 400 }
      );
    }

    if (new Date(event.start_time) <= now) {
      return NextResponse.json(
        { error: 'L\'evento è già iniziato' },
        { status: 400 }
      );
    }

    // Verifica finestra di iscrizione
    if (event.registrations_open_at && new Date(event.registrations_open_at) > now) {
      return NextResponse.json(
        { error: 'Le iscrizioni non sono ancora aperte' },
        { status: 400 }
      );
    }

    if (event.registrations_close_at && new Date(event.registrations_close_at) < now) {
      return NextResponse.json(
        { error: 'Le iscrizioni sono chiuse' },
        { status: 400 }
      );
    }

    // 3. Verifica se già iscritto
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', profile.id)
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Sei già iscritto a questo evento' },
        { status: 409 }
      );
    }

    // 3.5. Verifica conflitti temporali
    // Get all user's active enrollments with event times
    const { data: activeEnrollments } = await supabase
      .from('enrollments')
      .select('id, event_id, events(title, start_time, end_time)')
      .eq('user_id', profile.id)
      .in('status', ['confirmed', 'waitlist']);

    if (activeEnrollments && activeEnrollments.length > 0) {
      const newStart = new Date(event.start_time);
      const newEnd = new Date(event.end_time);

      const overlap = activeEnrollments.find(e => {
        // Ignora l'evento corrente (già gestito sopra) e assicurati che events esista
        if (!e.events || e.event_id === eventId) return false;
        
        // Handling supabase join array or single object format correctly (it returns object for inner join single)
        const eventData = Array.isArray(e.events) ? e.events[0] : e.events;
        const eStart = new Date(eventData.start_time);
        const eEnd = new Date(eventData.end_time);
        
        // Controllo sovrapposizione: inizio1 < fine2 AND fine1 > inizio2
        return eStart < newEnd && eEnd > newStart;
      });

      if (overlap) {
        if (force && cancelEventId === overlap.event_id) {
          // L'utente ha confermato di voler sovrascrivere. Cancella la vecchia iscrizione.
          await supabase
            .from('enrollments')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', overlap.id);
        } else {
          // Ritorna un payload speciale 409 per attivare la modale/confirm lato frontend
          const conflictingData = Array.isArray(overlap.events) ? overlap.events[0] : overlap.events;
          return NextResponse.json(
            { 
              error: 'Conflitto temporale',
              conflict: true,
              conflictingEvent: {
                id: overlap.event_id,
                title: conflictingData.title
              }
            },
            { status: 409 }
          );
        }
      }
    }

    // 4. Conta iscrizioni confermate (solo utenti normali)
    const { count: currentCount } = await supabase
      .from('enrollments')
      .select('*, profiles!inner(role)', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'confirmed')
      .eq('profiles.role', 'user');

    const confirmedCount = currentCount || 0;

    // 5. Determina status
    let enrollStatus: 'confirmed' | 'waitlist';
    let waitlistPosition: number | null = null;

    if (profile.role === 'admin' || profile.role === 'staff') {
      // Admin e staff confermati sempre, non occupano posti
      enrollStatus = 'confirmed';
    } else if (confirmedCount < event.max_posti) {
      enrollStatus = 'confirmed';
    } else {
      enrollStatus = 'waitlist';
      // Calcola posizione in waitlist
      const { count: wlCount } = await supabase
        .from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'waitlist');
      waitlistPosition = (wlCount || 0) + 1;
    }

    // 6. Inserisci iscrizione
    const { data: enrollment, error: insertError } = await supabase
      .from('enrollments')
      .insert({
        user_id: profile.id,
        event_id: eventId,
        status: enrollStatus,
        waitlist_position: waitlistPosition,
        registration_time: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Sei già iscritto a questo evento' },
          { status: 409 }
        );
      }
      throw insertError;
    }

    const result: EnrollmentResult = {
      success: true,
      status: enrollStatus,
      waitlist_position: waitlistPosition ?? undefined,
    };

    let message = 'Iscrizione confermata!';
    if (enrollStatus === 'waitlist') {
      message = `Sei in lista d'attesa (posizione ${waitlistPosition})`;
    }

    return NextResponse.json({
      data: { ...result, message },
      message,
    });
  } catch (error) {
    console.error('Errore POST /api/events/[id]/enroll:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'iscrizione' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[id]/enroll
 * Cancella iscrizione a un evento (bypass RPC, usa service role)
 */
export async function DELETE(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ cancelled: boolean }>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const supabase = createServiceRoleClient();

    // 1. Recupera profile_id dal clerk_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('clerk_id', userId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Profilo non trovato' },
        { status: 400 }
      );
    }

    // 1b. Verifica che l'evento non abbia iscrizione automatica
    // Gli utenti non possono disiscriversi da eventi con auto_enroll_all=true
    if (profile.role === 'user') {
      const { data: event } = await supabase
        .from('events')
        .select('auto_enroll_all')
        .eq('id', eventId)
        .single();

      if (event?.auto_enroll_all) {
        return NextResponse.json(
          { error: 'Non è possibile disiscriversi da questo evento: l\'iscrizione è automatica e obbligatoria' },
          { status: 403 }
        );
      }
    }

    // 2. Trova e cancella iscrizione attiva
    const { data: cancelled, error: cancelError } = await supabase
      .from('enrollments')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .select('id, status')
      .single();

    if (cancelError || !cancelled) {
      return NextResponse.json(
        { error: 'Iscrizione non trovata' },
        { status: 404 }
      );
    }

    // 3. Se era confirmed e utente normale, promuovi primo in waitlist
    if (cancelled.status === 'cancelled' && (profile.role === 'user' || !profile.role)) {
      const { data: nextInLine } = await supabase
        .from('enrollments')
        .select('id, user_id')
        .eq('event_id', eventId)
        .eq('status', 'waitlist')
        .order('waitlist_position', { ascending: true, nullsFirst: false })
        .order('registration_time', { ascending: true })
        .limit(1)
        .single();

      if (nextInLine) {
        await supabase
          .from('enrollments')
          .update({ status: 'confirmed', waitlist_position: null, updated_at: new Date().toISOString() })
          .eq('id', nextInLine.id);

        // Ricalcola posizioni waitlist rimanenti
        const { data: remaining } = await supabase
          .from('enrollments')
          .select('id')
          .eq('event_id', eventId)
          .eq('status', 'waitlist')
          .order('registration_time', { ascending: true });

        if (remaining && remaining.length > 0) {
          for (let i = 0; i < remaining.length; i++) {
            await supabase
              .from('enrollments')
              .update({ waitlist_position: i + 1 })
              .eq('id', remaining[i].id);
          }
        }

        // Notifica promozione
        const { data: event } = await supabase
          .from('events')
          .select('title')
          .eq('id', eventId)
          .single();

        if (event) {
          await supabase
            .from('notifications')
            .upsert({
              user_id: nextInLine.user_id,
              type: 'waitlist_promoted',
              title: 'Iscrizione confermata',
              body: `Che fortuna! Sei ora iscritto/a all'evento ${event.title} per cui eri in lista di attesa.`,
              action_url: `/events/${eventId}`,
              event_id: eventId,
              payload: { event_id: eventId, event_title: event.title },
            }, { onConflict: 'user_id,type,event_id' });
        }
      }
    }

    return NextResponse.json({
      data: { cancelled: true },
      message: 'Iscrizione cancellata con successo',
    });
  } catch (error) {
    console.error('Errore DELETE /api/events/[id]/enroll:', error);
    return NextResponse.json(
      { error: 'Errore durante la cancellazione' },
      { status: 500 }
    );
  }
}
