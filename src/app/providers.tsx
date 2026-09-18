'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { useAppStore } from '@/stores/useAppStore';

/** El Service Worker cachea agresivamente: solo se activa en producción. */
async function setupServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    if (process.env.NODE_ENV === 'production') {
      await navigator.serviceWorker.register('/sw.js');
    } else {
      // En desarrollo un SW viejo serviría JS desactualizado: se desregistra.
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch { /* sin https o navegador restringido: la app funciona igual */ }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 10,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  const setOnline = useAppStore((s) => s.setOnline);

  React.useEffect(() => {
    // Estado real de conexión (el valor inicial del store es fijo para no romper la hidratación)
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    void setupServiceWorker();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [setOnline]);

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
