'use client';

// =============================================================================
// Ciclo de vida de datos de una sesión: prepara la base local para el usuario
// autenticado (incluido su rol dentro del puesto) y sincroniza en segundo plano.
// =============================================================================

import type { AuthUser } from '@/lib/auth/types';
import { db } from '@/lib/db/dexie';
import { recalcAllFreshness } from '@/lib/db/repository';
import { ensureSeed } from '@/lib/db/seed';
import { drainQueue, pullFromServer } from '@/lib/db/sync';
import { getSupabase, hasBackend } from '@/lib/supabase/client';
import type { Role } from '@/types';

const DEFAULT_STALL = 'Mi Puesto';

export interface SessionContext {
  /** Dueño de los datos: el propio usuario, o el dueño del puesto si es cajero */
  ownerId: string;
  role: Role;
}

interface CachedMembership {
  userId: string;
  ownerId: string;
  role: Role;
}

/**
 * Determina de quién son los datos que ve este usuario. Un cajero trabaja sobre los
 * datos de su dueño. Sin conexión se usa la última membresía conocida.
 */
async function resolveContext(user: AuthUser): Promise<SessionContext> {
  const self: SessionContext = { ownerId: user.id, role: 'owner' };
  if (!hasBackend()) return self;

  const cached = (await db().meta.get('membership'))?.value as CachedMembership | undefined;
  const cachedCtx: SessionContext | null =
    cached && cached.userId === user.id ? { ownerId: cached.ownerId, role: cached.role } : null;

  const sb = getSupabase();
  if (!sb || (typeof navigator !== 'undefined' && !navigator.onLine)) return cachedCtx ?? self;

  try {
    // Solo se confía en la respuesta si hay sesión válida de este usuario
    // (sin sesión, RLS devuelve vacío y se confundiría con "no es cajero").
    const { data: sess } = await sb.auth.getSession();
    if (sess.session?.user.id !== user.id) return cachedCtx ?? self;

    const { data, error } = await sb
      .from('stall_members')
      .select('owner_id, role')
      .eq('member_id', user.id)
      .maybeSingle();
    if (error) return cachedCtx ?? self;

    const ctx: SessionContext = data ? { ownerId: data.owner_id as string, role: 'cajero' } : self;
    await db().meta.put({
      key: 'membership',
      value: { userId: user.id, ownerId: ctx.ownerId, role: ctx.role } satisfies CachedMembership,
    });
    return ctx;
  } catch {
    return cachedCtx ?? self;
  }
}

/** Deja la base local lista para `user`: categorías, dueño activo, rol y perfil. */
export async function initSession(user: AuthUser): Promise<SessionContext> {
  await ensureSeed();
  const ctx = await resolveContext(user);

  await db().meta.bulkPut([
    { key: 'owner_id', value: ctx.ownerId },
    { key: 'role', value: ctx.role },
    { key: 'actor_name', value: user.displayName ?? user.email ?? null },
  ]);

  // El perfil del negocio pertenece al dueño: un cajero lo recibe del servidor, no lo crea
  if (ctx.role === 'owner') {
    await db().transaction('rw', db().profiles, async () => {
      const now = new Date().toISOString();
      const current = await db().profiles.get(ctx.ownerId);
      if (!current) {
        await db().profiles.put({
          id: ctx.ownerId,
          full_name: user.displayName,
          stall_name: user.stallName ?? DEFAULT_STALL,
          stall_type: null,
          phone: null,
          money_saved: 0,
          currency: 'PEN',
          created_at: now,
          updated_at: now,
        });
      } else if (current.stall_name === DEFAULT_STALL && user.stallName) {
        // Perfil creado con valores por defecto antes de que hubiera cuenta
        await db().profiles.put({
          ...current,
          full_name: current.full_name ?? user.displayName,
          stall_name: user.stallName,
          updated_at: now,
        });
      }
    });
  }
  return ctx;
}

/**
 * Sincronización de arranque: sube lo pendiente, baja datos frescos y recalcula el
 * semáforo. Devuelve true si cambió algo que la UI deba volver a leer.
 */
export async function syncOnStart(user: AuthUser, ctx: SessionContext): Promise<boolean> {
  let changed = false;
  await drainQueue();
  if (hasBackend()) changed = (await pullFromServer(user.id, ctx.ownerId)) || changed;
  changed = (await recalcAllFreshness()) || changed;
  await drainQueue();
  return changed;
}
