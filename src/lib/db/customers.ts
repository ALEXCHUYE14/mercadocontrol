'use client';

// =============================================================================
// Clientes y abonos (fiado). La deuda no se guarda: se calcula siempre desde las
// ventas a crédito y los abonos (ver lib/logic/credit.ts), así nunca se desincroniza.
// =============================================================================

import { db } from '@/lib/db/dexie';
import {
  assertCan,
  assertPositive,
  currentActorName,
  currentOwnerId,
  enqueue,
  nowISO,
} from '@/lib/db/internal';
import { requestSync } from '@/lib/db/sync';
import { customerBalances } from '@/lib/logic/credit';
import { round2, uuid } from '@/lib/utils';
import type { CashMethod, CreditPayment, Customer, Sale } from '@/types';

const CASH_METHODS: CashMethod[] = ['efectivo', 'yape', 'plin', 'tarjeta', 'otro'];

function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export async function getCustomers(): Promise<Customer[]> {
  const owner = await currentOwnerId();
  return (await db().customers.where('owner_id').equals(owner).toArray()).sort((a, b) =>
    a.name.localeCompare(b.name, 'es')
  );
}

export async function addCustomer(input: { name: string; phone?: string | null }): Promise<Customer> {
  const name = input.name.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!name) throw new Error('Escribe el nombre del cliente');
  const phone = input.phone?.trim().slice(0, 20) || null;
  let customer!: Customer;

  await db().transaction('rw', [db().meta, db().customers, db().syncQueue], async () => {
    await assertCan('credit');
    const owner = await currentOwnerId();
    const existing = await db().customers.where('owner_id').equals(owner).toArray();
    if (existing.some((c) => normalizeName(c.name) === normalizeName(name))) {
      throw new Error('Ya existe un cliente con ese nombre');
    }
    customer = { id: uuid(), owner_id: owner, name, phone, created_at: nowISO() };
    await db().customers.put(customer);
    await enqueue('customers', 'insert', customer);
  });
  requestSync();
  return customer;
}

export interface CreditOverview {
  balances: ReturnType<typeof customerBalances>;
  sales: Sale[];
  payments: CreditPayment[];
}

/** Todo lo necesario para las pantallas de fiado (balances + movimientos). */
export async function getCreditOverview(): Promise<CreditOverview> {
  const owner = await currentOwnerId();
  const [customers, sales, payments] = await Promise.all([
    getCustomers(),
    db().sales.where('owner_id').equals(owner).filter((s) => s.payment_method === 'fiado').toArray(),
    db().credit_payments.where('owner_id').equals(owner).toArray(),
  ]);
  return { balances: customerBalances(customers, sales, payments), sales, payments };
}

/** Registra un abono. No se acepta más de lo que el cliente debe. */
export async function registerCreditPayment(input: {
  customerId: string;
  amount: number;
  method?: CashMethod;
  note?: string | null;
}): Promise<CreditPayment> {
  assertPositive(input.amount, 'El abono');
  const amount = round2(input.amount);
  if (amount <= 0) throw new Error('El abono debe ser de al menos S/ 0.01');
  const method = input.method ?? 'efectivo';
  if (!CASH_METHODS.includes(method)) throw new Error('Método de pago inválido');
  let payment!: CreditPayment;

  await db().transaction(
    'rw',
    [db().meta, db().customers, db().sales, db().credit_payments, db().syncQueue],
    async () => {
      await assertCan('credit');
      const owner = await currentOwnerId();
      const customer = await db().customers.get(input.customerId);
      if (!customer || customer.owner_id !== owner) throw new Error('Cliente no encontrado');

      const [sales, payments] = await Promise.all([
        db().sales.where('owner_id').equals(owner).filter((s) => s.payment_method === 'fiado').toArray(),
        db().credit_payments.where('customer_id').equals(customer.id).toArray(),
      ]);
      const balance = customerBalances([customer], sales, payments)[0].balance;
      if (balance <= 0) throw new Error('Este cliente no tiene deuda pendiente');
      if (amount > balance + 1e-9) throw new Error(`El abono supera la deuda (S/ ${balance.toFixed(2)})`);

      payment = {
        id: uuid(),
        owner_id: owner,
        customer_id: customer.id,
        amount,
        payment_method: method,
        note: input.note?.trim().slice(0, 160) || null,
        received_by: await currentActorName(),
        created_at: nowISO(),
      };
      await db().credit_payments.put(payment);
      await enqueue('credit_payments', 'insert', payment);
    }
  );
  requestSync();
  return payment;
}
