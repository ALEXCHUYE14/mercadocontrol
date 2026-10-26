import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../helpers/db';
import { db } from '@/lib/db/dexie';
import { ensureSeed } from '@/lib/db/seed';

beforeEach(resetDb);

describe('ensureSeed', () => {
  // Nota de aislamiento: `seeding` (en seed.ts) es un caché a nivel de módulo que vive
  // entre pruebas de este archivo. Por eso esta es la ÚNICA prueba del archivo que
  // depende de un caché "virgen": separada de las de loadDemoProducts (ver
  // demoProducts.test.ts), que necesitan su propio archivo por la misma razón.
  it('siembra las 8 categorías una sola vez, incluso con llamadas concurrentes (React StrictMode)', async () => {
    await Promise.all([ensureSeed(), ensureSeed(), ensureSeed()]);
    expect(await db().categories.count()).toBe(8);

    await ensureSeed(); // una llamada posterior tampoco duplica
    expect(await db().categories.count()).toBe(8);
  });
});
