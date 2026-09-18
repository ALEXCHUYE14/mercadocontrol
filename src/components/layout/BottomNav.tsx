'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Boxes, Trash2, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/inventario', label: 'Inventario', icon: Boxes },
  { href: '/mermas', label: 'Mermas', icon: Trash2 },
  { href: '/cierre', label: 'Cierre', icon: Moon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex min-h-touch flex-col items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors',
                active ? 'text-fresco' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-6 w-6', active && 'stroke-[2.5]')} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
