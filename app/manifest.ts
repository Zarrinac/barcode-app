import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Barcode Warehouse',
    short_name: 'Barcode',
    description: 'Warehouse barcode reader and inventory tracker',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f3f6fb',
    theme_color: '#314864',
    dir: 'rtl',
    lang: 'fa',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
