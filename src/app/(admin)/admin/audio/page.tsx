'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AssemblyAISpeechModel,
  AudioJobStatus,
  AudioSourceListItem,
  AudioTranscript,
  AudioTranscriptionJob,
  TranscriptionOptions,
} from '@/types/database';

type SpeechModelPreset = 'auto' | 'u3-pro' | 'u2';

const SPEECH_MODEL_OPTIONS: {
  value: SpeechModelPreset;
  label: string;
  description: string;
  models: AssemblyAISpeechModel[];
}[] = [
  {
    value: 'auto',
    label: 'Universal-3 Pro → Universal-2 (consigliato)',
    description:
      'Tenta U3 Pro per primo (qualità e supporto multilingua migliori) e ripiega su U2 se non disponibile.',
    models: ['universal-3-pro', 'universal-2'],
  },
  {
    value: 'u3-pro',
    label: 'Solo Universal-3 Pro',
    description: 'Ultimo modello AssemblyAI. Migliore su parlato spontaneo e termini di dominio.',
    models: ['universal-3-pro'],
  },
  {
    value: 'u2',
    label: 'Solo Universal-2',
    description: 'Modello stabile precedente. Più collaudato.',
    models: ['universal-2'],
  },
];

const STATUS_LABEL: Record<AudioJobStatus, string> = {
  pending: 'In coda',
  processing: 'In elaborazione',
  completed: 'Completato',
  failed: 'Errore',
  cancelled: 'Annullato',
};

const STATUS_COLOR: Record<AudioJobStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

type SourceFilter = 'all' | 'asset' | 'group_attachment';
type TranscriptFilter = 'all' | 'with' | 'without' | 'in_progress';

// Stima della durata da dimensione file: m4a tipico ~128 kbps ≈ 1 MB/min.
// Fallback usato quando il probe del browser fallisce (es. CORS).
const ESTIMATED_BYTES_PER_SECOND = (128 * 1000) / 8; // 16 KB/s

// Prezzo listino AssemblyAI Universal: $0.37 / ora = $0.00617 / min.
// Mantenuto qui come costante: in futuro spostarlo in app_settings.
const ASSEMBLYAI_USD_PER_HOUR = 0.37;
const USD_TO_EUR = 0.92;

const AGESCI_DEFAULT_WORDS = [
  'AGESCI',
  'branca L/C',
  'lupetti',
  'coccinelle',
  'branco',
  'cerchio',
  'Akela',
  'Arcanda',
  'Bagheera',
  'Baloo',
  'Capo branco',
  'Capo cerchio',
  'consiglio della rupe',
  'consiglio della grande quercia',
  'caccia',
  'volo',
  'totem',
  'fazzolettone',
  'promessa',
  'Legge',
];

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

interface ProbedMeta {
  duration: number | null;
  sizeBytes: number | null;
}

function resolveSize(
  item: AudioSourceListItem,
  probed: ProbedMeta | undefined,
): number | null {
  if (item.file_size_bytes && item.file_size_bytes > 0) return item.file_size_bytes;
  if (probed?.sizeBytes && probed.sizeBytes > 0) return probed.sizeBytes;
  return null;
}

function estimateSeconds(
  item: AudioSourceListItem,
  probed: ProbedMeta | undefined,
): number | null {
  if (probed?.duration != null) return probed.duration;
  if (item.known_duration_seconds != null) return item.known_duration_seconds;
  const size = resolveSize(item, probed);
  if (size != null) return size / ESTIMATED_BYTES_PER_SECOND;
  return null;
}

/**
 * Probe parallelo di durata e dimensione di un audio remoto.
 *  - Durata: <audio preload="metadata"> carica solo i pochi KB di header
 *    del contenitore (M4A/MP3/...).
 *  - Dimensione: HEAD sul file URL, header Content-Length. E' una
 *    "CORS-safelisted response header" quindi non richiede expose-headers.
 * Entrambe le probe falliscono in modo silenzioso (CORS, 4xx, timeout):
 * in quel caso il rispettivo campo resta null e la UI mostra un placeholder.
 */
function probeAudioMeta(url: string, timeoutMs = 15000): Promise<ProbedMeta> {
  return new Promise((resolve) => {
    let pending = 2;
    let duration: number | null = null;
    let sizeBytes: number | null = null;
    let settled = false;

    const audio = document.createElement('audio');

    const finish = () => {
      pending -= 1;
      if (pending <= 0 && !settled) {
        settled = true;
        try {
          audio.src = '';
          audio.removeAttribute('src');
        } catch {
          // ignore
        }
        resolve({ duration, sizeBytes });
      }
    };

    audio.preload = 'metadata';
    audio.muted = true;
    audio.addEventListener('loadedmetadata', () => {
      duration = Number.isFinite(audio.duration) ? audio.duration : null;
      finish();
    });
    audio.addEventListener('error', () => finish());
    audio.src = url;

    fetch(url, { method: 'HEAD' })
      .then((r) => {
        if (!r.ok) return;
        const len = r.headers.get('content-length');
        const parsed = len ? parseInt(len, 10) : NaN;
        if (Number.isFinite(parsed) && parsed > 0) sizeBytes = parsed;
      })
      .catch(() => {
        // ignore CORS/network errors
      })
      .finally(finish);

    setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        audio.src = '';
        audio.removeAttribute('src');
      } catch {
        // ignore
      }
      resolve({ duration, sizeBytes });
    }, timeoutMs);
  });
}

export default function AdminAudioPage() {
  const [items, setItems] = useState<AudioSourceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const [filterSource, setFilterSource] = useState<SourceFilter>('all');
  const [filterTranscript, setFilterTranscript] = useState<TranscriptFilter>('all');
  const [filterText, setFilterText] = useState('');

  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Metadati probed (durata + dimensione) per ciascun item. Persiste in
  // memoria per la sessione UI.
  const [probedMeta, setProbedMeta] = useState<Map<string, ProbedMeta>>(new Map());
  const probeInflightRef = useRef<Set<string>>(new Set());

  const keyOf = useCallback(
    (i: AudioSourceListItem) => `${i.source_type}:${i.source_id}`,
    [],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/audio/list');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore caricamento');
      setItems((data.data ?? []) as AudioSourceListItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Probe durata+dimensione in parallelo con concorrenza limitata. Per ogni
  // item proviamo a colmare i metadati che non abbiamo gia' dal server
  // (known_duration_seconds dal transcript, file_size_bytes dalla riga
  // assets). I gruppi-attachment non hanno mai size lato DB, quindi vanno
  // sempre probed.
  useEffect(() => {
    let cancelled = false;

    async function runProbes() {
      const queue = items.filter((i) => {
        const k = keyOf(i);
        if (probedMeta.has(k) || probeInflightRef.current.has(k)) return false;
        const needsDuration = i.known_duration_seconds == null;
        const needsSize = !i.file_size_bytes || i.file_size_bytes <= 0;
        return needsDuration || needsSize;
      });

      const CONCURRENCY = 4;
      let idx = 0;

      async function worker() {
        while (!cancelled && idx < queue.length) {
          const item = queue[idx++];
          const k = keyOf(item);
          probeInflightRef.current.add(k);
          const meta = await probeAudioMeta(item.file_url);
          probeInflightRef.current.delete(k);
          if (cancelled) return;
          setProbedMeta((prev) => {
            const next = new Map(prev);
            next.set(k, meta);
            return next;
          });
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()),
      );
    }

    runProbes();
    return () => {
      cancelled = true;
    };
  }, [items, keyOf, probedMeta]);

  // Auto-refresh while there are jobs in progress.
  useEffect(() => {
    const hasInProgress = items.some(
      (i) =>
        i.latest_job &&
        (i.latest_job.status === 'pending' || i.latest_job.status === 'processing'),
    );
    if (!hasInProgress) return;
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [items, refresh]);

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      if (filterSource !== 'all' && i.source_type !== filterSource) return false;
      if (filterTranscript === 'with' && !i.has_transcript) return false;
      if (
        filterTranscript === 'without' &&
        (i.has_transcript ||
          i.latest_job?.status === 'processing' ||
          i.latest_job?.status === 'pending')
      )
        return false;
      if (filterTranscript === 'in_progress') {
        const s = i.latest_job?.status;
        if (s !== 'pending' && s !== 'processing') return false;
      }
      if (filterText) {
        const q = filterText.toLowerCase();
        const hay = [i.file_name, i.event_title ?? '', i.group_name ?? '']
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filterSource, filterTranscript, filterText]);

  const selectableItems = filteredItems.filter(
    (i) =>
      !i.latest_job ||
      i.latest_job.status === 'failed' ||
      i.latest_job.status === 'cancelled',
  );
  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every((i) => selectedKeys.has(keyOf(i)));

  const selectedItems = useMemo(
    () => items.filter((i) => selectedKeys.has(keyOf(i))),
    [items, selectedKeys, keyOf],
  );

  // Totale minuti / costo stimato sulla selezione corrente.
  const totals = useMemo(() => {
    let totalSeconds = 0;
    let estimatedCount = 0;
    let exactCount = 0;
    let unknownCount = 0;

    for (const it of selectedItems) {
      const probed = probedMeta.get(keyOf(it));
      const dur = estimateSeconds(it, probed);
      if (dur == null) {
        unknownCount += 1;
        continue;
      }
      totalSeconds += dur;
      if (probed?.duration != null || it.known_duration_seconds != null) {
        exactCount += 1;
      } else {
        estimatedCount += 1;
      }
    }

    const totalHours = totalSeconds / 3600;
    const costUsd = totalHours * ASSEMBLYAI_USD_PER_HOUR;
    const costEur = costUsd * USD_TO_EUR;

    return {
      totalSeconds,
      totalMinutes: totalSeconds / 60,
      costUsd,
      costEur,
      estimatedCount,
      exactCount,
      unknownCount,
    };
  }, [selectedItems, probedMeta, keyOf]);

  const toggleAll = () => {
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(selectableItems.map(keyOf)));
    }
  };

  const toggleOne = (i: AudioSourceListItem) => {
    const k = keyOf(i);
    const next = new Set(selectedKeys);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setSelectedKeys(next);
  };

  const submitWithOptions = async (options: TranscriptionOptions) => {
    if (selectedKeys.size === 0) return;
    setIsSubmitting(true);
    setSubmitMessage(null);
    try {
      const payload = {
        items: Array.from(selectedKeys).map((k) => {
          const [source_type, source_id] = k.split(':') as [
            'asset' | 'group_attachment',
            string,
          ];
          return { source_type, source_id };
        }),
        options,
      };
      const res = await fetch('/api/admin/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore invio');
      const ok = (data.data as { status?: string }[]).filter(
        (r) => r.status === 'created',
      ).length;
      const already = (data.data as { status?: string }[]).filter(
        (r) => r.status === 'already_active',
      ).length;
      const errs = (data.data as { error?: string }[]).filter((r) => r.error).length;
      setSubmitMessage(
        `Job creati: ${ok}${already ? ` · gia' attivi: ${already}` : ''}${errs ? ` · errori: ${errs}` : ''}`,
      );
      setSelectedKeys(new Set());
      setShowSubmitModal(false);
      await refresh();
    } catch (e) {
      setSubmitMessage(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isProcessingNow, setIsProcessingNow] = useState(false);

  const processPendingNow = async () => {
    setIsProcessingNow(true);
    setSubmitMessage(null);
    try {
      const res = await fetch('/api/admin/audio/process-pending', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore esecuzione');
      const r = data.data as {
        considered: number;
        submitted: number;
        failed: number;
        errors: { jobId: string; error: string }[];
      };
      const parts = [
        `Considerati: ${r.considered}`,
        `inviati: ${r.submitted}`,
      ];
      if (r.failed > 0) parts.push(`falliti: ${r.failed}`);
      let msg = parts.join(' · ');
      if (r.errors.length > 0) {
        msg += ` — primo errore: ${r.errors[0].error}`;
      }
      setSubmitMessage(msg);
      await refresh();
    } catch (e) {
      setSubmitMessage(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setIsProcessingNow(false);
    }
  };

  const retryJob = async (jobId: string) => {
    const res = await fetch(`/api/admin/audio/jobs/${jobId}/retry`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Retry fallito');
      return;
    }
    await refresh();
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Eliminare il job e (se presente) la trascrizione associata?')) return;
    const res = await fetch(`/api/admin/audio/jobs/${jobId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? 'Eliminazione fallita');
      return;
    }
    await refresh();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trascrizione Audio</h1>
          <p className="text-gray-600 mt-1">
            Invia gli audio caricati al servizio AI di speech-to-text e gestisci le
            trascrizioni con i metadati di contesto (evento, gruppo, moderatori).
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300"
        >
          Aggiorna
        </button>
      </div>

      {/* Filtri */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sorgente</label>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as SourceFilter)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="all">Tutte</option>
            <option value="asset">Asset di evento</option>
            <option value="group_attachment">Allegati gruppi workshop</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Stato trascrizione
          </label>
          <select
            value={filterTranscript}
            onChange={(e) => setFilterTranscript(e.target.value as TranscriptFilter)}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="all">Tutti</option>
            <option value="without">Da trascrivere</option>
            <option value="in_progress">In corso</option>
            <option value="with">Con transcript</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">Cerca</label>
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Nome file, evento, gruppo…"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={isSubmitting || selectedKeys.size === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
          >
            Configura e trascrivi ({selectedKeys.size})
          </button>
          <button
            onClick={processPendingNow}
            disabled={isProcessingNow}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 disabled:opacity-50"
            title="Esegue subito il worker che invia i job 'in coda' ad AssemblyAI. Utile per non aspettare il prossimo tick del cron (ogni 5 min)."
          >
            {isProcessingNow ? 'Esecuzione…' : 'Esegui pending ora'}
          </button>
          {submitMessage && (
            <span className="text-sm text-gray-700">{submitMessage}</span>
          )}
        </div>
        {selectedKeys.size > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-sm flex flex-wrap gap-x-6 gap-y-1 text-gray-700">
            <div>
              <span className="text-gray-500">Audio selezionati:</span>{' '}
              <span className="font-medium">{selectedKeys.size}</span>
            </div>
            <div>
              <span className="text-gray-500">Durata totale:</span>{' '}
              <span className="font-medium">
                {totals.unknownCount > 0
                  ? `~${formatDuration(totals.totalSeconds)} (${totals.unknownCount} non stimabili)`
                  : `${formatDuration(totals.totalSeconds)}`}
              </span>
              {totals.estimatedCount > 0 && (
                <span className="text-xs text-gray-500 ml-1">
                  (di cui {totals.estimatedCount} stimat{totals.estimatedCount === 1 ? 'o' : 'i'})
                </span>
              )}
            </div>
            <div>
              <span className="text-gray-500">Costo stimato:</span>{' '}
              <span className="font-medium">
                ${totals.costUsd.toFixed(2)} (~€{totals.costEur.toFixed(2)})
              </span>
              <span
                className="text-xs text-gray-500 ml-1"
                title={`AssemblyAI Universal $${ASSEMBLYAI_USD_PER_HOUR}/h`}
              >
                ⓘ
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Tabella */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}
      {isLoading ? (
        <div className="text-gray-500">Caricamento…</div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          Nessun audio trovato.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Seleziona tutto"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">File</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Contesto</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Durata</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Dimensione</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Stato</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((i) => {
                const k = keyOf(i);
                const isSelectable =
                  !i.latest_job ||
                  i.latest_job.status === 'failed' ||
                  i.latest_job.status === 'cancelled';
                const probed = probedMeta.get(k);
                const dur = estimateSeconds(i, probed);
                const isExact = probed?.duration != null || i.known_duration_seconds != null;
                const sizeBytes = resolveSize(i, probed);
                return (
                  <tr key={k} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(k)}
                        onChange={() => toggleOne(i)}
                        disabled={!isSelectable}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 flex items-center gap-2">
                        <span>🎵</span>
                        <span className="truncate max-w-[280px]" title={i.file_name}>
                          {i.file_name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {i.source_type === 'asset' ? 'Asset' : 'Allegato gruppo'} ·{' '}
                        {formatDate(i.created_at)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {i.event_title && <div>📅 {i.event_title}</div>}
                      {i.group_name && (
                        <div className="text-xs text-gray-500">👥 {i.group_name}</div>
                      )}
                      {!i.event_title && !i.group_name && (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {dur != null
                        ? `${isExact ? '' : '~'}${formatDuration(dur)}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {formatBytes(sizeBytes)}
                    </td>
                    <td className="px-3 py-2">
                      {i.latest_job ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[i.latest_job.status]}`}
                          title={i.latest_job.last_error ?? undefined}
                        >
                          {STATUS_LABEL[i.latest_job.status]}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">— mai trascritto</span>
                      )}
                      {i.latest_job?.last_error && (
                        <div
                          className="text-xs text-red-600 mt-1 truncate max-w-[200px]"
                          title={i.latest_job.last_error}
                        >
                          {i.latest_job.last_error}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={i.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs px-2 py-1 text-gray-600 hover:text-gray-900"
                          title="Ascolta audio"
                        >
                          ▶
                        </a>
                        {i.latest_job && i.has_transcript && (
                          <button
                            onClick={() => setDetailJobId(i.latest_job!.id)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                          >
                            Vedi trascrizione
                          </button>
                        )}
                        {i.latest_job?.status === 'failed' && (
                          <button
                            onClick={() => retryJob(i.latest_job!.id)}
                            className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                          >
                            Riprova
                          </button>
                        )}
                        {i.latest_job && (
                          <button
                            onClick={() => deleteJob(i.latest_job!.id)}
                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                            title="Elimina job"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailJobId && (
        <TranscriptDrawer
          jobId={detailJobId}
          onClose={() => setDetailJobId(null)}
        />
      )}

      {showSubmitModal && (
        <SubmitModal
          selectedItems={selectedItems}
          totals={totals}
          isSubmitting={isSubmitting}
          onCancel={() => setShowSubmitModal(false)}
          onSubmit={submitWithOptions}
        />
      )}
    </div>
  );
}

// ============================================
// SUBMIT MODAL: configurazione opzioni + conferma invio
// ============================================
function SubmitModal({
  selectedItems,
  totals,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  selectedItems: AudioSourceListItem[];
  totals: {
    totalSeconds: number;
    costUsd: number;
    costEur: number;
    estimatedCount: number;
    exactCount: number;
    unknownCount: number;
  };
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (options: TranscriptionOptions) => void;
}) {
  const [modelPreset, setModelPreset] = useState<SpeechModelPreset>('auto');
  const [keyterms, setKeyterms] = useState<string[]>([]);
  const [keytermsInput, setKeytermsInput] = useState('');
  const [disfluencies, setDisfluencies] = useState(false);
  const [contextNotes, setContextNotes] = useState('');
  const [customSpelling, setCustomSpelling] = useState<{ from: string; to: string }[]>([]);
  const [usePromptAsContext, setUsePromptAsContext] = useState(true);

  const selectedModel = SPEECH_MODEL_OPTIONS.find((o) => o.value === modelPreset)!;
  // U2 ha un limite di 200 keyterms; U3 Pro fino a 1000.
  const maxKeyterms = selectedModel.models.includes('universal-3-pro') ? 1000 : 200;

  // Suggerimenti dal contesto degli item selezionati.
  const suggestions = useMemo(() => {
    const set = new Set<string>();
    for (const it of selectedItems) {
      // Parole capitalizzate dal titolo evento.
      if (it.event_title) {
        for (const w of it.event_title.match(/[A-ZÀ-Ý][a-zà-ý][a-zà-ý]+/g) ?? []) {
          set.add(w);
        }
      }
      // Nome gruppo.
      if (it.group_name) set.add(it.group_name);
      // Nomi moderatori.
      for (const m of it.moderators ?? []) {
        if (m.name) set.add(m.name);
        if (m.surname) set.add(m.surname);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'it'));
  }, [selectedItems]);

  const addKeyterm = (w: string) => {
    const clean = w.trim();
    if (!clean) return;
    setKeyterms((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
    setKeytermsInput('');
  };

  const removeKeyterm = (w: string) => {
    setKeyterms((prev) => prev.filter((x) => x !== w));
  };

  const loadAgesciPreset = () => {
    setKeyterms((prev) => {
      const next = new Set(prev);
      for (const w of AGESCI_DEFAULT_WORDS) next.add(w);
      return Array.from(next);
    });
  };

  const loadFromSuggestions = () => {
    setKeyterms((prev) => {
      const next = new Set(prev);
      for (const w of suggestions) next.add(w);
      return Array.from(next);
    });
  };

  const addSpellingRow = () => {
    setCustomSpelling((prev) => [...prev, { from: '', to: '' }]);
  };
  const updateSpellingRow = (i: number, patch: Partial<{ from: string; to: string }>) => {
    setCustomSpelling((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    );
  };
  const removeSpellingRow = (i: number) => {
    setCustomSpelling((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = () => {
    const options: TranscriptionOptions = {
      speech_models: selectedModel.models,
    };
    if (keyterms.length > 0) {
      options.keyterms_prompt = keyterms.slice(0, maxKeyterms);
    }
    if (disfluencies) options.disfluencies = true;
    if (contextNotes.trim()) {
      options.context_notes = contextNotes.trim();
      // Quando l'utente lo richiede, passiamo anche al provider come prompt
      // (utile soprattutto su U3 Pro per il contesto multilingua / di
      // dominio). Per default è attivo: l'utente puo' disattivarlo se vuole
      // solo annotare per i tool downstream.
      if (usePromptAsContext) {
        options.prompt = contextNotes.trim();
      }
    }
    const spelling = customSpelling
      .map((r) => ({
        from: r.from
          .split(/[,;|]/)
          .map((s) => s.trim())
          .filter(Boolean),
        to: r.to.trim(),
      }))
      .filter((r) => r.from.length > 0 && r.to);
    if (spelling.length > 0) options.custom_spelling = spelling;
    onSubmit(options);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Configura e invia trascrizione
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Le opzioni sotto vengono passate ad AssemblyAI per migliorare la qualità
            della trascrizione. Restano salvate nei metadati del job per audit.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Riepilogo */}
          <section className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Riepilogo</h3>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-gray-500 text-xs">Audio</div>
                <div className="font-medium">{selectedItems.length}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Durata totale</div>
                <div className="font-medium">
                  {totals.unknownCount > 0 ? '~' : ''}
                  {formatDuration(totals.totalSeconds)}
                  {totals.unknownCount > 0 && (
                    <span className="text-xs text-gray-500 ml-1">
                      ({totals.unknownCount} senza stima)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs">Costo stimato</div>
                <div className="font-medium">
                  ${totals.costUsd.toFixed(2)}{' '}
                  <span className="text-xs text-gray-500">
                    (~€{totals.costEur.toFixed(2)})
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Listino AssemblyAI Universal: $0.37/h. Le durate stimate da dimensione
              file possono variare a seconda del bitrate reale del file.
            </p>
          </section>

          {/* Modello */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Modello AssemblyAI
            </h3>
            <div className="space-y-2">
              {SPEECH_MODEL_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex gap-3 p-3 rounded border cursor-pointer ${
                    modelPreset === opt.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="speech-model"
                    checked={modelPreset === opt.value}
                    onChange={() => setModelPreset(opt.value)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {opt.description}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 font-mono">
                      speech_models: [{opt.models.map((m) => `"${m}"`).join(', ')}]
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Keyterms prompt */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Termini chiave (keyterms_prompt)
              </h3>
              <div className="flex gap-2">
                {suggestions.length > 0 && (
                  <button
                    onClick={loadFromSuggestions}
                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                  >
                    + Da metadati ({suggestions.length})
                  </button>
                )}
                <button
                  onClick={loadAgesciPreset}
                  className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                >
                  + Preset AGESCI
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Termini specifici (nomi propri, sigle, gergo) che il decoder potrebbe
              sbagliare. Es: nomi dei moderatori, &quot;AGESCI&quot;, &quot;branca
              L/C&quot;.
            </p>
            <div className="border border-gray-300 rounded p-2 min-h-[80px] flex flex-wrap gap-1.5">
              {keyterms.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs"
                >
                  {w}
                  <button
                    onClick={() => removeKeyterm(w)}
                    className="hover:text-blue-900"
                    aria-label={`Rimuovi ${w}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={keytermsInput}
                onChange={(e) => setKeytermsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addKeyterm(keytermsInput);
                  } else if (
                    e.key === 'Backspace' &&
                    keytermsInput === '' &&
                    keyterms.length > 0
                  ) {
                    removeKeyterm(keyterms[keyterms.length - 1]);
                  }
                }}
                placeholder={keyterms.length === 0 ? 'Aggiungi termini (Invio)' : ''}
                className="flex-1 min-w-[150px] outline-none text-sm"
              />
            </div>
            {keyterms.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                {keyterms.length}/{maxKeyterms} termini
                {keyterms.length > maxKeyterms && (
                  <span className="text-red-600 ml-2">
                    I termini oltre il limite verranno scartati.
                  </span>
                )}
              </div>
            )}
          </section>

          {/* Custom spelling */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Spelling personalizzato
              </h3>
              <button
                onClick={addSpellingRow}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                + Aggiungi
              </button>
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Quando il modello scrive una parola in modo sbagliato, mappala alla
              versione corretta. Più alternative separate da virgola. Es: &quot;ajeshi,
              agesh&quot; → &quot;AGESCI&quot;.
            </p>
            {customSpelling.length === 0 ? (
              <div className="text-xs text-gray-400 italic">Nessuna sostituzione.</div>
            ) : (
              <div className="space-y-2">
                {customSpelling.map((r, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={r.from}
                      onChange={(e) => updateSpellingRow(i, { from: e.target.value })}
                      placeholder="trascritto come (separati da virgola)"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <span className="text-gray-400">→</span>
                    <input
                      type="text"
                      value={r.to}
                      onChange={(e) => updateSpellingRow(i, { to: e.target.value })}
                      placeholder="spelling corretto"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => removeSpellingRow(i)}
                      className="text-red-600 hover:bg-red-50 rounded px-2 py-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Disfluencies */}
          <section>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={disfluencies}
                onChange={(e) => setDisfluencies(e.target.checked)}
              />
              <span>
                <span className="font-medium text-gray-900">Mantieni esitazioni</span>
                <span className="text-gray-500 ml-1">
                  (&quot;ehm&quot;, &quot;uhm&quot;, false start). Di default vengono
                  rimosse.
                </span>
              </span>
            </label>
          </section>

          {/* Context notes / prompt */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Note di contesto / prompt
            </h3>
            <p className="text-xs text-gray-600 mb-2">
              Testo libero che descrive l&apos;audio (argomento, partecipanti,
              riferimenti…). Viene <strong>sempre</strong> salvato nei metadati del
              transcript (in testa al .txt e nel bundle JSON, utile ai tool AI
              downstream). Se attivi l&apos;opzione sotto, viene passato ad AssemblyAI
              come parametro <code className="text-[10px]">prompt</code>: Universal-3
              Pro lo usa per indirizzare lingua e contesto.
            </p>
            <textarea
              value={contextNotes}
              onChange={(e) => setContextNotes(e.target.value)}
              rows={4}
              placeholder="Es: Workshop sulla narrazione fantastica. I partecipanti discutono di…"
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={usePromptAsContext}
                onChange={(e) => setUsePromptAsContext(e.target.checked)}
                disabled={!contextNotes.trim()}
              />
              <span>
                Passa anche ad AssemblyAI come <code>prompt</code> (consigliato con
                Universal-3 Pro)
              </span>
            </label>
          </section>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedItems.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 text-sm font-medium"
          >
            {isSubmitting
              ? 'Invio…'
              : `Invia ${selectedItems.length} audio · $${totals.costUsd.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TRANSCRIPT DRAWER (invariato strutturalmente)
// ============================================
function TranscriptDrawer({
  jobId,
  onClose,
}: {
  jobId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    job: AudioTranscriptionJob;
    transcript: AudioTranscript | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/admin/audio/jobs/${jobId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        setData(j.data ?? null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [jobId]);

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <aside className="w-full max-w-xl bg-white h-full overflow-y-auto p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Trascrizione</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>

        {loading || !data ? (
          <div className="text-gray-500">Caricamento…</div>
        ) : (
          <>
            <section className="mb-4 text-sm">
              <div className="text-gray-500">File</div>
              <div className="font-medium">{data.job.metadata?.file?.name}</div>
              {data.job.metadata?.event && (
                <>
                  <div className="text-gray-500 mt-2">Evento</div>
                  <div className="font-medium">{data.job.metadata.event.title}</div>
                  {data.job.metadata.event.description && (
                    <div className="text-gray-600 mt-1 whitespace-pre-line">
                      {data.job.metadata.event.description}
                    </div>
                  )}
                </>
              )}
              {data.job.metadata?.group && (
                <>
                  <div className="text-gray-500 mt-2">Gruppo</div>
                  <div className="font-medium">{data.job.metadata.group.name}</div>
                </>
              )}
              {data.job.metadata?.moderators &&
                data.job.metadata.moderators.length > 0 && (
                  <>
                    <div className="text-gray-500 mt-2">Moderatori</div>
                    <ul className="list-disc pl-5">
                      {data.job.metadata.moderators.map((m) => (
                        <li key={m.id}>
                          {[m.name, m.surname].filter(Boolean).join(' ') || m.email}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              {data.job.metadata?.options && (
                <>
                  <div className="text-gray-500 mt-2">Opzioni di trascrizione</div>
                  {data.job.metadata.options.speech_models && (
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">Modello:</span>{' '}
                      {data.job.metadata.options.speech_models.join(' → ')}
                    </div>
                  )}
                  {data.job.metadata.options.keyterms_prompt &&
                    data.job.metadata.options.keyterms_prompt.length > 0 && (
                      <div className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">
                          Key terms ({data.job.metadata.options.keyterms_prompt.length}):
                        </span>{' '}
                        {data.job.metadata.options.keyterms_prompt.join(', ')}
                      </div>
                    )}
                  {data.job.metadata.options.custom_spelling &&
                    data.job.metadata.options.custom_spelling.length > 0 && (
                      <div className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Spelling:</span>{' '}
                        {data.job.metadata.options.custom_spelling
                          .map((s) => `${s.from.join('/')} → ${s.to}`)
                          .join(' · ')}
                      </div>
                    )}
                  {data.job.metadata.options.prompt && (
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">Prompt:</span>{' '}
                      {data.job.metadata.options.prompt}
                    </div>
                  )}
                  {data.job.metadata.options.context_notes &&
                    data.job.metadata.options.context_notes !==
                      data.job.metadata.options.prompt && (
                      <div className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Note:</span>{' '}
                        {data.job.metadata.options.context_notes}
                      </div>
                    )}
                </>
              )}
            </section>

            <div className="flex gap-2 mb-4">
              <a
                href={`/api/admin/audio/jobs/${jobId}/transcript/text`}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
              >
                Scarica .txt
              </a>
              <a
                href={`/api/admin/audio/jobs/${jobId}/transcript/json`}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded border border-gray-300"
              >
                Scarica .json
              </a>
            </div>

            {data.transcript ? (
              <section>
                <div className="text-xs text-gray-500 mb-2">
                  Lingua: {data.transcript.language ?? '—'} · Durata:{' '}
                  {data.transcript.duration_seconds
                    ? `${Math.round(data.transcript.duration_seconds)}s`
                    : '—'}{' '}
                  · Confidence: {data.transcript.confidence?.toFixed(2) ?? '—'}
                </div>
                {data.transcript.segments && data.transcript.segments.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {data.transcript.segments.map((s, idx) => (
                      <div key={idx} className="border-l-2 border-gray-200 pl-3">
                        <div className="text-xs text-gray-500">
                          {formatMs(s.start_ms)}
                          {s.speaker ? ` · ${s.speaker}` : ''}
                        </div>
                        <div>{s.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm whitespace-pre-line bg-gray-50 p-3 rounded border border-gray-200">
                    {data.transcript.text}
                  </div>
                )}
              </section>
            ) : (
              <div className="text-gray-500 text-sm">Transcript non disponibile.</div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
