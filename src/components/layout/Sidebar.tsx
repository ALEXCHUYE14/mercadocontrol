'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isActive, navFor } from '@/components/layout/nav';
import { useAppStore } from '@/stores/useAppStore';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useProfile } from '@/hooks/useSales';

/** Barra lateral (escritorio / tablet horizontal). */
export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const role = useAppStore((s) => s.role);
  const { data: profile } = useProfile();
  const stall = profile?.stall_name || user?.stallName || 'Mi Puesto';
  const person = profile?.full_name || user?.displayName || user?.email || '';

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-bosque px-4 py-6 text-bosque-fg lg:flex">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-2xl">🧺</span>
        <span className="text-lg font-extrabold tracking-tight">MercadoControl</span>
      </Link>

      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
        {navFor(role).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-[48px] items-center gap-3 rounded-xl px-3 font-semibold transition-colors',
                active ? 'bg-white text-bosque shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="rounded-2xl bg-white/10 p-3">
        <p className="truncate text-sm font-bold">{stall}</p>
        {person && (
          <p className="truncate text-xs text-white/70">
            {person}
            {role === 'cajero' ? ' · Cajero' : ''}
          </p>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-semibold hover:bg-white/20"
        >
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
