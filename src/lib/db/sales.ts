'use client';

// =============================================================================
// Repositorio de VENTAS (tickets). Una venta = cabecera + detalle + un movimiento
// de inventario "salida" por línea, todo en UNA transacción de Dexie: o se guarda
// completo o no se guarda nada. En sync se suben venta, detalle y logs; el stock
// del servidor lo descuenta el trigger de los logs (no se sube el producto).
// =============================================================================

import { db } from '@/lib/db/dexie';
import {
  assertCan,
  assertNonNegative,
  assertPositive,
  currentActorName,
  currentOwnerId,
  enqueue,
  nowISO,
} from '@/lib/db/internal';
import { requestSync } from '@/lib/db/sync';
import { localDayKey, salesByDay, topProducts, type DaySales, type TopProduct } from '@/lib/logic/reports';
import { saleProfit } from '@/lib/logic/reportSummary';
import { round2, round3, uuid } from '@/lib/utils';
import type { InventoryLog, PaymentMethod, Product, Sale, SaleItem, SaleWithItems } from '@/types';

const STOCK_EPS = 1e-6;
const PAYMENT_VALUES: PaymentMethod[] = ['efectivo', 'yape', 'plin', 'tarjeta', 'otro', 'fiado'];

export interface CheckoutLineInput {
  productId: string;
  quantity: number;
  /** Si se omite se usa el precio de venta actual del producto */
  unitPrice?: number;
}

export interface CheckoutInput {
  items: CheckoutLineInput[];
  paymentMethod?: PaymentMethod;
  discount?: number;
  customerName?: string | null;
  customerPhone?: string | null;
  /** Obligatorio en fiado: el cliente que queda debiendo */
  customerId?: string | null;
  /** Efectivo recibido (para calcular el vuelto) */
  amountPaid?: number | null;
  note?: string | null;
}

function formatTicketNumber(seq: number): string {
  return String(seq).padStart(6, '0');
}

function cleanText(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** Registra una venta completa y devuelve el ticket con su detalle. */
export async function checkoutSale(input: CheckoutInput): Promise<SaleWithItems> {
  if (!input.items.length) throw new Error('Agrega al menos un producto a la venta');
  const paymentMethod = input.paymentMethod ?? 'efectivo';
  if (!PAYMENT_VALUES.includes(paymentMethod)) throw new Error('Método de pago inválido');
  for (const line of input.items) {
    assertPositive(line.quantity, 'La cantidad');
    if (line.unitPrice !== undefined) assertNonNegative(line.unitPrice, 'El precio');
  }
  const discount = round2(input.discount ?? 0);
  assertNonNegative(discount, 'El descuento');

  let result!: SaleWithItems;

  await db().transaction(
    'rw',
    [db().meta, db().products, db().customers, db().sales, db().sale_items, db().inventory_logs, db().syncQueue],
    async () => {
      await assertCan('sell');
      const owner = await currentOwnerId();
      const seller = await currentActorName();
      const now = nowISO();

      // 1) Cliente (fiado): debe existir y ser de este negocio
      let customerId: string | null = null;
      let customerName = cleanText(input.customerName);
      let customerPhone = cleanText(input.customerPhone);
      if (paymentMethod === 'fiado') {
        if (!input.customerId) throw new Error('Elige o crea el cliente al que le fías');
        const customer = await db().customers.get(input.customerId);
        if (!customer || customer.owner_id !== owner) throw new Error('Cliente no encontrado');
        customerId = customer.id;
        customerName = customer.name;
        customerPhone = customer.phone;
      }

      // 2) Cargar productos y validar stock (sumando líneas repetidas del mismo producto)
      const products = new Map<string, Product>();
      const requested = new Map<string, number>();
      for (const line of input.items) {
        if (!products.has(line.productId)) {
          const p = await db().products.get(line.productId);
          if (!p || !p.is_active || p.owner_id !== owner) throw new Error('Producto no disponible');
          products.set(p.id, p);
        }
        requested.set(line.productId, round3((requested.get(line.productId) ?? 0) + line.quantity));
      }
      for (const [id, qty] of requested) {
        const p = products.get(id)!;
        if (qty > p.current_stock + STOCK_EPS) {
          throw new Error(`Solo quedan ${p.current_stock} ${p.unit} de ${p.name}`);
        }
      }

      // 3) Totales
      const saleId = uuid();
      const items: SaleItem[] = input.items.map((line) => {
        const p = products.get(line.productId)!;
        const unitPrice = line.unitPrice ?? p.sale_price;
        const quantity = round3(line.quantity);
        return {
          id: uuid(),
          sale_id: saleId,
          owner_id: owner,
          product_id: p.id,
          product_name: p.name,
          unit: p.unit,
          quantity,
          unit_price: unitPrice,
          unit_cost: p.avg_cost,
          subtotal: round2(quantity * unitPrice),
          created_at: now,
        };
      });
      const subtotal = round2(items.reduce((s, i) => s + i.subtotal, 0));
      if (discount > subtotal) throw new Error('El descuento no puede superar el subtotal');
      const total = round2(subtotal - discount);

      let amountPaid: number | null = null;
      if (paymentMethod === 'efectivo' && input.amountPaid != null) {
        assertNonNegative(input.amountPaid, 'El monto recibido');
        if (round2(input.amountPaid) < total) throw new Error('El monto recibido es menor al total');
        amountPaid = round2(input.amountPaid);
      }

      // 4) Correlativo del ticket (por dispositivo)
      const seqMeta = await db().meta.get('ticket_seq');
      const seq = (typeof seqMeta?.value === 'number' ? seqMeta.value : 0) + 1;
      await db().meta.put({ key: 'ticket_seq', value: seq });

      const sale: Sale = {
        id: saleId,
        owner_id: owner,
        ticket_number: formatTicketNumber(seq),
        customer_name: customerName,
        customer_phone: customerPhone,
        payment_method: paymentMethod,
        subtotal,
        discount,
        total,
        amount_paid: amountPaid,
        note: cleanText(input.note),
        customer_id: customerId,
        seller_name: seller,
        voided_at: null,
        void_reason: null,
        created_at: now,
      };

      // 5) Persistir venta, detalle, stock y movimientos (+ cola de sync en el mismo orden)
      await db().sales.put(sale);
      await enqueue('sales', 'insert', sale);
      await db().sale_items.bulkPut(items);
      for (const it of items) await enqueue('sale_items', 'insert', it);

      for (const it of items) {
        const log: InventoryLog = {
          id: uuid(),
          owner_id: owner,
          product_id: it.product_id as string,
          movement: 'salida',
          quantity: it.quantity,
          unit_cost: null,
          unit_price: it.unit_price,
          note: `Venta #${sale.ticket_number}`,
          source: 'pos',
          created_at: now,
        };
        await db().inventory_logs.put(log);
        await enqueue('inventory_logs', 'insert', log);
      }
      for (const [id, qty] of requested) {
        const p = products.get(id)!;
        await db().products.put({
          ...p,
          current_stock: Math.max(0, round3(p.current_stock - qty)),
          updated_at: now,
        });
      }

      result = { sale, items };
    }
  );
  requestSync();
  return result;
}

/**
 * Anula una venta: devuelve el stock y la excluye de ventas, reportes y deuda.
 * El ticket original se conserva (marcado como anulado) para auditoría.
 */
export async function voidSale(saleId: string, reason: string): Promise<SaleWithItems> {
  const cleanReason = reason.trim().slice(0, 160);
  if (!cleanReason) throw new Error('Escribe el motivo de la anulación');
  let result!: SaleWithItems;

  await db().transaction(
    'rw',
    [db().meta, db().products, db().sales, db().sale_items, db().inventory_logs, db().syncQueue],
    async () => {
      await assertCan('voidSale');
      const owner = await currentOwnerId();
      const sale = await db().sales.get(saleId);
      if (!sale || sale.owner_id !== owner) throw new Error('Venta no encontrada');
      if (sale.voided_at) throw new Error('Esta venta ya fue anulada');
      const items = await db().sale_items.where('sale_id').equals(saleId).toArray();
      const now = nowISO();

      for (const it of items) {
        if (!it.product_id) continue; // producto eliminado: no hay stock que devolver
        const p = await db().products.get(it.product_id);
        if (!p) continue;
        // Costo = PPC vigente, así el promedio ponderado no cambia al reingresar
        const log: InventoryLog = {
          id: uuid(),
          owner_id: owner,
          product_id: p.id,
          movement: 'entrada',
          quantity: it.quantity,
          unit_cost: p.avg_cost,
          unit_price: null,
          note: `Anulación #${sale.ticket_number}`,
          source: 'void',
          created_at: now,
        };
        await db().products.put({
          ...p,
          current_stock: round3(p.current_stock + it.quantity),
          entry_date: p.current_stock <= 0 ? now : p.entry_date, // mismo criterio que el trigger del servidor
          updated_at: now,
        });
        await db().inventory_logs.put(log);
        await enqueue('inventory_logs', 'insert', log);
      }

      const voided: Sale = { ...sale, voided_at: now, void_reason: cleanReason };
      await db().sales.put(voided);
      await enqueue('sales', 'update', {
        id: voided.id,
        owner_id: owner,
        voided_at: now,
        void_reason: cleanReason,
      });
      result = { sale: voided, items };
    }
  );
  requestSync();
  return result;
}

// ---------------------------------------------------------------------------
// Lecturas
// ---------------------------------------------------------------------------

async function itemsBySale(saleIds: string[]): Promise<Map<string, SaleItem[]>> {
  const rows = await db().sale_items.where('sale_id').anyOf(saleIds).toArray();
  const map = new Map<string, SaleItem[]>();
  for (const r of rows) {
    const list = map.get(r.sale_id) ?? [];
    list.push(r);
    map.set(r.sale_id, list);
  }
  return map;
}

function newestFirst(a: Sale, b: Sale): number {
  return b.created_at.localeCompare(a.created_at) || b.ticket_number.localeCompare(a.ticket_number);
}

/** Ventas más recientes primero, con su detalle (incluye anuladas, marcadas). */
export async function getRecentSales(limit = 50): Promise<SaleWithItems[]> {
  const owner = await currentOwnerId();
  const sales = (await db().sales.where('owner_id').equals(owner).toArray()).sort(newestFirst).slice(0, limit);
  const items = await itemsBySale(sales.map((s) => s.id));
  return sales.map((sale) => ({ sale, items: items.get(sale.id) ?? [] }));
}

/** Ventas del dueño actual creadas desde `fromMs`. Por defecto excluye las anuladas. */
export async function getSalesSince(fromMs: number, opts: { includeVoided?: boolean } = {}): Promise<Sale[]> {
  const owner = await currentOwnerId();
  return (await db().sales.where('owner_id').equals(owner).toArray()).filter(
    (s) => new Date(s.created_at).getTime() >= fromMs && (opts.includeVoided || !s.voided_at)
  );
}

/** Ventas (con detalle) dentro de un rango [fromMs, toMs). Incluye anuladas, marcadas. */
export async function getSalesBetween(fromMs: number, toMs: number): Promise<SaleWithItems[]> {
  const owner = await currentOwnerId();
  const sales = (await db().sales.where('owner_id').equals(owner).toArray())
    .filter((s) => {
      const t = new Date(s.created_at).getTime();
      return t >= fromMs && t < toMs;
    })
    .sort(newestFirst);
  const items = await itemsBySale(sales.map((s) => s.id));
  return sales.map((sale) => ({ sale, items: items.get(sale.id) ?? [] }));
}

export interface DashboardReport {
  week: DaySales[];
  top: TopProduct[];
  /** Ganancia bruta de hoy (solo ventas con costo conocido) */
  todayProfit: number;
}

/** Ventas de los últimos 7 días, más vendidos y ganancia de hoy (para el dashboard). */
export async function getDashboardReport(): Promise<DashboardReport> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
  const sales = await getSalesSince(from);
  const grouped = sales.length ? await itemsBySale(sales.map((s) => s.id)) : new Map<string, SaleItem[]>();
  const todayKey = localDayKey(now);
  let todayProfit = 0;
  for (const sale of sales) {
    if (localDayKey(new Date(sale.created_at)) !== todayKey) continue;
    todayProfit += saleProfit(sale, grouped.get(sale.id) ?? []) ?? 0;
  }
  return {
    week: salesByDay(sales, 7, now),
    top: topProducts([...grouped.values()].flat(), 5),
    todayProfit: round2(todayProfit),
  };
}
