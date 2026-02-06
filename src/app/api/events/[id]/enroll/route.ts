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
      console.error('RPC error:', error);
      throw error;
    }

    // L'RPC ritorna un JSONB con success/error/message
    const rpcResult = data as {
      success: boolean;
      error?: string;
      message?: string;
      enrollment_id?: string;
      status?: 'confirmed' | 'waitlist';
      waitlist_position?: number;
    };

    // Gestisci errori specifici dall'RPC
    if (!rpcResult.success) {
      const errorMap: Record<string, { message: string; status: number }> = {
        'UNAUTHORIZED': { message: 'Autenticazione richiesta', status: 401 },
        'PROFILE_NOT_FOUND': { message: 'Completa prima il tuo profilo per iscriverti agli eventi', status: 400 },
        'EVENT_NOT_FOUND': { message: 'Evento non trovato', status: 404 },
        'EVENT_NOT_PUBLISHED': { message: 'Evento non ancora disponibile per le iscrizioni', status: 400 },
        'ALREADY_ENROLLED': { message: 'Sei gia iscritto a questo evento', status: 409 },
        'EVENT_STARTED': { message: 'L\'evento e gia iniziato', status: 400 },
      };

      const errorInfo = errorMap[rpcResult.error || ''] || {
        message: rpcResult.message || 'Errore durante l\'iscrizione',
        status: 400
      };

      return NextResponse.json(
        { error: errorInfo.message },
        { status: errorInfo.status }
      );
    }

    // Costruisci il risultato di successo
    const result: EnrollmentResult = {
      success: true,
      status: rpcResult.status || 'confirmed',
      waitlist_position: rpcResult.waitlist_position,
    };

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
      console.error('RPC error:', error);
      throw error;
    }

    // L'RPC ritorna un JSONB con success/error/message
    const rpcResult = data as {
      success: boolean;
      error?: string;
      message?: string;
    };

    // Gestisci errori specifici dall'RPC
    if (!rpcResult.success) {
      const errorMap: Record<string, { message: string; status: number }> = {
        'UNAUTHORIZED': { message: 'Autenticazione richiesta', status: 401 },
        'PROFILE_NOT_FOUND': { message: 'Profilo non trovato', status: 400 },
        'ENROLLMENT_NOT_FOUND': { message: 'Iscrizione non trovata', status: 404 },
      };

      const errorInfo = errorMap[rpcResult.error || ''] || {
        message: rpcResult.message || 'Errore durante la cancellazione',
        status: 400
      };

      return NextResponse.json(
        { error: errorInfo.message },
        { status: errorInfo.status }
      );
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
