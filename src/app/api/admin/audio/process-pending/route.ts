import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/transcription/adminAuth';
import {
  processPendingTranscriptionJobs,
  type RunnerResult,
} from '@/lib/transcription/runner';
import type { ApiResponse } from '@/types/database';

/**
 * POST /api/admin/audio/process-pending
 * Trigger manuale del worker di trascrizione. Utile per:
 *  - debug quando il cron Vercel non parte (variabile / cron secret mancante);
 *  - non aspettare il prossimo tick (la schedule e' "/5 minuti);
 *  - verificare la pipeline end-to-end dopo un cambio configurazione.
 *
 * Solo admin/staff.
 */
export async function POST(): Promise<NextResponse<ApiResponse<RunnerResult>>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  try {
    const result = await processPendingTranscriptionJobs();
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('POST /api/admin/audio/process-pending:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Errore sconosciuto' },
      { status: 500 },
    );
  }
}
