import { getCmsBundle } from './server';
import { resolveBrandAssetUrl } from './brandAssets';
import { BrandClientProvider, type BrandSlotsMap } from './BrandContext';
import type { BrandAssetSlotKey } from './types';

const SLOT_KEYS: BrandAssetSlotKey[] = [
  'logo_full',
  'logo_compact',
  'favicon',
  'apple_touch',
  'icon_192',
  'icon_512',
  'og_image',
  'splash',
];

export default async function BrandProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const bundle = await getCmsBundle();
  const slots = {} as BrandSlotsMap;
  for (const key of SLOT_KEYS) {
    slots[key] = resolveBrandAssetUrl(bundle.brand.assets[key]);
  }
  return <BrandClientProvider slots={slots}>{children}</BrandClientProvider>;
}
