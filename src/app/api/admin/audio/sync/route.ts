import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/transcription/adminAuth';
import { applyTranscriptFromProvider } from '@/lib/transcription/transcriptApply';
import type { ApiResponse } from '@/types/database';

interface SyncResult {
  considered: number;
  completed: number;
  still_processing: number;
  failed: number;
  not_found: number;
  errors: { jobId: string; error: string }[];
}

const MAX_JOBS_PER_RUN = 50;
const SYNC_CONCURRENCY = 5;

/**
 * POST /api/admin/audio/sync
 *
 * Sincronizza con AssemblyAI lo stato dei job in 'processing'. Utile quando:
 *   - il webhook non e' arrivato (NEXT_PUBLIC_APP_URL errato, deploy
 *     intermedio, secret mismatch, ecc.);
 *   - vogliamo forzare un check senza aspettare il prossimo webhook.
 *
 * Per ogni job con provider_job_id, fa GET /v2/transcript/{id} e, se il
 * provider riporta 'completed', applica il transcript come avrebbe fatto
 * il webhook (insert audio_transcripts, derived asset/attachment, marca
 * job completed). Idempotente.
 */
export async function POST(): Promise<NextResponse<ApiResponse<SyncResult>>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const supabase = createServiceRoleClient();

  const { data: jobsData, error: jobsError } = await supabase
    .from('audio_transcription_jobs')
    .select('id, provider_job_id')
    .eq('status', 'processing')
    .not('provider_job_id', 'is', null)
    .order('submitted_at', { ascending: true })
    .limit(MAX_JOBS_PER_RUN);

  if (jobsError) {
    return NextResponse.json(
      { error: `fetch jobs fallito: ${jobsError.message}` },
      { status: 500 },
    );
  }

  type Row = { id: string; provider_job_id: string };
  const jobs = ((jobsData ?? []) as unknown as Row[]).filter(
    (j) => j.provider_job_id,
  );

  const result: SyncResult = {
    considered: jobs.length,
    completed: 0,
    still_processing: 0,
    failed: 0,
    not_found: 0,
    errors: [],
  };

  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      try {
        const outcome = await applyTranscriptFromProvider(
          supabase,
          job.provider_job_id,
        );
        switch (outcome.kind) {
          case 'completed':
            result.completed += 1;
            break;
          case 'still_processing':
            result.still_processing += 1;
            break;
          case 'failed':
            result.failed += 1;
            break;
          case 'job_not_found':
            result.not_found += 1;
            break;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Errore sconosciuto';
        console.error(`sync: errore su job ${job.id}`, err);
        result.errors.push({ jobId: job.id, error: errorMessage });
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(SYNC_CONCURRENCY, jobs.length) },
      () => worker(),
    ),
  );

  return NextResponse.json({ data: result });
}
