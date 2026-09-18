// =============================================================================
// Ticket de venta: modelo + composición PURA (sin React, sin DOM, sin DB).
//  - layoutTicket: filas ya compuestas (texto, alineación, énfasis) para un ancho de
//    columnas dado. Es la fuente única: de aquí salen el texto plano, el ESC/POS
//    (impresora Bluetooth) y la vista previa.
//  - formatTicketText: texto monoespaciado para WhatsApp / portapapeles / vista previa.
//  - renderTicketHtml: documento HTML autónomo dimensionado para papel de 58/80 mm
//    (también sale bien en A4 o "Guardar como PDF").
// =============================================================================

import type { PaymentMethod, Sale, SaleItem, UnitMeasure } from '@/types';

export type PaperWidth = 58 | 80;

/** Columnas de texto (fuente A de una térmica ESC/POS) por ancho de papel. */
export const PAPER_COLS: Record<PaperWidth, number> = { 58: 32, 80: 48 };

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; emoji: string }[] = [
  { value: 'efectivo', label: 'Efectivo', emoji: '💵' },
  { value: 'yape', label: 'Yape', emoji: '📱' },
  { value: 'plin', label: 'Plin', emoji: '📲' },
  { value: 'tarjeta', label: 'Tarjeta', emoji: '💳' },
  { value: 'otro', label: 'Otro', emoji: '🧾' },
  { value: 'fiado', label: 'Fiado', emoji: '🤝' },
];

export function paymentLabel(method: PaymentMethod): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? 'Otro';
}

export interface TicketBusiness {
  name: string;
  phone: string | null;
  address: string | null;
  /** RUC / DNI opcional que el comerciante quiera mostrar */
  taxId: string | null;
}

export interface TicketLine {
  name: string;
  quantity: number;
  unit: UnitMeasure;
  unitPrice: number;
  subtotal: number;
}

export interface Ticket {
  business: TicketBusiness;
  number: string;
  issuedAt: string;
  lines: TicketLine[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountPaid: number | null;
  change: number | null;
  customerName: string | null;
  seller: string | null;
  voided: boolean;
  voidReason: string | null;
  footer: string;
}

export const DEFAULT_TICKET_FOOTER =
  '¡Gracias por su compra! · Ticket de control interno, no es comprobante de pago.';

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Monto en soles con formato fijo (sin espacios especiales de Intl: alinea en monoespaciado). */
export function money(n: number): string {
  return `S/ ${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function qtyText(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

export function buildTicket(
  sale: Sale,
  items: SaleItem[],
  business: TicketBusiness,
  footer: string = DEFAULT_TICKET_FOOTER
): Ticket {
  const isCash = sale.payment_method === 'efectivo' && sale.amount_paid != null;
  return {
    business,
    number: sale.ticket_number,
    issuedAt: sale.created_at,
    lines: items.map((i) => ({
      name: i.product_name,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unit_price,
      subtotal: i.subtotal,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    paymentMethod: sale.payment_method,
    amountPaid: isCash ? sale.amount_paid : null,
    change: isCash ? Math.max(0, r2((sale.amount_paid as number) - sale.total)) : null,
    customerName: sale.customer_name,
    seller: sale.seller_name ?? null,
    voided: !!sale.voided_at,
    voidReason: sale.void_reason ?? null,
    footer: footer.trim() || DEFAULT_TICKET_FOOTER,
  };
}

/** dd/mm/aaaa hh:mm en hora local del dispositivo. */
export function formatTicketDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Composición en filas
// ---------------------------------------------------------------------------

export interface TicketRow {
  /** Texto SIN relleno de centrado (el centrado lo hace quien imprime) */
  text: string;
  align: 'left' | 'center';
  bold?: boolean;
  /** Doble tamaño (nombre del negocio, total) */
  big?: boolean;
}

function wrap(text: string, cols: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
    if (!word) continue;
    let w = word;
    // Palabras más largas que el ancho se parten
    while (w.length > cols) {
      if (line) {
        out.push(line);
        line = '';
      }
      out.push(w.slice(0, cols));
      w = w.slice(cols);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= cols) line += ' ' + w;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out;
}

function pair(left: string, right: string, cols: number): string {
  const gap = cols - left.length - right.length;
  return gap >= 1 ? left + ' '.repeat(gap) + right : `${left} ${right}`;
}

/**
 * `doubleSize`: la impresora ESC/POS imprime títulos y TOTAL al doble de tamaño (cada
 * carácter ocupa 2 columnas), así que esas filas se componen a media anchura. En texto
 * plano se componen a ancho completo y sin marca `big`.
 */
export function layoutTicket(t: Ticket, cols: number, opts: { doubleSize?: boolean } = {}): TicketRow[] {
  const dbl = opts.doubleSize === true;
  const rows: TicketRow[] = [];
  const hr = '-'.repeat(cols);
  const center = (text: string, extra: Partial<TicketRow> = {}, width = cols) =>
    wrap(text, width).forEach((l) => rows.push({ text: l, align: 'center', ...extra }));
  const left = (text: string, extra: Partial<TicketRow> = {}) =>
    wrap(text, cols).forEach((l) => rows.push({ text: l, align: 'left', ...extra }));
  const raw = (text: string, extra: Partial<TicketRow> = {}) => rows.push({ text, align: 'left', ...extra });

  const half = Math.max(8, Math.floor(cols / 2));
  const bigCols = dbl ? half : cols;
  center(t.business.name.toUpperCase(), { bold: true, big: dbl }, bigCols);
  if (t.business.address) center(t.business.address);
  if (t.business.phone) center(`Tel: ${t.business.phone}`);
  if (t.business.taxId) center(`RUC/DNI: ${t.business.taxId}`);
  raw(hr);
  if (t.voided) {
    center('*** ANULADO ***', { bold: true, big: dbl }, bigCols);
    if (t.voidReason) center(`Motivo: ${t.voidReason}`);
    raw(hr);
  }
  raw(`Ticket N° ${t.number}`, { bold: true });
  raw(formatTicketDate(t.issuedAt));
  if (t.seller) left(`Atendió: ${t.seller}`);
  if (t.customerName) left(`Cliente: ${t.customerName}`);
  raw(hr);

  for (const l of t.lines) {
    left(l.name);
    raw(pair(`  ${qtyText(l.quantity)} ${l.unit} x ${money(l.unitPrice)}`, money(l.subtotal), cols));
  }
  raw(hr);

  if (t.discount > 0) {
    raw(pair('Subtotal', money(t.subtotal), cols));
    raw(pair('Descuento', `-${money(t.discount)}`, cols));
  }
  raw(pair('TOTAL', money(t.total), bigCols), { bold: true, big: dbl });
  raw(pair('Pago', paymentLabel(t.paymentMethod), cols));
  if (t.paymentMethod === 'fiado') raw('Pendiente de pago (fiado)', { bold: true });
  if (t.amountPaid != null) {
    raw(pair('Recibido', money(t.amountPaid), cols));
    raw(pair('Vuelto', money(t.change ?? 0), cols));
  }
  raw(hr);
  center(t.footer);
  return rows;
}

function padCenter(text: string, cols: number): string {
  return ' '.repeat(Math.max(0, Math.floor((cols - text.length) / 2))) + text;
}

/** Texto plano monoespaciado (WhatsApp, portapapeles, vista previa). */
export function formatTicketText(t: Ticket, cols = 32): string {
  return layoutTicket(t, cols)
    .map((r) => (r.align === 'center' ? padCenter(r.text, cols) : r.text))
    .join('\n');
}

// ---------------------------------------------------------------------------
// HTML imprimible
// ---------------------------------------------------------------------------

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Documento HTML autónomo del ticket. Todo texto del usuario se escapa
 * (nombres de producto y de cliente son entrada libre).
 */
export function renderTicketHtml(t: Ticket, paper: PaperWidth = 80): string {
  const e = escapeHtml;
  const lines = t.lines
    .map(
      (l) => `<div class="item"><div class="name">${e(l.name)}</div>
<div class="row"><span>${e(qtyText(l.quantity))} ${e(l.unit)} x ${e(money(l.unitPrice))}</span><span>${e(money(l.subtotal))}</span></div></div>`
    )
    .join('\n');

  const totals: string[] = [];
  if (t.discount > 0) {
    totals.push(`<div class="row"><span>Subtotal</span><span>${e(money(t.subtotal))}</span></div>`);
    totals.push(`<div class="row"><span>Descuento</span><span>-${e(money(t.discount))}</span></div>`);
  }
  totals.push(`<div class="row total"><span>TOTAL</span><span>${e(money(t.total))}</span></div>`);
  totals.push(`<div class="row"><span>Pago</span><span>${e(paymentLabel(t.paymentMethod))}</span></div>`);
  if (t.paymentMethod === 'fiado') totals.push(`<div><b>Pendiente de pago (fiado)</b></div>`);
  if (t.amountPaid != null) {
    totals.push(`<div class="row"><span>Recibido</span><span>${e(money(t.amountPaid))}</span></div>`);
    totals.push(`<div class="row"><span>Vuelto</span><span>${e(money(t.change ?? 0))}</span></div>`);
  }

  const voidBanner = t.voided
    ? `<div class="c void">*** ANULADO ***</div>${t.voidReason ? `<div class="c">Motivo: ${e(t.voidReason)}</div>` : ''}<hr>`
    : '';

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Ticket ${e(t.number)}</title>
<style>
  @page { size: ${paper}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { width: ${paper}mm; padding: 3mm 3mm 6mm; color: #000;
    font: ${paper === 58 ? 11 : 12}px/1.35 "Courier New", ui-monospace, monospace; }
  .c { text-align: center; }
  .biz { font-weight: 700; font-size: 1.25em; text-transform: uppercase; }
  .void { font-weight: 700; font-size: 1.3em; }
  hr { border: 0; border-top: 1px dashed #000; margin: 2mm 0; }
  .row { display: flex; justify-content: space-between; gap: 2mm; }
  .row span:last-child { white-space: nowrap; }
  .item { margin-bottom: 1.5mm; }
  .name { word-break: break-word; }
  .total { font-weight: 700; font-size: 1.2em; }
  .foot { margin-top: 2mm; font-size: .9em; }
</style></head>
<body>
  <div class="c"><div class="biz">${e(t.business.name)}</div>
  ${t.business.address ? `<div>${e(t.business.address)}</div>` : ''}
  ${t.business.phone ? `<div>Tel: ${e(t.business.phone)}</div>` : ''}
  ${t.business.taxId ? `<div>RUC/DNI: ${e(t.business.taxId)}</div>` : ''}</div>
  <hr>
  ${voidBanner}
  <div>Ticket N° ${e(t.number)}</div>
  <div>${e(formatTicketDate(t.issuedAt))}</div>
  ${t.seller ? `<div>Atendió: ${e(t.seller)}</div>` : ''}
  ${t.customerName ? `<div>Cliente: ${e(t.customerName)}</div>` : ''}
  <hr>
  ${lines}
  <hr>
  ${totals.join('\n  ')}
  <hr>
  <div class="c foot">${e(t.footer)}</div>
</body></html>`;
}

/** Ticket de ejemplo para probar la impresora sin registrar una venta real. */
export function buildSampleTicket(business: TicketBusiness, footer: string = DEFAULT_TICKET_FOOTER): Ticket {
  const now = new Date().toISOString();
  return {
    business,
    number: '000000',
    issuedAt: now,
    lines: [
      { name: 'Tomate', quantity: 2.5, unit: 'kg', unitPrice: 3.5, subtotal: 8.75 },
      { name: 'Culantro', quantity: 4, unit: 'atado', unitPrice: 1, subtotal: 4 },
    ],
    subtotal: 12.75,
    discount: 0,
    total: 12.75,
    paymentMethod: 'efectivo',
    amountPaid: 20,
    change: 7.25,
    customerName: null,
    seller: null,
    voided: false,
    voidReason: null,
    footer: footer.trim() || DEFAULT_TICKET_FOOTER,
  };
}
