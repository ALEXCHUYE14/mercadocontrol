import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { BottomNav } from '@/components/layout/BottomNav';
import { TopBar } from '@/components/layout/TopBar';

export const metadata: Metadata = {
  title: 'MercadoControl',
  description: 'Gestiona tu puesto: inventario, frescura y mermas. Funciona sin internet.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MercadoControl',
  },
};

export const viewport: Viewport = {
  themeColor: '#065F46',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" suppressHydrationWarning>
      <body className="min-h-screen bg-background">
        <Providers>
          <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
            <TopBar />
            <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
            <BottomNav />
          </div>
        </Providers>
      </body>
    </html>
  );
}
