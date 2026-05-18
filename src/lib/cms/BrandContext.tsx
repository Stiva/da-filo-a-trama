'use client';

import { createContext, useContext } from 'react';
import type { BrandAssetSlotKey } from './types';

export type BrandSlotsMap = Record<BrandAssetSlotKey, string | null>;

const EMPTY: BrandSlotsMap = {
  logo_full: null,
  logo_compact: null,
  favicon: null,
  apple_touch: null,
  icon_192: null,
  icon_512: null,
  og_image: null,
  splash: null,
};

const BrandContext = createContext<BrandSlotsMap>(EMPTY);

export function BrandClientProvider({
  slots,
  children,
}: {
  slots: BrandSlotsMap;
  children: React.ReactNode;
}) {
  return <BrandContext.Provider value={slots}>{children}</BrandContext.Provider>;
}

export function useBrandAsset(key: BrandAssetSlotKey): string | null {
  return useContext(BrandContext)[key];
}
