'use client';

// Utilidades compartidas por los repositorios (no forman parte de la API pública de la UI).

import { can, type Action } from '@/lib/auth/permissions';
import { LOCAL_OWNER_ID } from '@/lib/constants';
import { db } from '@/lib/db/dexie';
import type { Role, SyncEntity, SyncOp } from '@/types';

export function nowISO(): string {
  return new Date().toISOString();
}

/** Dueño de los datos de la sesión activa. Requiere la tabla `meta` dentro de la transacción. */
export async function currentOwnerId(): Promise<string> {
  const meta = await db().meta.get('owner_id');
  return typeof meta?.value === 'string' && meta.value ? meta.value : LOCAL_OWNER_ID;
}

/** Rol de la sesión activa (por defecto dueño: modo local y datos anteriores al equipo). */
export async function currentRole(): Promise<Role> {
  const meta = await db().meta.get('role');
  return meta?.value === 'cajero' ? 'cajero' : 'owner';
}

/** Nombre de quien opera (para "cobró: …"). */
export async function currentActorName(): Promise<string | null> {
  const meta = await db().meta.get('actor_name');
  return typeof meta?.value === 'string' && meta.value.trim() ? meta.value.trim() : null;
}

/** Defensa en profundidad: aunque la UI oculte el botón, el repositorio rechaza la acción. */
export async function assertCan(action: Action): Promise<void> {
  if (!can(await currentRole(), action)) {
    throw new Error('Tu rol no tiene permiso para esta acción');
  }
}

export function assertPositive(n: number, label: string): void {
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} debe ser mayor que 0`);
}

export function assertNonNegative(n: number, label: string): void {
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} no puede ser negativo`);
}

/** Encola una mutación para el motor de sync. Llamar dentro de la misma transacción del cambio. */
export async function enqueue(entity: SyncEntity, op: SyncOp, payload: object): Promise<void> {
  await db().syncQueue.add({
    entity,
    op,
    payload: payload as Record<string, unknown>,
    createdAt: Date.now(),
    tries: 0,
  });
}
