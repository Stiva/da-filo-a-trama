import type { BrandAssetSlot, BrandAssetSlotKey, BrandAssets } from './types';

/**
 * Resolve a brand asset slot to a usable URL.
 *
 * Priority: explicit `url` set via CMS > `fallback` from defaults > null.
 * Appends a `?v=` cache buster when `versionedAt` is supplied so the admin
 * can refresh CDN/browser caches after a new upload.
 */
export function resolveBrandAssetUrl(
  slot: BrandAssetSlot | undefined,
  versionedAt?: string | null,
): string | null {
  if (!slot) return null;
  const base = slot.url ?? slot.fallback;
  if (!base) return null;
  if (!versionedAt) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}v=${encodeURIComponent(versionedAt)}`;
}

export function getBrandAssetUrl(
  assets: BrandAssets,
  key: BrandAssetSlotKey,
  versionedAt?: string | null,
): string | null {
  return resolveBrandAssetUrl(assets[key], versionedAt);
}
