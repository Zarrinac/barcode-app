import type { Metadata } from 'next';
import '@/assets/styles/globals.css';

export const metadata: Metadata = {
  title: 'Barcode Warehouse',
  description: 'Warehouse barcode reader and inventory tracker',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
