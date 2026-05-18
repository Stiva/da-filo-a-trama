import 'server-only';
import { unstable_cache } from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { loadCmsDefaults } from './defaults';
import type { CmsBundle, CmsSettingKey } from './types';

export const CMS_CACHE_TAG = 'cms';
export const CMS_COPY_CACHE_TAG = 'cms:copy';

const CMS_KEY_PREFIXES = ['brand.', 'meta.'];

type AppSettingRow = {
  key: string;
  value: unknown;
};

/**
 * Read all CMS brand+meta settings from `app_settings`, merging on top of the
 * compile-time defaults. Cached for the whole request lifecycle and tagged
 * with `cms` so admin POSTs can invalidate via revalidateTag.
 */
async function fetchCmsBundleUncached(): Promise<CmsBundle> {
  const defaults = loadCmsDefaults();
  const bundle: CmsBundle = {
    brand: {
      colors: { ...defaults.brand.colors },
      shadows: { ...defaults.brand.shadows },
      fonts: { ...defaults.brand.fonts },
      assets: { ...defaults.brand.assets },
    },
    meta: {
      app: {
        ...defaults.meta.app,
        keywords: [...defaults.meta.app.keywords],
        authors: defaults.meta.app.authors.map((a) => ({ ...a })),
      },
      og: { ...defaults.meta.og },
      pwa: {
        ...defaults.meta.pwa,
        categories: [...defaults.meta.pwa.categories],
      },
    },
  };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .or(
        CMS_KEY_PREFIXES.map((p) => `key.like.${p}%`).join(','),
      );

    if (error) {
      console.error('[cms] Failed to load app_settings, using defaults:', error);
      return bundle;
    }

    for (const row of (data || []) as AppSettingRow[]) {
      applyRow(bundle, row.key, row.value);
    }
  } catch (err) {
    console.error('[cms] Unexpected error loading bundle, using defaults:', err);
  }

  return bundle;
}

function applyRow(bundle: CmsBundle, key: string, value: unknown): void {
  if (value == null || typeof value !== 'object') return;

  switch (key as CmsSettingKey) {
    case 'brand.colors':
      bundle.brand.colors = { ...bundle.brand.colors, ...(value as Record<string, unknown>) } as CmsBundle['brand']['colors'];
      return;
    case 'brand.shadows':
      bundle.brand.shadows = { ...bundle.brand.shadows, ...(value as Record<string, string>) };
      return;
    case 'brand.fonts':
      bundle.brand.fonts = { ...bundle.brand.fonts, ...(value as object) } as CmsBundle['brand']['fonts'];
      return;
    case 'brand.assets':
      bundle.brand.assets = { ...bundle.brand.assets, ...(value as object) } as CmsBundle['brand']['assets'];
      return;
    case 'meta.app':
      bundle.meta.app = { ...bundle.meta.app, ...(value as object) } as CmsBundle['meta']['app'];
      return;
    case 'meta.og':
      bundle.meta.og = { ...bundle.meta.og, ...(value as object) } as CmsBundle['meta']['og'];
      return;
    case 'meta.pwa':
      bundle.meta.pwa = { ...bundle.meta.pwa, ...(value as object) } as CmsBundle['meta']['pwa'];
      return;
  }
}

const getCachedBundle = unstable_cache(
  fetchCmsBundleUncached,
  ['cms-bundle-v1'],
  { tags: [CMS_CACHE_TAG] },
);

export async function getCmsBundle(): Promise<CmsBundle> {
  return getCachedBundle();
}
