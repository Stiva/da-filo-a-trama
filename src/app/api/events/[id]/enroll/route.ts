import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { EnrollmentResult, ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/events/[id]/enroll
 * Iscrizione a un evento. Delega l'insert atomico (count + insert sotto lock)
 * a enroll_user_to_event RPC; resta nel route solo l'orchestrazione e i
 * controlli soft (conflitti temporali, finestra iscrizioni).
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

    // 3. Verifica se già iscritto (cerca anche cancelled per riattivazione)
    const { data: existing } = await supabase
      .from('enrollments')
      .select('id, status')
      .eq('user_id', profile.id)
      .eq('event_id', eventId)
      .maybeSingle();

    if (existing && existing.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Sei già iscritto a questo evento' },
        { status: 409 }
      );
    }

    // 3.5. Verifica conflitti temporali
    // Get all user's active enrollments with event times
    const { data: activeEnrollments } = await supabase
      .from('enrollments')
      .select('id, event_id, events(title, start_time, end_time, is_published)')
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

        // Gli eventi in bozza non vengono considerati ai fini dell'overlapping
        if (!eventData.is_published) return false;

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

    // 4. Iscrizione atomica via RPC: lock FOR UPDATE su events serializza
    // le richieste concorrenti, eliminando la race condition count+insert.
    // p_user_id passato esplicitamente perche' service role non ha JWT Clerk.
    const { data: rpcResult, error: rpcError } = await supabase.rpc('enroll_user_to_event', {
      p_event_id: eventId,
      p_user_id: profile.id,
    });

    if (rpcError) {
      throw rpcError;
    }

    const rpc = rpcResult as {
      success: boolean;
      error?: string;
      message?: string;
      status?: 'confirmed' | 'waitlist';
      waitlist_position?: number | null;
    };

    if (!rpc.success) {
      const statusCode =
        rpc.error === 'ALREADY_ENROLLED' ? 409 :
        rpc.error === 'EVENT_NOT_FOUND' ? 404 :
        rpc.error === 'PROFILE_NOT_FOUND' ? 400 :
        rpc.error === 'EVENT_NOT_PUBLISHED' || rpc.error === 'EVENT_STARTED' || rpc.error === 'EVENT_FULL' ? 400 :
        500;
      return NextResponse.json({ error: rpc.message || 'Errore durante l\'iscrizione' }, { status: statusCode });
    }

    const result: EnrollmentResult = {
      success: true,
      status: rpc.status!,
      waitlist_position: rpc.waitlist_position ?? undefined,
    };

    const message = rpc.message || (rpc.status === 'confirmed'
      ? 'Iscrizione confermata!'
      : `Sei in lista d'attesa (posizione ${rpc.waitlist_position})`);

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
 * Cancella iscrizione e promuove primo in waitlist via cancel_enrollment RPC.
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

    // 2. Cancellazione atomica via RPC: gestisce promozione waitlist e
    // notifica in un'unica transazione (lock FOR UPDATE sulla riga waitlist).
    const { data: rpcResult, error: rpcError } = await supabase.rpc('cancel_enrollment', {
      p_event_id: eventId,
      p_user_id: profile.id,
    });

    if (rpcError) {
      throw rpcError;
    }

    const rpc = rpcResult as { success: boolean; error?: string; message?: string };

    if (!rpc.success) {
      const statusCode = rpc.error === 'ENROLLMENT_NOT_FOUND' ? 404 : rpc.error === 'PROFILE_NOT_FOUND' ? 400 : 500;
      return NextResponse.json({ error: rpc.message || 'Iscrizione non trovata' }, { status: statusCode });
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
