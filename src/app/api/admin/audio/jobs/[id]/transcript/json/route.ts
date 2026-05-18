import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/transcription/adminAuth';
import type { AudioJobMetadata, AudioTranscriptSegment } from '@/types/database';

/**
 * GET /api/admin/audio/jobs/[id]/transcript/json
 * Restituisce un bundle JSON con metadati + transcript completo +
 * segmenti. Formato pensato per essere dato in pasto a pipeline AI.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return new Response(authResult.error, { status: authResult.status });
  }

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  // Job e transcript in due query separate (vedi nota equivalente nel
  // file text/route.ts): l'embedding 1-to-1 di PostgREST aveva shape
  // ambigua, splittare e' piu' robusto.
  const { data: jobData, error: jobError } = await supabase
    .from('audio_transcription_jobs')
    .select('id, source_type, source_id, provider, language, metadata')
    .eq('id', id)
    .single();

  if (jobError || !jobData) {
    return new Response('Not found', { status: 404 });
  }

  type JobRow = {
    id: string;
    source_type: string;
    source_id: string;
    provider: string;
    language: string;
    metadata: AudioJobMetadata;
  };
  const job = jobData as unknown as JobRow;

  const { data: transcriptData } = await supabase
    .from('audio_transcripts')
    .select('text, segments, duration_seconds, confidence, language')
    .eq('job_id', id)
    .maybeSingle();

  type TranscriptRow = {
    text: string;
    segments: AudioTranscriptSegment[] | null;
    duration_seconds: number | null;
    confidence: number | null;
    language: string | null;
  };
  const transcript = transcriptData as TranscriptRow | null;

  if (!transcript) {
    return new Response('Transcript non disponibile', { status: 404 });
  }

  const bundle = {
    job_id: job.id,
    source: { type: job.source_type, id: job.source_id },
    provider: job.provider,
    language: transcript.language ?? job.language,
    duration_seconds: transcript.duration_seconds,
    confidence: transcript.confidence,
    metadata: job.metadata,
    transcript: {
      text: transcript.text,
      segments: transcript.segments,
    },
  };

  const safeName =
    (job.metadata.file?.name ?? `transcript-${job.id}`).replace(/\.[^.]+$/, '') +
    '.json';

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    },
  });
}
