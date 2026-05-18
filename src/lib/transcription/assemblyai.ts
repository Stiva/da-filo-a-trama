/**
 * Client minimale per AssemblyAI.
 * https://www.assemblyai.com/docs/api-reference/transcripts
 *
 * Modello async-by-default: si fornisce un URL pubblicamente raggiungibile
 * dell'audio (signed URL di Supabase Storage) e un webhook_url; il provider
 * scarica il file, esegue la trascrizione e chiama il webhook a completamento.
 */

const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

export interface AssemblyAISubmitParams {
  audioUrl: string;
  language: string;        // 'it'
  diarization: boolean;
  webhookUrl: string;
  webhookAuthHeaderName?: string;
  webhookAuthHeaderValue?: string;
}

export interface AssemblyAIJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  error?: string | null;
}

export interface AssemblyAIWord {
  start: number;
  end: number;
  text: string;
  confidence: number;
  speaker?: string | null;
}

export interface AssemblyAIUtterance {
  start: number;
  end: number;
  text: string;
  confidence: number;
  speaker?: string | null;
}

export interface AssemblyAITranscript {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text: string | null;
  language_code: string | null;
  audio_duration: number | null;
  confidence: number | null;
  words: AssemblyAIWord[] | null;
  utterances: AssemblyAIUtterance[] | null;
  error?: string | null;
}

function apiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    throw new Error('ASSEMBLYAI_API_KEY non configurata');
  }
  return key;
}

/**
 * Crea un job di trascrizione. Il provider scaricherà l'audio da `audio_url`.
 */
export async function submitTranscriptionJob(
  params: AssemblyAISubmitParams,
): Promise<AssemblyAIJob> {
  const body: Record<string, unknown> = {
    audio_url: params.audioUrl,
    language_code: params.language,
    speaker_labels: params.diarization,
    punctuate: true,
    format_text: true,
    webhook_url: params.webhookUrl,
  };

  if (params.webhookAuthHeaderName && params.webhookAuthHeaderValue) {
    body.webhook_auth_header_name = params.webhookAuthHeaderName;
    body.webhook_auth_header_value = params.webhookAuthHeaderValue;
  }

  const res = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript`, {
    method: 'POST',
    headers: {
      Authorization: apiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `AssemblyAI submit failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const json = (await res.json()) as AssemblyAIJob;
  return json;
}

/** Recupera lo stato/risultato di un job. */
export async function fetchTranscript(
  jobId: string,
): Promise<AssemblyAITranscript> {
  const res = await fetch(`${ASSEMBLYAI_BASE_URL}/transcript/${jobId}`, {
    headers: { Authorization: apiKey() },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `AssemblyAI fetch failed (${res.status}): ${text || res.statusText}`,
    );
  }

  return (await res.json()) as AssemblyAITranscript;
}
