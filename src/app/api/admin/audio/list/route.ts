import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/transcription/adminAuth';
import { looksLikeAudioFile } from '@/lib/transcription/jobs';
import { extractStoragePath } from '@/lib/transcription/storage';
import type {
  ApiResponse,
  AudioJobStatus,
  AudioSourceListItem,
} from '@/types/database';

/**
 * GET /api/admin/audio/list
 * Restituisce tutti gli audio trascrivibili (assets tipo='audio' o file
 * audio fra gli event_group_attachments) con lo stato dell'ultimo job di
 * trascrizione (se esiste).
 */
export async function GET(): Promise<
  NextResponse<ApiResponse<AudioSourceListItem[]>>
> {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  try {
    const supabase = createServiceRoleClient();

    // 1) Audio in `assets` (tipo='audio' o tipo='video' con mime audio).
    //    Includiamo anche file dichiarati come tipo='document' ma con
    //    estensione audio: caso raro ma documentato.
    const { data: assetsData, error: assetsError } = await supabase
      .from('assets')
      .select(
        'id, file_url, file_name, file_size_bytes, mime_type, tipo, folder_path, created_at, event_id, events(id, title, description)',
      )
      .eq('tipo', 'audio')
      .order('created_at', { ascending: false });

    if (assetsError) throw assetsError;

    // 2) Allegati di gruppo che sono audio (filtrati lato app).
    const { data: attachmentsData, error: attachmentsError } = await supabase
      .from('event_group_attachments')
      .select(
        'id, file_name, file_url, created_at, group_id, event_groups(id, name, event_id, events(id, title, description))',
      )
      .order('created_at', { ascending: false });

    if (attachmentsError) throw attachmentsError;

    type AssetRow = {
      id: string;
      file_url: string;
      file_name: string;
      file_size_bytes: number | null;
      mime_type: string | null;
      tipo: string;
      folder_path: string | null;
      created_at: string;
      event_id: string | null;
      events: {
        id: string;
        title: string;
        description: string | null;
      } | null;
    };

    type AttachmentRow = {
      id: string;
      file_name: string;
      file_url: string;
      created_at: string;
      group_id: string;
      event_groups: {
        id: string;
        name: string;
        event_id: string;
        events: { id: string; title: string; description: string | null } | null;
      } | null;
    };

    const assets = (assetsData ?? []) as unknown as AssetRow[];
    const attachments = ((attachmentsData ?? []) as unknown as AttachmentRow[]).filter(
      (a) => looksLikeAudioFile(a.file_name, null),
    );

    // 3) Ultimo job per ciascuna sorgente.
    const sourceIds = [
      ...assets.map((a) => a.id),
      ...attachments.map((a) => a.id),
    ];

    let jobsBySource = new Map<
      string,
      {
        id: string;
        status: AudioJobStatus;
        created_at: string;
        completed_at: string | null;
        last_error: string | null;
        has_transcript: boolean;
        duration_seconds: number | null;
      }
    >();

    if (sourceIds.length > 0) {
      // Query separata su audio_transcription_jobs: l'embedding di
      // audio_transcripts qui sotto era problematico perche' l'FK
      // audio_transcripts.job_id ha UNIQUE constraint -> PostgREST tratta
      // la relazione come 1-to-1 e ritorna un oggetto singolo (o null)
      // invece di un array. Tutta la logica downstream assumeva array,
      // quindi has_transcript risultava sempre false anche con
      // transcript presenti. Facciamo due query e mergiamo a mano.
      const { data: jobsData, error: jobsError } = await supabase
        .from('audio_transcription_jobs')
        .select(
          'id, source_type, source_id, status, created_at, completed_at, last_error',
        )
        .in('source_id', sourceIds)
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      type JobRow = {
        id: string;
        source_type: string;
        source_id: string;
        status: AudioJobStatus;
        created_at: string;
        completed_at: string | null;
        last_error: string | null;
      };

      const jobRows = (jobsData ?? []) as unknown as JobRow[];

      // Transcript per i job recuperati: map job_id -> { id, duration }.
      const jobIds = jobRows.map((j) => j.id);
      const transcriptsByJobId = new Map<
        string,
        { id: string; duration_seconds: number | null }
      >();
      if (jobIds.length > 0) {
        const { data: transcriptsData, error: transcriptsError } = await supabase
          .from('audio_transcripts')
          .select('id, job_id, duration_seconds')
          .in('job_id', jobIds);
        if (transcriptsError) throw transcriptsError;

        type TranscriptRow = {
          id: string;
          job_id: string;
          duration_seconds: number | null;
        };
        for (const t of (transcriptsData ?? []) as unknown as TranscriptRow[]) {
          transcriptsByJobId.set(t.job_id, {
            id: t.id,
            duration_seconds: t.duration_seconds,
          });
        }
      }

      jobsBySource = new Map();
      for (const j of jobRows) {
        const key = `${j.source_type}:${j.source_id}`;
        if (!jobsBySource.has(key)) {
          const transcript = transcriptsByJobId.get(j.id);
          jobsBySource.set(key, {
            id: j.id,
            status: j.status,
            created_at: j.created_at,
            completed_at: j.completed_at,
            last_error: j.last_error,
            has_transcript: transcript != null,
            duration_seconds: transcript?.duration_seconds ?? null,
          });
        }
      }
    }

    // 4) Moderatori per ciascun group_id (per popolare suggerimenti vocabolario).
    const groupIds = Array.from(
      new Set(
        attachments
          .map((a) => a.event_groups?.id)
          .filter((g): g is string => !!g),
      ),
    );
    const moderatorsByGroup = new Map<
      string,
      { id: string; name: string | null; surname: string | null; email: string | null }[]
    >();
    if (groupIds.length > 0) {
      const { data: modsData } = await supabase
        .from('event_group_moderators')
        .select('group_id, profiles(id, name, surname, email)')
        .in('group_id', groupIds);
      type ModRow = {
        group_id: string;
        profiles: {
          id: string;
          name: string | null;
          surname: string | null;
          email: string;
        } | null;
      };
      for (const m of ((modsData ?? []) as unknown as ModRow[])) {
        if (!m.profiles) continue;
        const list = moderatorsByGroup.get(m.group_id) ?? [];
        list.push({
          id: m.profiles.id,
          name: m.profiles.name,
          surname: m.profiles.surname,
          email: m.profiles.email,
        });
        moderatorsByGroup.set(m.group_id, list);
      }
    }

    const items: AudioSourceListItem[] = [];

    for (const a of assets) {
      const key = `asset:${a.id}`;
      const job = jobsBySource.get(key);
      items.push({
        source_type: 'asset',
        source_id: a.id,
        file_name: a.file_name,
        file_url: a.file_url,
        file_size_bytes: a.file_size_bytes,
        mime_type: a.mime_type,
        event_id: a.event_id,
        event_title: a.events?.title ?? null,
        event_description: a.events?.description ?? null,
        group_id: null,
        group_name: null,
        moderators: [],
        folder_path: a.folder_path,
        created_at: a.created_at,
        known_duration_seconds: job?.duration_seconds ?? null,
        latest_job: job
          ? {
              id: job.id,
              status: job.status,
              created_at: job.created_at,
              completed_at: job.completed_at,
              last_error: job.last_error,
            }
          : null,
        has_transcript: job?.has_transcript ?? false,
      });
    }

    for (const a of attachments) {
      const key = `group_attachment:${a.id}`;
      const job = jobsBySource.get(key);
      items.push({
        source_type: 'group_attachment',
        source_id: a.id,
        file_name: a.file_name,
        file_url: a.file_url,
        file_size_bytes: null,
        mime_type: null,
        event_id: a.event_groups?.event_id ?? null,
        event_title: a.event_groups?.events?.title ?? null,
        event_description: a.event_groups?.events?.description ?? null,
        group_id: a.group_id,
        group_name: a.event_groups?.name ?? null,
        moderators: a.event_groups
          ? moderatorsByGroup.get(a.event_groups.id) ?? []
          : [],
        folder_path: null,
        created_at: a.created_at,
        known_duration_seconds: job?.duration_seconds ?? null,
        latest_job: job
          ? {
              id: job.id,
              status: job.status,
              created_at: job.created_at,
              completed_at: job.completed_at,
              last_error: job.last_error,
            }
          : null,
        has_transcript: job?.has_transcript ?? false,
      });
    }

    items.sort((x, y) => y.created_at.localeCompare(x.created_at));

    // Arricchimento dimensione file: per gli assets file_size_bytes puo'
    // essere NULL (rows storici), per gli event_group_attachments la colonna
    // non esiste proprio. Probe via Storage API con service role: bypassa
    // RLS e CORS, e funziona anche su bucket privati.
    await enrichWithFileSize(supabase, items);

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('Errore GET /api/admin/audio/list:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli audio' },
      { status: 500 },
    );
  }
}

const STORAGE_BUCKET = 'assets';
const SIZE_PROBE_CONCURRENCY = 10;

/**
 * Popola `file_size_bytes` per gli item che non l'hanno usando la Storage
 * REST API con service-role (bypassa RLS, funziona anche su bucket privati,
 * niente CORS). Best-effort: errori per singolo file vengono silenziati e
 * l'item resta con size null.
 */
async function enrichWithFileSize(
  supabase: ReturnType<typeof createServiceRoleClient>,
  items: AudioSourceListItem[],
): Promise<void> {
  const targets = items.filter(
    (it) => !it.file_size_bytes || it.file_size_bytes <= 0,
  );
  if (targets.length === 0) return;

  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const item = targets[cursor++];
      const path = extractStoragePath(item.file_url);
      if (!path) continue;
      try {
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKET)
          .info(path);
        if (error || !data) continue;
        // storage-js v2 espone la size come `size` sull'oggetto FileObjectV2.
        const size = (data as { size?: number }).size;
        if (typeof size === 'number' && size > 0) {
          item.file_size_bytes = size;
        }
      } catch {
        // ignora: best-effort
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(SIZE_PROBE_CONCURRENCY, targets.length) },
      () => worker(),
    ),
  );
}
