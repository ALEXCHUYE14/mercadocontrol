'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { canOpenRoute, homeRoute } from '@/lib/auth/permissions';
import { useAppStore } from '@/stores/useAppStore';

/**
 * Marco de las pantallas privadas: barra lateral (escritorio) + barra superior +
 * navegación inferior (móvil). También impide abrir por URL pantallas que el rol no permite.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAppStore((s) => s.role);
  const allowed = canOpenRoute(role, pathname);

  React.useEffect(() => {
    if (!allowed) router.replace(homeRoute(role));
  }, [allowed, role, router]);

  return (
    <div className="min-h-dvh lg:pl-64">
      <Sidebar />
      <TopBar />
      <main id="contenido" className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 lg:px-8 lg:pb-12 lg:pt-8">
        {allowed ? children : null}
      </main>
      <BottomNav />
    </div>
  );
}
