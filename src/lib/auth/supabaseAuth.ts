'use client';

// =============================================================================
// Autenticación con Supabase (correo + contraseña). Pensada para offline-first:
// la sesión persiste en el dispositivo y, si no hay red, se reutiliza el último
// usuario conocido para poder seguir trabajando sin internet.
// =============================================================================

import type { Session, User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import {
  AuthError,
  MIN_PASSWORD_LENGTH,
  type AuthService,
  type AuthUser,
  type SignInInput,
  type SignUpInput,
  type SignUpResult,
} from '@/lib/auth/types';

const CACHE_KEY = 'mc_auth_cache';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function toUser(u: User): AuthUser {
  const meta = (u.user_metadata ?? {}) as { full_name?: unknown; stall_name?: unknown };
  return {
    id: u.id,
    email: u.email ?? null,
    displayName: typeof meta.full_name === 'string' && meta.full_name ? meta.full_name : null,
    stallName: typeof meta.stall_name === 'string' && meta.stall_name ? meta.stall_name : null,
  };
}

function cacheUser(user: AuthUser | null): void {
  try {
    if (user) storage()?.setItem(CACHE_KEY, JSON.stringify(user));
    else storage()?.removeItem(CACHE_KEY);
  } catch { /* almacenamiento lleno o bloqueado */ }
}

function readCachedUser(): AuthUser | null {
  try {
    const raw = storage()?.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<AuthUser>;
    return typeof v.id === 'string' && v.id
      ? {
          id: v.id,
          email: typeof v.email === 'string' ? v.email : null,
          displayName: typeof v.displayName === 'string' ? v.displayName : null,
          stallName: typeof v.stallName === 'string' ? v.stallName : null,
        }
      : null;
  } catch {
    return null;
  }
}

/** Traduce los errores de Supabase a mensajes claros para el comerciante. */
export function translateAuthError(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (raw.includes('invalid login credentials')) return 'Correo o contraseña incorrectos';
  if (raw.includes('email not confirmed')) return 'Confirma tu correo (revisa tu bandeja) antes de ingresar';
  if (raw.includes('already registered') || raw.includes('already been registered')) {
    return 'Ese correo ya tiene una cuenta. Inicia sesión';
  }
  if (raw.includes('password should be') || raw.includes('weak password')) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  if (raw.includes('rate limit') || raw.includes('too many')) return 'Demasiados intentos. Espera un momento';
  if (raw.includes('fetch') || raw.includes('network') || raw.includes('failed to')) {
    return 'Sin conexión: necesitas internet para iniciar sesión';
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo';
}

export function createSupabaseAuth(): AuthService {
  const client = () => {
    const sb = getSupabase();
    if (!sb) throw new AuthError('El servicio de cuentas no está configurado');
    return sb;
  };

  return {
    mode: 'supabase',

    async needsSignUp() {
      return false;
    },

    async getSession() {
      const online = typeof navigator === 'undefined' || navigator.onLine;
      try {
        const { data, error } = await client().auth.getSession();
        if (error) throw error;
        const user = data.session ? toUser(data.session.user) : null;
        cacheUser(user);
        return user;
      } catch {
        // Sin red no se puede renovar el token: se conserva el último usuario conocido
        // para que el comerciante siga trabajando (los datos ya están en el dispositivo).
        return online ? null : readCachedUser();
      }
    },

    async signIn({ email, password }: SignInInput): Promise<AuthUser> {
      const mail = email?.trim().toLowerCase() ?? '';
      if (!EMAIL_RE.test(mail)) throw new AuthError('Escribe un correo válido');
      if (!password) throw new AuthError('Escribe tu contraseña');
      const { data, error } = await client().auth.signInWithPassword({ email: mail, password });
      if (error || !data.user) throw new AuthError(translateAuthError(error));
      const user = toUser(data.user);
      cacheUser(user);
      return user;
    },

    async signUp({ email, password, fullName, stallName }: SignUpInput): Promise<SignUpResult> {
      const mail = email?.trim().toLowerCase() ?? '';
      if (!EMAIL_RE.test(mail)) throw new AuthError('Escribe un correo válido');
      if (!fullName.trim()) throw new AuthError('Escribe tu nombre');
      if (!stallName.trim()) throw new AuthError('Escribe el nombre de tu puesto');
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new AuthError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      }
      const { data, error } = await client().auth.signUp({
        email: mail,
        password,
        // El trigger fn_handle_new_user crea el perfil con estos datos
        options: { data: { full_name: fullName.trim(), stall_name: stallName.trim() } },
      });
      if (error) throw new AuthError(translateAuthError(error));
      // Con confirmación de correo activa, Supabase no devuelve sesión
      const session: Session | null = data.session;
      if (!session || !data.user) return { user: null, needsConfirmation: true };
      const user = toUser(data.user);
      cacheUser(user);
      return { user, needsConfirmation: false };
    },

    async requestPasswordReset(email: string) {
      const mail = email.trim().toLowerCase();
      if (!EMAIL_RE.test(mail)) throw new AuthError('Escribe un correo válido');
      const { error } = await client().auth.resetPasswordForEmail(mail, {
        redirectTo: `${window.location.origin}/recuperar`,
      });
      // Por seguridad no se revela si el correo existe: solo se reportan fallos de servicio
      if (error) throw new AuthError(translateAuthError(error));
    },

    async updatePassword(next: string) {
      if (next.length < MIN_PASSWORD_LENGTH) {
        throw new AuthError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      }
      const sb = client();
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session) throw new AuthError('El enlace venció o ya se usó. Solicita otro correo de recuperación');
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) throw new AuthError(translateAuthError(error));
    },

    async changePassword(current: string, next: string) {
      if (next.length < MIN_PASSWORD_LENGTH) {
        throw new AuthError(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
      }
      if (next === current) throw new AuthError('La contraseña nueva debe ser distinta a la actual');
      const sb = client();
      const { data: sess } = await sb.auth.getSession();
      const email = sess.session?.user.email;
      if (!email) throw new AuthError('Inicia sesión de nuevo para cambiar tu contraseña');
      // Verifica la contraseña actual antes de permitir el cambio
      const check = await sb.auth.signInWithPassword({ email, password: current });
      if (check.error) throw new AuthError('La contraseña actual es incorrecta');
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) throw new AuthError(translateAuthError(error));
    },

    async signOut() {
      cacheUser(null);
      try {
        await client().auth.signOut();
      } catch { /* sin red: la sesión local ya se descartó */ }
    },

    onChange(listener) {
      const sb = getSupabase();
      if (!sb) return () => {};
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        // Renovaciones fallidas sin red no cierran la sesión; solo el cierre explícito
        if (event === 'SIGNED_OUT') {
          cacheUser(null);
          listener(null);
        } else if (session) {
          const user = toUser(session.user);
          cacheUser(user);
          listener(user);
        }
      });
      return () => data.subscription.unsubscribe();
    },
  };
}
