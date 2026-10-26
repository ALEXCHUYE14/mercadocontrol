import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../helpers/db';
import { db } from '@/lib/db/dexie';
import { initSession } from '@/lib/db/session';
import type { AuthUser } from '@/lib/auth/types';

beforeEach(resetDb);

const user: AuthUser = { id: 'local-demo-user', email: null, displayName: 'Ana Ruiz', stallName: 'Frutas Ana' };

describe('initSession (modo local, sin backend)', () => {
  it('deja el dueño activo, el rol en "owner" y siembra las categorías globales', async () => {
    const ctx = await initSession(user);
    expect(ctx).toEqual({ ownerId: 'local-demo-user', role: 'owner' });
    expect((await db().meta.get('owner_id'))?.value).toBe('local-demo-user');
    expect((await db().meta.get('role'))?.value).toBe('owner');
    // Nota de aislamiento (ver seed.test.ts): esta debe ser la única prueba del archivo
    // que depende de un caché de `ensureSeed` virgen, por eso la categorías se verifican
    // aquí mismo y no en un it() aparte.
    expect(await db().categories.count()).toBe(8);
  });

  it('crea el perfil con el nombre del puesto que trae la cuenta', async () => {
    await initSession(user);
    const profile = await db().profiles.get('local-demo-user');
    expect(profile?.stall_name).toBe('Frutas Ana');
    expect(profile?.full_name).toBe('Ana Ruiz');
  });

  it('si ya existe un perfil con datos reales, no lo pisa con el del usuario', async () => {
    await initSession(user);
    await db().profiles.update('local-demo-user', { stall_name: 'Nombre editado a mano' });
    await initSession(user);
    expect((await db().profiles.get('local-demo-user'))?.stall_name).toBe('Nombre editado a mano');
  });
});
