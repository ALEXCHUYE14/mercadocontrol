import { describe, expect, it } from 'vitest';
import { cartSubtotal, cartTotals, cashChange, lineSubtotal, parseMoney, quickCashOptions } from '@/lib/logic/cart';

describe('parseMoney', () => {
  it('acepta punto y coma decimal', () => {
    expect(parseMoney('2.5')).toBe(2.5);
    expect(parseMoney('2,50')).toBe(2.5);
  });

  it('recorta espacios', () => {
    expect(parseMoney(' 3 ')).toBe(3);
  });

  it('rechaza vacío, texto, negativos y notación científica', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('-1')).toBeNull();
    expect(parseMoney('1e3')).toBeNull();
  });

  it('un punto decimal sin dígitos detrás se acepta (se está escribiendo "2.50")', () => {
    expect(parseMoney('2.')).toBe(2);
  });

  it('más de 4 decimales se rechaza', () => {
    expect(parseMoney('2.123456')).toBeNull();
  });
});

describe('lineSubtotal / cartSubtotal', () => {
  it('cantidad por precio, redondeado a centavos', () => {
    expect(lineSubtotal({ productId: 'a', quantity: 2.5, unitPrice: 4 })).toBe(10);
  });

  it('suma varias líneas', () => {
    expect(
      cartSubtotal([
        { productId: 'a', quantity: 2, unitPrice: 1.1 },
        { productId: 'b', quantity: 1, unitPrice: 2.2 },
      ])
    ).toBe(4.4);
  });
});

describe('cartTotals', () => {
  it('aplica el descuento sobre el subtotal', () => {
    expect(cartTotals([{ productId: 'a', quantity: 2, unitPrice: 1.1 }], 0.5)).toEqual({
      subtotal: 2.2,
      discount: 0.5,
      total: 1.7,
    });
  });

  it('el descuento nunca supera el subtotal ni lo vuelve negativo', () => {
    expect(cartTotals([{ productId: 'a', quantity: 1, unitPrice: 2 }], 99).total).toBe(0);
  });

  it('un descuento negativo se trata como 0', () => {
    expect(cartTotals([{ productId: 'a', quantity: 1, unitPrice: 2 }], -5).discount).toBe(0);
  });
});

describe('cashChange', () => {
  it('vuelto cuando se recibe de más', () => {
    expect(cashChange(12, 20)).toEqual({ change: 8, missing: 0 });
  });

  it('falta cuando se recibe de menos', () => {
    expect(cashChange(12, 5)).toEqual({ change: 0, missing: 7 });
  });

  it('monto exacto: ni vuelto ni falta', () => {
    expect(cashChange(12, 12)).toEqual({ change: 0, missing: 0 });
  });
});

describe('quickCashOptions', () => {
  it('sugiere billetes/monedas que cubren el total, sin repetir el exacto', () => {
    expect(quickCashOptions(12)).toEqual([20, 50, 100]);
  });

  it('si el total coincide con una denominación, no la repite', () => {
    expect(quickCashOptions(20)).not.toContain(20);
  });
});
