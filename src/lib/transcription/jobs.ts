import type {
  AudioJobMetadata,
  AudioJobSourceType,
  AudioTranscriptSegment,
} from '@/types/database';
import type {
  AssemblyAITranscript,
  AssemblyAIUtterance,
} from './assemblyai';

const AUDIO_MIME_PREFIXES = ['audio/'];
const AUDIO_EXT_REGEX = /\.(m4a|mp3|mpga|mpeg|wav|aac|ogg|oga|flac|webm)$/i;

export function isAudioMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return AUDIO_MIME_PREFIXES.some((p) => mimeType.toLowerCase().startsWith(p));
}

export function looksLikeAudioFile(
  fileName: string,
  mimeType: string | null | undefined,
): boolean {
  if (isAudioMime(mimeType)) return true;
  return AUDIO_EXT_REGEX.test(fileName);
}

export function buildAudioJobSourceKey(
  sourceType: AudioJobSourceType,
  sourceId: string,
): string {
  return `${sourceType}:${sourceId}`;
}

export function utteranceToSegment(
  u: AssemblyAIUtterance,
): AudioTranscriptSegment {
  return {
    start_ms: Math.round(u.start),
    end_ms: Math.round(u.end),
    text: u.text,
    speaker: u.speaker ?? null,
    confidence: u.confidence ?? null,
  };
}

export function transcriptToSegments(
  t: AssemblyAITranscript,
): AudioTranscriptSegment[] | null {
  if (t.utterances && t.utterances.length > 0) {
    return t.utterances.map(utteranceToSegment);
  }
  return null;
}

/**
 * Costruisce il file .txt di trascrizione "leggibile" che viene caricato
 * come asset derivato. Include i metadati di contesto in testa al file
 * cosi' che qualsiasi tool AI downstream li trovi nello stesso documento.
 */
export function renderTranscriptTextFile(
  metadata: AudioJobMetadata,
  transcript: { text: string; segments: AudioTranscriptSegment[] | null },
): string {
  const lines: string[] = [];

  lines.push('=== METADATI ===');
  if (metadata.event) {
    lines.push(`Evento: ${metadata.event.title}`);
    if (metadata.event.start_time) {
      lines.push(`Data inizio: ${metadata.event.start_time}`);
    }
    if (metadata.event.description) {
      lines.push('');
      lines.push('Descrizione evento:');
      lines.push(metadata.event.description);
    }
  }
  if (metadata.group) {
    lines.push('');
    lines.push(`Gruppo: ${metadata.group.name}`);
  }
  if (metadata.moderators && metadata.moderators.length > 0) {
    lines.push('');
    lines.push('Moderatori:');
    for (const m of metadata.moderators) {
      const name = [m.name, m.surname].filter(Boolean).join(' ').trim();
      const display = name || m.email || m.id;
      lines.push(`- ${display}${m.email && name ? ` <${m.email}>` : ''}`);
    }
  }
  lines.push('');
  lines.push(`File originale: ${metadata.file.name}`);
  lines.push('');
  lines.push('=== TRASCRIZIONE ===');
  lines.push('');

  if (transcript.segments && transcript.segments.length > 0) {
    for (const s of transcript.segments) {
      const ts = formatTimestamp(s.start_ms);
      const speaker = s.speaker ? `[${s.speaker}] ` : '';
      lines.push(`[${ts}] ${speaker}${s.text}`);
    }
  } else {
    lines.push(transcript.text);
  }

  return lines.join('\n');
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
