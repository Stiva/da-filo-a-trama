import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { applyTranscriptFromProvider } from '@/lib/transcription/transcriptApply';

/**
 * POST /api/webhooks/transcription
 *
 * Webhook AssemblyAI: chiamato quando un job raggiunge uno stato terminale
 * ('completed' o 'error'). Body: { transcript_id, status }. Protetto da
 * x-transcription-secret (configurato in fase di submit).
 *
 * Tutta la logica di applicazione del transcript (insert audio_transcripts,
 * creazione asset/attachment derivato, transizione del job a completed/failed)
 * vive in applyTranscriptFromProvider, condivisa con il sync manuale.
 */
export async function POST(request: Request) {
  const secret = process.env.TRANSCRIPTION_WEBHOOK_SECRET;
  const headerSecret = request.headers.get('x-transcription-secret');
  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let payload: { transcript_id?: string; status?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const transcriptId = payload.transcript_id;
  if (!transcriptId) {
    return NextResponse.json(
      { error: 'transcript_id mancante' },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  try {
    const outcome = await applyTranscriptFromProvider(supabase, transcriptId);

    if (outcome.kind === 'job_not_found') {
      // Webhook per job cancellato o sconosciuto. 200 per evitare retry
      // infiniti di AssemblyAI.
      console.warn(`webhook: job non trovato per provider_job_id=${transcriptId}`);
      return NextResponse.json({ data: { ignored: true } });
    }

    return NextResponse.json({ data: outcome });
  } catch (err) {
    console.error('webhook: errore processing', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
      },
      { status: 500 },
    );
  }
}
