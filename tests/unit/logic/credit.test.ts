import { describe, expect, it } from 'vitest';
import { buildReminderText, customerBalances, customerLedger, totalReceivable } from '@/lib/logic/credit';
import type { CreditPayment, Customer, Sale } from '@/types';

const customers: Customer[] = [
  { id: 'c1', owner_id: 'o', name: 'Ana', phone: null, created_at: '2026-01-01' },
  { id: 'c2', owner_id: 'o', name: 'Beto', phone: null, created_at: '2026-01-01' },
];

const sales: Pick<Sale, 'customer_id' | 'payment_method' | 'total' | 'voided_at' | 'created_at'>[] = [
  { customer_id: 'c1', payment_method: 'fiado', total: 50, voided_at: null, created_at: '2026-09-01T10:00:00Z' },
  { customer_id: 'c1', payment_method: 'fiado', total: 30, voided_at: '2026-09-02T10:00:00Z', created_at: '2026-09-02T09:00:00Z' },
  { customer_id: 'c2', payment_method: 'efectivo', total: 99, voided_at: null, created_at: '2026-09-02T09:00:00Z' },
];

const payments: Pick<CreditPayment, 'customer_id' | 'amount' | 'created_at'>[] = [
  { customer_id: 'c1', amount: 20, created_at: '2026-09-03T10:00:00Z' },
];

describe('customerBalances', () => {
  it('la deuda es ventas fiadas vigentes menos abonos', () => {
    const [ana] = customerBalances(customers, sales, payments);
    expect(ana).toMatchObject({ charged: 50, paid: 20, balance: 30 });
  });

  it('una venta anulada no cuenta como deuda', () => {
    expect(customerBalances(customers, sales, payments)[0].charged).toBe(50); // no 80
  });

  it('una venta al contado no genera deuda', () => {
    const beto = customerBalances(customers, sales, payments).find((b) => b.customer.id === 'c2')!;
    expect(beto.balance).toBe(0);
  });

  it('un sobrepago histórico nunca deja saldo negativo', () => {
    const [ana] = customerBalances(customers, sales, [{ customer_id: 'c1', amount: 999, created_at: '2026-09-03' }]);
    expect(ana.balance).toBe(0);
  });

  it('ordena por mayor deuda primero', () => {
    const extra = [...customers, { id: 'c3', owner_id: 'o', name: 'Caro', phone: null, created_at: '2026-01-01' }];
    const extraSales = [...sales, { customer_id: 'c3', payment_method: 'fiado' as const, total: 200, voided_at: null, created_at: '2026-09-01' }];
    const list = customerBalances(extra, extraSales, payments);
    expect(list[0].customer.id).toBe('c3');
  });
});

describe('totalReceivable', () => {
  it('suma la deuda de todos los clientes', () => {
    expect(totalReceivable(customerBalances(customers, sales, payments))).toBe(30);
  });
});

describe('customerLedger', () => {
  it('mezcla ventas y abonos, del más reciente al más antiguo', () => {
    const ledger = customerLedger(
      'c1',
      [
        { id: 's1', ticket_number: '000001', customer_id: 'c1', payment_method: 'fiado', total: 50, voided_at: null, created_at: '2026-09-01T10:00:00Z' },
        { id: 's2', ticket_number: '000002', customer_id: 'c1', payment_method: 'fiado', total: 30, voided_at: '2026-09-02T10:00:00Z', created_at: '2026-09-02T09:00:00Z' },
      ],
      [{ id: 'p1', customer_id: 'c1', amount: 20, payment_method: 'yape', created_at: '2026-09-03T10:00:00Z' }]
    );
    expect(ledger).toHaveLength(3);
    expect(ledger[0].kind).toBe('abono'); // el más reciente
    expect(ledger.find((e) => e.id === 's2')?.voided).toBe(true);
    expect(ledger.find((e) => e.kind === 'abono')?.amount).toBeLessThan(0); // resta la deuda
  });
});

describe('buildReminderText', () => {
  it('incluye el nombre, el monto y el negocio', () => {
    const text = buildReminderText('Ana', 30, 'Frutas Ana');
    expect(text).toContain('Ana');
    expect(text).toContain('Frutas Ana');
    expect(text).toContain('30.00');
  });

  it('con nombre vacío no deja un saludo roto ("Hola ,")', () => {
    expect(buildReminderText('  ', 10, 'Mi Puesto')).not.toContain('Hola ,');
  });
});
