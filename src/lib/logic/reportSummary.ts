// =============================================================================
// Resumen de ventas para reportes (PURO). Las ventas anuladas no suman a nada.
// =============================================================================

import { localDayKey } from '@/lib/logic/reports';
import type { PaymentMethod, Sale, SaleItem, SaleWithItems } from '@/types';

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Ganancia bruta de una venta = total cobrado − costo de lo vendido (ya con descuento).
 * null si algún renglón no tiene costo (ventas anteriores a este dato): no se inventa.
 */
export function saleProfit(sale: Pick<Sale, 'total'>, items: Pick<SaleItem, 'quantity' | 'unit_cost'>[]): number | null {
  if (!items.length) return null;
  let cost = 0;
  for (const it of items) {
    if (it.unit_cost == null || !Number.isFinite(it.unit_cost)) return null;
    cost += it.quantity * it.unit_cost;
  }
  return r2(sale.total - cost);
}

export interface ReportFilters {
  payment: PaymentMethod | 'todos';
  includeVoided: boolean;
}

export function filterSales(rows: SaleWithItems[], filters: ReportFilters): SaleWithItems[] {
  return rows.filter((r) => {
    if (!filters.includeVoided && r.sale.voided_at) return false;
    return filters.payment === 'todos' || r.sale.payment_method === filters.payment;
  });
}

export interface PaymentBreakdown {
  method: PaymentMethod;
  count: number;
  total: number;
}

export interface ProductBreakdown {
  name: string;
  unit: string;
  quantity: number;
  revenue: number;
}

export interface SellerBreakdown {
  name: string;
  count: number;
  total: number;
}

export interface ReportSummary {
  count: number;
  voidedCount: number;
  revenue: number;
  discounts: number;
  avgTicket: number;
  /** Ganancia bruta de las ventas con costo conocido */
  profit: number;
  /** Cuántas ventas entraron al cálculo de ganancia (las demás no tienen costo) */
  profitSalesCount: number;
  /** Lo vendido a crédito en el período (aún no cobrado, salvo abonos posteriores) */
  onCredit: number;
  byPayment: PaymentBreakdown[];
  byProduct: ProductBreakdown[];
  bySeller: SellerBreakdown[];
}

export function summarize(rows: SaleWithItems[]): ReportSummary {
  const active = rows.filter((r) => !r.sale.voided_at);
  const payment = new Map<PaymentMethod, PaymentBreakdown>();
  const product = new Map<string, ProductBreakdown>();
  const seller = new Map<string, SellerBreakdown>();
  let revenue = 0;
  let discounts = 0;
  let profit = 0;
  let profitSales = 0;
  let onCredit = 0;

  for (const { sale, items } of active) {
    revenue += sale.total;
    discounts += sale.discount;
    if (sale.payment_method === 'fiado') onCredit += sale.total;

    const p = payment.get(sale.payment_method) ?? { method: sale.payment_method, count: 0, total: 0 };
    p.count += 1;
    p.total += sale.total;
    payment.set(sale.payment_method, p);

    const sName = sale.seller_name?.trim() || 'Sin registrar';
    const s = seller.get(sName) ?? { name: sName, count: 0, total: 0 };
    s.count += 1;
    s.total += sale.total;
    seller.set(sName, s);

    for (const it of items) {
      const key = `${it.product_id ?? it.product_name}|${it.unit}`;
      const pr = product.get(key) ?? { name: it.product_name, unit: it.unit, quantity: 0, revenue: 0 };
      pr.quantity += it.quantity;
      pr.revenue += it.subtotal;
      product.set(key, pr);
    }

    const gain = saleProfit(sale, items);
    if (gain !== null) {
      profit += gain;
      profitSales += 1;
    }
  }

  const count = active.length;
  return {
    count,
    voidedCount: rows.length - count,
    revenue: r2(revenue),
    discounts: r2(discounts),
    avgTicket: count ? r2(revenue / count) : 0,
    profit: r2(profit),
    profitSalesCount: profitSales,
    onCredit: r2(onCredit),
    byPayment: [...payment.values()].map((x) => ({ ...x, total: r2(x.total) })).sort((a, b) => b.total - a.total),
    byProduct: [...product.values()]
      .map((x) => ({ ...x, quantity: Math.round(x.quantity * 1000) / 1000, revenue: r2(x.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
    bySeller: [...seller.values()].map((x) => ({ ...x, total: r2(x.total) })).sort((a, b) => b.total - a.total),
  };
}

export interface ChartBucket {
  key: string;
  label: string;
  total: number;
  count: number;
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/**
 * Ventas por día dentro de [fromMs, toMs). Si hay más de `maxBars` días se agrupan por
 * bloques para que el gráfico siga legible.
 */
export function bucketSales(
  sales: Pick<Sale, 'total' | 'created_at' | 'voided_at'>[],
  fromMs: number,
  toMs: number,
  maxBars = 31
): ChartBucket[] {
  const days: ChartBucket[] = [];
  const index = new Map<string, number>();
  for (let t = new Date(fromMs); t.getTime() < toMs; t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)) {
    const key = localDayKey(t);
    index.set(key, days.length);
    days.push({
      key,
      label: days.length < 8 && toMs - fromMs <= 8 * 86_400_000 ? WEEKDAYS[t.getDay()] : `${t.getDate()}/${t.getMonth() + 1}`,
      total: 0,
      count: 0,
    });
  }
  for (const s of sales) {
    if (s.voided_at) continue;
    const i = index.get(localDayKey(new Date(s.created_at)));
    if (i === undefined) continue;
    days[i].total = r2(days[i].total + s.total);
    days[i].count += 1;
  }
  if (days.length <= maxBars) return days;

  const size = Math.ceil(days.length / maxBars);
  const grouped: ChartBucket[] = [];
  for (let i = 0; i < days.length; i += size) {
    const chunk = days.slice(i, i + size);
    grouped.push({
      key: chunk[0].key,
      label: chunk[0].label,
      total: r2(chunk.reduce((s, d) => s + d.total, 0)),
      count: chunk.reduce((s, d) => s + d.count, 0),
    });
  }
  return grouped;
}
