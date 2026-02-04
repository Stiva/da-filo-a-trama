import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { EnrollmentResult, ApiResponse } from '@/types/database';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/events/[id]/enroll
 * Iscrizione a un evento tramite RPC atomica
 */
export async function POST(
  request: Request,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<EnrollmentResult>>> {
  try {
    const { id: eventId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Autenticazione richiesta' },
        { status: 401 }
      );
    }

    const supabase = await createServerSupabaseClient();

    // Chiama la funzione RPC per iscrizione atomica
    // La funzione gestisce concorrenza e waitlist
    const { data, error } = await supabase.rpc('enroll_user_to_event', {
      p_event_id: eventId,
    });

    if (error) {
      // Gestisci errori specifici
      if (error.message.includes('gia iscritto') || error.message.includes('already enrolled')) {
        return NextResponse.json(
          { error: 'Sei gia iscritto a questo evento' },
          { status: 409 }
        );
      }
      if (error.message.includes('non trovato') || error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Evento non trovato' },
          { status: 404 }
        );
      }
      throw error;
    }

    const result = data as EnrollmentResult;

    // Messaggio in base allo status
    let message = 'Iscrizione confermata!';
    if (result.status === 'waitlist') {
      message = `Sei in lista d'attesa (posizione ${result.waitlist_position})`;
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
 * Cancella iscrizione a un evento
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

    const supabase = await createServerSupabaseClient();

    // Chiama la funzione RPC per cancellazione
    // La funzione gestisce anche la promozione dalla waitlist
    const { data, error } = await supabase.rpc('cancel_enrollment', {
      p_event_id: eventId,
    });

    if (error) {
      if (error.message.includes('non trovata') || error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Iscrizione non trovata' },
          { status: 404 }
        );
      }
      throw error;
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
