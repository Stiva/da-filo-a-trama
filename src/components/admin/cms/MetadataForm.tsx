'use client';

import { useState } from 'react';
import type { MetaApp, MetaOg, MetaPwa } from '@/lib/cms/types';

type Section = 'app' | 'og' | 'pwa';

type Status = { type: 'idle' | 'saving' | 'ok' | 'error'; message?: string };

async function saveSetting(key: string, value: unknown, description: string) {
  const res = await fetch('/api/admin/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, description }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'Errore di salvataggio');
  }
}

function TextField({
  label,
  value,
  onChange,
  hint,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  multiline?: boolean;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-agesci-blue focus:ring-1 focus:ring-agesci-blue outline-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-agesci-blue focus:ring-1 focus:ring-agesci-blue outline-none"
        />
      )}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded border border-gray-300 cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
        />
      </div>
    </label>
  );
}

export default function MetadataForm({
  initialApp,
  initialOg,
  initialPwa,
}: {
  initialApp: MetaApp;
  initialOg: MetaOg;
  initialPwa: MetaPwa;
}) {
  const [section, setSection] = useState<Section>('app');
  const [app, setApp] = useState<MetaApp>(initialApp);
  const [og, setOg] = useState<MetaOg>(initialOg);
  const [pwa, setPwa] = useState<MetaPwa>(initialPwa);
  const [status, setStatus] = useState<Status>({ type: 'idle' });

  async function handleSave() {
    setStatus({ type: 'saving' });
    try {
      if (section === 'app') {
        await saveSetting('meta.app', app, 'CMS — metadata Next.js (title, description, keywords)');
      } else if (section === 'og') {
        await saveSetting('meta.og', og, 'CMS — Open Graph metadata');
      } else {
        await saveSetting('meta.pwa', pwa, 'CMS — Web App Manifest PWA');
      }
      setStatus({ type: 'ok', message: 'Salvato' });
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Errore sconosciuto',
      });
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['app', 'og', 'pwa'] as Section[]).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              section === s
                ? 'border-agesci-blue text-agesci-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {s === 'app' ? 'App / SEO' : s === 'og' ? 'Open Graph' : 'PWA / Manifest'}
          </button>
        ))}
      </div>

      {section === 'app' && (
        <div>
          <TextField
            label="Title"
            value={app.title}
            onChange={(v) => setApp({ ...app, title: v })}
            hint="Titolo nella tab del browser e nei risultati di ricerca."
          />
          <TextField
            label="Description"
            value={app.description}
            onChange={(v) => setApp({ ...app, description: v })}
            multiline
          />
          <TextField
            label="Keywords (separate da virgola)"
            value={app.keywords.join(', ')}
            onChange={(v) =>
              setApp({
                ...app,
                keywords: v.split(',').map((k) => k.trim()).filter(Boolean),
              })
            }
          />
          <TextField
            label="Apple Web App Title"
            value={app.apple_web_app_title}
            onChange={(v) => setApp({ ...app, apple_web_app_title: v })}
            hint="Nome visualizzato quando l'app è installata su iOS."
          />
          <TextField
            label="Locale"
            value={app.locale}
            onChange={(v) => setApp({ ...app, locale: v })}
            hint="Codice locale completo, es. it_IT."
          />
        </div>
      )}

      {section === 'og' && (
        <div>
          <TextField label="OG Title" value={og.title} onChange={(v) => setOg({ ...og, title: v })} />
          <TextField
            label="OG Description"
            value={og.description}
            onChange={(v) => setOg({ ...og, description: v })}
            multiline
          />
          <TextField
            label="OG Type"
            value={og.type}
            onChange={(v) => setOg({ ...og, type: v })}
            hint="Tipicamente: website"
          />
          <p className="text-xs text-gray-500">
            L&apos;immagine OG si configura nella sezione <strong>Brand</strong> (slot <code>og_image</code>).
          </p>
        </div>
      )}

      {section === 'pwa' && (
        <div>
          <TextField label="Nome" value={pwa.name} onChange={(v) => setPwa({ ...pwa, name: v })} />
          <TextField
            label="Short name"
            value={pwa.short_name}
            onChange={(v) => setPwa({ ...pwa, short_name: v })}
            hint="Massimo ~12 caratteri (icona homescreen)."
          />
          <TextField
            label="Description"
            value={pwa.description}
            onChange={(v) => setPwa({ ...pwa, description: v })}
            multiline
          />
          <ColorField
            label="Theme color"
            value={pwa.theme_color}
            onChange={(v) => setPwa({ ...pwa, theme_color: v })}
          />
          <ColorField
            label="Background color"
            value={pwa.background_color}
            onChange={(v) => setPwa({ ...pwa, background_color: v })}
          />
          <TextField
            label="Start URL"
            value={pwa.start_url}
            onChange={(v) => setPwa({ ...pwa, start_url: v })}
          />
          <label className="block mb-3">
            <span className="block text-sm font-medium text-gray-700 mb-1">Display mode</span>
            <select
              value={pwa.display}
              onChange={(e) => setPwa({ ...pwa, display: e.target.value as MetaPwa['display'] })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="standalone">standalone</option>
              <option value="fullscreen">fullscreen</option>
              <option value="minimal-ui">minimal-ui</option>
              <option value="browser">browser</option>
            </select>
          </label>
          <label className="block mb-3">
            <span className="block text-sm font-medium text-gray-700 mb-1">Orientation</span>
            <select
              value={pwa.orientation}
              onChange={(e) =>
                setPwa({ ...pwa, orientation: e.target.value as MetaPwa['orientation'] })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
            >
              <option value="portrait-primary">portrait-primary</option>
              <option value="landscape-primary">landscape-primary</option>
              <option value="any">any</option>
            </select>
          </label>
          <TextField
            label="Categories (separate da virgola)"
            value={pwa.categories.join(', ')}
            onChange={(v) =>
              setPwa({
                ...pwa,
                categories: v.split(',').map((k) => k.trim()).filter(Boolean),
              })
            }
          />
          <TextField label="Lang" value={pwa.lang} onChange={(v) => setPwa({ ...pwa, lang: v })} />
        </div>
      )}

      <div className="sticky bottom-4 mt-6 flex justify-end items-center gap-3 bg-white/90 backdrop-blur-sm p-3 rounded-lg border border-gray-200">
        {status.type === 'ok' && (
          <span className="text-sm text-green-700">{status.message}</span>
        )}
        {status.type === 'error' && (
          <span className="text-sm text-red-600">{status.message}</span>
        )}
        <button
          onClick={handleSave}
          disabled={status.type === 'saving'}
          className="px-4 py-2 text-sm rounded-md bg-agesci-blue text-white hover:bg-agesci-blue-light disabled:opacity-50"
        >
          {status.type === 'saving' ? 'Salvataggio…' : 'Salva sezione'}
        </button>
      </div>
    </div>
  );
}
