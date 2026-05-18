'use client';

import { useEffect, useState } from 'react';
import { uploadFileResumable } from '@/lib/storage/uploadFile';
import type { BrandAssetSlotKey, BrandAssets } from '@/lib/cms/types';

const SLOT_LABELS: Record<BrandAssetSlotKey, { title: string; hint: string; previewClass: string }> = {
  logo_full: {
    title: 'Logo completo',
    hint: 'Header desktop, landing, footer (formato orizzontale, PNG/SVG).',
    previewClass: 'h-16 w-auto',
  },
  logo_compact: {
    title: 'Logo compatto',
    hint: 'Versione iconica mobile (44×44).',
    previewClass: 'h-12 w-12',
  },
  favicon: {
    title: 'Favicon',
    hint: 'Visualizzato nella tab del browser (32×32 PNG/SVG).',
    previewClass: 'h-8 w-8',
  },
  apple_touch: {
    title: 'Apple touch icon',
    hint: 'Icona iOS home screen (180×180 PNG).',
    previewClass: 'h-12 w-12',
  },
  icon_192: {
    title: 'PWA icon 192',
    hint: '192×192 PNG. Usato dal manifest PWA.',
    previewClass: 'h-12 w-12',
  },
  icon_512: {
    title: 'PWA icon 512',
    hint: '512×512 PNG. Splash e icone PWA grandi.',
    previewClass: 'h-12 w-12',
  },
  og_image: {
    title: 'OG image (social)',
    hint: 'Anteprima social/WhatsApp (1200×630 JPG/PNG).',
    previewClass: 'h-16 w-auto',
  },
  splash: {
    title: 'Splash (opzionale)',
    hint: 'Immagine di copertura per loader/splash.',
    previewClass: 'h-16 w-auto',
  },
};

const SLOT_ORDER: BrandAssetSlotKey[] = [
  'logo_full',
  'logo_compact',
  'favicon',
  'apple_touch',
  'icon_192',
  'icon_512',
  'og_image',
  'splash',
];

type Status = { type: 'idle' | 'uploading' | 'saving' | 'ok' | 'error'; message?: string; progress?: number };

export default function BrandAssetsForm({ initial }: { initial: BrandAssets }) {
  const [assets, setAssets] = useState<BrandAssets>(initial);
  const [statuses, setStatuses] = useState<Record<BrandAssetSlotKey, Status>>(
    () =>
      Object.fromEntries(
        SLOT_ORDER.map((k) => [k, { type: 'idle' } as Status]),
      ) as Record<BrandAssetSlotKey, Status>,
  );

  useEffect(() => {
    setAssets(initial);
  }, [initial]);

  function setStatus(key: BrandAssetSlotKey, next: Status) {
    setStatuses((prev) => ({ ...prev, [key]: next }));
  }

  async function persist(next: BrandAssets) {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'brand.assets',
        value: next,
        description: 'CMS — slot asset brand',
      }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || 'Errore di salvataggio');
    }
  }

  async function handleFile(key: BrandAssetSlotKey, file: File) {
    setStatus(key, { type: 'uploading', progress: 0 });
    try {
      const signRes = await fetch('/api/admin/assets/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: `cms_${key}_${file.name}`,
          fileSize: file.size,
          mimeType: file.type,
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
        contentType: file.type,
        onProgress: (b, total) =>
          setStatus(key, { type: 'uploading', progress: Math.round((b / total) * 100) }),
      });

      setStatus(key, { type: 'saving' });
      const next: BrandAssets = {
        ...assets,
        [key]: { ...assets[key], url: file_url },
      };
      await persist(next);
      setAssets(next);
      setStatus(key, { type: 'ok', message: 'Caricato' });
    } catch (err) {
      setStatus(key, {
        type: 'error',
        message: err instanceof Error ? err.message : 'Errore sconosciuto',
      });
    }
  }

  async function handleReset(key: BrandAssetSlotKey) {
    if (!confirm(`Tornare al fallback statico per "${SLOT_LABELS[key].title}"?`)) return;
    setStatus(key, { type: 'saving' });
    try {
      const next: BrandAssets = {
        ...assets,
        [key]: { ...assets[key], url: null },
      };
      await persist(next);
      setAssets(next);
      setStatus(key, { type: 'ok', message: 'Reset effettuato' });
    } catch (err) {
      setStatus(key, {
        type: 'error',
        message: err instanceof Error ? err.message : 'Errore sconosciuto',
      });
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SLOT_ORDER.map((key) => {
        const slot = assets[key];
        const label = SLOT_LABELS[key];
        const status = statuses[key];
        const currentUrl = slot.url || slot.fallback;
        const isOverride = !!slot.url;
        const isUploading = status.type === 'uploading' || status.type === 'saving';

        return (
          <div
            key={key}
            className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900">{label.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{label.hint}</p>
                <code className="text-[10px] text-agesci-blue/70 mt-1 inline-block">
                  {key}
                </code>
              </div>
              {isOverride && (
                <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded">
                  override
                </span>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-center min-h-[96px]">
              {currentUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentUrl}
                  alt={label.title}
                  className={`${label.previewClass} object-contain`}
                />
              ) : (
                <span className="text-xs text-gray-400">Nessuna immagine</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <label className="px-3 py-1.5 text-sm rounded-md bg-agesci-blue text-white hover:bg-agesci-blue-light cursor-pointer disabled:opacity-50">
                {isUploading ? 'Caricamento…' : 'Carica'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  disabled={isUploading}
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
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Reset
                </button>
              )}
              {status.type === 'uploading' && (
                <span className="text-xs text-gray-500">
                  {status.progress ?? 0}%
                </span>
              )}
              {status.type === 'ok' && (
                <span className="text-xs text-green-700">{status.message}</span>
              )}
              {status.type === 'error' && (
                <span className="text-xs text-red-600">{status.message}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
