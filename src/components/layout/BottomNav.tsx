'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isActive, navFor } from '@/components/layout/nav';
import { Sheet } from '@/components/ui/sheet';
import { useAppStore } from '@/stores/useAppStore';

/** Navegación inferior (móvil): al alcance del pulgar. En escritorio se usa la barra lateral. */
export function BottomNav() {
  const pathname = usePathname();
  const role = useAppStore((s) => s.role);
  const [moreOpen, setMoreOpen] = useState(false);

  const items = navFor(role);
  const primary = items.filter((i) => i.primary);
  const secondary = items.filter((i) => !i.primary);
  const moreActive = secondary.some((i) => isActive(pathname, i.href));
  const slots = primary.length + (secondary.length ? 1 : 0);

  const tabClass = 'group flex min-h-[64px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold';
  const pill = (active: boolean) =>
    cn(
      'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
      active ? 'bg-fresco/15 text-fresco' : 'text-muted-foreground group-active:bg-secondary'
    );

  return (
    <>
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/90 backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-3xl px-2 pb-safe" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
          {primary.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={tabClass}>
                <span className={pill(active)}>
                  <Icon className={cn('h-6 w-6', active && 'stroke-[2.5]')} />
                </span>
                <span className={active ? 'text-fresco' : 'text-muted-foreground'}>{label}</span>
              </Link>
            );
          })}
          {secondary.length > 0 && (
            <button type="button" onClick={() => setMoreOpen(true)} className={tabClass} aria-haspopup="dialog">
              <span className={pill(moreActive)}>
                <MoreHorizontal className="h-6 w-6" />
              </span>
              <span className={moreActive ? 'text-fresco' : 'text-muted-foreground'}>Más</span>
            </button>
          )}
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Más opciones">
        <ul className="grid grid-cols-2 gap-3">
          {secondary.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border-2 font-bold active:scale-[0.97]',
                  isActive(pathname, href) ? 'border-fresco bg-fresco/10 text-fresco' : 'border-border bg-card'
                )}
              >
                <Icon className="h-7 w-7" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
