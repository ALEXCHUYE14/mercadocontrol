import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../helpers/db';
import { db } from '@/lib/db/dexie';
import { loadDemoProducts } from '@/lib/db/seed';

beforeEach(resetDb);

describe('loadDemoProducts', () => {
  // Ver la nota de aislamiento en seed.test.ts: esta prueba necesita ser la primera en
  // disparar `ensureSeed()` en este archivo para que la vinculación por categoría sea real.
  it('carga 6 productos vinculados a su categoría; llamadas repetidas o simultáneas no duplican', async () => {
    expect(await loadDemoProducts()).toBe(6);

    const categories = await db().categories.toArray();
    const products = await db().products.toArray();
    expect(products.every((p) => p.category_id !== null)).toBe(true);
    const tomate = products.find((p) => p.name === 'Tomate')!;
    expect(categories.find((c) => c.id === tomate.category_id)?.name).toBe('Verduras');

    expect(await loadDemoProducts()).toBe(0); // ya había: no agrega más
    expect(await db().products.count()).toBe(6);

    await resetDb();
    const [a, b] = await Promise.all([loadDemoProducts(), loadDemoProducts()]);
    expect(a + b).toBe(6); // una de las dos carga los 6, la otra ve que ya había
    expect(await db().products.count()).toBe(6);
  });
});
