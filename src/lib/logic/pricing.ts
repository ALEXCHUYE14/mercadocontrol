// =============================================================================
// Cálculos de costo/precio: Promedio Ponderado de Costo (PPC) y márgenes.
// Espejo cliente de la lógica del trigger fn_apply_inventory_movement.
// =============================================================================

/**
 * Recalcula el Costo Promedio Ponderado tras una nueva entrada de mercadería.
 *   PPC' = (stock*PPC + qty*costoUnitario) / (stock + qty)
 */
export function weightedAvgCost(
  currentStock: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingUnitCost: number
): number {
  const total = currentStock + incomingQty;
  if (total <= 0) return currentAvgCost;
  return round(
    (currentStock * currentAvgCost + incomingQty * incomingUnitCost) / total,
    4
  );
}

/** Margen bruto unitario (precio venta - PPC). */
export function unitMargin(salePrice: number, avgCost: number): number {
  return round(salePrice - avgCost, 2);
}

/** Margen porcentual sobre el precio de venta. */
export function marginPct(salePrice: number, avgCost: number): number {
  if (salePrice <= 0) return 0;
  return round(((salePrice - avgCost) / salePrice) * 100, 1);
}

/** Capital inmovilizado en un producto (stock * PPC). */
export function inventoryValue(stock: number, avgCost: number): number {
  return round(stock * avgCost, 2);
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * f) / f;
}
