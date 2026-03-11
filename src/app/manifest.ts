import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Da Filo a Trama',
    short_name: 'DfaT',
    description: 'Piattaforma Eventi Scout - Da Filo a Trama',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0D274E', // Agesci blue approx
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
