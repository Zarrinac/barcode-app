import type { Metadata } from 'next';
import PwaRegister from './pwa-register';
import '@/assets/styles/globals.css';

export const metadata: Metadata = {
  applicationName: 'Barcode Warehouse',
  title: 'Barcode Warehouse',
  description: 'Warehouse barcode reader and inventory tracker',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Barcode',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
