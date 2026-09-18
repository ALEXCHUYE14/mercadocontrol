'use client';

import { Cloud, CloudOff, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { drainQueue } from '@/lib/db/sync';
import { useEffect, useState } from 'react';
import { db } from '@/lib/db/dexie';

export function TopBar() {
  const online = useAppStore((s) => s.online);
  const pending = useAppStore((s) => s.pendingSync);
  const setPending = useAppStore((s) => s.setPendingSync);
  const [busy, setBusy] = useState(false);

  // Refresca el contador de pendientes periódicamente
  useEffect(() => {
    const tick = async () => {
      try {
        setPending(await db().syncQueue.count());
      } catch { /* noop */ }
    };
    void tick();
    const i = setInterval(tick, 5000);
    return () => clearInterval(i);
  }, [setPending]);

  const onSync = async () => {
    setBusy(true);
    try {
      const { pending } = await drainQueue();
      setPending(pending);
    } catch { /* se reintenta en la próxima sincronización */ } finally {
      setBusy(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-bosque text-bosque-fg shadow-md">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧺</span>
          <span className="text-lg font-extrabold tracking-tight">MercadoControl</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Estado de conexión */}
          <span
            className="flex items-center gap-1 text-sm font-semibold"
            title={online ? 'Con conexión' : 'Sin conexión — tus datos se guardan igual'}
          >
            {online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5 text-amber-300" />}
          </span>

          {/* Estado de sincronización */}
          <button
            onClick={onSync}
            disabled={busy || pending === 0}
            className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold active:scale-95 disabled:opacity-70"
            title="Sincronizar con la nube"
          >
            {pending > 0 ? (
              <>
                <CloudOff className="h-4 w-4 text-amber-300" />
                <span>{pending}</span>
              </>
            ) : (
              <Cloud className="h-4 w-4" />
            )}
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Aviso offline persistente y claro */}
      {!online && (
        <div className="bg-atencion px-4 py-1.5 text-center text-sm font-semibold text-atencion-fg">
          Sin internet · Todo se guarda en tu teléfono y se subirá solo
        </div>
      )}
    </header>
  );
}
