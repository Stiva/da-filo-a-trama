import 'server-only';
import { unstable_cache } from 'next/cache';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { loadCmsDefaults } from './defaults';
import { CMS_COPY_CACHE_TAG } from './server';
import type { CopyKey } from './defaults';

export const DEFAULT_LOCALE = 'it';

export type CopyRow = {
  key: string;
  locale: string;
  value: string;
  namespace: string | null;
  description: string | null;
  updated_at: string;
};

type CopyMap = Map<string, string>;

async function fetchCopyMap(locale: string): Promise<CopyMap> {
  const map: CopyMap = new Map();

  // 1. seed con i defaults (chiavi tipizzate)
  const defaults = loadCmsDefaults();
  for (const [key, value] of Object.entries(defaults.copy)) {
    map.set(key, value as string);
  }

  // 2. override con il DB (locale richiesto + fallback 'it' se differente)
  try {
    const supabase = createServiceRoleClient();
    const locales = locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [DEFAULT_LOCALE, locale];
    const { data, error } = await supabase
      .from('cms_copy')
      .select('key, locale, value')
      .in('locale', locales);

    if (error) {
      console.error('[cms.copy] DB read failed, using defaults:', error);
      return map;
    }

    // Applichiamo prima 'it' (fallback), poi il locale richiesto, così override vince.
    const sorted = (data || []).sort((a, b) => {
      if (a.locale === b.locale) return 0;
      if (a.locale === DEFAULT_LOCALE) return -1;
      if (b.locale === DEFAULT_LOCALE) return 1;
      return 0;
    });
    for (const row of sorted) {
      if (row.locale === DEFAULT_LOCALE || row.locale === locale) {
        map.set(row.key, row.value as string);
      }
    }
  } catch (err) {
    console.error('[cms.copy] Unexpected error, using defaults:', err);
  }

  return map;
}

const getCachedCopyMap = unstable_cache(
  async (locale: string) => {
    const map = await fetchCopyMap(locale);
    // unstable_cache richiede serializzabile → restituiamo array di tuple.
    return Array.from(map.entries());
  },
  ['cms-copy-v1'],
  { tags: [CMS_COPY_CACHE_TAG] },
);

export async function getCopy(locale: string = DEFAULT_LOCALE): Promise<CopyMap> {
  const entries = await getCachedCopyMap(locale);
  return new Map(entries);
}

export type CopyKeyLike = CopyKey | (string & {});
export type CopyOpts = { locale?: string; vars?: Record<string, string | number> };

function substitute(value: string, vars?: CopyOpts['vars']): string {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) =>
    name in vars ? String(vars[name as keyof typeof vars]) : `{${name}}`,
  );
}

/**
 * Server-side helper. Use inside async server components or route handlers.
 * Fallback chain: locale richiesto → 'it' → defaults.copy → key stessa.
 */
export async function t(key: CopyKeyLike, opts: CopyOpts = {}): Promise<string> {
  const locale = opts.locale ?? DEFAULT_LOCALE;
  const map = await getCopy(locale);
  const value = map.get(key) ?? key;
  return substitute(value, opts.vars);
}

/**
 * Sincrono: dato un CopyMap pre-caricato, risolve una chiave. Utile quando
 * si vogliono evitare N await in un componente con molte chiavi.
 */
export function tSync(
  map: CopyMap,
  key: CopyKeyLike,
  vars?: CopyOpts['vars'],
): string {
  const value = map.get(key) ?? key;
  return substitute(value, vars);
}
