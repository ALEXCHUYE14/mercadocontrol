import { describe, expect, it } from 'vitest';
import { DEFAULT_LOW_STOCK, isLowStock, lowStockProducts, stockThreshold } from '@/lib/logic/stock';

const base = { min_stock: 0, current_stock: 4, is_active: true };

describe('stockThreshold', () => {
  it('el umbral propio del producto manda', () => {
    expect(stockThreshold({ min_stock: 12 }, 5)).toBe(12);
  });

  it('0 usa el valor por defecto', () => {
    expect(stockThreshold({ min_stock: 0 }, 5)).toBe(5);
  });

  it('un producto anterior a esta función (sin el campo) usa el valor por defecto', () => {
    expect(stockThreshold({} as { min_stock: number }, 5)).toBe(5);
  });
});

describe('isLowStock', () => {
  it('en o por debajo del umbral cuenta como bajo', () => {
    expect(isLowStock(base, 5)).toBe(true);
  });

  it('agotado también cuenta como bajo', () => {
    expect(isLowStock({ ...base, current_stock: 0 }, 5)).toBe(true);
  });

  it('por encima del umbral no cuenta', () => {
    expect(isLowStock({ ...base, current_stock: 6 }, 5)).toBe(false);
  });

  it('un producto inactivo nunca cuenta (no se repone lo que ya no se vende)', () => {
    expect(isLowStock({ ...base, is_active: false }, 5)).toBe(false);
  });

  it('respeta el umbral propio aunque sea mayor al valor por defecto', () => {
    expect(isLowStock({ min_stock: 10, current_stock: 8, is_active: true }, 5)).toBe(true);
  });
});

describe('lowStockProducts', () => {
  it('ordena primero el más crítico (relación stock/umbral más baja)', () => {
    const a = { id: 'a', ...base, current_stock: 4 };
    const b = { id: 'b', ...base, current_stock: 1 };
    expect(lowStockProducts([a, b], 5).map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('usa DEFAULT_LOW_STOCK cuando no se pasa un umbral', () => {
    expect(lowStockProducts([{ ...base, current_stock: DEFAULT_LOW_STOCK }])).toHaveLength(1);
  });
});
