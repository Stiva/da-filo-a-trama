import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/transcription/adminAuth';
import { looksLikeAudioFile } from '@/lib/transcription/jobs';
import type {
  ApiResponse,
  AssemblyAISpeechModel,
  AudioJobMetadata,
  AudioJobSourceType,
  TranscriptionOptions,
} from '@/types/database';

interface TranscribeRequest {
  items: { source_type: AudioJobSourceType; source_id: string }[];
  options?: TranscriptionOptions;
}

const MAX_KEYTERMS = 1000;
const MAX_TERM_LEN = 100;
const MAX_CUSTOM_SPELLING_ROWS = 200;
const MAX_CONTEXT_NOTES_LEN = 8000;
const VALID_SPEECH_MODELS: AssemblyAISpeechModel[] = [
  'universal-3-pro',
  'universal-2',
];

function sanitizeOptions(input: unknown): TranscriptionOptions {
  const raw = (input ?? {}) as Partial<TranscriptionOptions> & {
    // Backward-compat: client/UI versioni precedenti potrebbero ancora
    // mandare word_boost. Lo trattiamo come keyterms_prompt.
    word_boost?: unknown;
  };
  const out: TranscriptionOptions = {};

  if (Array.isArray(raw.speech_models)) {
    const cleaned = raw.speech_models.filter(
      (s): s is AssemblyAISpeechModel =>
        typeof s === 'string' && VALID_SPEECH_MODELS.includes(s as AssemblyAISpeechModel),
    );
    if (cleaned.length > 0) {
      // De-dup preservando l'ordine.
      out.speech_models = Array.from(new Set(cleaned));
    }
  }

  const keytermsSource = Array.isArray(raw.keyterms_prompt)
    ? raw.keyterms_prompt
    : Array.isArray(raw.word_boost)
      ? (raw.word_boost as unknown[])
      : null;
  if (keytermsSource) {
    const cleaned = keytermsSource
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= MAX_TERM_LEN)
      .slice(0, MAX_KEYTERMS);
    if (cleaned.length > 0) out.keyterms_prompt = Array.from(new Set(cleaned));
  }

  if (Array.isArray(raw.custom_spelling)) {
    const rows = (raw.custom_spelling as unknown[])
      .filter(
        (r): r is { from?: unknown; to?: unknown } =>
          typeof r === 'object' && r !== null,
      )
      .map((r) => {
        const from = Array.isArray(r.from)
          ? (r.from as unknown[])
              .filter((f): f is string => typeof f === 'string')
              .map((f) => f.trim())
              .filter((f) => f.length > 0 && f.length <= MAX_TERM_LEN)
          : [];
        const to = typeof r.to === 'string' ? r.to.trim().slice(0, MAX_TERM_LEN) : '';
        return { from, to };
      })
      .filter((r) => r.from.length > 0 && r.to.length > 0)
      .slice(0, MAX_CUSTOM_SPELLING_ROWS);
    if (rows.length > 0) out.custom_spelling = rows;
  }

  if (typeof raw.disfluencies === 'boolean') {
    out.disfluencies = raw.disfluencies;
  }

  if (typeof raw.prompt === 'string') {
    const trimmed = raw.prompt.trim().slice(0, MAX_CONTEXT_NOTES_LEN);
    if (trimmed) out.prompt = trimmed;
  }

  if (typeof raw.context_notes === 'string') {
    const trimmed = raw.context_notes.trim().slice(0, MAX_CONTEXT_NOTES_LEN);
    if (trimmed) out.context_notes = trimmed;
  }

  return out;
}

interface TranscribeResponseItem {
  source_type: AudioJobSourceType;
  source_id: string;
  job_id?: string;
  status?: 'created' | 'already_active';
  error?: string;
}

/**
 * POST /api/admin/audio/transcribe
 * Crea uno o piu' job di trascrizione in stato 'pending'. Il cron li raccogliera'
 * e li sottometterà al provider. Le sorgenti sono identificate da
 * (source_type, source_id).
 *
 * Snapshot dei metadati di contesto (evento, gruppo, moderatori, descrizione,
 * file) viene salvato nel job per uso downstream da pipeline AI.
 */
export async function POST(
  request: Request,
): Promise<NextResponse<ApiResponse<TranscribeResponseItem[]>>> {
  const authResult = await requireAdmin();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  let body: TranscribeRequest;
  try {
    body = (await request.json()) as TranscribeRequest;
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: 'items deve essere un array non vuoto' },
      { status: 400 },
    );
  }
  if (body.items.length > 200) {
    return NextResponse.json(
      { error: 'Massimo 200 audio per richiesta' },
      { status: 400 },
    );
  }

  const options = sanitizeOptions(body.options);

  const supabase = createServiceRoleClient();

  // Risolvi clerk_id -> profile_id per created_by
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_id', authResult.userId)
    .single();
  const createdBy = (profile as { id: string } | null)?.id ?? null;

  const results: TranscribeResponseItem[] = [];

  for (const item of body.items) {
    try {
      const metadata = await buildMetadataSnapshot(
        supabase,
        item.source_type,
        item.source_id,
      );

      if (!metadata) {
        results.push({
          ...item,
          error: 'Sorgente audio non trovata',
        });
        continue;
      }

      // Allega le opzioni di trascrizione alla snapshot di metadati: cosi'
      // il cron le ritrova al momento del submit al provider e restano
      // tracciate nella riga del job per audit.
      if (Object.keys(options).length > 0) {
        metadata.options = options;
      }

      if (!looksLikeAudioFile(metadata.file.name, metadata.file.mime_type)) {
        results.push({
          ...item,
          error: 'Il file non sembra essere un audio',
        });
        continue;
      }

      // Tentiamo l'insert. Il filtered unique index su (source_type, source_id)
      // WHERE status IN ('pending','processing') previene duplicati attivi.
      const insertPayload = {
        source_type: item.source_type,
        source_id: item.source_id,
        asset_id: item.source_type === 'asset' ? item.source_id : null,
        group_attachment_id:
          item.source_type === 'group_attachment' ? item.source_id : null,
        event_id: metadata.event?.id ?? null,
        group_id: metadata.group?.id ?? null,
        provider: 'assemblyai',
        status: 'pending' as const,
        language: 'it',
        diarization: true,
        metadata: metadata as unknown as Record<string, unknown>,
        created_by: createdBy,
      };

      const { data: inserted, error: insertError } = await supabase
        .from('audio_transcription_jobs')
        .insert(insertPayload)
        .select('id')
        .single();

      if (insertError) {
        // Conflitto sul filtered unique index = c'e' gia' un job attivo.
        if (insertError.code === '23505') {
          const { data: existing } = await supabase
            .from('audio_transcription_jobs')
            .select('id')
            .eq('source_type', item.source_type)
            .eq('source_id', item.source_id)
            .in('status', ['pending', 'processing'])
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          results.push({
            ...item,
            job_id: (existing as { id: string } | null)?.id,
            status: 'already_active',
          });
          continue;
        }
        throw insertError;
      }

      results.push({
        ...item,
        job_id: (inserted as { id: string }).id,
        status: 'created',
      });
    } catch (err) {
      console.error('transcribe: errore item', item, err);
      results.push({
        ...item,
        error: err instanceof Error ? err.message : 'Errore sconosciuto',
      });
    }
  }

  return NextResponse.json({ data: results });
}

async function buildMetadataSnapshot(
  supabase: ReturnType<typeof createServiceRoleClient>,
  sourceType: AudioJobSourceType,
  sourceId: string,
): Promise<AudioJobMetadata | null> {
  if (sourceType === 'asset') {
    const { data, error } = await supabase
      .from('assets')
      .select(
        'id, file_url, file_name, file_size_bytes, mime_type, event_id, events(id, title, description, category, start_time, end_time)',
      )
      .eq('id', sourceId)
      .single();
    if (error || !data) return null;

    type R = {
      id: string;
      file_url: string;
      file_name: string;
      file_size_bytes: number | null;
      mime_type: string | null;
      event_id: string | null;
      events: {
        id: string;
        title: string;
        description: string | null;
        category: string | null;
        start_time: string | null;
        end_time: string | null;
      } | null;
    };
    const a = data as unknown as R;

    return {
      event: a.events
        ? {
            id: a.events.id,
            title: a.events.title,
            description: a.events.description,
            category: a.events.category,
            start_time: a.events.start_time,
            end_time: a.events.end_time,
          }
        : null,
      group: null,
      moderators: [],
      file: {
        name: a.file_name,
        size_bytes: a.file_size_bytes,
        mime_type: a.mime_type,
        url: a.file_url,
      },
    };
  }

  // group_attachment
  const { data, error } = await supabase
    .from('event_group_attachments')
    .select(
      'id, file_name, file_url, group_id, event_groups(id, name, event_id, events(id, title, description, category, start_time, end_time))',
    )
    .eq('id', sourceId)
    .single();
  if (error || !data) return null;

  type R = {
    id: string;
    file_name: string;
    file_url: string;
    group_id: string;
    event_groups: {
      id: string;
      name: string;
      event_id: string;
      events: {
        id: string;
        title: string;
        description: string | null;
        category: string | null;
        start_time: string | null;
        end_time: string | null;
      } | null;
    } | null;
  };
  const att = data as unknown as R;

  // Moderatori del gruppo
  const { data: modsData } = await supabase
    .from('event_group_moderators')
    .select('user_id, profiles(id, name, surname, email)')
    .eq('group_id', att.group_id);

  type ModRow = {
    user_id: string;
    profiles: {
      id: string;
      name: string | null;
      surname: string | null;
      email: string;
    } | null;
  };

  const mods = ((modsData ?? []) as unknown as ModRow[])
    .map((m) => m.profiles)
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      surname: p.surname,
      email: p.email,
    }));

  return {
    event: att.event_groups?.events
      ? {
          id: att.event_groups.events.id,
          title: att.event_groups.events.title,
          description: att.event_groups.events.description,
          category: att.event_groups.events.category,
          start_time: att.event_groups.events.start_time,
          end_time: att.event_groups.events.end_time,
        }
      : null,
    group: att.event_groups
      ? { id: att.event_groups.id, name: att.event_groups.name }
      : null,
    moderators: mods,
    file: {
      name: att.file_name,
      size_bytes: null,
      mime_type: null,
      url: att.file_url,
    },
  };
}
