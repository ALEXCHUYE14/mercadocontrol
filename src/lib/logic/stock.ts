// =============================================================================
// Alertas de stock mínimo (PURO).
// Cada producto puede tener su propio umbral; si es 0 se usa el valor por defecto
// configurado en Ajustes.
// =============================================================================

import type { Product } from '@/types';

export const DEFAULT_LOW_STOCK = 5;

type StockFields = Pick<Product, 'min_stock' | 'current_stock' | 'is_active'>;

/** Umbral efectivo del producto. Tolera productos antiguos sin `min_stock`. */
export function stockThreshold(p: Pick<Product, 'min_stock'>, fallback: number = DEFAULT_LOW_STOCK): number {
  const own = Number(p.min_stock);
  return Number.isFinite(own) && own > 0 ? own : Math.max(0, fallback);
}

/** true si el producto activo está en o por debajo de su umbral (incluye agotado). */
export function isLowStock(p: StockFields, fallback: number = DEFAULT_LOW_STOCK): boolean {
  return p.is_active && p.current_stock <= stockThreshold(p, fallback);
}

/** Productos por reponer, primero los más críticos (menor stock relativo al umbral). */
export function lowStockProducts<T extends StockFields>(products: T[], fallback: number = DEFAULT_LOW_STOCK): T[] {
  return products
    .filter((p) => isLowStock(p, fallback))
    .sort((a, b) => {
      const ra = a.current_stock / stockThreshold(a, fallback);
      const rb = b.current_stock / stockThreshold(b, fallback);
      return ra - rb;
    });
}
