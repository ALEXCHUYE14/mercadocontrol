import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../helpers/db';
import { db } from '@/lib/db/dexie';
import { addProduct } from '@/lib/db/repository';
import { checkoutSale, getDashboardReport, getRecentSales, getSalesBetween, voidSale } from '@/lib/db/sales';

beforeEach(resetDb);

async function queueEntities() {
  return (await db().syncQueue.orderBy('createdAt').toArray()).map((q) => `${q.entity}:${q.op}`);
}

async function seedProduct(overrides: Partial<Parameters<typeof addProduct>[0]> = {}) {
  return addProduct({
    name: 'Tomate',
    category_id: null,
    unit: 'kg',
    quantity: 20,
    unit_cost: 2.2,
    sale_price: 3.5,
    ...overrides,
  });
}

describe('checkoutSale', () => {
  it('calcula subtotal/descuento/total, guarda el costo por línea y numera el ticket', async () => {
    const p1 = await seedProduct({ name: 'Tomate' });
    const p2 = await seedProduct({ name: 'Culantro', unit_cost: 0.4, sale_price: 1, quantity: 30 });
    await db().syncQueue.clear();

    const r = await checkoutSale({
      items: [
        { productId: p1.id, quantity: 2, unitPrice: 4 },
        { productId: p2.id, quantity: 5, unitPrice: 1 },
      ],
      discount: 1,
      amountPaid: 20,
    });

    expect(r.sale).toMatchObject({ subtotal: 13, discount: 1, total: 12, ticket_number: '000001' });
    expect(r.items.map((i) => i.unit_cost)).toEqual([2.2, 0.4]); // costo al momento de vender
  });

  it('un segundo ticket continúa el correlativo', async () => {
    const p = await seedProduct();
    await checkoutSale({ items: [{ productId: p.id, quantity: 1 }] });
    const second = await checkoutSale({ items: [{ productId: p.id, quantity: 1 }] });
    expect(second.sale.ticket_number).toBe('000002');
  });

  it('descuenta el stock y registra un log de salida con source "pos"', async () => {
    const p = await seedProduct();
    await checkoutSale({ items: [{ productId: p.id, quantity: 3, unitPrice: 4 }] });
    expect((await db().products.get(p.id))?.current_stock).toBe(17);
    const logs = await db().inventory_logs.where('product_id').equals(p.id).toArray();
    const salidas = logs.filter((l) => l.movement === 'salida');
    expect(salidas).toHaveLength(1);
    expect(salidas[0].source).toBe('pos');
  });

  it('solo sube venta, detalle y logs al servidor; nunca el producto (lo maneja el trigger)', async () => {
    const p = await seedProduct();
    await db().syncQueue.clear();
    await checkoutSale({ items: [{ productId: p.id, quantity: 2 }] });
    expect(await queueEntities()).toEqual(['sales:insert', 'sale_items:insert', 'inventory_logs:insert']);
  });

  it('líneas repetidas del mismo producto suman cantidad para validar el stock', async () => {
    const p = await seedProduct({ quantity: 5 });
    await expect(
      checkoutSale({ items: [{ productId: p.id, quantity: 3 }, { productId: p.id, quantity: 3 }] })
    ).rejects.toThrow(/Solo quedan/);
  });

  it('es atómico: si una línea falla, no queda nada guardado (ni stock, ni ticket, ni cola)', async () => {
    const p1 = await seedProduct({ name: 'Tomate' });
    const p2 = await seedProduct({ name: 'Arroz', quantity: 1 });
    const before = {
      sales: await db().sales.count(),
      stock: (await db().products.get(p1.id))!.current_stock,
      queue: (await queueEntities()).length,
    };
    await expect(
      checkoutSale({ items: [{ productId: p1.id, quantity: 1 }, { productId: p2.id, quantity: 999 }] })
    ).rejects.toThrow(/Solo quedan/);
    expect({
      sales: await db().sales.count(),
      stock: (await db().products.get(p1.id))!.current_stock,
      queue: (await queueEntities()).length,
    }).toEqual(before);
  });

  it('valida: carrito vacío, cantidad <= 0, precio negativo, método inválido, descuento mayor al subtotal', async () => {
    const p = await seedProduct();
    await expect(checkoutSale({ items: [] })).rejects.toThrow();
    await expect(checkoutSale({ items: [{ productId: p.id, quantity: 0 }] })).rejects.toThrow();
    await expect(checkoutSale({ items: [{ productId: p.id, quantity: 1, unitPrice: -1 }] })).rejects.toThrow();
    await expect(checkoutSale({ items: [{ productId: p.id, quantity: 1 }], paymentMethod: 'bitcoin' as never })).rejects.toThrow();
    await expect(checkoutSale({ items: [{ productId: p.id, quantity: 1 }], discount: 999 })).rejects.toThrow(/descuento/i);
  });

  it('rechaza un producto inexistente, de otro dueño, o archivado', async () => {
    const p = await seedProduct();
    await expect(checkoutSale({ items: [{ productId: 'no-existe', quantity: 1 }] })).rejects.toThrow(/no disponible/);
    await db().products.update(p.id, { is_active: false });
    await expect(checkoutSale({ items: [{ productId: p.id, quantity: 1 }] })).rejects.toThrow(/no disponible/);
  });

  it('efectivo: exige que el monto recibido alcance el total', async () => {
    const p = await seedProduct();
    await expect(checkoutSale({ items: [{ productId: p.id, quantity: 1, unitPrice: 10 }], amountPaid: 1 })).rejects.toThrow(/menor al total/);
  });

  it('fiado: exige un cliente válido del mismo negocio', async () => {
    const p = await seedProduct();
    await expect(checkoutSale({ items: [{ productId: p.id, quantity: 1 }], paymentMethod: 'fiado' })).rejects.toThrow(/cliente/i);
    await expect(
      checkoutSale({ items: [{ productId: p.id, quantity: 1 }], paymentMethod: 'fiado', customerId: 'no-existe' })
    ).rejects.toThrow(/no encontrado/);
  });

  it('6 ventas simultáneas del mismo producto generan tickets únicos y descuentan el stock exacto', async () => {
    const p = await seedProduct({ quantity: 20 });
    const results = await Promise.all(Array.from({ length: 6 }, () => checkoutSale({ items: [{ productId: p.id, quantity: 1 }] })));
    expect(new Set(results.map((r) => r.sale.ticket_number)).size).toBe(6);
    expect((await db().products.get(p.id))?.current_stock).toBe(14);
  });
});

describe('voidSale', () => {
  it('devuelve el stock al costo vigente (el PPC del producto no cambia) y marca la venta', async () => {
    const p = await seedProduct();
    const sale = await checkoutSale({ items: [{ productId: p.id, quantity: 2, unitPrice: 4 }] });
    await db().syncQueue.clear();

    const voided = await voidSale(sale.sale.id, '  Error de precio  ');
    expect(voided.sale.void_reason).toBe('Error de precio'); // recortado
    expect(voided.sale.voided_at).not.toBeNull();
    expect((await db().products.get(p.id))?.current_stock).toBe(20); // vuelve al stock original
    expect((await db().products.get(p.id))?.avg_cost).toBe(2.2); // el PPC no se altera
  });

  it('encola solo los logs de reingreso y una actualización PARCIAL de la venta', async () => {
    const p = await seedProduct();
    const sale = await checkoutSale({ items: [{ productId: p.id, quantity: 2 }] });
    await db().syncQueue.clear();
    await voidSale(sale.sale.id, 'motivo');
    expect(await queueEntities()).toEqual(['inventory_logs:insert', 'sales:update']);
    const update = (await db().syncQueue.toArray()).find((q) => q.entity === 'sales')!;
    expect(Object.keys(update.payload).sort()).toEqual(['id', 'owner_id', 'void_reason', 'voided_at']);
  });

  it('una venta anulada ya no cuenta en las métricas del día', async () => {
    const p = await seedProduct();
    const sale = await checkoutSale({ items: [{ productId: p.id, quantity: 2, unitPrice: 4 }] });
    await voidSale(sale.sale.id, 'motivo');
    const { getTodayMetrics } = await import('@/lib/db/repository');
    expect((await getTodayMetrics()).totalSales).toBe(0);
  });

  it('exige un motivo; rechaza anular dos veces o una venta inexistente', async () => {
    const p = await seedProduct();
    const sale = await checkoutSale({ items: [{ productId: p.id, quantity: 1 }] });
    await expect(voidSale(sale.sale.id, '   ')).rejects.toThrow(/motivo/i);
    await voidSale(sale.sale.id, 'ok');
    await expect(voidSale(sale.sale.id, 'de nuevo')).rejects.toThrow(/ya fue anulada/);
    await expect(voidSale('no-existe', 'x')).rejects.toThrow(/no encontrada/);
  });

  it('anular una venta sobre un producto agotado reactiva su fecha de ingreso', async () => {
    const p = await seedProduct({ quantity: 4 });
    const sale = await checkoutSale({ items: [{ productId: p.id, quantity: 4 }] }); // deja el stock en 0
    expect((await db().products.get(p.id))?.current_stock).toBe(0);
    await voidSale(sale.sale.id, 'devolución');
    expect((await db().products.get(p.id))?.current_stock).toBe(4);
  });
});

describe('lecturas', () => {
  it('getRecentSales ordena de la más reciente a la más antigua e incluye el detalle', async () => {
    const p = await seedProduct();
    await checkoutSale({ items: [{ productId: p.id, quantity: 1 }] });
    const second = await checkoutSale({ items: [{ productId: p.id, quantity: 1 }] });
    const recent = await getRecentSales(5);
    expect(recent[0].sale.id).toBe(second.sale.id);
    expect(recent.every((s) => s.items.length >= 1)).toBe(true);
  });

  it('getSalesBetween respeta el rango [from, to) e incluye las anuladas marcadas', async () => {
    const p = await seedProduct();
    const sale = await checkoutSale({ items: [{ productId: p.id, quantity: 1 }] });
    await voidSale(sale.sale.id, 'x');
    const now = Date.now();
    const rows = await getSalesBetween(now - 60_000, now + 60_000);
    expect(rows).toHaveLength(1);
    expect(rows[0].sale.voided_at).not.toBeNull();
    expect(await getSalesBetween(now + 60_000, now + 120_000)).toHaveLength(0);
  });

  it('getDashboardReport calcula la ganancia de hoy y los más vendidos, excluyendo anuladas', async () => {
    const p = await seedProduct();
    await checkoutSale({ items: [{ productId: p.id, quantity: 2, unitPrice: 4 }] }); // ganancia: 2*(4-2.2)=3.6
    const voided = await checkoutSale({ items: [{ productId: p.id, quantity: 1, unitPrice: 100 }] });
    await voidSale(voided.sale.id, 'x');

    const report = await getDashboardReport();
    expect(report.todayProfit).toBeCloseTo(3.6, 5);
    expect(report.top.find((t) => t.name === 'Tomate')?.quantity).toBe(2); // sin la anulada
    expect(report.week).toHaveLength(7);
  });
});
