'use client';

// =============================================================================
// Repositorio: única puerta de entrada para leer/escribir datos.
// - Escribe SIEMPRE primero en Dexie (respuesta instantánea, sirve offline).
// - Encola la mutación para que el motor de sync la suba a Supabase.
// - Replica en el cliente la lógica de los triggers (stock, PPC, merma,
//   frescura, dinero salvado) para que los números cuadren sin conexión.
//
// IMPORTANTE (sync): en el servidor, los triggers de `inventory_logs` y
// `waste_logs` YA aplican el stock, el PPC y el dinero salvado. Por eso, para
// ventas, reabastecimientos y mermas solo se encola el LOG; encolar además el
// producto/perfil ya modificado duplicaría el movimiento en Postgres.
// =============================================================================

import { db } from '@/lib/db/dexie';
import {
  assertCan,
  assertNonNegative,
  assertPositive,
  currentOwnerId,
  currentRole,
  enqueue,
  nowISO,
} from '@/lib/db/internal';
import { getSettings } from '@/lib/db/settings';
import { isLowStock } from '@/lib/logic/stock';
import { checkoutSale, getSalesSince } from '@/lib/db/sales';
import { requestSync } from '@/lib/db/sync';
import { computeFreshness } from '@/lib/logic/freshness';
import { inventoryValue, weightedAvgCost } from '@/lib/logic/pricing';
import { round2, round3, uuid } from '@/lib/utils';
import {
  WASTE_REASONS,
  type Category,
  type DailyClosure,
  type InventoryLog,
  type Product,
  type SaleWithItems,
  type UnitMeasure,
  type WasteLog,
  type WasteReason,
} from '@/types';

const STOCK_EPS = 1e-6;

/** Clasifica un producto con el semáforo "en vivo" (no confía en el valor guardado). */
function liveFreshness(p: Product, cats: Map<string, Category>) {
  return computeFreshness(p, p.category_id ? cats.get(p.category_id) : null).state;
}

// ---------------------------------------------------------------------------
// LECTURAS
// ---------------------------------------------------------------------------
export async function getActiveProducts(): Promise<Product[]> {
  const owner = await currentOwnerId();
  const items = await db().products.where('owner_id').equals(owner).toArray();
  return items
    .filter((p) => p.is_active)
    .map((p) => ({ ...p, min_stock: Number(p.min_stock) || 0 })) // productos anteriores a la alerta de stock
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function getCategories(): Promise<Category[]> {
  const owner = await currentOwnerId();
  const all = await db().categories.toArray();
  return all
    .filter((c) => c.owner_id === null || c.owner_id === owner)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function getCategoryMap(): Promise<Map<string, Category>> {
  const cats = await getCategories();
  return new Map(cats.map((c) => [c.id, c]));
}

// ---------------------------------------------------------------------------
// ESCRITURAS  (Dexie primero -> cola de sync)
// ---------------------------------------------------------------------------

export interface NewProductInput {
  name: string;
  category_id: string | null;
  unit: UnitMeasure;
  quantity: number;      // stock inicial
  unit_cost: number;     // costo unitario de compra
  sale_price: number;
  /** Alerta de stock bajo (0 = usar el valor por defecto de Ajustes) */
  min_stock?: number;
  batch_code?: string | null;
  expires_at?: string | null;
  photo_url?: string | null;
  source?: string;       // 'manual' | 'voz' | 'foto_ia'
}

/** Alta de un producto/lote + su log de entrada. */
export async function addProduct(input: NewProductInput): Promise<Product> {
  const name = input.name.trim();
  if (!name) throw new Error('El nombre del producto es obligatorio');
  assertPositive(input.quantity, 'La cantidad');
  assertNonNegative(input.unit_cost, 'El costo');
  assertNonNegative(input.sale_price, 'El precio de venta');
  const minStock = input.min_stock ?? 0;
  assertNonNegative(minStock, 'El stock mínimo');

  const quantity = round3(input.quantity);
  let product!: Product;

  await db().transaction(
    'rw',
    [db().meta, db().categories, db().products, db().inventory_logs, db().syncQueue],
    async () => {
      await assertCan('editInventory');
      const owner = await currentOwnerId();
      const cat = input.category_id ? await db().categories.get(input.category_id) : undefined;
      const now = nowISO();

      product = {
        id: uuid(),
        owner_id: owner,
        category_id: input.category_id,
        name,
        batch_code: input.batch_code ?? `L-${Date.now().toString(36).toUpperCase()}`,
        unit: input.unit,
        current_stock: quantity,
        initial_stock: quantity,
        avg_cost: input.unit_cost,
        sale_price: input.sale_price,
        min_stock: round3(minStock),
        freshness: 'verde',
        entry_date: now,
        expires_at: input.expires_at ?? null,
        photo_url: input.photo_url ?? null,
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      product.freshness = computeFreshness(product, cat).state;

      const log: InventoryLog = {
        id: uuid(),
        owner_id: owner,
        product_id: product.id,
        movement: 'entrada',
        quantity,
        unit_cost: input.unit_cost,
        unit_price: null,
        note: null,
        source: input.source ?? 'manual',
        created_at: now,
      };

      await db().products.put(product);
      // El log queda solo en local: el producto se sube ya con su stock inicial y
      // subir también la "entrada" haría que el trigger del servidor lo sume otra vez.
      await db().inventory_logs.put(log);
      await enqueue('products', 'insert', product);
    }
  );
  requestSync();
  return product;
}

/** Reabastecimiento: suma stock y recalcula PPC. */
export async function restockProduct(
  productId: string,
  quantity: number,
  unitCost: number
): Promise<void> {
  assertPositive(quantity, 'La cantidad');
  assertNonNegative(unitCost, 'El costo');
  const qty = round3(quantity);

  await db().transaction(
    'rw',
    [db().meta, db().products, db().inventory_logs, db().syncQueue],
    async () => {
      await assertCan('editInventory');
      const owner = await currentOwnerId();
      const p = await db().products.get(productId);
      if (!p) throw new Error('Producto no encontrado');
      const now = nowISO();

      const updated: Product = {
        ...p,
        current_stock: round3(p.current_stock + qty),
        avg_cost: weightedAvgCost(p.current_stock, p.avg_cost, qty, unitCost),
        entry_date: p.current_stock <= 0 ? now : p.entry_date,
        updated_at: now,
      };
      const log: InventoryLog = {
        id: uuid(),
        owner_id: owner,
        product_id: productId,
        movement: 'entrada',
        quantity: qty,
        unit_cost: unitCost,
        unit_price: null,
        note: 'Reabastecimiento',
        source: 'manual',
        created_at: now,
      };

      await db().products.put(updated);
      await db().inventory_logs.put(log);
      await enqueue('inventory_logs', 'insert', log); // el trigger del servidor actualiza stock/PPC
    }
  );
  requestSync();
}

export interface ProductPatch {
  name: string;
  category_id: string | null;
  sale_price: number;
  min_stock: number;
}

/**
 * Edita datos comerciales del producto. No toca stock ni costo (esos cambian solo con
 * movimientos), y solo viajan al servidor los campos editados.
 */
export async function updateProduct(productId: string, patch: ProductPatch): Promise<Product> {
  const name = patch.name.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('El nombre del producto es obligatorio');
  assertNonNegative(patch.sale_price, 'El precio de venta');
  assertNonNegative(patch.min_stock, 'El stock mínimo');
  let updated!: Product;

  await db().transaction('rw', [db().meta, db().products, db().syncQueue], async () => {
    await assertCan('editInventory');
    const owner = await currentOwnerId();
    const p = await db().products.get(productId);
    if (!p || p.owner_id !== owner) throw new Error('Producto no encontrado');
    const fields = {
      name,
      category_id: patch.category_id,
      sale_price: patch.sale_price,
      min_stock: round3(patch.min_stock),
    };
    updated = { ...p, ...fields, updated_at: nowISO() };
    await db().products.put(updated);
    await enqueue('products', 'update', { id: p.id, owner_id: owner, ...fields });
  });
  requestSync();
  return updated;
}

/** "Elimina" un producto: se archiva (deja de mostrarse) pero el historial de ventas se conserva. */
export async function archiveProduct(productId: string): Promise<void> {
  await db().transaction('rw', [db().meta, db().products, db().syncQueue], async () => {
    await assertCan('editInventory');
    const owner = await currentOwnerId();
    const p = await db().products.get(productId);
    if (!p || p.owner_id !== owner) throw new Error('Producto no encontrado');
    await db().products.put({ ...p, is_active: false, updated_at: nowISO() });
    await enqueue('products', 'update', { id: p.id, owner_id: owner, is_active: false });
  });
  requestSync();
}

/**
 * Venta rápida de un solo producto. Genera un ticket como cualquier venta
 * (usa checkoutSale, así todas las ventas quedan con número y detalle).
 */
export async function sellProduct(
  productId: string,
  quantity: number,
  unitPrice?: number
): Promise<SaleWithItems> {
  return checkoutSale({ items: [{ productId, quantity, unitPrice }] });
}

/** Registro de merma "a un tap". Calcula pérdida y acumula dinero salvado. */
export async function registerWaste(
  productId: string,
  reason: WasteReason,
  quantity: number,
  note?: string
): Promise<WasteLog> {
  assertPositive(quantity, 'La cantidad');
  const qty = round3(quantity);
  let waste!: WasteLog;

  await db().transaction(
    'rw',
    [db().meta, db().products, db().waste_logs, db().profiles, db().syncQueue],
    async () => {
      await assertCan('waste');
      const owner = await currentOwnerId();
      const p = await db().products.get(productId);
      if (!p) throw new Error('Producto no encontrado');
      if (qty > p.current_stock + STOCK_EPS) {
        throw new Error(`Solo quedan ${p.current_stock} ${p.unit} de ${p.name}`);
      }
      const now = nowISO();
      const loss = round2(qty * p.avg_cost);

      waste = {
        id: uuid(),
        owner_id: owner,
        product_id: productId,
        reason,
        quantity: qty,
        monetary_loss: loss,
        note: note ?? null,
        created_at: now,
      };
      const updated: Product = {
        ...p,
        current_stock: Math.max(0, round3(p.current_stock - qty)),
        updated_at: now,
      };

      await db().products.put(updated);
      await db().waste_logs.put(waste);
      // El trigger del servidor descuenta stock y acumula money_saved; no se encolan
      // producto ni perfil para no aplicar el movimiento dos veces.
      await enqueue('waste_logs', 'insert', waste);

      // Ñapa y remate "salvan" el valor en lugar de botarlo
      if (reason === 'napa' || reason === 'remate') {
        const prof = await db().profiles.get(owner);
        if (prof) {
          await db().profiles.put({
            ...prof,
            money_saved: round2(prof.money_saved + loss),
            updated_at: now,
          });
        }
      }
    }
  );
  requestSync();
  return waste;
}

/**
 * Recalcula el semáforo de todos los productos localmente.
 * Devuelve true si cambió algún producto (para refrescar la UI).
 * Lee y escribe dentro de una sola transacción para no pisar ventas concurrentes.
 */
export async function recalcAllFreshness(): Promise<boolean> {
  let changed = 0;
  await db().transaction(
    'rw',
    [db().meta, db().categories, db().products, db().syncQueue],
    async () => {
      const owner = await currentOwnerId();
      // El cajero no puede modificar productos en el servidor (RLS); solo el dueño sincroniza el semáforo
      const canSync = (await currentRole()) === 'owner';
      const cats = await getCategoryMap();
      const products = await db().products.where('owner_id').equals(owner).toArray();
      for (const p of products) {
        if (!p.is_active) continue;
        const state = liveFreshness(p, cats);
        if (state === p.freshness) continue;
        const now = nowISO();
        await db().products.put({ ...p, freshness: state, updated_at: now });
        // Solo el semáforo viaja al servidor (nunca el stock, que lo manejan los logs)
        if (canSync) await enqueue('products', 'update', { id: p.id, owner_id: p.owner_id, freshness: state });
        changed++;
      }
    }
  );
  if (changed) requestSync();
  return changed > 0;
}

// ---------------------------------------------------------------------------
// MÉTRICAS DEL DÍA (para dashboard y cierre)
// ---------------------------------------------------------------------------
export interface DayMetrics {
  totalSales: number;
  wasteLoss: number;
  inventoryCapital: number;
  redCount: number;
  yellowCount: number;
  greenCount: number;
  lowStockCount: number;
}

const LOSS_REASONS = new Set<WasteReason>(
  WASTE_REASONS.filter((r) => r.isLoss).map((r) => r.reason)
);

export async function getTodayMetrics(): Promise<DayMetrics> {
  const owner = await currentOwnerId();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const from = startOfDay.getTime();

  const [logs, sales, wastes, products, cats, settings] = await Promise.all([
    db().inventory_logs.where('owner_id').equals(owner).toArray(),
    getSalesSince(from),
    db().waste_logs.where('owner_id').equals(owner).toArray(),
    db().products.where('owner_id').equals(owner).toArray(),
    getCategoryMap(),
    getSettings(),
  ]);

  // Ventas con ticket (ya consideran descuentos) + ventas históricas anteriores a los
  // tickets, que solo existen como movimientos de salida (los del POS llevan source='pos').
  const ticketSales = sales.reduce((sum, s) => sum + s.total, 0);
  const legacySales = logs
    .filter((l) => l.movement === 'salida' && l.source !== 'pos' && new Date(l.created_at).getTime() >= from)
    .reduce((sum, l) => sum + l.quantity * (l.unit_price ?? 0), 0);
  const totalSales = ticketSales + legacySales;

  // Solo cuenta como pérdida lo que realmente se botó/consumió; ñapa y remate
  // recuperan valor (la UI los muestra como "Valor rescatado").
  const wasteLoss = wastes
    .filter((w) => new Date(w.created_at).getTime() >= from && LOSS_REASONS.has(w.reason))
    .reduce((s, w) => s + w.monetary_loss, 0);

  let inventoryCapital = 0;
  let red = 0, yellow = 0, green = 0, low = 0;
  for (const p of products) {
    if (!p.is_active) continue;
    inventoryCapital += inventoryValue(p.current_stock, p.avg_cost);
    if (isLowStock(p, settings.lowStockDefault)) low++;
    // Productos agotados no requieren acción: no cuentan en el semáforo
    if (p.current_stock <= 0) continue;
    const state = liveFreshness(p, cats);
    if (state === 'rojo') red++;
    else if (state === 'amarillo') yellow++;
    else green++;
  }

  return {
    totalSales: round2(totalSales),
    wasteLoss: round2(wasteLoss),
    inventoryCapital: round2(inventoryCapital),
    redCount: red,
    yellowCount: yellow,
    greenCount: green,
    lowStockCount: low,
  };
}

/** Guarda el cierre del día (upsert por fecha). */
export async function saveClosure(note?: string): Promise<DailyClosure> {
  const m = await getTodayMetrics();
  const closure_date = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD (fecha local del dispositivo)
  let closure!: DailyClosure;

  await db().transaction('rw', [db().meta, db().daily_closures, db().syncQueue], async () => {
    await assertCan('closure');
    const owner = await currentOwnerId();
    const existing = (await db().daily_closures.where('owner_id').equals(owner).toArray()).find(
      (c) => c.closure_date === closure_date
    );

    closure = {
      id: existing?.id ?? uuid(),
      owner_id: owner,
      closure_date,
      total_sales: m.totalSales,
      total_waste_loss: m.wasteLoss,
      inventory_capital: m.inventoryCapital,
      items_adjusted: m.redCount + m.yellowCount,
      note: note ?? existing?.note ?? null,
      created_at: existing?.created_at ?? nowISO(),
    };

    await db().daily_closures.put(closure);
    await enqueue('daily_closures', existing ? 'update' : 'insert', closure);
  });
  requestSync();
  return closure;
}
