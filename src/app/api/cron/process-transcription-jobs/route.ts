import { NextResponse } from 'next/server';
import { processPendingTranscriptionJobs } from '@/lib/transcription/runner';

/**
 * GET /api/cron/process-transcription-jobs
 *
 * Worker che raccoglie i job di trascrizione in stato 'pending' e li
 * sottomette ad AssemblyAI. Schedulato via Vercel Cron in vercel.json.
 *
 * Autenticazione: accetta sia il pattern Vercel Cron nativo
 * (`Authorization: Bearer $CRON_SECRET`, inviato automaticamente quando
 * la variabile e' configurata sul progetto) sia il legacy
 * `x-cron-secret` usato dagli altri cron del progetto, per compatibilita'
 * con eventuali trigger esterni gia' attivi.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await processPendingTranscriptionJobs();
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('cron process-transcription-jobs:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
      },
      { status: 500 },
    );
  }
}

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Vercel Cron: Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader === `Bearer ${secret}`) return true;

  // Legacy / external trigger: x-cron-secret
  const xCron = request.headers.get('x-cron-secret');
  if (xCron && xCron === secret) return true;

  return false;
}
