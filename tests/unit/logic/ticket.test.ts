import { describe, expect, it } from 'vitest';
import {
  buildSampleTicket,
  buildTicket,
  escapeHtml,
  formatTicketText,
  layoutTicket,
  renderTicketHtml,
  type TicketBusiness,
} from '@/lib/logic/ticket';
import type { Sale, SaleItem } from '@/types';

const biz: TicketBusiness = { name: 'Frutas Ñandú', phone: '999888777', address: 'Mercado Central', taxId: null };

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 's1',
    owner_id: 'o',
    ticket_number: '000009',
    customer_name: null,
    customer_phone: null,
    payment_method: 'efectivo',
    subtotal: 12.75,
    discount: 0,
    total: 12.75,
    amount_paid: 20,
    note: null,
    customer_id: null,
    seller_name: 'Luis',
    voided_at: null,
    void_reason: null,
    created_at: '2026-09-10T15:00:00.000Z',
    ...overrides,
  };
}

function items(overrides: Partial<SaleItem>[] = [{}]): SaleItem[] {
  return overrides.map((o, i) => ({
    id: `i${i}`,
    sale_id: 's1',
    owner_id: 'o',
    product_id: 'p1',
    product_name: 'Palta fuerte con nombre muy muy largo para forzar salto de línea',
    unit: 'kg',
    quantity: 2.5,
    unit_price: 5.1,
    unit_cost: 2,
    subtotal: 12.75,
    created_at: '2026-09-10T15:00:00.000Z',
    ...o,
  }));
}

describe('layoutTicket', () => {
  it('ninguna fila supera el ancho de columnas (58 mm y 80 mm)', () => {
    const t = buildTicket(sale(), items(), biz);
    for (const cols of [32, 48] as const) {
      const rows = layoutTicket(t, cols, { doubleSize: true });
      expect(rows.every((r) => r.text.length <= (r.big ? cols / 2 : cols))).toBe(true);
    }
  });

  it('en texto plano (sin doubleSize) ninguna fila se marca "big"', () => {
    const t = buildTicket(sale(), items(), biz);
    expect(layoutTicket(t, 32).some((r) => r.big)).toBe(false);
  });
});

describe('formatTicketText', () => {
  it('incluye vendedor, total y vuelto', () => {
    const text = formatTicketText(buildTicket(sale(), items(), biz));
    expect(text).toContain('Atendió: Luis');
    expect(text).toMatch(/TOTAL\s+S\/\s*12\.75/);
    expect(text).toMatch(/Vuelto\s+S\/\s*7\.25/); // 20 - 12.75
  });

  it('una venta anulada muestra el aviso y el motivo', () => {
    const text = formatTicketText(buildTicket(sale({ voided_at: '2026-09-11T10:00:00Z', void_reason: 'Error de precio' }), items(), biz));
    expect(text).toContain('ANULADO');
    expect(text).toContain('Error de precio');
  });

  it('una venta fiada marca "pendiente de pago" y no muestra vuelto', () => {
    const text = formatTicketText(
      buildTicket(sale({ payment_method: 'fiado', amount_paid: null, customer_name: 'María' }), items(), biz)
    );
    expect(text).toContain('Pendiente de pago');
    expect(text).not.toContain('Vuelto');
  });

  it('sin descuento no muestra la fila "Descuento"', () => {
    expect(formatTicketText(buildTicket(sale({ discount: 0 }), items(), biz))).not.toContain('Descuento');
  });

  it('un nombre de producto larguísimo se parte en varias líneas sin exceder el ancho', () => {
    const text = formatTicketText(buildTicket(sale(), items(), biz), 32);
    expect(text.split('\n').every((l) => l.length <= 32)).toBe(true);
  });
});

describe('renderTicketHtml', () => {
  it('escapa nombres de cliente/negocio/producto maliciosos (sin <script>/<img>/<b> crudos)', () => {
    const evil = buildTicket(
      sale({ customer_name: '<img src=x onerror=alert(1)>' }),
      items([{ product_name: '<script>alert("x")</script> & Cía' }]),
      { ...biz, name: '"><b>Hack</b>' }
    );
    const html = renderTicketHtml(evil, 58);
    const withoutStyleBlock = html.replace(/<style>[\s\S]*?<\/style>/, '');
    expect(withoutStyleBlock).not.toMatch(/<script|<img|<b>/);
    expect(html).toContain('&amp; Cía');
  });

  it('fija el ancho de página según el papel', () => {
    expect(renderTicketHtml(buildTicket(sale(), items(), biz), 58)).toContain('size: 58mm auto');
    expect(renderTicketHtml(buildTicket(sale(), items(), biz), 80)).toContain('size: 80mm auto');
  });

  it('una venta anulada muestra el banner en HTML', () => {
    const html = renderTicketHtml(buildTicket(sale({ voided_at: '2026-09-11T10:00:00Z' }), items(), biz));
    expect(html).toContain('ANULADO');
  });
});

describe('escapeHtml', () => {
  it('escapa los 5 caracteres peligrosos', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

describe('buildSampleTicket', () => {
  it('genera un ticket de demostración coherente (subtotal = total, sin descuento)', () => {
    const t = buildSampleTicket(biz);
    expect(t.total).toBeCloseTo(t.subtotal, 5);
    expect(t.lines.length).toBeGreaterThan(0);
  });
});
