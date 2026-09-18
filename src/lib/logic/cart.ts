// =============================================================================
// Cálculos PUROS del carrito de venta (sin React ni DB): subtotal, descuento,
// total, vuelto y parseo seguro de montos escritos por la persona.
// =============================================================================

export interface CartLine {
  productId: string;
  quantity: number;
  /** Precio unitario ya validado */
  unitPrice: number;
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Convierte lo escrito ("2.5", "2,50") a número >= 0; null si es inválido o vacío. */
export function parseMoney(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,4})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function lineSubtotal(line: CartLine): number {
  return r2(line.quantity * line.unitPrice);
}

export function cartSubtotal(lines: CartLine[]): number {
  return r2(lines.reduce((s, l) => s + lineSubtotal(l), 0));
}

export interface CartTotals {
  subtotal: number;
  /** Descuento efectivamente aplicado (nunca mayor al subtotal) */
  discount: number;
  total: number;
}

export function cartTotals(lines: CartLine[], discountInput: number): CartTotals {
  const subtotal = cartSubtotal(lines);
  const discount = Math.min(Math.max(0, r2(discountInput)), subtotal);
  return { subtotal, discount, total: r2(subtotal - discount) };
}

/** Vuelto (>= 0) y faltante (>= 0) para un pago en efectivo. */
export function cashChange(total: number, received: number): { change: number; missing: number } {
  const diff = r2(received - total);
  return { change: Math.max(0, diff), missing: Math.max(0, -diff) };
}

/** Billetes/monedas sugeridos (soles peruanos) que cubren el total, sin repetir el exacto. */
export function quickCashOptions(total: number): number[] {
  const denominations = [5, 10, 20, 50, 100, 200];
  const options = denominations.filter((d) => d >= total && d !== total);
  return options.slice(0, 3);
}
