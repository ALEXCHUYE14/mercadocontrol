'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Settings, WifiOff } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { drainQueue } from '@/lib/db/sync';
import { db } from '@/lib/db/dexie';
import { hasBackend } from '@/lib/supabase/client';
import { useProfile } from '@/hooks/useSales';
import { useAuth } from '@/lib/auth/AuthProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export function TopBar() {
  const online = useAppStore((s) => s.online);
  const pending = useAppStore((s) => s.pendingSync);
  const setPending = useAppStore((s) => s.setPendingSync);
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const initial = (profile?.stall_name || user?.stallName || user?.displayName || 'M').trim().charAt(0).toUpperCase();
  const backend = hasBackend();

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
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 lg:px-8">
        <Link href="/" className="flex items-center gap-2 lg:invisible" aria-label="Inicio">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-bosque text-xl">🧺</span>
          <span className="text-lg font-extrabold tracking-tight">MercadoControl</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {backend && (
            <button
              type="button"
              onClick={onSync}
              disabled={busy || pending === 0 || !online}
              aria-label={pending > 0 ? `${pending} cambios pendientes de sincronizar` : 'Todo sincronizado'}
              className="flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-semibold shadow-sm active:scale-95 disabled:opacity-80"
            >
              {pending > 0 ? (
                <>
                  <CloudOff className="h-4 w-4 text-atencion" />
                  <span className="tabular">{pending}</span>
                </>
              ) : (
                <Cloud className="h-4 w-4 text-fresco" />
              )}
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${busy ? 'animate-spin' : ''}`} />
            </button>
          )}
          <Link
            href="/ajustes"
            aria-label="Ajustes"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-bosque text-base font-extrabold text-bosque-fg shadow-sm lg:hidden"
          >
            {initial}
          </Link>
          <Link
            href="/ajustes"
            aria-label="Ajustes"
            className="hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground lg:flex"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Aviso offline persistente y claro */}
      {!online && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 bg-atencion px-4 py-1.5 text-center text-sm font-semibold text-atencion-fg"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          Sin internet · Todo se guarda en tu teléfono{backend ? ' y se subirá solo' : ''}
        </div>
      )}
    </header>
  );
}
