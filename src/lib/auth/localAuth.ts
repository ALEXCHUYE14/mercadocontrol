'use client';

// =============================================================================
// Autenticación LOCAL (sin Supabase): una cuenta por dispositivo, protegida con
// clave. Sirve para que la app pida acceso también en modo demo/offline.
// OJO: protege el acceso a la app, pero los datos de IndexedDB no se cifran.
// =============================================================================

import { LOCAL_OWNER_ID } from '@/lib/constants';
import { db } from '@/lib/db/dexie';
import { hashSecret, verifySecret, type SecretRecord } from '@/lib/auth/password';
import {
  AuthError,
  MIN_LOCAL_SECRET_LENGTH,
  type AuthService,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
  type SignUpResult,
} from '@/lib/auth/types';

const ACCOUNT_KEY = 'local_account';
const SESSION_KEY = 'mc_local_session';
const THROTTLE_KEY = 'mc_local_throttle';
const MAX_ATTEMPTS = 5;
const LOCK_MS = 30_000;

interface LocalAccount {
  fullName: string;
  stallName: string;
  secret: SecretRecord;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // modo privado / almacenamiento bloqueado
  }
}

async function readAccount(): Promise<LocalAccount | null> {
  const meta = await db().meta.get(ACCOUNT_KEY);
  return (meta?.value as LocalAccount | undefined) ?? null;
}

function toUser(a: LocalAccount): AuthUser {
  return { id: LOCAL_OWNER_ID, email: null, displayName: a.fullName, stallName: a.stallName };
}

function readThrottle(): { count: number; until: number } {
  try {
    const raw = storage()?.getItem(THROTTLE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { count?: number; until?: number };
      return { count: Number(v.count) || 0, until: Number(v.until) || 0 };
    }
  } catch { /* datos corruptos: se ignoran */ }
  return { count: 0, until: 0 };
}

export function createLocalAuth(): AuthService {
  const listeners = new Set<(u: AuthUser | null) => void>();
  const emit = (u: AuthUser | null) => listeners.forEach((l) => l(u));

  return {
    mode: 'local',

    async needsSignUp() {
      return (await readAccount()) === null;
    },

    async getSession() {
      const account = await readAccount();
      if (!account || storage()?.getItem(SESSION_KEY) !== '1') return null;
      return toUser(account);
    },

    async signUp(input: SignUpInput): Promise<SignUpResult> {
      if (await readAccount()) throw new AuthError('Ya existe una cuenta en este dispositivo');
      const fullName = input.fullName.trim();
      const stallName = input.stallName.trim();
      if (!fullName) throw new AuthError('Escribe tu nombre');
      if (!stallName) throw new AuthError('Escribe el nombre de tu puesto');
      if (input.password.length < MIN_LOCAL_SECRET_LENGTH) {
        throw new AuthError(`La clave debe tener al menos ${MIN_LOCAL_SECRET_LENGTH} caracteres`);
      }
      const account: LocalAccount = { fullName, stallName, secret: await hashSecret(input.password) };
      await db().meta.put({ key: ACCOUNT_KEY, value: account });
      storage()?.setItem(SESSION_KEY, '1');
      const user = toUser(account);
      emit(user);
      return { user, needsConfirmation: false };
    },

    async signIn(input: SignInInput): Promise<AuthUser> {
      const account = await readAccount();
      if (!account) throw new AuthError('Primero crea tu cuenta en este dispositivo');

      const throttle = readThrottle();
      if (throttle.until > Date.now()) {
        const secs = Math.ceil((throttle.until - Date.now()) / 1000);
        throw new AuthError(`Demasiados intentos. Espera ${secs} s e inténtalo de nuevo`);
      }

      let ok = false;
      try {
        ok = await verifySecret(input.password, account.secret);
      } catch (err) {
        throw new AuthError(err instanceof Error ? err.message : 'No se pudo verificar la clave');
      }
      if (!ok) {
        const count = throttle.until && throttle.until <= Date.now() ? 1 : throttle.count + 1;
        const locked = count >= MAX_ATTEMPTS;
        storage()?.setItem(
          THROTTLE_KEY,
          JSON.stringify({ count: locked ? 0 : count, until: locked ? Date.now() + LOCK_MS : 0 })
        );
        throw new AuthError('Clave incorrecta');
      }
      storage()?.removeItem(THROTTLE_KEY);
      storage()?.setItem(SESSION_KEY, '1');
      const user = toUser(account);
      emit(user);
      return user;
    },

    async requestPasswordReset() {
      throw new AuthError('En modo local no hay recuperación por correo. Cambia la clave desde Ajustes.');
    },

    async updatePassword() {
      throw new AuthError('Operación no disponible en modo local');
    },

    async changePassword(current: string, next: string) {
      const account = await readAccount();
      if (!account) throw new AuthError('No hay una cuenta en este dispositivo');
      if (next.length < MIN_LOCAL_SECRET_LENGTH) {
        throw new AuthError(`La clave nueva debe tener al menos ${MIN_LOCAL_SECRET_LENGTH} caracteres`);
      }
      if (next === current) throw new AuthError('La clave nueva debe ser distinta a la actual');
      let ok = false;
      try {
        ok = await verifySecret(current, account.secret);
      } catch (err) {
        throw new AuthError(err instanceof Error ? err.message : 'No se pudo verificar la clave');
      }
      if (!ok) throw new AuthError('La clave actual es incorrecta');
      await db().meta.put({ key: ACCOUNT_KEY, value: { ...account, secret: await hashSecret(next) } });
    },

    async signOut() {
      storage()?.removeItem(SESSION_KEY);
      emit(null);
    },

    onChange(listener) {
      listeners.add(listener);
      const onStorage = (e: StorageEvent) => {
        if (e.key === SESSION_KEY && e.newValue !== '1') listener(null);
      };
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
      };
    },
  };
}
