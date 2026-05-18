import type { CmsDefaults } from './defaults';

export type ColorScale = { DEFAULT: string; light?: string; dark?: string };
export type ColorValue = string | ColorScale;

export type BrandColors = Record<string, ColorValue>;
export type BrandShadows = Record<string, string>;

export type FontSlot = {
  url: string;
  family: string;
  fallback?: string;
  weights?: number[];
  format?: 'woff2' | 'woff' | 'ttf';
} | null;

export type BrandFonts = {
  sans: FontSlot;
  display: FontSlot;
  brand: FontSlot;
  loveyou: FontSlot;
};

export type BrandAssetSlot = {
  url: string | null;
  fallback: string | null;
};

export type BrandAssetSlotKey = keyof BrandAssets;

export type BrandAssets = {
  logo_full: BrandAssetSlot;
  logo_compact: BrandAssetSlot;
  favicon: BrandAssetSlot;
  apple_touch: BrandAssetSlot;
  icon_192: BrandAssetSlot;
  icon_512: BrandAssetSlot;
  og_image: BrandAssetSlot;
  splash: BrandAssetSlot;
};

export type MetaApp = {
  title: string;
  description: string;
  keywords: string[];
  authors: { name: string }[];
  locale: string;
  apple_web_app_title: string;
};

export type MetaOg = {
  title: string;
  description: string;
  type: string;
};

export type MetaPwa = {
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  start_url: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'portrait-primary' | 'landscape-primary' | 'any';
  categories: string[];
  lang: string;
};

export type CmsBundle = {
  brand: {
    colors: BrandColors;
    shadows: BrandShadows;
    fonts: BrandFonts;
    assets: BrandAssets;
  };
  meta: {
    app: MetaApp;
    og: MetaOg;
    pwa: MetaPwa;
  };
};

export type CmsBundleWritable = {
  brand: {
    colors: BrandColors;
    shadows: BrandShadows;
    fonts: BrandFonts;
    assets: BrandAssets;
  };
  meta: {
    app: MetaApp;
    og: MetaOg;
    pwa: MetaPwa;
  };
};

export type CmsSettingKey =
  | 'brand.colors'
  | 'brand.shadows'
  | 'brand.fonts'
  | 'brand.assets'
  | 'meta.app'
  | 'meta.og'
  | 'meta.pwa';

export type { CmsDefaults };
