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

  const { data, error } = await supabase
    .from('audio_transcription_jobs')
    .select(
      'id, source_type, source_id, provider, language, metadata, audio_transcripts(text, segments, duration_seconds, confidence, language)',
    )
    .eq('id', id)
    .single();

  if (error || !data) {
    return new Response('Not found', { status: 404 });
  }

  type Row = {
    id: string;
    source_type: string;
    source_id: string;
    provider: string;
    language: string;
    metadata: AudioJobMetadata;
    audio_transcripts:
      | {
          text: string;
          segments: AudioTranscriptSegment[] | null;
          duration_seconds: number | null;
          confidence: number | null;
          language: string | null;
        }[]
      | null;
  };

  const row = data as unknown as Row;
  const transcript = row.audio_transcripts?.[0];
  if (!transcript) {
    return new Response('Transcript non disponibile', { status: 404 });
  }

  const bundle = {
    job_id: row.id,
    source: { type: row.source_type, id: row.source_id },
    provider: row.provider,
    language: transcript.language ?? row.language,
    duration_seconds: transcript.duration_seconds,
    confidence: transcript.confidence,
    metadata: row.metadata,
    transcript: {
      text: transcript.text,
      segments: transcript.segments,
    },
  };

  const safeName =
    (row.metadata.file?.name ?? `transcript-${row.id}`).replace(/\.[^.]+$/, '') +
    '.json';

  return new Response(JSON.stringify(bundle, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    },
  });
}
