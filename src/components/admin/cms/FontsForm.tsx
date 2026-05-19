'use client';

import { useState } from 'react';
import { uploadFileResumable } from '@/lib/storage/uploadFile';
import type { BrandFonts, FontSlot } from '@/lib/cms/types';

type SlotKey = keyof BrandFonts;

const SLOT_META: Record<SlotKey, { title: string; cssVar: string; hint: string }> = {
  sans: {
    title: 'Sans (corpo testo)',
    cssVar: '--font-inter',
    hint: 'Usato in tutto il body via tailwind font-sans.',
  },
  display: {
    title: 'Display (titoli)',
    cssVar: '--font-loveyou',
    hint: 'Headings utente (font-display in tailwind).',
  },
  brand: {
    title: 'Brand (decorativo)',
    cssVar: '--font-dancing-script',
    hint: 'Font handwritten/decorativo (font-brand).',
  },
  loveyou: {
    title: 'Love You (slot legacy)',
    cssVar: '--font-loveyou',
    hint: 'Override puntuale dello slot loveyou se serve.',
  },
};

const SLOT_ORDER: SlotKey[] = ['sans', 'display', 'brand', 'loveyou'];

type Status = { type: 'idle' | 'uploading' | 'saving' | 'ok' | 'error'; message?: string; progress?: number };

const ACCEPT = 'font/woff2,font/woff,font/ttf,application/font-woff,.woff2,.woff,.ttf';

export default function FontsForm({ initial }: { initial: BrandFonts }) {
  const [fonts, setFonts] = useState<BrandFonts>(initial);
  const [familyDrafts, setFamilyDrafts] = useState<Record<SlotKey, string>>({
    sans: fonts.sans?.family ?? '',
    display: fonts.display?.family ?? '',
    brand: fonts.brand?.family ?? '',
    loveyou: fonts.loveyou?.family ?? '',
  });
  const [statuses, setStatuses] = useState<Record<SlotKey, Status>>(() =>
    Object.fromEntries(SLOT_ORDER.map((k) => [k, { type: 'idle' } as Status])) as Record<
      SlotKey,
      Status
    >,
  );

  function setStatus(key: SlotKey, next: Status) {
    setStatuses((prev) => ({ ...prev, [key]: next }));
  }

  async function persist(next: BrandFonts) {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'brand.fonts',
        value: next,
        description: 'CMS — font slots',
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || 'Errore di salvataggio');
    }
  }

  function inferFormat(file: File): 'woff2' | 'woff' | 'ttf' {
    const name = file.name.toLowerCase();
    if (name.endsWith('.woff2')) return 'woff2';
    if (name.endsWith('.woff')) return 'woff';
    return 'ttf';
  }

  async function handleFile(key: SlotKey, file: File) {
    const family = familyDrafts[key].trim();
    if (!family) {
      setStatus(key, { type: 'error', message: 'Imposta prima il nome family.' });
      return;
    }
    setStatus(key, { type: 'uploading', progress: 0 });
    try {
      const mimeMap = {
        woff2: 'font/woff2',
        woff: 'font/woff',
        ttf: 'font/ttf',
      };
      const format = inferFormat(file);
      const signRes = await fetch('/api/admin/assets/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `cms_font_${key}_${file.name}`,
          fileSize: file.size,
          mimeType: file.type || mimeMap[format],
        }),
      });
      const signJson = await signRes.json();
      if (!signRes.ok) throw new Error(signJson.error || 'Firma upload fallita');

      const { upload_token, path, file_url } = signJson.data as {
        upload_token: string;
        path: string;
        file_url: string;
      };

      await uploadFileResumable({
        file,
        bucket: 'assets',
        path,
        authToken: upload_token,
        contentType: file.type || mimeMap[format],
        onProgress: (b, total) =>
          setStatus(key, { type: 'uploading', progress: Math.round((b / total) * 100) }),
      });

      setStatus(key, { type: 'saving' });
      const newSlot: FontSlot = {
        url: file_url,
        family,
        format,
        weights: [400, 700],
      };
      const next: BrandFonts = { ...fonts, [key]: newSlot };
      await persist(next);
      setFonts(next);
      setStatus(key, { type: 'ok', message: 'Font attivato' });
    } catch (err) {
      setStatus(key, {
        type: 'error',
        message: err instanceof Error ? err.message : 'Errore sconosciuto',
      });
    }
  }

  async function handleReset(key: SlotKey) {
    if (!confirm(`Ripristinare il font baseline per "${SLOT_META[key].title}"?`)) return;
    setStatus(key, { type: 'saving' });
    try {
      const next: BrandFonts = { ...fonts, [key]: null };
      await persist(next);
      setFonts(next);
      setFamilyDrafts((prev) => ({ ...prev, [key]: '' }));
      setStatus(key, { type: 'ok', message: 'Reset effettuato' });
    } catch (err) {
      setStatus(key, {
        type: 'error',
        message: err instanceof Error ? err.message : 'Errore sconosciuto',
      });
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Carica font WOFF2/WOFF/TTF. I font baseline next/font Google
        (Inter, Quicksand, Dancing Script) restano caricati come fallback,
        quindi il sito non resta mai senza un font.
      </p>
      {SLOT_ORDER.map((key) => {
        const meta = SLOT_META[key];
        const slot = fonts[key];
        const status = statuses[key];
        const isOverride = !!slot;
        const isBusy = status.type === 'uploading' || status.type === 'saving';

        return (
          <div key={key} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{meta.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{meta.hint}</p>
                <code className="text-[10px] text-agesci-blue/70 mt-1 inline-block">
                  override su {meta.cssVar}
                </code>
              </div>
              {isOverride && (
                <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded flex-shrink-0">
                  attivo: {slot.family}
                </span>
              )}
            </div>

            <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
              <input
                type="text"
                placeholder="Nome family CSS (es. NeueHaas)"
                value={familyDrafts[key]}
                onChange={(e) => setFamilyDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-agesci-blue focus:ring-1 focus:ring-agesci-blue outline-none"
              />
              <label className="px-3 py-2 text-sm rounded-md bg-agesci-blue text-white hover:bg-agesci-blue-light cursor-pointer text-center">
                {isBusy ? `${status.progress ?? '…'}%` : 'Carica font'}
                <input
                  type="file"
                  accept={ACCEPT}
                  className="hidden"
                  disabled={isBusy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(key, f);
                    e.target.value = '';
                  }}
                />
              </label>
              {isOverride && (
                <button
                  type="button"
                  onClick={() => handleReset(key)}
                  className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Reset
                </button>
              )}
            </div>

            {status.type === 'ok' && (
              <p className="mt-2 text-xs text-green-700">{status.message}</p>
            )}
            {status.type === 'error' && (
              <p className="mt-2 text-xs text-red-600">{status.message}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
