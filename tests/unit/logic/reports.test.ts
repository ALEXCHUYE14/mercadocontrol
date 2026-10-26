import { describe, expect, it } from 'vitest';
import { localDayKey, salesByDay, topProducts } from '@/lib/logic/reports';

describe('salesByDay', () => {
  it('genera un balde por día, con 0 en los días sin ventas, e ignora lo fuera de rango', () => {
    const now = new Date(2026, 8, 18, 15, 0);
    const days = salesByDay(
      [
        { total: 10, created_at: new Date(2026, 8, 18, 9).toISOString() },
        { total: 5.5, created_at: new Date(2026, 8, 17, 9).toISOString() },
        { total: 99, created_at: new Date(2026, 7, 1).toISOString() }, // fuera de los 7 días
      ],
      7,
      now
    );
    expect(days).toHaveLength(7);
    expect(days[6].total).toBe(10); // hoy
    expect(days[5].total).toBe(5.5); // ayer
    expect(days.reduce((s, d) => s + d.total, 0)).toBe(15.5);
  });
});

describe('topProducts', () => {
  it('agrega por producto+unidad y ordena por ingreso', () => {
    const top = topProducts(
      [
        { product_id: 'a', product_name: 'A', unit: 'kg', quantity: 1, subtotal: 5 },
        { product_id: 'b', product_name: 'B', unit: 'kg', quantity: 1, subtotal: 9 },
        { product_id: 'a', product_name: 'A', unit: 'kg', quantity: 2, subtotal: 6 },
      ],
      2
    );
    expect(top.map((p) => [p.name, p.quantity, p.revenue])).toEqual([
      ['A', 3, 11],
      ['B', 1, 9],
    ]);
  });

  it('respeta el límite', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      product_id: String(i),
      product_name: `P${i}`,
      unit: 'kg' as const,
      quantity: 1,
      subtotal: i,
    }));
    expect(topProducts(items, 3)).toHaveLength(3);
  });
});

describe('localDayKey', () => {
  it('formatea en hora local, con ceros a la izquierda', () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
