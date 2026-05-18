import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/transcription/adminAuth';
import type { ApiResponse } from '@/types/database';

/**
 * POST /api/admin/audio/jobs/[id]/retry
 * Riporta un job in stato 'pending' (utile per job failed). Il cron lo
 * raccoglierà nuovamente al prossimo giro.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const { id } = await context.params;
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('audio_transcription_jobs')
    .update({
      status: 'pending',
      provider_job_id: null,
      submitted_at: null,
      completed_at: null,
      last_error: null,
    })
    .eq('id', id)
    .in('status', ['failed', 'cancelled'])
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Job non trovato o non riprovabile (stato attuale non e\' failed/cancelled)' },
      { status: 409 },
    );
  }

  return NextResponse.json({ data: { id: (data as { id: string }).id } });
}
