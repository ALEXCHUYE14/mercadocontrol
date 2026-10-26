import { describe, expect, it } from 'vitest';
import { buildItemsCsv, buildReportHtml, buildSalesCsv, csvCell, toCsv } from '@/lib/logic/exportReport';
import { summarize } from '@/lib/logic/reportSummary';
import type { SaleWithItems } from '@/types';

describe('csvCell', () => {
  it('antepone un apóstrofo a lo que Excel interpretaría como fórmula', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+cmd')).toBe("'+cmd");
    expect(csvCell('-5 kg')).toBe("'-5 kg");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('un número negativo normal no se toca', () => {
    expect(csvCell(-5.5)).toBe('-5.5');
  });

  it('entre comillas si lleva comas, comillas o saltos de línea', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
  });

  it('null/undefined se vuelven celda vacía', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('une filas con salto de línea CRLF (compatible con Excel)', () => {
    expect(
      toCsv([
        ['a', 1],
        ['b', 2],
      ])
    ).toBe('a,1\r\nb,2');
  });
});

const rows: SaleWithItems[] = [
  {
    sale: {
      id: 'A',
      owner_id: 'o',
      ticket_number: '000001',
      customer_name: '=HYPERLINK("http://x")',
      customer_phone: null,
      payment_method: 'efectivo',
      subtotal: 10,
      discount: 0,
      total: 10,
      amount_paid: null,
      note: null,
      customer_id: null,
      seller_name: 'Ana',
      voided_at: null,
      void_reason: null,
      created_at: '2026-09-10T15:00:00.000Z',
    },
    items: [
      {
        id: 'i1',
        sale_id: 'A',
        owner_id: 'o',
        product_id: 'p1',
        product_name: '+cmd|calc',
        unit: 'kg',
        quantity: 2,
        unit_price: 5,
        unit_cost: 2,
        subtotal: 10,
        created_at: '2026-09-10T15:00:00.000Z',
      },
    ],
  },
  {
    sale: {
      id: 'B',
      owner_id: 'o',
      ticket_number: '000002',
      customer_name: null,
      customer_phone: null,
      payment_method: 'fiado',
      subtotal: 6,
      discount: 0,
      total: 6,
      amount_paid: null,
      note: null,
      customer_id: null,
      seller_name: null,
      voided_at: '2026-09-11T10:00:00Z',
      void_reason: 'Error',
      created_at: '2026-09-10T15:00:00.000Z',
    },
    items: [],
  },
];

describe('buildSalesCsv', () => {
  it('una fila por ticket, con el cliente malicioso escapado', () => {
    const csv = buildSalesCsv(rows);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3); // cabecera + 2 ventas
    expect(csv).toContain(`"'=HYPERLINK`);
    expect(csv).toContain('Anulada');
  });
});

describe('buildItemsCsv', () => {
  it('una fila por línea vendida, con el producto malicioso escapado', () => {
    expect(buildItemsCsv(rows)).toContain("'+cmd|calc");
  });
});

describe('buildReportHtml', () => {
  it('escapa el nombre del negocio (texto libre) en el reporte imprimible', () => {
    const html = buildReportHtml(summarize(rows), {
      businessName: '<b>X</b>',
      rangeLabel: 'r',
      paymentLabel: 'Todos',
      generatedAt: 'ahora',
    });
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(html).not.toContain('<b>X</b>');
  });
});
