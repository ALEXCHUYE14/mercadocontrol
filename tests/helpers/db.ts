import { db } from '@/lib/db/dexie';

/**
 * Vacía todas las tablas de Dexie entre pruebas. Reutiliza la misma instancia (igual
 * que una pestaña real nunca "reabre" la base), pero deja el estado tan limpio como
 * una instalación nueva. Se llama en `beforeEach` de cada prueba que toca la base.
 */
export async function resetDb(): Promise<void> {
  const database = db();
  await database.transaction('rw', database.tables, async () => {
    await Promise.all(database.tables.map((t) => t.clear()));
  });
}
