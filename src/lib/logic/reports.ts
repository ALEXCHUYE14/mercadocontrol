// =============================================================================
// Reportes de ventas: agregaciones PURAS sobre ventas y detalle (testeables sin DB).
// =============================================================================

import type { Sale, SaleItem } from '@/types';

/** Clave de día (AAAA-MM-DD) en hora local del dispositivo. */
export function localDayKey(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export interface DaySales {
  day: string; // AAAA-MM-DD
  label: string; // "lun", "mar"…
  total: number;
  count: number;
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Ventas por día de los últimos `days` días (incluye hoy y los días sin ventas en 0). */
export function salesByDay(
  sales: Pick<Sale, 'total' | 'created_at'>[],
  days: number,
  now = new Date()
): DaySales[] {
  const buckets = new Map<string, DaySales>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    buckets.set(localDayKey(d), { day: localDayKey(d), label: WEEKDAYS[d.getDay()], total: 0, count: 0 });
  }
  for (const s of sales) {
    const t = new Date(s.created_at);
    if (Number.isNaN(t.getTime())) continue;
    const b = buckets.get(localDayKey(t));
    if (!b) continue;
    b.total = Math.round((b.total + s.total) * 100) / 100;
    b.count += 1;
  }
  return [...buckets.values()];
}

export interface TopProduct {
  name: string;
  quantity: number;
  unit: string;
  revenue: number;
}

/** Productos más vendidos (por ingreso) dentro del detalle de ventas dado. */
export function topProducts(
  items: Pick<SaleItem, 'product_id' | 'product_name' | 'unit' | 'quantity' | 'subtotal'>[],
  limit = 5
): TopProduct[] {
  const acc = new Map<string, TopProduct>();
  for (const it of items) {
    const key = `${it.product_id ?? it.product_name}|${it.unit}`;
    const cur = acc.get(key) ?? { name: it.product_name, quantity: 0, unit: it.unit, revenue: 0 };
    cur.quantity = Math.round((cur.quantity + it.quantity) * 1000) / 1000;
    cur.revenue = Math.round((cur.revenue + it.subtotal) * 100) / 100;
    acc.set(key, cur);
  }
  return [...acc.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}
