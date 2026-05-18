import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Barcode Warehouse',
    short_name: 'Barcode',
    description: 'Warehouse barcode reader and inventory tracker',
    start_url: '/scanner',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f3f6fb',
    theme_color: '#314864',
    dir: 'rtl',
    lang: 'fa',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
