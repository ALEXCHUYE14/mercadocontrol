import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../helpers/db';
import { db } from '@/lib/db/dexie';
import { addCustomer, getCreditOverview, registerCreditPayment } from '@/lib/db/customers';
import { addProduct } from '@/lib/db/repository';
import { checkoutSale, voidSale } from '@/lib/db/sales';

beforeEach(resetDb);

describe('addCustomer', () => {
  it('normaliza espacios en el nombre', async () => {
    const c = await addCustomer({ name: '  María   Pérez ', phone: '987654321' });
    expect(c.name).toBe('María Pérez');
  });

  it('rechaza nombre vacío', async () => {
    await expect(addCustomer({ name: '   ' })).rejects.toThrow();
  });

  it('no permite duplicar por nombre, ignorando mayúsculas y acentos', async () => {
    await addCustomer({ name: 'María Pérez' });
    await expect(addCustomer({ name: 'maria perez' })).rejects.toThrow(/Ya existe/);
  });
});

describe('getCreditOverview / registerCreditPayment', () => {
  it('la deuda aparece tras una venta fiada y baja con los abonos', async () => {
    const p = await addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 2, sale_price: 4 });
    const maria = await addCustomer({ name: 'María' });
    await checkoutSale({ items: [{ productId: p.id, quantity: 3, unitPrice: 4 }], paymentMethod: 'fiado', customerId: maria.id });

    let ov = await getCreditOverview();
    expect(ov.balances.find((b) => b.customer.id === maria.id)?.balance).toBe(12);

    await registerCreditPayment({ customerId: maria.id, amount: 5, method: 'yape' });
    ov = await getCreditOverview();
    expect(ov.balances.find((b) => b.customer.id === maria.id)?.balance).toBe(7);
  });

  it('rechaza abonos de 0, negativos, mayores a la deuda, con método "fiado", o sin deuda pendiente', async () => {
    const p = await addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 2, sale_price: 4 });
    const maria = await addCustomer({ name: 'María' });
    await checkoutSale({ items: [{ productId: p.id, quantity: 3, unitPrice: 4 }], paymentMethod: 'fiado', customerId: maria.id });

    await expect(registerCreditPayment({ customerId: maria.id, amount: 0 })).rejects.toThrow();
    await expect(registerCreditPayment({ customerId: maria.id, amount: -3 })).rejects.toThrow();
    await expect(registerCreditPayment({ customerId: maria.id, amount: 12.01 })).rejects.toThrow(/supera/);
    await expect(registerCreditPayment({ customerId: maria.id, amount: 1, method: 'fiado' as never })).rejects.toThrow(/inválido/i);

    const sinDeuda = await addCustomer({ name: 'Juan' });
    await expect(registerCreditPayment({ customerId: sinDeuda.id, amount: 1 })).rejects.toThrow(/no tiene deuda/);
  });

  it('se puede pagar la deuda exacta y queda registrado quién recibió el abono', async () => {
    const p = await addProduct({ name: 'Tomate', category_id: null, unit: 'kg', quantity: 10, unit_cost: 2, sale_price: 4 });
    const maria = await addCustomer({ name: 'María' });
    await checkoutSale({ items: [{ productId: p.id, quantity: 3, unitPrice: 4 }], paymentMethod: 'fiado', customerId: maria.id });
    await db().meta.put({ key: 'actor_name', value: 'Luis Cajero' });

    const payment = await registerCreditPayment({ customerId: maria.id, amount: 12 });
    expect(payment.received_by).toBe('Luis Cajero');
    const ov = await getCreditOverview();
    expect(ov.balances.find((b) => b.customer.id === maria.id)?.balance).toBe(0);
    await expect(registerCreditPayment({ customerId: maria.id, amount: 1 })).rejects.toThrow(/no tiene deuda/);
  });

  it('anular una venta fiada baja la deuda del cliente', async () => {
    const p = await addProduct({ name: 'Culantro', category_id: null, unit: 'atado', quantity: 30, unit_cost: 0.4, sale_price: 1 });
    const juan = await addCustomer({ name: 'Juan' });
    const sale = await checkoutSale({ items: [{ productId: p.id, quantity: 10, unitPrice: 1 }], paymentMethod: 'fiado', customerId: juan.id });
    expect((await getCreditOverview()).balances.find((b) => b.customer.id === juan.id)?.balance).toBe(10);

    await voidSale(sale.sale.id, 'cliente se arrepintió');
    expect((await getCreditOverview()).balances.find((b) => b.customer.id === juan.id)?.balance).toBe(0);
  });
});
