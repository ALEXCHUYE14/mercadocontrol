import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../helpers/db';
import { db } from '@/lib/db/dexie';
import {
  addProduct,
  archiveProduct,
  getActiveProducts,
  getTodayMetrics,
  recalcAllFreshness,
  registerWaste,
  restockProduct,
  saveClosure,
  updateProduct,
} from '@/lib/db/repository';

beforeEach(resetDb);

async function queueEntities() {
  return (await db().syncQueue.orderBy('createdAt').toArray()).map((q) => `${q.entity}:${q.op}`);
}

describe('addProduct', () => {
  it('crea el producto con PPC inicial = costo y semáforo verde; encola solo el producto', async () => {
    const p = await addProduct({ name: '  Tomate  ', category_id: null, unit: 'kg', quantity: 10, unit_cost: 2, sale_price: 3 });
    expect(p).toMatchObject({ name: 'Tomate', current_stock: 10, initial_stock: 10, avg_cost: 2, freshness: 'verde', min_stock: 0 });
    // El log de entrada queda solo en local: subir también "entrada" duplicaría el stock en el trigger del servidor.
    expect(await queueEntities()).toEqual(['products:insert']);
    expect(await db().inventory_logs.count()).toBe(1);
  });

  it('acepta un stock mínimo propio', async () => {
    const p = await addProduct({ name: 'Arroz', category_id: null, unit: 'saco', quantity: 5, unit_cost: 100, sale_price: 120, min_stock: 2 });
    expect(p.min_stock).toBe(2);
  });

  it('rechaza nombre vacío, cantidad <= 0, costo o stock mínimo negativos', async () => {
    const base = { category_id: null, unit: 'kg' as const, quantity: 1, unit_cost: 1, sale_price: 1 };
    await expect(addProduct({ ...base, name: '  ' })).rejects.toThrow();
    await expect(addProduct({ ...base, name: 'x', quantity: 0 })).rejects.toThrow();
    await expect(addProduct({ ...base, name: 'x', unit_cost: -1 })).rejects.toThrow();
    await expect(addProduct({ ...base, name: 'x', min_stock: -1 })).rejects.toThrow();
  });
});

describe('restockProduct', () => {
  it('suma stock y recalcula el PPC ponderado; encola solo el log', async () => {
    const p = await addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 18, unit_cost: 2.2, sale_price: 3.5 });
    await db().syncQueue.clear();
    await restockProduct(p.id, 7, 3);
    const updated = await db().products.get(p.id);
    expect(updated?.current_stock).toBe(25);
    expect(updated?.avg_cost).toBe(2.424); // (18*2.2 + 7*3) / 25
    expect(await queueEntities()).toEqual(['inventory_logs:insert']);
  });

  it('rechaza cantidad <= 0 o costo negativo', async () => {
    const p = await addProduct({ name: 'x', category_id: null, unit: 'kg', quantity: 1, unit_cost: 1, sale_price: 1 });
    await expect(restockProduct(p.id, 0, 1)).rejects.toThrow();
    await expect(restockProduct(p.id, 1, -1)).rejects.toThrow();
  });

  it('un producto inexistente rechaza con un mensaje claro', async () => {
    await expect(restockProduct('no-existe', 1, 1)).rejects.toThrow(/no encontrado/i);
  });
});

describe('updateProduct', () => {
  it('edita nombre, categoría, precio y stock mínimo; no toca stock ni costo', async () => {
    const p = await addProduct({ name: 'Arroz', category_id: null, unit: 'saco', quantity: 8, unit_cost: 150, sale_price: 175 });
    await db().syncQueue.clear();
    const updated = await updateProduct(p.id, { name: '  Arroz   Costeño ', category_id: null, sale_price: 180, min_stock: 10 });
    expect(updated).toMatchObject({ name: 'Arroz Costeño', sale_price: 180, min_stock: 10, current_stock: 8, avg_cost: 150 });
  });

  it('encola solo los campos editados (nunca stock, costo ni freshness)', async () => {
    const p = await addProduct({ name: 'Arroz', category_id: null, unit: 'saco', quantity: 8, unit_cost: 150, sale_price: 175 });
    await db().syncQueue.clear();
    await updateProduct(p.id, { name: 'Arroz Costeño', category_id: null, sale_price: 180, min_stock: 10 });
    const q = (await db().syncQueue.toArray())[0];
    expect(q.entity).toBe('products');
    expect(Object.keys(q.payload).sort()).toEqual(['category_id', 'id', 'min_stock', 'name', 'owner_id', 'sale_price']);
  });

  it('rechaza nombre vacío o precio negativo', async () => {
    const p = await addProduct({ name: 'x', category_id: null, unit: 'kg', quantity: 1, unit_cost: 1, sale_price: 1 });
    await expect(updateProduct(p.id, { name: ' ', category_id: null, sale_price: 1, min_stock: 0 })).rejects.toThrow();
    await expect(updateProduct(p.id, { name: 'x', category_id: null, sale_price: -1, min_stock: 0 })).rejects.toThrow();
  });

  it('un producto de otro dueño no se puede editar', async () => {
    const p = await addProduct({ name: 'x', category_id: null, unit: 'kg', quantity: 1, unit_cost: 1, sale_price: 1 });
    await db().products.update(p.id, { owner_id: 'otro-dueño' });
    await expect(updateProduct(p.id, { name: 'y', category_id: null, sale_price: 1, min_stock: 0 })).rejects.toThrow();
  });
});

describe('archiveProduct', () => {
  it('deja de listarse como activo, pero no se borra (conserva el historial)', async () => {
    const p = await addProduct({ name: 'Arroz', category_id: null, unit: 'saco', quantity: 8, unit_cost: 150, sale_price: 175 });
    await archiveProduct(p.id);
    expect((await getActiveProducts()).some((x) => x.id === p.id)).toBe(false);
    expect(await db().products.get(p.id)).toMatchObject({ is_active: false });
  });
});

describe('registerWaste', () => {
  it('descuenta stock y calcula la pérdida al costo; ñapa/remate acumulan dinero salvado', async () => {
    const p = await addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 2.4, sale_price: 3.5 });
    await db().meta.put({ key: 'owner_id', value: p.owner_id });
    // El perfil debe existir para poder acumular money_saved
    await db().profiles.put({
      id: p.owner_id,
      full_name: null,
      stall_name: null,
      stall_type: null,
      phone: null,
      money_saved: 0,
      currency: 'PEN',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });
    await db().syncQueue.clear();

    await registerWaste(p.id, 'napa', 2);
    expect((await db().products.get(p.id))?.current_stock).toBe(8);
    expect((await db().profiles.get(p.owner_id))?.money_saved).toBe(4.8); // 2 * 2.4
    expect(await queueEntities()).toEqual(['waste_logs:insert']); // nunca el producto/perfil

    await registerWaste(p.id, 'malogrado', 1);
    expect((await db().profiles.get(p.owner_id))?.money_saved).toBe(4.8); // malogrado no "salva" dinero
  });

  it('rechaza mermar más de lo que hay en stock', async () => {
    const p = await addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 5, unit_cost: 1, sale_price: 2 });
    await expect(registerWaste(p.id, 'malogrado', 999)).rejects.toThrow(/Solo quedan/);
  });

  it('rechaza cantidad <= 0', async () => {
    const p = await addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 5, unit_cost: 1, sale_price: 2 });
    await expect(registerWaste(p.id, 'malogrado', 0)).rejects.toThrow();
  });
});

describe('recalcAllFreshness', () => {
  it('actualiza el semáforo desactualizado y lo encola', async () => {
    const p = await addProduct({ name: 'Culantro', category_id: null, unit: 'atado', quantity: 10, unit_cost: 0.4, sale_price: 1 });
    await db().products.update(p.id, { freshness: 'verde', entry_date: new Date(Date.now() - 20 * 86_400_000).toISOString() });
    await db().syncQueue.clear();

    expect(await recalcAllFreshness()).toBe(true);
    expect((await db().products.get(p.id))?.freshness).toBe('rojo'); // vida útil por defecto: 7 días
    const q = (await db().syncQueue.toArray())[0];
    expect(Object.keys(q.payload).sort()).toEqual(['freshness', 'id', 'owner_id']); // nunca el stock

    expect(await recalcAllFreshness()).toBe(false); // ya estaba al día: nada que cambiar
  });

  it('el cajero recalcula localmente pero NO sincroniza el semáforo (RLS lo rechazaría)', async () => {
    const p = await addProduct({ name: 'Culantro', category_id: null, unit: 'atado', quantity: 10, unit_cost: 0.4, sale_price: 1 });
    await db().products.update(p.id, { freshness: 'verde', entry_date: new Date(Date.now() - 20 * 86_400_000).toISOString() });
    await db().meta.put({ key: 'role', value: 'cajero' });
    await db().syncQueue.clear();

    expect(await recalcAllFreshness()).toBe(true);
    expect((await db().products.get(p.id))?.freshness).toBe('rojo'); // el cambio local sí ocurre
    expect(await db().syncQueue.count()).toBe(0); // pero no se sube
  });
});

describe('getTodayMetrics', () => {
  it('cuenta el stock bajo usando el umbral propio o el de Ajustes', async () => {
    await addProduct({ name: 'Bajo', category_id: null, unit: 'kg', quantity: 3, unit_cost: 1, sale_price: 2, min_stock: 5 });
    await addProduct({ name: 'Ok', category_id: null, unit: 'kg', quantity: 20, unit_cost: 1, sale_price: 2, min_stock: 5 });
    const m = await getTodayMetrics();
    expect(m.lowStockCount).toBe(1);
  });

  it('la pérdida del día excluye ñapa/remate (se muestran como "valor rescatado", no pérdida)', async () => {
    const p = await addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 2, sale_price: 3 });
    await db().profiles.put({
      id: p.owner_id, full_name: null, stall_name: null, stall_type: null, phone: null,
      money_saved: 0, currency: 'PEN', created_at: '2026-01-01', updated_at: '2026-01-01',
    });
    await registerWaste(p.id, 'napa', 2);
    await registerWaste(p.id, 'malogrado', 1);
    expect((await getTodayMetrics()).wasteLoss).toBe(2); // solo 1 * 2 (malogrado)
  });

  it('un producto agotado no cuenta en el semáforo (nada que vencer)', async () => {
    const p = await addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 1, unit_cost: 1, sale_price: 2 });
    await db().products.update(p.id, { current_stock: 0 });
    const m = await getTodayMetrics();
    expect(m.redCount + m.yellowCount + m.greenCount).toBe(0);
  });
});

describe('saveClosure', () => {
  it('es único por día (upsert) y conserva la nota más reciente', async () => {
    await saveClosure();
    await saveClosure('nota del cierre');
    expect(await db().daily_closures.count()).toBe(1);
    expect((await db().daily_closures.toArray())[0].note).toBe('nota del cierre');
  });
});
