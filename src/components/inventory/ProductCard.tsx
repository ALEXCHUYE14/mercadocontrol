'use client';

import { useMemo } from 'react';
import { Trash2, ShoppingCart, Clock } from 'lucide-react';
import type { Category, Product } from '@/types';
import { computeFreshness, FRESHNESS_META, freshnessHint } from '@/lib/logic/freshness';
import { formatPEN, formatQty, cn } from '@/lib/utils';
import { marginPct } from '@/lib/logic/pricing';

interface ProductCardProps {
  product: Product;
  category?: Category | null;
  onWaste: (product: Product) => void;
  onSell: (product: Product) => void;
}

export function ProductCard({ product, category, onWaste, onSell }: ProductCardProps) {
  const fresh = useMemo(
    () => computeFreshness(product, category),
    [product, category]
  );
  const meta = FRESHNESS_META[fresh.state];
  const margin = marginPct(product.sale_price, product.avg_cost);

  const daysLabel =
    fresh.daysLeft >= 1
      ? `${Math.floor(fresh.daysLeft)} día(s)`
      : fresh.daysLeft > 0
      ? 'Hoy'
      : 'Vencido';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 bg-card shadow-sm ring-1',
        fresh.state === 'rojo' && 'border-semaforo-rojo/40 ring-semaforo-rojo/10',
        fresh.state === 'amarillo' && 'border-semaforo-amarillo/40 ring-semaforo-amarillo/10',
        fresh.state === 'verde' && 'border-semaforo-verde/30 ring-semaforo-verde/5'
      )}
    >
      {/* Franja lateral del semáforo */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-2',
          meta.dot,
          fresh.state === 'rojo' && 'animate-pulse-soft'
        )}
      />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">{category?.icon ?? '📦'}</span>
              <h3 className="truncate text-lg font-bold">{product.name}</h3>
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span className={cn('inline-flex items-center gap-1 font-semibold', meta.text)}>
                <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
                {meta.label}
              </span>
              <span className="text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {daysLabel}
              </span>
            </div>
          </div>

          {/* Stock grande y legible */}
          <div className="shrink-0 text-right">
            <div className="text-2xl font-extrabold tabular-nums leading-none">
              {formatQty(product.current_stock)}
            </div>
            <div className="text-xs uppercase text-muted-foreground">{product.unit}</div>
          </div>
        </div>

        {/* Precio, costo, margen */}
        <div className="mt-3 flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm">
          <span className="font-semibold">
            Venta {formatPEN(product.sale_price)}
          </span>
          <span className="text-muted-foreground">
            Costo {formatPEN(product.avg_cost)}
          </span>
          <span className={cn('font-bold', margin >= 20 ? 'text-fresco' : 'text-atencion')}>
            {margin}%
          </span>
        </div>

        {/* Sugerencia según semáforo */}
        {fresh.state !== 'verde' && (
          <p className={cn('mt-2 text-sm font-semibold', meta.text)}>
            {meta.emoji} {freshnessHint(fresh.state)}
          </p>
        )}

        {/* Acciones grandes */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => onSell(product)}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-fresco font-bold text-fresco-fg active:scale-[0.98]"
          >
            <ShoppingCart className="h-5 w-5" /> Vender
          </button>
          <button
            onClick={() => onWaste(product)}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-alerta/10 font-bold text-alerta active:scale-[0.98]"
          >
            <Trash2 className="h-5 w-5" /> Merma
          </button>
        </div>
      </div>
    </div>
  );
}
