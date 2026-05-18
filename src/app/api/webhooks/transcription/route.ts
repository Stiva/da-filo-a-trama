import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { fetchTranscript } from '@/lib/transcription/assemblyai';
import {
  renderTranscriptTextFile,
  transcriptToSegments,
} from '@/lib/transcription/jobs';
import type {
  AudioJobMetadata,
  AudioTranscriptSegment,
} from '@/types/database';

const BUCKET = 'assets';

/**
 * POST /api/webhooks/transcription
 *
 * Webhook AssemblyAI: chiamato quando un job (queued/processing) raggiunge
 * uno stato terminale ('completed' o 'error'). Protetto da un header
 * custom (x-transcription-secret) configurato in fase di submit.
 *
 * Note implementative:
 *   - Il body del webhook contiene solo { transcript_id, status }; bisogna
 *     fare GET /transcript/:id per avere testo e segmenti.
 *   - Se status = 'completed' creiamo audio_transcripts e un asset .txt
 *     derivato nello stesso folder dell'audio originale.
 *   - Se status = 'error' segniamo il job come 'failed'.
 *   - Idempotente: se esiste già un transcript per quel job_id, non lo
 *     duplichiamo (UNIQUE constraint su audio_transcripts.job_id).
 */
export async function POST(request: Request) {
  const secret = process.env.TRANSCRIPTION_WEBHOOK_SECRET;
  const headerSecret = request.headers.get('x-transcription-secret');
  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let payload: { transcript_id?: string; status?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const transcriptId = payload.transcript_id;
  if (!transcriptId) {
    return NextResponse.json(
      { error: 'transcript_id mancante' },
      { status: 400 },
    );
  }

  const supabase = createServiceRoleClient();

  const { data: jobData, error: jobError } = await supabase
    .from('audio_transcription_jobs')
    .select('id, metadata, asset_id, group_attachment_id, source_type')
    .eq('provider_job_id', transcriptId)
    .single();

  if (jobError || !jobData) {
    // Job non trovato: il webhook potrebbe arrivare per un job cancellato.
    // Rispondiamo 200 per non far retry indefinitamente.
    console.warn(`webhook: job non trovato per provider_job_id=${transcriptId}`);
    return NextResponse.json({ data: { ignored: true } });
  }

  type JobRow = {
    id: string;
    metadata: AudioJobMetadata;
    asset_id: string | null;
    group_attachment_id: string | null;
    source_type: 'asset' | 'group_attachment';
  };
  const job = jobData as unknown as JobRow;

  // Fetch del transcript completo dal provider.
  try {
    const remote = await fetchTranscript(transcriptId);

    if (remote.status === 'error') {
      await supabase
        .from('audio_transcription_jobs')
        .update({
          status: 'failed',
          last_error: remote.error ?? 'Provider ha riportato errore',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      return NextResponse.json({ data: { status: 'failed' } });
    }

    if (remote.status !== 'completed') {
      // Stato non terminale: ignora (potrebbero arrivare callback duplicati).
      return NextResponse.json({ data: { status: remote.status } });
    }

    const text = remote.text ?? '';
    const segments: AudioTranscriptSegment[] | null = transcriptToSegments(remote);
    const wordCount = remote.words?.length ?? text.split(/\s+/).filter(Boolean).length;
    const durationSeconds = remote.audio_duration ?? null;

    // Insert transcript (idempotente per UNIQUE job_id).
    const { data: existing } = await supabase
      .from('audio_transcripts')
      .select('id, derived_asset_id')
      .eq('job_id', job.id)
      .maybeSingle();

    let transcriptRowId: string;
    let derivedAssetId: string | null =
      (existing as { id: string; derived_asset_id: string | null } | null)
        ?.derived_asset_id ?? null;

    if (existing) {
      transcriptRowId = (existing as { id: string }).id;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('audio_transcripts')
        .insert({
          job_id: job.id,
          text,
          segments,
          language: remote.language_code,
          duration_seconds: durationSeconds,
          word_count: wordCount,
          confidence: remote.confidence,
          provider: 'assemblyai',
          raw_response: remote as unknown as Record<string, unknown>,
        })
        .select('id')
        .single();

      if (insertError || !inserted) {
        throw insertError ?? new Error('Insert transcript fallito');
      }
      transcriptRowId = (inserted as { id: string }).id;
    }

    // Crea l'asset .txt derivato (solo se non gia' creato).
    if (!derivedAssetId) {
      derivedAssetId = await createDerivedTranscriptAsset(
        supabase,
        job,
        text,
        segments,
      );
      if (derivedAssetId) {
        await supabase
          .from('audio_transcripts')
          .update({ derived_asset_id: derivedAssetId })
          .eq('id', transcriptRowId);
      }
    }

    await supabase
      .from('audio_transcription_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', job.id);

    return NextResponse.json({ data: { status: 'completed' } });
  } catch (err) {
    console.error('webhook: errore processing', err);
    const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
    await supabase
      .from('audio_transcription_jobs')
      .update({
        status: 'failed',
        last_error: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return NextResponse.json(
      { error: 'Errore processing webhook' },
      { status: 500 },
    );
  }
}

async function createDerivedTranscriptAsset(
  supabase: ReturnType<typeof createServiceRoleClient>,
  job: {
    id: string;
    metadata: AudioJobMetadata;
    asset_id: string | null;
    source_type: 'asset' | 'group_attachment';
  },
  text: string,
  segments: AudioTranscriptSegment[] | null,
): Promise<string | null> {
  // Per ora salviamo l'asset derivato solo se la sorgente e' di tipo 'asset':
  // per gli allegati di gruppo il modello dati non ha folder_path/visibility,
  // quindi e' piu' sensato lasciare il transcript in app + scaricabile via
  // API, senza riversarlo in un asset documentale.
  if (job.source_type !== 'asset' || !job.asset_id) {
    return null;
  }

  const { data: sourceAsset } = await supabase
    .from('assets')
    .select('event_id, poi_id, folder_path, visibilita, file_name')
    .eq('id', job.asset_id)
    .single();

  type SourceAsset = {
    event_id: string | null;
    poi_id: string | null;
    folder_path: string;
    visibilita: 'public' | 'registered' | 'staff';
    file_name: string;
  };
  const source = sourceAsset as unknown as SourceAsset | null;
  if (!source) return null;

  const content = renderTranscriptTextFile(job.metadata, { text, segments });
  const buffer = new TextEncoder().encode(content);

  const baseName = source.file_name.replace(/\.[^.]+$/, '');
  const fileName = `${baseName} - trascrizione.txt`;
  const storagePath = `transcripts/${job.id}.txt`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'text/plain; charset=utf-8',
      upsert: true,
    });
  if (uploadError) {
    console.error('webhook: upload derived asset failed', uploadError);
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const { data: assetInsert, error: assetInsertError } = await supabase
    .from('assets')
    .insert({
      event_id: source.event_id,
      poi_id: source.poi_id,
      file_url: publicUrlData.publicUrl,
      file_name: fileName,
      file_size_bytes: buffer.byteLength,
      mime_type: 'text/plain',
      tipo: 'document',
      visibilita: 'staff',
      title: fileName,
      description: 'Trascrizione automatica dell\'audio originale',
      folder_path: source.folder_path,
    })
    .select('id')
    .single();

  if (assetInsertError || !assetInsert) {
    console.error('webhook: insert derived asset failed', assetInsertError);
    return null;
  }

  return (assetInsert as { id: string }).id;
}
