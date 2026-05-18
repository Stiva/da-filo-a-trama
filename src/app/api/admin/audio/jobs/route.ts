import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/transcription/adminAuth';
import type {
  ApiResponse,
  AudioJobStatus,
  AudioTranscriptionJob,
} from '@/types/database';

/**
 * GET /api/admin/audio/jobs
 * Lista paginata di job, ordinati per data desc. Filtri opzionali: status.
 */
export async function GET(
  request: Request,
): Promise<NextResponse<ApiResponse<AudioTranscriptionJob[]>>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as AudioJobStatus | null;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);

  const supabase = createServiceRoleClient();
  let query = supabase
    .from('audio_transcription_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('GET /api/admin/audio/jobs:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero dei job' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    data: (data ?? []) as unknown as AudioTranscriptionJob[],
  });
}
