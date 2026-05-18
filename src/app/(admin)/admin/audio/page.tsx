'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AudioJobStatus,
  AudioSourceListItem,
  AudioTranscript,
  AudioTranscriptionJob,
} from '@/types/database';

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

  const keyOf = (i: AudioSourceListItem) => `${i.source_type}:${i.source_id}`;

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      if (filterSource !== 'all' && i.source_type !== filterSource) return false;
      if (filterTranscript === 'with' && !i.has_transcript) return false;
      if (filterTranscript === 'without' && (i.has_transcript || i.latest_job?.status === 'processing' || i.latest_job?.status === 'pending')) return false;
      if (filterTranscript === 'in_progress') {
        const s = i.latest_job?.status;
        if (s !== 'pending' && s !== 'processing') return false;
      }
      if (filterText) {
        const q = filterText.toLowerCase();
        const hay = [
          i.file_name,
          i.event_title ?? '',
          i.group_name ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, filterSource, filterTranscript, filterText]);

  const selectableItems = filteredItems.filter(
    (i) => !i.latest_job || i.latest_job.status === 'failed' || i.latest_job.status === 'cancelled',
  );
  const allSelected =
    selectableItems.length > 0 && selectableItems.every((i) => selectedKeys.has(keyOf(i)));

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

  const submitSelected = async () => {
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
      };
      const res = await fetch('/api/admin/audio/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Errore invio');
      const ok = (data.data as { status?: string; error?: string }[]).filter(
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
      await refresh();
    } catch (e) {
      setSubmitMessage(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setIsSubmitting(false);
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
          <label className="block text-xs font-medium text-gray-700 mb-1">Stato trascrizione</label>
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
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={submitSelected}
          disabled={isSubmitting || selectedKeys.size === 0}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isSubmitting ? 'Invio…' : `Trascrivi selezionati (${selectedKeys.size})`}
        </button>
        {submitMessage && (
          <span className="text-sm text-gray-700">{submitMessage}</span>
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
                <th className="px-3 py-2 text-left font-medium text-gray-700">Dimensione</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Stato</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">Caricato</th>
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
                        {i.source_type === 'asset' ? 'Asset' : 'Allegato gruppo'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {i.event_title && <div>📅 {i.event_title}</div>}
                      {i.group_name && <div className="text-xs text-gray-500">👥 {i.group_name}</div>}
                      {!i.event_title && !i.group_name && <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formatBytes(i.file_size_bytes)}</td>
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
                        <div className="text-xs text-red-600 mt-1 truncate max-w-[200px]" title={i.latest_job.last_error}>
                          {i.latest_job.last_error}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formatDate(i.created_at)}</td>
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
    </div>
  );
}

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
              {data.job.metadata?.moderators && data.job.metadata.moderators.length > 0 && (
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
                  · Confidence:{' '}
                  {data.transcript.confidence?.toFixed(2) ?? '—'}
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
