'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ensureSeed } from '@/lib/db/seed';
import { db } from '@/lib/db/dexie';
import { drainQueue, initSyncListeners, pullFromServer } from '@/lib/db/sync';
import { recalcAllFreshness } from '@/lib/db/repository';
import { getSupabase, hasBackend } from '@/lib/supabase/client';
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
  const setPending = useAppStore((s) => s.setPendingSync);

  React.useEffect(() => {
    let mounted = true;
    // Estado real de conexión (el valor inicial del store es fijo para no romper la hidratación)
    setOnline(navigator.onLine);

    async function bootstrap() {
      // 1) Semilla local (categorías + demo) para uso inmediato offline
      await ensureSeed();
      // Las consultas de la UI pudieron correr antes de la semilla: se refrescan
      await client.invalidateQueries();

      // 2) Registrar Service Worker (PWA)
      await setupServiceWorker();

      // 3) Si hay backend y sesión, define el owner real
      let uid: string | undefined;
      if (hasBackend()) {
        try {
          const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
          uid = data.session?.user.id;
          if (uid) await db().meta.put({ key: 'owner_id', value: uid });
        } catch { /* sin red: se usa el owner local */ }
      }

      // 4) Subir primero lo pendiente y recién después bajar datos del servidor
      await drainQueue();
      if (uid) await pullFromServer(uid);

      // 5) Recalcular semáforo al abrir la app
      await recalcAllFreshness();
      await client.invalidateQueries();

      // 6) Contador de pendientes
      const { pending } = await drainQueue();
      if (mounted) setPending(pending);
    }

    bootstrap().catch((err) => {
      console.error('[MercadoControl] Error al iniciar', err);
    });

    const stopSyncListeners = initSyncListeners();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Recalcular frescura periódicamente (cada 15 min) y refrescar la UI si cambió algo
    const interval = setInterval(() => {
      recalcAllFreshness()
        .then((changed) => (changed ? client.invalidateQueries() : undefined))
        .catch(() => {});
    }, 1000 * 60 * 15);

    return () => {
      mounted = false;
      stopSyncListeners();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      clearInterval(interval);
    };
  }, [client, setOnline, setPending]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
