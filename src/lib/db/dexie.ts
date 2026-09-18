'use client';

// =============================================================================
// Base de datos local (IndexedDB via Dexie) — corazón del modo Offline-First.
// Toda lectura de la UI ocurre contra estas tablas; las escrituras se guardan
// aquí de inmediato y se encolan en `syncQueue` para subir a Supabase.
// =============================================================================

import Dexie, { type Table } from 'dexie';
import type {
  Category,
  DailyClosure,
  InventoryLog,
  Product,
  Profile,
  SyncMutation,
  WasteLog,
} from '@/types';

export class MercadoControlDB extends Dexie {
  profiles!: Table<Profile, string>;
  categories!: Table<Category, string>;
  products!: Table<Product, string>;
  inventory_logs!: Table<InventoryLog, string>;
  waste_logs!: Table<WasteLog, string>;
  daily_closures!: Table<DailyClosure, string>;
  syncQueue!: Table<SyncMutation, number>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('mercadocontrol');
    this.version(1).stores({
      profiles: 'id',
      categories: 'id, owner_id, name',
      products: 'id, owner_id, category_id, freshness, is_active, entry_date',
      inventory_logs: 'id, owner_id, product_id, created_at',
      waste_logs: 'id, owner_id, product_id, reason, created_at',
      daily_closures: 'id, owner_id, closure_date',
      // ++id -> autoincrement; ordenamos por createdAt al drenar la cola
      syncQueue: '++id, entity, op, createdAt',
      meta: 'key',
    });
  }
}

// Instancia única (solo en navegador)
let _db: MercadoControlDB | null = null;

export function db(): MercadoControlDB {
  if (typeof window === 'undefined') {
    // En SSR devolvemos un stub que nunca se usa realmente.
    throw new Error('Dexie solo está disponible en el navegador');
  }
  if (!_db) _db = new MercadoControlDB();
  return _db;
}
