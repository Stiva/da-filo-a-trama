import { MetadataRoute } from 'next';
import { getCmsBundle } from '@/lib/cms/server';
import { resolveBrandAssetUrl } from '@/lib/cms/brandAssets';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const bundle = await getCmsBundle();
  const { pwa } = bundle.meta;
  const { assets } = bundle.brand;
  const icon192 = resolveBrandAssetUrl(assets.icon_192) || '/icon-192.png';
  const icon512 = resolveBrandAssetUrl(assets.icon_512) || '/icon-512.png';

  return {
    name: pwa.name,
    short_name: pwa.short_name,
    description: pwa.description,
    start_url: pwa.start_url,
    display: pwa.display,
    background_color: pwa.background_color,
    theme_color: pwa.theme_color,
    orientation: pwa.orientation,
    categories: pwa.categories,
    lang: pwa.lang,
    icons: [
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
