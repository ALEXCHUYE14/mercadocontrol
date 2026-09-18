// =============================================================================
// Motor del semáforo de frescura (mismo cálculo que fn_recalc_freshness en SQL)
// Se ejecuta también en el cliente para que funcione 100% offline.
// =============================================================================

import type { Category, FreshnessState, Product } from '@/types';
import { daysSince } from '@/lib/utils';

export interface FreshnessResult {
  state: FreshnessState;
  /** fracción de vida útil consumida (0..1+) */
  fraction: number;
  /** días restantes estimados (puede ser negativo si venció) */
  daysLeft: number;
}

const DEFAULTS = {
  shelfLife: 7,
  yellow: 0.5,
  red: 0.8,
};

/**
 * Calcula el estado de frescura de un producto según el tiempo desde su
 * ingreso, la vida útil de su categoría y (si existe) su fecha de vencimiento.
 */
export function computeFreshness(
  product: Pick<Product, 'entry_date' | 'expires_at'>,
  category?: Pick<Category, 'avg_shelf_life_days' | 'yellow_threshold' | 'red_threshold'> | null
): FreshnessResult {
  const shelfLife = category?.avg_shelf_life_days ?? DEFAULTS.shelfLife;
  const yellow = category?.yellow_threshold ?? DEFAULTS.yellow;
  const red = category?.red_threshold ?? DEFAULTS.red;

  const elapsed = Math.max(0, daysSince(product.entry_date));
  const fraction = elapsed / Math.max(shelfLife, 1);
  let daysLeft = shelfLife - elapsed;

  // Vencimiento explícito manda sobre el cálculo por antigüedad
  const expiresMs = product.expires_at != null ? new Date(product.expires_at).getTime() : NaN;
  const hasExpiry = !Number.isNaN(expiresMs);
  const expired = hasExpiry && expiresMs <= Date.now();
  if (hasExpiry) daysLeft = Math.min(daysLeft, (expiresMs - Date.now()) / 86_400_000);

  let state: FreshnessState;
  if (expired || fraction >= red) state = 'rojo';
  else if (fraction >= yellow) state = 'amarillo';
  else state = 'verde';

  return { state, fraction, daysLeft };
}

/** Texto de acción sugerida según el estado (para la UI). */
export function freshnessHint(state: FreshnessState): string {
  switch (state) {
    case 'verde':
      return 'Producto fresco';
    case 'amarillo':
      return 'Vender pronto · arma combos u ofertas';
    case 'rojo':
      return '¡Remate urgente! · ofrece a restaurantes';
  }
}

export const FRESHNESS_META: Record<
  FreshnessState,
  { label: string; emoji: string; dot: string; ring: string; text: string }
> = {
  verde: {
    label: 'Fresco',
    emoji: '🟢',
    dot: 'bg-semaforo-verde',
    ring: 'ring-semaforo-verde/40',
    text: 'text-semaforo-verde',
  },
  amarillo: {
    label: 'Prioritario',
    emoji: '🟡',
    dot: 'bg-semaforo-amarillo',
    ring: 'ring-semaforo-amarillo/40',
    text: 'text-semaforo-amarillo',
  },
  rojo: {
    label: 'Urgente',
    emoji: '🔴',
    dot: 'bg-semaforo-rojo',
    ring: 'ring-semaforo-rojo/40',
    text: 'text-semaforo-rojo',
  },
};
