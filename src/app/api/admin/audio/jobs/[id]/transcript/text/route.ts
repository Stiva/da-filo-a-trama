import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/transcription/adminAuth';
import { renderTranscriptTextFile } from '@/lib/transcription/jobs';
import type {
  AudioJobMetadata,
  AudioTranscriptSegment,
} from '@/types/database';

/**
 * GET /api/admin/audio/jobs/[id]/transcript/text
 * Restituisce il transcript come testo (.txt) corredato dai metadati di
 * contesto in testa al file.
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

  // Job e transcript in due query separate: audio_transcripts.job_id ha
  // UNIQUE constraint, quindi PostgREST tratta l'embedding come 1-to-1
  // (oggetto, non array). Per evitare ambiguita' nella shape della
  // risposta facciamo due query esplicite.
  const { data: jobData, error: jobError } = await supabase
    .from('audio_transcription_jobs')
    .select('id, metadata')
    .eq('id', id)
    .single();

  if (jobError || !jobData) {
    return new Response('Not found', { status: 404 });
  }

  const job = jobData as unknown as { id: string; metadata: AudioJobMetadata };

  const { data: transcriptData } = await supabase
    .from('audio_transcripts')
    .select('text, segments')
    .eq('job_id', id)
    .maybeSingle();

  const transcript = transcriptData as
    | { text: string; segments: AudioTranscriptSegment[] | null }
    | null;

  if (!transcript) {
    return new Response('Transcript non disponibile', { status: 404 });
  }

  const content = renderTranscriptTextFile(job.metadata, {
    text: transcript.text,
    segments: transcript.segments,
  });

  const safeName =
    (job.metadata.file?.name ?? `transcript-${job.id}`).replace(/\.[^.]+$/, '') +
    '.txt';

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    },
  });
}
