import { describe, expect, it } from 'vitest';
import { inventoryValue, marginPct, unitMargin, weightedAvgCost } from '@/lib/logic/pricing';

describe('weightedAvgCost', () => {
  it('pondera el costo nuevo con el stock existente', () => {
    // (18*2.2 + 7*3) / 25 = 2.424
    expect(weightedAvgCost(18, 2.2, 7, 3)).toBe(2.424);
  });

  it('con stock 0 adopta el costo nuevo', () => {
    expect(weightedAvgCost(0, 0, 5, 3)).toBe(3);
  });

  it('si el total queda en 0 o negativo conserva el costo anterior (evita dividir por 0)', () => {
    expect(weightedAvgCost(0, 2.5, 0, 3)).toBe(2.5);
  });
});

describe('unitMargin / marginPct', () => {
  it('margen unitario', () => {
    expect(unitMargin(5, 3)).toBe(2);
  });

  it('margen porcentual sobre el precio de venta', () => {
    expect(marginPct(5, 3)).toBe(40);
  });

  it('precio de venta 0 no revienta (división por 0 evitada)', () => {
    expect(marginPct(0, 3)).toBe(0);
  });
});

describe('inventoryValue', () => {
  it('stock por costo promedio', () => {
    expect(inventoryValue(10, 2.5)).toBe(25);
  });
});
