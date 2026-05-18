import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { submitTranscriptionJob } from '@/lib/transcription/assemblyai';
import { createSignedAudioUrl } from '@/lib/transcription/storage';
import type { AudioJobMetadata } from '@/types/database';

const MAX_JOBS_PER_RUN = 10;
const MAX_ATTEMPTS = 3;

/**
 * GET /api/cron/process-transcription-jobs
 *
 * Raccoglie job in stato 'pending' e li sottomette al provider AssemblyAI.
 * Idempotente: i job vengono spostati in 'processing' atomicamente prima
 * della chiamata al provider, cosi' un secondo cron run non li ripiglia.
 *
 * Triggered da Vercel Cron (vercel.json). Protetto da CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const headerSecret = request.headers.get('x-cron-secret');
  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createServiceRoleClient();

  // Recupera job pending (oldest first).
  const { data: pendingJobs, error: pendingError } = await supabase
    .from('audio_transcription_jobs')
    .select('id, metadata, attempts, language, diarization')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(MAX_JOBS_PER_RUN);

  if (pendingError) {
    console.error('cron: errore fetch pending:', pendingError);
    return NextResponse.json(
      { error: 'Errore nel recupero job pending' },
      { status: 500 },
    );
  }

  type Row = {
    id: string;
    metadata: AudioJobMetadata;
    attempts: number;
    language: string;
    diarization: boolean;
  };

  const jobs = (pendingJobs ?? []) as unknown as Row[];

  let submitted = 0;
  let failed = 0;
  let skipped = 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const webhookSecret = process.env.TRANSCRIPTION_WEBHOOK_SECRET;
  if (!appUrl || !webhookSecret) {
    console.error('cron: NEXT_PUBLIC_APP_URL o TRANSCRIPTION_WEBHOOK_SECRET non configurati');
    return NextResponse.json(
      { error: 'Configurazione webhook mancante' },
      { status: 500 },
    );
  }
  const webhookUrl = `${appUrl}/api/webhooks/transcription`;

  for (const job of jobs) {
    // Claim atomico: pending -> processing solo se ancora pending.
    const { data: claimed, error: claimError } = await supabase
      .from('audio_transcription_jobs')
      .update({
        status: 'processing',
        submitted_at: new Date().toISOString(),
        attempts: job.attempts + 1,
      })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
      .single();

    if (claimError || !claimed) {
      skipped += 1;
      continue;
    }

    try {
      const fileUrl = job.metadata?.file?.url;
      if (!fileUrl) {
        throw new Error('metadata.file.url mancante nel job');
      }

      const signedUrl = await createSignedAudioUrl(fileUrl);

      const providerJob = await submitTranscriptionJob({
        audioUrl: signedUrl,
        language: job.language,
        diarization: job.diarization,
        webhookUrl,
        webhookAuthHeaderName: 'x-transcription-secret',
        webhookAuthHeaderValue: webhookSecret,
      });

      await supabase
        .from('audio_transcription_jobs')
        .update({
          provider_job_id: providerJob.id,
        })
        .eq('id', job.id);

      submitted += 1;
    } catch (err) {
      console.error(`cron: submit failed for job ${job.id}`, err);
      const errorMessage =
        err instanceof Error ? err.message : 'Errore sconosciuto';

      // Se ho ancora tentativi disponibili, riporto a pending; altrimenti
      // segno il job come failed.
      const newAttempts = job.attempts + 1;
      const nextStatus = newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending';

      await supabase
        .from('audio_transcription_jobs')
        .update({
          status: nextStatus,
          last_error: errorMessage,
          submitted_at: null,
          provider_job_id: null,
        })
        .eq('id', job.id);

      failed += 1;
    }
  }

  return NextResponse.json({
    data: {
      considered: jobs.length,
      submitted,
      failed,
      skipped,
    },
  });
}
