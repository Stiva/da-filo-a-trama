/**
 * Client minimale per AssemblyAI (pre-recorded API).
 * https://www.assemblyai.com/docs/api-reference/transcripts
 *
 * Note pratiche:
 *  - `speech_models` e' obbligatorio (non c'e' default lato API).
 *    Usare una ordered fallback list, es. ['universal-3-pro', 'universal-2'].
 *  - L'header e' "Authorization: <API_KEY>" senza "Bearer ".
 *  - `keyterms_prompt` ha sostituito il vecchio `word_boost`/`boost_param`.
 *  - `prompt` viene usato da Universal-3 Pro come contesto/multilingua.
 */

const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

export type AssemblyAISpeechModel = 'universal-3-pro' | 'universal-2';

export interface AssemblyAISubmitParams {
  audioUrl: string;
  /** Ordered fallback list. Obbligatorio. */
  speechModels: AssemblyAISpeechModel[];
  language: string;        // 'it'
  diarization: boolean;
  webhookUrl: string;
  webhookAuthHeaderName?: string;
  webhookAuthHeaderValue?: string;
  /** Termini di dominio da boostare (sostituisce word_boost). */
  keytermsPrompt?: string[];
  /** Sostituzioni deterministiche pronuncia -> scrittura. */
  customSpelling?: { from: string[]; to: string }[];
  /** Se false (default), rimuove "ehm"/"uhm"/falsi inizi dal testo. */
  disfluencies?: boolean;
  /** Prompt contestuale (U3 Pro). Es. "Transcribe Italian" o contesto libero. */
  prompt?: string;
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
 * Crea un job di trascrizione. Il provider scarichera' l'audio da `audio_url`.
 */
export async function submitTranscriptionJob(
  params: AssemblyAISubmitParams,
): Promise<AssemblyAIJob> {
  if (!params.speechModels || params.speechModels.length === 0) {
    throw new Error('speech_models e\' obbligatorio per AssemblyAI pre-recorded');
  }

  const body: Record<string, unknown> = {
    audio_url: params.audioUrl,
    speech_models: params.speechModels,
    language_code: params.language,
    speaker_labels: params.diarization,
    punctuate: true,
    format_text: true,
    webhook_url: params.webhookUrl,
    disfluencies: params.disfluencies ?? false,
  };

  if (params.webhookAuthHeaderName && params.webhookAuthHeaderValue) {
    body.webhook_auth_header_name = params.webhookAuthHeaderName;
    body.webhook_auth_header_value = params.webhookAuthHeaderValue;
  }

  if (params.keytermsPrompt && params.keytermsPrompt.length > 0) {
    body.keyterms_prompt = params.keytermsPrompt.slice(0, 1000);
  }

  if (params.customSpelling && params.customSpelling.length > 0) {
    body.custom_spelling = params.customSpelling
      .filter((s) => s.to.trim() && s.from.length > 0)
      .map((s) => ({
        from: s.from.map((f) => f.trim()).filter(Boolean),
        to: s.to.trim(),
      }))
      .filter((s) => s.from.length > 0);
  }

  if (params.prompt && params.prompt.trim()) {
    body.prompt = params.prompt.trim();
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
    let detail = text;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      detail = json.error ?? json.message ?? text;
    } catch {
      // body non JSON: mantieni il testo grezzo
    }
    throw new Error(
      `AssemblyAI submit ${res.status} ${res.statusText}: ${detail || '(empty body)'}`,
    );
  }

  return (await res.json()) as AssemblyAIJob;
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
      `AssemblyAI fetch ${res.status} ${res.statusText}: ${text || '(empty body)'}`,
    );
  }

  return (await res.json()) as AssemblyAITranscript;
}
