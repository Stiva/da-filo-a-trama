import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  submitTranscriptionJob,
  type AssemblyAISpeechModel,
} from './assemblyai';
import { createSignedAudioUrl } from './storage';
import type { AudioJobMetadata } from '@/types/database';

const DEFAULT_SPEECH_MODELS: AssemblyAISpeechModel[] = [
  'universal-3-pro',
  'universal-2',
];

const MAX_ATTEMPTS = 3;

export interface RunnerResult {
  considered: number;
  submitted: number;
  failed: number;
  skipped: number;
  errors: { jobId: string; error: string }[];
}

/**
 * Raccoglie job in stato 'pending' e li sottomette al provider AssemblyAI.
 *
 * Idempotente: i job vengono spostati in 'processing' atomicamente prima
 * della chiamata al provider, cosi' chiamate concorrenti (cron + trigger
 * manuale) non li sottomettono due volte.
 *
 * Restituisce contatori e lista degli errori per audit/diagnostica.
 */
export async function processPendingTranscriptionJobs(
  maxJobs = 10,
): Promise<RunnerResult> {
  const supabase = createServiceRoleClient();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const webhookSecret = process.env.TRANSCRIPTION_WEBHOOK_SECRET;
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL non configurato');
  }
  if (!webhookSecret) {
    throw new Error('TRANSCRIPTION_WEBHOOK_SECRET non configurato');
  }
  const webhookUrl = `${appUrl}/api/webhooks/transcription`;

  const { data: pendingJobs, error: pendingError } = await supabase
    .from('audio_transcription_jobs')
    .select('id, metadata, attempts, language, diarization')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(maxJobs);

  if (pendingError) {
    throw new Error(`fetch pending fallito: ${pendingError.message}`);
  }

  type Row = {
    id: string;
    metadata: AudioJobMetadata;
    attempts: number;
    language: string;
    diarization: boolean;
  };

  const jobs = (pendingJobs ?? []) as unknown as Row[];

  const result: RunnerResult = {
    considered: jobs.length,
    submitted: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  for (const job of jobs) {
    // Claim atomico: pending -> processing solo se ancora pending.
    // Cosi' una run concorrente sullo stesso job non lo ri-sottomette.
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
      result.skipped += 1;
      continue;
    }

    try {
      const fileUrl = job.metadata?.file?.url;
      if (!fileUrl) {
        throw new Error('metadata.file.url mancante nel job');
      }

      const signedUrl = await createSignedAudioUrl(fileUrl);

      const options = job.metadata?.options;
      const speechModels =
        options?.speech_models && options.speech_models.length > 0
          ? options.speech_models
          : DEFAULT_SPEECH_MODELS;

      // Backward-compat: i job creati prima del refactor possono avere
      // `word_boost` invece di `keyterms_prompt`.
      const legacyOptions = options as
        | (typeof options & { word_boost?: string[] })
        | undefined;
      const keytermsPrompt =
        options?.keyterms_prompt ?? legacyOptions?.word_boost;

      const promptForProvider = options?.prompt || options?.context_notes;

      const providerJob = await submitTranscriptionJob({
        audioUrl: signedUrl,
        speechModels,
        language: job.language,
        diarization: job.diarization,
        webhookUrl,
        webhookAuthHeaderName: 'x-transcription-secret',
        webhookAuthHeaderValue: webhookSecret,
        keytermsPrompt,
        customSpelling: options?.custom_spelling,
        disfluencies: options?.disfluencies,
        prompt: promptForProvider,
      });

      await supabase
        .from('audio_transcription_jobs')
        .update({ provider_job_id: providerJob.id })
        .eq('id', job.id);

      result.submitted += 1;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Errore sconosciuto';
      console.error(`processPendingTranscriptionJobs: submit failed for ${job.id}`, err);

      // Tentativi residui? Riporto a pending. Altrimenti failed.
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

      result.failed += 1;
      result.errors.push({ jobId: job.id, error: errorMessage });
    }
  }

  return result;
}
