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

  const { data, error } = await supabase
    .from('audio_transcription_jobs')
    .select('id, metadata, audio_transcripts(text, segments)')
    .eq('id', id)
    .single();

  if (error || !data) {
    return new Response('Not found', { status: 404 });
  }

  type Row = {
    id: string;
    metadata: AudioJobMetadata;
    audio_transcripts:
      | { text: string; segments: AudioTranscriptSegment[] | null }[]
      | null;
  };
  const row = data as unknown as Row;
  const transcript = row.audio_transcripts?.[0];
  if (!transcript) {
    return new Response('Transcript non disponibile', { status: 404 });
  }

  const content = renderTranscriptTextFile(row.metadata, {
    text: transcript.text,
    segments: transcript.segments,
  });

  const safeName =
    (row.metadata.file?.name ?? `transcript-${row.id}`).replace(/\.[^.]+$/, '') +
    '.txt';

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    },
  });
}
