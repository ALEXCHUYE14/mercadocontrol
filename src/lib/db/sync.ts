'use client';

// =============================================================================
// Motor de sincronización Offline-First.
// Drena la cola `syncQueue` de Dexie hacia Supabase cuando hay conexión y sesión.
// - Se dispara: al volver online, al registrar Background Sync, o manualmente.
// - Reintentos acotados (MAX_TRIES); se respeta el orden de la cola y, si un
//   item falla, se detiene el lote para no romper dependencias (FK) entre items.
// - Nunca se baja data del servidor mientras haya cambios locales sin subir,
//   para no pisar el trabajo hecho offline.
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '@/lib/db/dexie';
import { getSupabase, hasBackend } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/utils';
import type { SyncMutation } from '@/types';

const MAX_TRIES = 6;
const PAGE_SIZE = 1000;
let syncing = false;

type BackgroundSyncRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> };
};

/** Solicita una sincronización: drena ya y, además, registra Background Sync si existe. */
export function requestSync(): void {
  if (typeof window === 'undefined') return;
  // Drenado directo: no depende de que el Service Worker esté activo (p. ej. en dev).
  void drainQueue().catch(() => {});
  // Background Sync (best-effort): reintenta aunque el usuario cierre la pestaña.
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.getRegistration().then((reg) => {
      void (reg as BackgroundSyncRegistration | undefined)?.sync?.register('mc-sync-queue');
    }).catch(() => {});
  }
}

/** Vacía la cola de mutaciones hacia Supabase. Seguro de llamar en paralelo. */
export async function drainQueue(): Promise<{ pushed: number; pending: number }> {
  if (syncing) return { pushed: 0, pending: await pendingCount() };
  if (!hasBackend() || typeof navigator === 'undefined' || !navigator.onLine) {
    return { pushed: 0, pending: await pendingCount() };
  }
  const sb = getSupabase();
  if (!sb) return { pushed: 0, pending: await pendingCount() };

  syncing = true;
  let pushed = 0;
  try {
    // Sin sesión, RLS rechazaría todo: se conserva la cola hasta que inicie sesión.
    const { data: sessionData } = await sb.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return { pushed: 0, pending: await pendingCount() };
    // Un cajero escribe con el id del DUEÑO del puesto (owner_id), no con el suyo
    const ownerMeta = await db().meta.get('owner_id');
    const allowedOwners = new Set<unknown>([userId, ownerMeta?.value]);

    const items = await db().syncQueue.orderBy('createdAt').toArray();
    for (const item of items) {
      if (item.tries >= MAX_TRIES) continue;              // inspección manual
      if (!allowedOwners.has(ownerOf(item))) continue;    // datos de otro dueño/demo local

      try {
        await pushOne(sb, item);
        if (item.id != null) await db().syncQueue.delete(item.id);
        pushed++;
      } catch (err) {
        if (item.id != null) {
          await db().syncQueue.update(item.id, {
            tries: item.tries + 1,
            lastError: errorMessage(err),
          });
        }
        break; // respeta el orden: los siguientes pueden depender de este
      }
    }
  } finally {
    syncing = false;
  }
  await db().meta.put({ key: 'last_sync', value: Date.now() });
  return { pushed, pending: await pendingCount() };
}

function ownerOf(item: SyncMutation): unknown {
  return item.entity === 'profiles' ? item.payload.id : item.payload.owner_id;
}

async function pushOne(sb: SupabaseClient, item: SyncMutation) {
  const { entity, op, payload } = item;

  if (op === 'delete') {
    const { error } = await sb.from(entity).delete().eq('id', payload.id as string);
    if (error) throw error;
    return;
  }

  // Actualización parcial (semáforo/edición de productos, datos del perfil, anulación de ventas): un upsert fallaría
  // por las columnas NOT NULL ausentes y podría pisar stock o dinero salvado.
  if ((entity === 'products' || entity === 'profiles' || entity === 'sales') && op === 'update') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, owner_id, ...patch } = payload;
    const { error } = await sb.from(entity).update(patch).eq('id', id as string);
    if (error) throw error;
    return;
  }

  // upsert es idempotente: seguro ante reintentos y datos ya subidos.
  // El cierre diario es único por (dueño, fecha), no solo por id.
  const onConflict = entity === 'daily_closures' ? 'owner_id,closure_date' : 'id';
  const { error } = await sb.from(entity).upsert(payload, { onConflict });
  if (error) throw error;
}

async function pendingCount(): Promise<number> {
  return db().syncQueue.count();
}

type Row = Record<string, unknown>;

/** Descarga una tabla completa paginando (Supabase limita a 1000 filas por request). */
async function fetchAll(sb: SupabaseClient, table: string, ownerId: string | null): Promise<Row[] | null> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = sb.from(table).select('*').order('id').range(from, from + PAGE_SIZE - 1);
    if (ownerId) query = query.eq('owner_id', ownerId);
    const { data, error } = await query;
    if (error || !data) return null;
    rows.push(...(data as Row[]));
    if (data.length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Las categorías globales del servidor tienen ids distintos a las sembradas
 * localmente. Se reemplazan las locales y se re-apuntan productos (y cola pendiente)
 * a la categoría equivalente por nombre, para no romper la FK al sincronizar.
 */
async function pullCategories(sb: SupabaseClient): Promise<void> {
  const rows = await fetchAll(sb, 'categories', null); // globales + propias (RLS filtra)
  // Una respuesta vacía indica sesión inválida o RLS: nunca borrar las locales por eso
  if (!rows || rows.length === 0) return;

  const serverIds = new Set(rows.map((r) => r.id as string));
  const serverByName = new Map(
    rows.filter((r) => r.owner_id == null).map((r) => [String(r.name).toLowerCase(), r.id as string])
  );

  await db().transaction('rw', [db().categories, db().products, db().syncQueue], async () => {
    const stale = (await db().categories.toArray()).filter(
      (c) => c.owner_id === null && !serverIds.has(c.id)
    );
    const remap = new Map(stale.map((c) => [c.id, serverByName.get(c.name.toLowerCase()) ?? null]));

    if (remap.size) {
      for (const p of await db().products.toArray()) {
        if (p.category_id && remap.has(p.category_id)) {
          await db().products.update(p.id, { category_id: remap.get(p.category_id) ?? null });
        }
      }
      for (const q of await db().syncQueue.where('entity').equals('products').toArray()) {
        const cid = q.payload.category_id as string | null | undefined;
        if (cid && remap.has(cid) && q.id != null) {
          await db().syncQueue.update(q.id, { payload: { ...q.payload, category_id: remap.get(cid) ?? null } });
        }
      }
      await db().categories.bulkDelete(stale.map((c) => c.id));
    }
    await db().categories.bulkPut(rows as never[]);
  });
}

/** Baja datos frescos del servidor a Dexie (al iniciar sesión / recuperar red). */
export async function pullFromServer(userId: string, ownerId: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || typeof navigator === 'undefined' || !navigator.onLine) return false;

  try {
    // Sin sesión válida del mismo usuario, RLS devolvería vacío: no se toca lo local
    const { data: sessionData } = await sb.auth.getSession();
    if (sessionData.session?.user.id !== userId) return false;

    await pullCategories(sb);

    // Con cambios locales pendientes, bajar datos los sobrescribiría.
    if ((await pendingCount()) > 0) return false;

    for (const t of [
      'products',
      'inventory_logs',
      'waste_logs',
      'daily_closures',
      'customers',
      'sales',
      'sale_items',
      'credit_payments',
    ] as const) {
      const rows = await fetchAll(sb, t, ownerId);
      if (!rows) continue;
      await db().table(t).bulkPut(rows);
    }
    const { data: prof } = await sb.from('profiles').select('*').eq('id', ownerId).maybeSingle();
    if (prof) await db().profiles.put(prof);
    return true;
  } catch {
    return false; // sin red / servidor caído: se reintentará en la próxima apertura
  }
}

/** Inicializa los listeners de reconexión y mensajes del Service Worker. Devuelve la función de limpieza. */
export function initSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => void drainQueue().catch(() => {});
  const onMessage = (e: MessageEvent) => {
    if (e.data?.type === 'SYNC_NOW') void drainQueue().catch(() => {});
  };
  window.addEventListener('online', onOnline);
  const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : null;
  sw?.addEventListener('message', onMessage);
  return () => {
    window.removeEventListener('online', onOnline);
    sw?.removeEventListener('message', onMessage);
  };
}
