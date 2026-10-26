// Defensa en profundidad: aunque la interfaz oculte los botones, cada función de
// escritura debe rechazar al cajero por sí misma (ver src/lib/auth/permissions.ts).
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../helpers/db';
import { db } from '@/lib/db/dexie';
import { addCustomer, registerCreditPayment } from '@/lib/db/customers';
import * as repo from '@/lib/db/repository';
import { checkoutSale, voidSale } from '@/lib/db/sales';
import { updateProfile } from '@/lib/db/settings';

beforeEach(resetDb);

async function asCajero(actorName = 'Luis Cajero') {
  await db().meta.put({ key: 'role', value: 'cajero' });
  await db().meta.put({ key: 'actor_name', value: actorName });
}

describe('rol cajero: permitido', () => {
  it('puede vender (y queda registrado quién cobró)', async () => {
    const p = await repo.addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 1, sale_price: 2 });
    await asCajero();
    const sale = await checkoutSale({ items: [{ productId: p.id, quantity: 1 }] });
    expect(sale.sale.seller_name).toBe('Luis Cajero');
  });

  it('puede crear clientes y cobrar abonos', async () => {
    const p = await repo.addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 1, sale_price: 2 });
    const customer = await addCustomer({ name: 'Pedro' }); // antes de ser cajero, para enfocar la prueba en el cobro
    await checkoutSale({ items: [{ productId: p.id, quantity: 1, unitPrice: 5 }], paymentMethod: 'fiado', customerId: customer.id });
    await asCajero();
    await expect(addCustomer({ name: 'Otro cliente' })).resolves.toBeDefined();
    const payment = await registerCreditPayment({ customerId: customer.id, amount: 2 });
    expect(payment.received_by).toBe('Luis Cajero');
  });

  it('recalcula el semáforo localmente (aunque no lo sincronice)', async () => {
    const p = await repo.addProduct({ name: 'Culantro', category_id: null, unit: 'atado', quantity: 10, unit_cost: 0.4, sale_price: 1 });
    await db().products.update(p.id, { freshness: 'verde', entry_date: new Date(Date.now() - 20 * 86_400_000).toISOString() });
    await asCajero();
    expect(await repo.recalcAllFreshness()).toBe(true);
  });
});

describe('rol cajero: prohibido (assertCan debe rechazar)', () => {
  it('no puede anular ventas', async () => {
    const p = await repo.addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 1, sale_price: 2 });
    const sale = await checkoutSale({ items: [{ productId: p.id, quantity: 1 }] });
    await asCajero();
    await expect(voidSale(sale.sale.id, 'x')).rejects.toThrow(/permiso/i);
  });

  it('no puede registrar mermas', async () => {
    const p = await repo.addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 1, sale_price: 2 });
    await asCajero();
    await expect(repo.registerWaste(p.id, 'malogrado', 1)).rejects.toThrow(/permiso/i);
  });

  it('no puede reabastecer, crear, editar ni archivar productos', async () => {
    const p = await repo.addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 1, sale_price: 2 });
    await asCajero();
    await expect(repo.restockProduct(p.id, 1, 1)).rejects.toThrow(/permiso/i);
    await expect(repo.addProduct({ name: 'X', category_id: null, unit: 'kg', quantity: 1, unit_cost: 1, sale_price: 2 })).rejects.toThrow(/permiso/i);
    await expect(repo.updateProduct(p.id, { name: 'X', category_id: null, sale_price: 1, min_stock: 0 })).rejects.toThrow(/permiso/i);
    await expect(repo.archiveProduct(p.id)).rejects.toThrow(/permiso/i);
  });

  it('no puede cerrar caja', async () => {
    await asCajero();
    await expect(repo.saveClosure()).rejects.toThrow(/permiso/i);
  });

  it('no puede editar los datos del negocio', async () => {
    const { db: dbModule } = await import('@/lib/db/dexie');
    await dbModule().profiles.put({
      id: 'local-demo-user', full_name: null, stall_name: 'Mi Puesto', stall_type: null, phone: null,
      money_saved: 0, currency: 'PEN', created_at: '2026-01-01', updated_at: '2026-01-01',
    });
    await asCajero();
    await expect(updateProfile({ full_name: 'x', stall_name: 'y', phone: null })).rejects.toThrow(/permiso/i);
  });

  it('ninguna de las rutas prohibidas deja efectos secundarios a medias', async () => {
    const p = await repo.addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 1, sale_price: 2 });
    await asCajero();
    await repo.registerWaste(p.id, 'malogrado', 1).catch(() => {});
    expect((await db().products.get(p.id))?.current_stock).toBe(10); // intacto: el rechazo fue antes de tocar el stock
  });
});
