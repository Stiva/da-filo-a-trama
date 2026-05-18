import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/transcription/adminAuth';
import type {
  ApiResponse,
  AudioTranscript,
  AudioTranscriptionJob,
} from '@/types/database';

interface JobDetail {
  job: AudioTranscriptionJob;
  transcript: AudioTranscript | null;
}

/**
 * GET /api/admin/audio/jobs/[id]
 * Restituisce job + transcript se presente.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<JobDetail>>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  const { data: job, error: jobError } = await supabase
    .from('audio_transcription_jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job non trovato' }, { status: 404 });
  }

  const { data: transcript } = await supabase
    .from('audio_transcripts')
    .select('*')
    .eq('job_id', id)
    .maybeSingle();

  return NextResponse.json({
    data: {
      job: job as unknown as AudioTranscriptionJob,
      transcript: (transcript as unknown as AudioTranscript) ?? null,
    },
  });
}

/**
 * DELETE /api/admin/audio/jobs/[id]
 * Cancella un job (e il transcript associato via FK cascade).
 * Per i job in stato 'processing' la cancellazione e' best-effort:
 * eventuali webhook in arrivo dal provider verranno ignorati.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from('audio_transcription_jobs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('DELETE /api/admin/audio/jobs/[id]:', error);
    return NextResponse.json(
      { error: 'Errore nella cancellazione del job' },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: { deleted: true } });
}
