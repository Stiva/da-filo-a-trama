import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/transcription/adminAuth';
import { looksLikeAudioFile } from '@/lib/transcription/jobs';
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
      const { data: jobsData, error: jobsError } = await supabase
        .from('audio_transcription_jobs')
        .select(
          'id, source_type, source_id, status, created_at, completed_at, last_error, audio_transcripts(id, duration_seconds)',
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
        audio_transcripts:
          | { id: string; duration_seconds: number | null }[]
          | null;
      };

      const rows = (jobsData ?? []) as unknown as JobRow[];
      jobsBySource = new Map();
      for (const j of rows) {
        const key = `${j.source_type}:${j.source_id}`;
        if (!jobsBySource.has(key)) {
          jobsBySource.set(key, {
            id: j.id,
            status: j.status,
            created_at: j.created_at,
            completed_at: j.completed_at,
            last_error: j.last_error,
            has_transcript: (j.audio_transcripts?.length ?? 0) > 0,
            duration_seconds: j.audio_transcripts?.[0]?.duration_seconds ?? null,
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

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('Errore GET /api/admin/audio/list:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero degli audio' },
      { status: 500 },
    );
  }
}
