// =============================================================================
// Exportación de reportes (PURO): CSV compatible con Excel y HTML imprimible (PDF).
// =============================================================================

import { formatTicketDate, money, paymentLabel, escapeHtml } from '@/lib/logic/ticket';
import type { ReportSummary } from '@/lib/logic/reportSummary';
import type { SaleWithItems } from '@/types';

export type CsvCell = string | number | null | undefined;

/**
 * Protege contra "inyección de fórmulas": Excel ejecuta celdas de texto que empiezan con
 * = + - @ (o tab/retorno). Los nombres de producto/cliente son entrada libre, así que se
 * les antepone un apóstrofo. Los números reales no se tocan (pueden ser negativos).
 */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function dateParts(iso: string): [string, string] {
  const full = formatTicketDate(iso); // dd/mm/aaaa hh:mm
  const [d, h] = full.split(' ');
  return [d ?? '', h ?? ''];
}

/** Una fila por ticket. */
export function buildSalesCsv(rows: SaleWithItems[]): string {
  const header: CsvCell[] = [
    'Fecha', 'Hora', 'Ticket', 'Estado', 'Vendedor', 'Cliente', 'Método de pago',
    'Subtotal', 'Descuento', 'Total', 'Motivo de anulación',
  ];
  const body = rows.map(({ sale }) => {
    const [d, h] = dateParts(sale.created_at);
    return [
      d, h, sale.ticket_number, sale.voided_at ? 'Anulada' : 'Válida', sale.seller_name, sale.customer_name,
      paymentLabel(sale.payment_method), sale.subtotal, sale.discount, sale.total, sale.void_reason,
    ] as CsvCell[];
  });
  return toCsv([header, ...body]);
}

/** Una fila por producto vendido (para análisis por producto). */
export function buildItemsCsv(rows: SaleWithItems[]): string {
  const header: CsvCell[] = [
    'Fecha', 'Ticket', 'Estado', 'Producto', 'Unidad', 'Cantidad', 'Precio unitario', 'Costo unitario', 'Subtotal',
  ];
  const body: CsvCell[][] = [];
  for (const { sale, items } of rows) {
    const [d] = dateParts(sale.created_at);
    for (const it of items) {
      body.push([
        d, sale.ticket_number, sale.voided_at ? 'Anulada' : 'Válida', it.product_name, it.unit,
        it.quantity, it.unit_price, it.unit_cost, it.subtotal,
      ]);
    }
  }
  return toCsv([header, ...body]);
}

export interface ReportMeta {
  businessName: string;
  rangeLabel: string;
  paymentLabel: string;
  generatedAt: string;
}

/** Reporte imprimible (A4) para "Guardar como PDF". Todo texto libre se escapa. */
export function buildReportHtml(s: ReportSummary, meta: ReportMeta): string {
  const e = escapeHtml;
  const rows = (items: string[][]) =>
    items.map((r) => `<tr>${r.map((c, i) => `<td${i > 0 ? ' class="n"' : ''}>${e(c)}</td>`).join('')}</tr>`).join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Reporte de ventas</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font: 12px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 2px; } h2 { font-size: 14px; margin: 18px 0 6px; }
  .muted { color: #555; } .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
  .kpi { border: 1px solid #ccc; border-radius: 6px; padding: 8px; } .kpi b { display: block; font-size: 16px; }
  table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #ddd; padding: 4px 6px; text-align: left; }
  th { background: #f3f4f6; } td.n { text-align: right; font-variant-numeric: tabular-nums; }
</style></head><body>
<h1>Reporte de ventas · ${e(meta.businessName)}</h1>
<div class="muted">${e(meta.rangeLabel)} · Pago: ${e(meta.paymentLabel)} · Generado ${e(meta.generatedAt)}</div>
<div class="kpis">
  <div class="kpi">Ventas<b>${s.count}</b></div>
  <div class="kpi">Total vendido<b>${e(money(s.revenue))}</b></div>
  <div class="kpi">Ticket promedio<b>${e(money(s.avgTicket))}</b></div>
  <div class="kpi">Ganancia bruta<b>${e(money(s.profit))}</b><span class="muted">${s.profitSalesCount} de ${s.count} ventas con costo</span></div>
  <div class="kpi">Descuentos<b>${e(money(s.discounts))}</b></div>
  <div class="kpi">Vendido a crédito<b>${e(money(s.onCredit))}</b></div>
</div>
<h2>Por método de pago</h2>
<table><tr><th>Método</th><th class="n">Ventas</th><th class="n">Total</th></tr>
${rows(s.byPayment.map((p) => [paymentLabel(p.method), String(p.count), money(p.total)]))}</table>
<h2>Productos más vendidos</h2>
<table><tr><th>Producto</th><th class="n">Cantidad</th><th class="n">Ingreso</th></tr>
${rows(s.byProduct.slice(0, 25).map((p) => [p.name, `${p.quantity} ${p.unit}`, money(p.revenue)]))}</table>
<h2>Por vendedor</h2>
<table><tr><th>Vendedor</th><th class="n">Ventas</th><th class="n">Total</th></tr>
${rows(s.bySeller.map((p) => [p.name, String(p.count), money(p.total)]))}</table>
${s.voidedCount ? `<p class="muted">Ventas anuladas en el período (no incluidas): ${s.voidedCount}</p>` : ''}
</body></html>`;
}
