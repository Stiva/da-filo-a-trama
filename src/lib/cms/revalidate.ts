import 'server-only';
import { revalidateTag } from 'next/cache';
import { CMS_CACHE_TAG, CMS_COPY_CACHE_TAG } from './server';

export function revalidateCms(): void {
  revalidateTag(CMS_CACHE_TAG);
}

export function revalidateCmsCopy(): void {
  revalidateTag(CMS_COPY_CACHE_TAG);
}

/**
 * Decide which cache tag(s) to invalidate based on the app_settings key
 * being upserted. Only `brand.*` and `meta.*` keys participate in the CMS
 * bundle, so non-CMS keys are no-ops.
 */
export function revalidateForSettingKey(key: string): void {
  if (key.startsWith('brand.') || key.startsWith('meta.')) {
    revalidateCms();
  }
}
