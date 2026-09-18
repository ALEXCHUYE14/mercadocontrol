// =============================================================================
// Fiado (cuentas por cobrar) — cálculos PUROS.
// Deuda de un cliente = Σ ventas a crédito NO anuladas − Σ abonos.
// Anular una venta fiada baja la deuda automáticamente.
// =============================================================================

import type { CreditPayment, Customer, Sale } from '@/types';

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface CustomerBalance {
  customer: Customer;
  charged: number;
  paid: number;
  /** Lo que aún debe (nunca negativo aunque hubiera un sobrepago histórico) */
  balance: number;
  lastActivity: string | null;
}

type CreditSale = Pick<Sale, 'customer_id' | 'payment_method' | 'total' | 'voided_at' | 'created_at'>;
type Payment = Pick<CreditPayment, 'customer_id' | 'amount' | 'created_at'>;

export function customerBalances(
  customers: Customer[],
  sales: CreditSale[],
  payments: Payment[]
): CustomerBalance[] {
  const acc = new Map<string, { charged: number; paid: number; last: string | null }>();
  const bump = (id: string, patch: (a: { charged: number; paid: number; last: string | null }) => void, date: string) => {
    const a = acc.get(id) ?? { charged: 0, paid: 0, last: null };
    patch(a);
    if (!a.last || date > a.last) a.last = date;
    acc.set(id, a);
  };

  for (const s of sales) {
    if (s.payment_method !== 'fiado' || s.voided_at || !s.customer_id) continue;
    bump(s.customer_id, (a) => (a.charged += s.total), s.created_at);
  }
  for (const p of payments) bump(p.customer_id, (a) => (a.paid += p.amount), p.created_at);

  return customers
    .map((customer) => {
      const a = acc.get(customer.id) ?? { charged: 0, paid: 0, last: null };
      const charged = r2(a.charged);
      const paid = r2(a.paid);
      return { customer, charged, paid, balance: Math.max(0, r2(charged - paid)), lastActivity: a.last };
    })
    .sort((x, y) => y.balance - x.balance || x.customer.name.localeCompare(y.customer.name, 'es'));
}

export function totalReceivable(balances: CustomerBalance[]): number {
  return r2(balances.reduce((s, b) => s + b.balance, 0));
}

export interface LedgerEntry {
  kind: 'venta' | 'abono';
  id: string;
  date: string;
  /** Positivo = aumenta la deuda; negativo = la reduce */
  amount: number;
  label: string;
  voided: boolean;
}

/** Movimientos de un cliente, del más reciente al más antiguo. */
export function customerLedger(
  customerId: string,
  sales: (CreditSale & { id: string; ticket_number: string })[],
  payments: (Payment & { id: string; payment_method: string })[]
): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  for (const s of sales) {
    if (s.customer_id !== customerId || s.payment_method !== 'fiado') continue;
    out.push({
      kind: 'venta',
      id: s.id,
      date: s.created_at,
      amount: s.total,
      label: `Venta N° ${s.ticket_number}`,
      voided: !!s.voided_at,
    });
  }
  for (const p of payments) {
    if (p.customer_id !== customerId) continue;
    out.push({ kind: 'abono', id: p.id, date: p.created_at, amount: -p.amount, label: `Abono (${p.payment_method})`, voided: false });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Texto amable de recordatorio de pago para WhatsApp. */
export function buildReminderText(customerName: string, balance: number, businessName: string): string {
  const monto = `S/ ${balance.toFixed(2)}`;
  return `Hola ${customerName.trim() || ''}, te saluda ${businessName}. Te recordamos tu saldo pendiente de ${monto}. ¡Gracias por tu preferencia! 🙌`.replace('Hola ,', 'Hola,');
}
