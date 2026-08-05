import type { Metadata } from 'next';
import PwaRegister from './pwa-register';
import '@/assets/styles/globals.css';

export const metadata: Metadata = {
  applicationName: "D'CODE Barcode Scanner",
  title: "D'CODE Barcode Scanner",
  description: "D'CODE warehouse barcode reader and inventory tracker",
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon/favicon.ico', sizes: '64x64', type: 'image/x-icon' },
      { url: '/favicon/web/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/web/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/web/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon/web/favicon-64x64.png', sizes: '64x64', type: 'image/png' },
    ],
    apple: [{ url: '/favicon/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black',
    title: "D'CODE",
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
      <body className="min-h-full max-w-560 flex flex-col mx-auto">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
