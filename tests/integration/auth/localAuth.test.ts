import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../helpers/db';
import { createLocalAuth } from '@/lib/auth/localAuth';

beforeEach(async () => {
  await resetDb();
  localStorage.clear();
});

describe('createLocalAuth', () => {
  it('sin cuenta: necesita registro y no hay sesión', async () => {
    const auth = createLocalAuth();
    expect(await auth.needsSignUp()).toBe(true);
    expect(await auth.getSession()).toBeNull();
  });

  it('signUp valida nombre, puesto y longitud mínima de la clave', async () => {
    const auth = createLocalAuth();
    await expect(auth.signUp({ password: '12', fullName: 'Ana', stallName: 'Frutas' })).rejects.toThrow(/al menos/);
    await expect(auth.signUp({ password: '1234', fullName: ' ', stallName: 'Frutas' })).rejects.toThrow(/nombre/);
    await expect(auth.signUp({ password: '1234', fullName: 'Ana', stallName: ' ' })).rejects.toThrow(/puesto/);
  });

  it('signUp crea la cuenta, abre sesión y no permite una segunda cuenta en el mismo dispositivo', async () => {
    const auth = createLocalAuth();
    const created = await auth.signUp({ password: 'pin1234', fullName: 'Ana Ruiz', stallName: 'Frutas Ana' });
    expect(created.needsConfirmation).toBe(false);
    expect(created.user?.stallName).toBe('Frutas Ana');
    expect(await auth.needsSignUp()).toBe(false);
    expect((await auth.getSession())?.displayName).toBe('Ana Ruiz');
    await expect(auth.signUp({ password: 'otra1234', fullName: 'X', stallName: 'Y' })).rejects.toThrow();
  });

  it('signOut cierra la sesión sin borrar la cuenta', async () => {
    const auth = createLocalAuth();
    await auth.signUp({ password: 'pin1234', fullName: 'Ana', stallName: 'Frutas' });
    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
    expect(await auth.needsSignUp()).toBe(false);
  });

  it('signIn: rechaza sin cuenta, clave incorrecta, y acepta la clave correcta', async () => {
    const auth = createLocalAuth();
    await expect(auth.signIn({ password: 'x' })).rejects.toThrow(/crea tu cuenta/);
    await auth.signUp({ password: 'pin1234', fullName: 'Ana', stallName: 'Frutas' });
    await auth.signOut();
    await expect(auth.signIn({ password: 'mala' })).rejects.toThrow(/incorrecta/);
    expect((await auth.signIn({ password: 'pin1234' })).stallName).toBe('Frutas');
  });

  it('bloquea tras 5 intentos fallidos, incluso con la clave correcta', async () => {
    const auth = createLocalAuth();
    await auth.signUp({ password: 'pin1234', fullName: 'Ana', stallName: 'Frutas' });
    await auth.signOut();
    for (let i = 0; i < 4; i++) await auth.signIn({ password: `mala${i}` }).catch(() => {});
    await expect(auth.signIn({ password: 'zzz' })).rejects.toThrow(/incorrecta/); // 5º intento: se bloquea
    await expect(auth.signIn({ password: 'pin1234' })).rejects.toThrow(/Demasiados intentos/);
  });

  it('changePassword exige la clave actual correcta y una nueva distinta y suficientemente larga', async () => {
    const auth = createLocalAuth();
    await auth.signUp({ password: 'clave1', fullName: 'Ana', stallName: 'Frutas' });
    await expect(auth.changePassword('mala', 'nueva1')).rejects.toThrow(/incorrecta/);
    await expect(auth.changePassword('clave1', 'clave1')).rejects.toThrow(/distinta/);
    await expect(auth.changePassword('clave1', 'ab')).rejects.toThrow(/al menos/);

    await auth.changePassword('clave1', 'nueva1');
    await auth.signOut();
    await expect(auth.signIn({ password: 'clave1' })).rejects.toThrow(/incorrecta/);
    expect((await auth.signIn({ password: 'nueva1' })).displayName).toBe('Ana');
  });

  it('requestPasswordReset y updatePassword no están disponibles en modo local', async () => {
    const auth = createLocalAuth();
    await expect(auth.requestPasswordReset('a@b.co')).rejects.toThrow(/modo local/);
    await expect(auth.updatePassword('nueva1234')).rejects.toThrow();
  });
});
