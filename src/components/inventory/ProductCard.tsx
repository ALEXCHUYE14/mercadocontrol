'use client';

import { useMemo } from 'react';
import { AlertTriangle, Clock, Pencil, ShoppingCart, Trash2 } from 'lucide-react';
import type { Category, Product } from '@/types';
import { computeFreshness, FRESHNESS_META, freshnessHint } from '@/lib/logic/freshness';
import { cn, formatPEN, formatQty } from '@/lib/utils';
import { marginPct } from '@/lib/logic/pricing';

interface ProductCardProps {
  product: Product;
  category?: Category | null;
  onWaste: (product: Product) => void;
  onSell: (product: Product) => void;
  onEdit?: (product: Product) => void;
  /** Alerta de stock bajo (ya calculada con el umbral efectivo) */
  lowStock?: boolean;
  /** Permisos del rol: el cajero solo vende */
  canWaste?: boolean;
  canSell?: boolean;
}

export function ProductCard({
  product,
  category,
  onWaste,
  onSell,
  onEdit,
  lowStock = false,
  canWaste = true,
  canSell = true,
}: ProductCardProps) {
  const fresh = useMemo(() => computeFreshness(product, category), [product, category]);
  const meta = FRESHNESS_META[fresh.state];
  const margin = marginPct(product.sale_price, product.avg_cost);
  const soldOut = product.current_stock <= 0;

  const daysLabel =
    fresh.daysLeft >= 1 ? `${Math.floor(fresh.daysLeft)} día(s)` : fresh.daysLeft > 0 ? 'Hoy' : 'Vencido';

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card',
        soldOut && 'opacity-75'
      )}
    >
      {/* Franja lateral del semáforo */}
      <div
        aria-hidden
        className={cn('absolute left-0 top-0 h-full w-1.5', meta.dot, fresh.state === 'rojo' && 'animate-pulse-soft')}
      />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-xl">
                {category?.icon ?? '📦'}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold leading-tight">{product.name}</h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  <span className={cn('inline-flex items-center gap-1 font-semibold', meta.text)}>
                    <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                    {meta.label}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {daysLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stock grande y legible */}
          <div className="flex shrink-0 items-start gap-2">
            {onEdit && (
              <button
                type="button"
                aria-label={`Editar ${product.name}`}
                onClick={() => onEdit(product)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          <div className="text-right">
            <div className="text-2xl font-extrabold leading-none tabular">{formatQty(product.current_stock)}</div>
            <div className="mt-0.5 text-xs uppercase text-muted-foreground">{soldOut ? 'agotado' : product.unit}</div>
          </div>
          </div>
        </div>

        {lowStock && !soldOut && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-atencion/12 px-2.5 py-1 text-xs font-bold text-atencion">
            <AlertTriangle className="h-3.5 w-3.5" /> Stock bajo · conviene reponer
          </p>
        )}

        {/* Precio, costo, margen */}
        <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-secondary/70 px-3 py-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Venta</dt>
            <dd className="font-bold tabular">{formatPEN(product.sale_price)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Costo</dt>
            <dd className="font-semibold tabular text-muted-foreground">{formatPEN(product.avg_cost)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-muted-foreground">Margen</dt>
            <dd className={cn('font-bold tabular', margin >= 20 ? 'text-fresco' : 'text-atencion')}>{margin}%</dd>
          </div>
        </dl>

        {/* Sugerencia según semáforo */}
        {fresh.state !== 'verde' && (
          <p className={cn('mt-2 text-sm font-semibold', meta.text)}>
            {meta.emoji} {freshnessHint(fresh.state)}
          </p>
        )}

        {/* Acciones grandes */}
        <div className={cn('mt-3 grid gap-2', canWaste && canSell ? 'grid-cols-2' : 'grid-cols-1')}>
          {canSell && (
          <button
            type="button"
            onClick={() => onSell(product)}
            disabled={soldOut}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-fresco font-bold text-fresco-fg shadow-glow active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
          >
            <ShoppingCart className="h-5 w-5" /> Vender
          </button>
          )}
          {canWaste && (
          <button
            type="button"
            onClick={() => onWaste(product)}
            disabled={soldOut}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-alerta/10 font-bold text-alerta active:scale-[0.98] disabled:opacity-40"
          >
            <Trash2 className="h-5 w-5" /> Merma
          </button>
          )}
        </div>
      </div>
    </article>
  );
}
