'use client';

// =============================================================================
// Guarda de las pantallas privadas:
//  1. Sin sesión -> redirige a /login.
//  2. Con sesión -> prepara la base local del usuario (categorías, perfil, dueño)
//     y recién entonces muestra la app, para que ninguna consulta lea datos de otro dueño.
//  3. Ya dentro -> sincroniza en segundo plano y mantiene el semáforo al día.
// =============================================================================

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { SplashScreen } from '@/components/auth/SplashScreen';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/AuthProvider';
import { recalcAllFreshness } from '@/lib/db/repository';
import { initSession, syncOnStart, type SessionContext } from '@/lib/db/session';
import { useAppStore } from '@/stores/useAppStore';
import { initSyncListeners } from '@/lib/db/sync';
import { errorMessage } from '@/lib/utils';

const FRESHNESS_INTERVAL_MS = 15 * 60 * 1000;

export function SessionGate({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setRole = useAppStore((s) => s.setRole);
  const [readyFor, setReadyFor] = React.useState<string | null>(null);
  const ctxRef = React.useRef<SessionContext | null>(null);
  const [failure, setFailure] = React.useState<{ userId: string; message: string } | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  const userId = user?.id ?? null;
  const ready = userId !== null && readyFor === userId;

  // 1) Sin sesión -> login
  React.useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // 2) Preparar datos locales del usuario antes de mostrar la app
  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;
    initSession(user)
      .then((ctx) => {
        if (cancelled) return;
        ctxRef.current = ctx;
        setRole(ctx.role);
        queryClient.clear(); // descarta cachés de un usuario anterior
        setFailure(null);
        setReadyFor(user.id);
      })
      .catch((err) => {
        if (!cancelled) setFailure({ userId: user.id, message: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
    // `user` cambia de identidad con cada renovación de token; solo importa el id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, attempt, queryClient, setRole]);

  // 3) Segundo plano: sync de arranque, listeners de red y recálculo periódico del semáforo
  React.useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    const refresh = () => void queryClient.invalidateQueries();

    syncOnStart(user, ctxRef.current ?? { ownerId: user.id, role: 'owner' })
      .then((changed) => {
        if (!cancelled && changed) refresh();
      })
      .catch(() => {});

    const stopListeners = initSyncListeners();
    const timer = setInterval(() => {
      recalcAllFreshness()
        .then((changed) => {
          if (changed) refresh();
        })
        .catch(() => {});
    }, FRESHNESS_INTERVAL_MS);

    return () => {
      cancelled = true;
      stopListeners();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, queryClient]);

  if (failure && failure.userId === userId) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xl font-extrabold">No se pudo abrir tus datos</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {failure.message}. Cierra otras pestañas de la app o revisa que el navegador permita almacenamiento.
        </p>
        <Button onClick={() => setAttempt((n) => n + 1)}>Reintentar</Button>
      </div>
    );
  }

  if (status === 'loading') return <SplashScreen />;
  if (status === 'unauthenticated') return <SplashScreen label="Redirigiendo…" />;
  if (!ready) return <SplashScreen label="Preparando tu puesto…" />;
  return <>{children}</>;
}
