import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'MercadoControl', template: '%s · MercadoControl' },
  description: 'Gestiona tu puesto: inventario, ventas con ticket, frescura y mermas. Funciona sin internet.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MercadoControl',
  },
};

// Se permite el zoom (accesibilidad): antes estaba bloqueado con maximumScale=1
export const viewport: Viewport = {
  themeColor: '#065F46',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" className={sans.variable} suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes del primer pintado (evita parpadeo) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-background">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
