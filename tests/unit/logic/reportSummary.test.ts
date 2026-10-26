import { describe, expect, it } from 'vitest';
import { bucketSales, filterSales, saleProfit, summarize } from '@/lib/logic/reportSummary';
import type { SaleWithItems } from '@/types';

interface LineSpec {
  name: string;
  q: number;
  p: number;
  c?: number;
  pid?: string | null;
}

function mk(
  over: { id: string; total: number; pm?: SaleWithItems['sale']['payment_method']; seller?: string | null; voided?: string | null; customerName?: string | null; at?: string },
  lineSpecs: LineSpec[]
): SaleWithItems {
  return {
    sale: {
      id: over.id,
      owner_id: 'o',
      ticket_number: over.id,
      customer_name: over.customerName ?? null,
      customer_phone: null,
      payment_method: over.pm ?? 'efectivo',
      subtotal: over.total,
      discount: 0,
      total: over.total,
      amount_paid: null,
      note: null,
      customer_id: null,
      seller_name: over.seller ?? null,
      voided_at: over.voided ?? null,
      void_reason: over.voided ? 'error' : null,
      created_at: over.at ?? '2026-09-10T15:00:00.000Z',
    },
    items: lineSpecs.map((l, k) => ({
      id: `${over.id}-${k}`,
      sale_id: over.id,
      owner_id: 'o',
      product_id: l.pid ?? null,
      product_name: l.name,
      unit: 'kg',
      quantity: l.q,
      unit_price: l.p,
      unit_cost: l.c ?? null,
      subtotal: Math.round(l.q * l.p * 100) / 100,
      created_at: '2026-09-10T15:00:00.000Z',
    })),
  };
}

describe('saleProfit', () => {
  it('total cobrado menos el costo de lo vendido', () => {
    expect(
      saleProfit({ total: 12 }, [
        { quantity: 2, unit_cost: 2 },
        { quantity: 3, unit_cost: 1 },
      ])
    ).toBe(5);
  });

  it('sin costo conocido en alguna línea, no se inventa: devuelve null', () => {
    expect(saleProfit({ total: 12 }, [{ quantity: 2, unit_cost: null }])).toBeNull();
  });

  it('sin líneas, null', () => {
    expect(saleProfit({ total: 12 }, [])).toBeNull();
  });
});

const rows: SaleWithItems[] = [
  mk({ id: 'A', total: 10, seller: 'Ana' }, [{ name: 'Tomate', q: 2, p: 5, c: 2 }]),
  mk({ id: 'B', total: 6, pm: 'fiado', seller: 'Luis' }, [{ name: 'Tomate', q: 1, p: 6, c: 2 }]),
  mk({ id: 'C', total: 99, voided: '2026-09-11T10:00:00Z' }, [{ name: 'Palta', q: 9, p: 11 }]),
  mk({ id: 'D', total: 4, customerName: '=HYPERLINK("http://x")' }, [{ name: '+cmd|calc', q: 1, p: 4 }]),
];

describe('summarize', () => {
  it('excluye las ventas anuladas de los totales', () => {
    const s = summarize(rows);
    expect(s.count).toBe(3);
    expect(s.voidedCount).toBe(1);
    expect(s.revenue).toBe(20); // 10 + 6 + 4, sin la anulada (99)
  });

  it('la ganancia solo suma ventas con costo conocido', () => {
    const s = summarize(rows);
    expect(s.profit).toBe(10); // A: 10-4=6, B: 6-2=4
    expect(s.profitSalesCount).toBe(2);
  });

  it('acumula lo vendido a crédito (fiado)', () => {
    expect(summarize(rows).onCredit).toBe(6);
  });

  it('agrega por producto sumando cantidades repetidas', () => {
    expect(summarize(rows).byProduct.find((p) => p.name === 'Tomate')?.quantity).toBe(3);
  });

  it('un vendedor vacío se agrupa como "Sin registrar"', () => {
    expect(summarize(rows).bySeller.some((s) => s.name === 'Sin registrar')).toBe(true);
  });
});

describe('filterSales', () => {
  it('filtra por método de pago', () => {
    expect(filterSales(rows, { payment: 'fiado', includeVoided: true })).toHaveLength(1);
  });

  it('puede excluir las anuladas', () => {
    expect(filterSales(rows, { payment: 'todos', includeVoided: false })).toHaveLength(3);
  });
});

describe('bucketSales', () => {
  it('un día por balde dentro del rango, con el total correcto', () => {
    const b = bucketSales(
      rows.map((r) => r.sale),
      new Date(2026, 8, 8).getTime(),
      new Date(2026, 8, 13).getTime()
    );
    expect(b).toHaveLength(5);
    expect(b.find((x) => x.key === '2026-09-10')?.total).toBe(20); // sin la anulada
  });

  it('un rango largo se agrupa para no pasar de maxBars', () => {
    const b = bucketSales([], new Date(2026, 0, 1).getTime(), new Date(2026, 11, 31).getTime(), 31);
    expect(b.length).toBeLessThanOrEqual(31);
    expect(b.length).toBeGreaterThan(0);
  });
});
