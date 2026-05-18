'use client';

import { useEffect, useMemo, useState } from 'react';
import { cmsDefaults } from '@/lib/cms/defaults';

type Row = {
  key: string;
  locale: string;
  value: string;
  namespace: string | null;
  description: string | null;
  updated_at: string;
};

type DefaultEntry = { key: string; defaultValue: string; namespace: string | null };

function namespaceOf(key: string): string | null {
  const i = key.indexOf('.');
  return i === -1 ? null : key.slice(0, i);
}

const ALL_DEFAULTS: DefaultEntry[] = Object.entries(cmsDefaults.copy).map(([key, value]) => ({
  key,
  defaultValue: value as string,
  namespace: namespaceOf(key),
}));

type DraftMap = Record<string, { value: string; dirty: boolean; saving: boolean; error?: string }>;

export default function CopyTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [namespace, setNamespace] = useState<string>('');
  const [showOnlyOverrides, setShowOnlyOverrides] = useState(false);
  const [drafts, setDrafts] = useState<DraftMap>({});

  useEffect(() => {
    fetchRows();
  }, []);

  async function fetchRows() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/cms/copy?locale=it');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Errore di caricamento');
      setRows((json.data || []) as Row[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  }

  const rowsByKey = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of rows) map.set(r.key, r);
    return map;
  }, [rows]);

  const namespaces = useMemo(() => {
    const set = new Set<string>();
    for (const d of ALL_DEFAULTS) if (d.namespace) set.add(d.namespace);
    for (const r of rows) if (r.namespace) set.add(r.namespace);
    return Array.from(set).sort();
  }, [rows]);

  const visible = useMemo(() => {
    const merged: Array<{
      key: string;
      currentValue: string;
      defaultValue: string;
      hasOverride: boolean;
      namespace: string | null;
    }> = [];

    const seen = new Set<string>();
    for (const def of ALL_DEFAULTS) {
      const row = rowsByKey.get(def.key);
      merged.push({
        key: def.key,
        currentValue: row?.value ?? def.defaultValue,
        defaultValue: def.defaultValue,
        hasOverride: !!row,
        namespace: def.namespace,
      });
      seen.add(def.key);
    }
    for (const r of rows) {
      if (seen.has(r.key)) continue;
      merged.push({
        key: r.key,
        currentValue: r.value,
        defaultValue: '',
        hasOverride: true,
        namespace: r.namespace,
      });
    }

    return merged
      .filter((m) => (showOnlyOverrides ? m.hasOverride : true))
      .filter((m) => (namespace ? m.namespace === namespace : true))
      .filter((m) =>
        search
          ? m.key.toLowerCase().includes(search.toLowerCase()) ||
            m.currentValue.toLowerCase().includes(search.toLowerCase())
          : true,
      )
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [rowsByKey, rows, namespace, search, showOnlyOverrides]);

  function getDraft(key: string, fallback: string) {
    return drafts[key]?.value ?? fallback;
  }

  function setDraft(key: string, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { value, dirty: true, saving: false },
    }));
  }

  async function saveDraft(key: string) {
    const draft = drafts[key];
    if (!draft) return;
    setDrafts((prev) => ({ ...prev, [key]: { ...draft, saving: true, error: undefined } }));
    try {
      const res = await fetch('/api/admin/cms/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, locale: 'it', value: draft.value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Errore di salvataggio');
      setDrafts((prev) => {
        const { [key]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      });
      await fetchRows();
    } catch (err) {
      setDrafts((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          saving: false,
          error: err instanceof Error ? err.message : 'Errore sconosciuto',
        },
      }));
    }
  }

  async function resetToDefault(key: string) {
    if (!confirm(`Eliminare l'override per "${key}" e tornare al default?`)) return;
    try {
      const res = await fetch(
        `/api/admin/cms/copy?key=${encodeURIComponent(key)}&locale=it`,
        { method: 'DELETE' },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Errore di eliminazione');
      setDrafts((prev) => {
        const { [key]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      });
      await fetchRows();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          placeholder="Cerca per chiave o testo…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-agesci-blue focus:ring-1 focus:ring-agesci-blue outline-none"
        />
        <select
          value={namespace}
          onChange={(e) => setNamespace(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
        >
          <option value="">Tutti i namespace</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showOnlyOverrides}
            onChange={(e) => setShowOnlyOverrides(e.target.checked)}
            className="rounded border-gray-300 text-agesci-blue focus:ring-agesci-blue"
          />
          Solo override
        </label>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Caricamento…</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
          Nessun risultato.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item) => {
            const draft = drafts[item.key];
            const currentInput = draft?.value ?? item.currentValue;
            const isDirty = !!draft?.dirty && draft.value !== item.currentValue;
            return (
              <div
                key={item.key}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-agesci-blue">
                      {item.key}
                    </code>
                    {item.hasOverride && (
                      <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                        override
                      </span>
                    )}
                  </div>
                  {item.hasOverride && (
                    <button
                      onClick={() => resetToDefault(item.key)}
                      className="text-xs text-gray-500 hover:text-red-600 transition-colors flex-shrink-0"
                    >
                      Reset al default
                    </button>
                  )}
                </div>
                <textarea
                  value={currentInput}
                  onChange={(e) => setDraft(item.key, e.target.value)}
                  rows={Math.min(4, Math.max(1, currentInput.split('\n').length))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-agesci-blue focus:ring-1 focus:ring-agesci-blue outline-none"
                />
                {item.defaultValue && item.defaultValue !== currentInput && (
                  <p className="mt-1 text-xs text-gray-500 truncate">
                    Default: {item.defaultValue}
                  </p>
                )}
                {draft?.error && (
                  <p className="mt-1 text-xs text-red-600">{draft.error}</p>
                )}
                {isDirty && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => saveDraft(item.key)}
                      disabled={draft?.saving}
                      className="px-3 py-1.5 text-sm rounded-md bg-agesci-blue text-white hover:bg-agesci-blue-light disabled:opacity-50"
                    >
                      {draft?.saving ? 'Salvataggio…' : 'Salva'}
                    </button>
                    <button
                      onClick={() => {
                        setDrafts((prev) => {
                          const { [item.key]: _removed, ...rest } = prev;
                          void _removed;
                          return rest;
                        });
                      }}
                      className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Annulla
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
