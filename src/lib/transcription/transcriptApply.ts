import { createServiceRoleClient } from '@/lib/supabase/server';
import {
  type AssemblyAITranscript,
  fetchTranscript,
} from './assemblyai';
import {
  renderTranscriptTextFile,
  transcriptToSegments,
} from './jobs';
import type {
  AudioJobMetadata,
  AudioTranscriptSegment,
} from '@/types/database';

const BUCKET = 'assets';

export type ApplyOutcome =
  | { kind: 'completed'; transcriptId: string }
  | { kind: 'failed'; error: string }
  | { kind: 'still_processing'; status: string }
  | { kind: 'job_not_found' };

interface JobRow {
  id: string;
  metadata: AudioJobMetadata;
  asset_id: string | null;
  group_attachment_id: string | null;
  source_type: 'asset' | 'group_attachment';
}

/**
 * Cuore del flusso "transcript completed": idempotente, riusabile sia dal
 * webhook AssemblyAI che da un sync manuale.
 *
 *   - Recupera il job by provider_job_id.
 *   - Se il provider riporta error -> marca job failed.
 *   - Se completed: inserisce audio_transcripts (UNIQUE su job_id rende
 *     l'operazione idempotente), crea il file .txt derivato nello stesso
 *     contesto (assets folder_path per asset-source, event_group_attachments
 *     per group-source), marca il job completed.
 */
export async function applyTranscriptFromProvider(
  supabase: ReturnType<typeof createServiceRoleClient>,
  providerJobId: string,
): Promise<ApplyOutcome> {
  const { data: jobData, error: jobError } = await supabase
    .from('audio_transcription_jobs')
    .select('id, metadata, asset_id, group_attachment_id, source_type')
    .eq('provider_job_id', providerJobId)
    .single();

  if (jobError || !jobData) {
    return { kind: 'job_not_found' };
  }

  const job = jobData as unknown as JobRow;

  const remote = await fetchTranscript(providerJobId);

  if (remote.status === 'error') {
    const errorMessage = remote.error ?? 'Provider ha riportato errore';
    await supabase
      .from('audio_transcription_jobs')
      .update({
        status: 'failed',
        last_error: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return { kind: 'failed', error: errorMessage };
  }

  if (remote.status !== 'completed') {
    return { kind: 'still_processing', status: remote.status };
  }

  const transcriptId = await persistCompletedTranscript(supabase, job, remote);

  await supabase
    .from('audio_transcription_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', job.id);

  return { kind: 'completed', transcriptId };
}

async function persistCompletedTranscript(
  supabase: ReturnType<typeof createServiceRoleClient>,
  job: JobRow,
  remote: AssemblyAITranscript,
): Promise<string> {
  const text = remote.text ?? '';
  const segments: AudioTranscriptSegment[] | null = transcriptToSegments(remote);
  const wordCount = remote.words?.length ?? text.split(/\s+/).filter(Boolean).length;
  const durationSeconds = remote.audio_duration ?? null;

  // Idempotente per UNIQUE job_id.
  const { data: existing } = await supabase
    .from('audio_transcripts')
    .select('id, derived_asset_id, derived_attachment_id')
    .eq('job_id', job.id)
    .maybeSingle();

  type Existing = {
    id: string;
    derived_asset_id: string | null;
    derived_attachment_id: string | null;
  };

  let transcriptRowId: string;
  let derivedAssetId: string | null = (existing as Existing | null)?.derived_asset_id ?? null;
  let derivedAttachmentId: string | null =
    (existing as Existing | null)?.derived_attachment_id ?? null;

  if (existing) {
    transcriptRowId = (existing as Existing).id;
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

  // Crea il file .txt derivato. Idempotente: se l'id e' gia' salvato sul
  // transcript, salta. La storage upload e' upsert.
  if (job.source_type === 'asset' && !derivedAssetId) {
    derivedAssetId = await createDerivedAssetForSourceAsset(
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
  } else if (job.source_type === 'group_attachment' && !derivedAttachmentId) {
    derivedAttachmentId = await createDerivedAttachmentForSourceGroup(
      supabase,
      job,
      text,
      segments,
    );
    if (derivedAttachmentId) {
      await supabase
        .from('audio_transcripts')
        .update({ derived_attachment_id: derivedAttachmentId })
        .eq('id', transcriptRowId);
    }
  }

  return transcriptRowId;
}

async function createDerivedAssetForSourceAsset(
  supabase: ReturnType<typeof createServiceRoleClient>,
  job: JobRow,
  text: string,
  segments: AudioTranscriptSegment[] | null,
): Promise<string | null> {
  if (!job.asset_id) return null;

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
    console.error('createDerivedAsset: upload failed', uploadError);
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const { data: inserted, error: insertError } = await supabase
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

  if (insertError || !inserted) {
    console.error('createDerivedAsset: insert failed', insertError);
    return null;
  }
  return (inserted as { id: string }).id;
}

async function createDerivedAttachmentForSourceGroup(
  supabase: ReturnType<typeof createServiceRoleClient>,
  job: JobRow,
  text: string,
  segments: AudioTranscriptSegment[] | null,
): Promise<string | null> {
  if (!job.group_attachment_id) return null;

  // Recupera l'attachment originale per group_id e user_id (NOT NULL nel
  // modello dati: per il transcript usiamo lo stesso user dell'audio).
  const { data: sourceAttach } = await supabase
    .from('event_group_attachments')
    .select('group_id, user_id, file_name')
    .eq('id', job.group_attachment_id)
    .single();

  type SourceAttach = {
    group_id: string;
    user_id: string;
    file_name: string;
  };
  const source = sourceAttach as unknown as SourceAttach | null;
  if (!source) return null;

  const content = renderTranscriptTextFile(job.metadata, { text, segments });
  const buffer = new TextEncoder().encode(content);
  const baseName = source.file_name.replace(/\.[^.]+$/, '');
  const fileName = `${baseName} - trascrizione.txt`;
  const storagePath = `groups/${source.group_id}/transcripts/${job.id}.txt`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'text/plain; charset=utf-8',
      upsert: true,
    });
  if (uploadError) {
    console.error('createDerivedAttachment: upload failed', uploadError);
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const { data: inserted, error: insertError } = await supabase
    .from('event_group_attachments')
    .insert({
      group_id: source.group_id,
      user_id: source.user_id,
      file_name: fileName,
      file_url: publicUrlData.publicUrl,
      uploaded_by_role: 'admin',
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    console.error('createDerivedAttachment: insert failed', insertError);
    return null;
  }
  return (inserted as { id: string }).id;
}
