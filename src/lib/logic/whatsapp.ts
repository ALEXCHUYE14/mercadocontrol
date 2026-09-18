// =============================================================================
// Generadores de texto limpio para WhatsApp:
//  - Catálogo de remate (productos amarillo/rojo a precio reducido).
//  - Lista de pedido al mayorista (productos con poco stock).
// =============================================================================

import type { Category, Product } from '@/types';
import { computeFreshness } from '@/lib/logic/freshness';
import { formatPEN, formatQty } from '@/lib/utils';

/** Enlace wa.me con el texto ya codificado. */
export function waLink(text: string, phone?: string): string {
  const base = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Catálogo de remate: toma productos en amarillo/rojo y sugiere un precio
 * rebajado (por defecto -30%) para vender rápido a restaurantes de la zona.
 */
export function buildRemateCatalog(
  products: Product[],
  categories: Map<string, Category>,
  opts: { discount?: number; stallName?: string } = {}
): { text: string; count: number } {
  const discount = opts.discount ?? 0.3;
  const items = products
    .filter((p) => {
      if (!p.is_active || p.current_stock <= 0) return false;
      const s = computeFreshness(p, p.category_id ? categories.get(p.category_id) : null).state;
      return s === 'amarillo' || s === 'rojo';
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const header = `🥬 *REMATE DEL DÍA${opts.stallName ? ' · ' + opts.stallName : ''}* 🥬\n_Productos fresquitos a precio especial. ¡Aprovecha!_\n`;
  const lines = items.map((p) => {
    const price = Math.max(0.1, p.sale_price * (1 - discount));
    return `• ${p.name} — *${formatPEN(price)}* x ${p.unit} (${formatQty(p.current_stock)} disp.)`;
  });
  const footer = `\n📲 Pide por este chat y coordinamos la entrega.`;

  const text = items.length
    ? `${header}\n${lines.join('\n')}\n${footer}`
    : 'Hoy no hay productos en remate. ¡Todo fresco! 🟢';

  return { text, count: items.length };
}

/**
 * Lista de pedido al mayorista: productos con stock por debajo de un umbral.
 */
export function buildWholesalerOrder(
  products: Product[],
  opts: { lowStockThreshold?: number; stallName?: string } = {}
): { text: string; count: number } {
  const threshold = opts.lowStockThreshold ?? 5;
  const low = products
    .filter((p) => p.is_active && p.current_stock <= threshold)
    .sort((a, b) => a.current_stock - b.current_stock);

  const header = `📝 *PEDIDO MAYORISTA${opts.stallName ? ' · ' + opts.stallName : ''}*\n${new Date().toLocaleDateString('es-PE')}\n`;
  const lines = low.map((p) => `• ${p.name} (quedan ${formatQty(p.current_stock)} ${p.unit})`);
  const text = low.length
    ? `${header}\n${lines.join('\n')}`
    : 'No hay productos por reponer. Stock saludable ✅';

  return { text, count: low.length };
}
