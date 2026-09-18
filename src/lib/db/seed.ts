'use client';

// =============================================================================
// Semilla local: categorías globales (necesarias para usar la app sin conexión)
// y productos de ejemplo OPCIONALES (los carga el usuario a propósito).
// =============================================================================

import { db } from '@/lib/db/dexie';
import { currentOwnerId } from '@/lib/db/internal';
import { computeFreshness } from '@/lib/logic/freshness';
import { uuid } from '@/lib/utils';
import type { Category, Product } from '@/types';

const GLOBAL_CATEGORIES: Omit<Category, 'id' | 'created_at' | 'updated_at'>[] = [
  { owner_id: null, name: 'Frutas', icon: '🍎', color: '#EF4444', avg_shelf_life_days: 5, yellow_threshold: 0.45, red_threshold: 0.75 },
  { owner_id: null, name: 'Verduras', icon: '🥬', color: '#10B981', avg_shelf_life_days: 4, yellow_threshold: 0.45, red_threshold: 0.75 },
  { owner_id: null, name: 'Tubérculos', icon: '🥔', color: '#F97316', avg_shelf_life_days: 20, yellow_threshold: 0.55, red_threshold: 0.85 },
  { owner_id: null, name: 'Hierbas', icon: '🌿', color: '#065F46', avg_shelf_life_days: 2, yellow_threshold: 0.4, red_threshold: 0.7 },
  { owner_id: null, name: 'Abarrotes', icon: '🍚', color: '#0F172A', avg_shelf_life_days: 180, yellow_threshold: 0.7, red_threshold: 0.9 },
  { owner_id: null, name: 'Huevos', icon: '🥚', color: '#F97316', avg_shelf_life_days: 21, yellow_threshold: 0.55, red_threshold: 0.85 },
  { owner_id: null, name: 'Lácteos', icon: '🥛', color: '#F8FAFC', avg_shelf_life_days: 10, yellow_threshold: 0.55, red_threshold: 0.85 },
  { owner_id: null, name: 'Carnes/Pollo', icon: '🍗', color: '#EF4444', avg_shelf_life_days: 2, yellow_threshold: 0.4, red_threshold: 0.7 },
];

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

let seeding: Promise<void> | null = null;

/**
 * Garantiza las categorías globales. Idempotente y seguro ante llamadas simultáneas
 * (React StrictMode monta los efectos dos veces en desarrollo y las duplicaría).
 */
export function ensureSeed(): Promise<void> {
  if (!seeding) {
    seeding = seedCategories().catch((err) => {
      seeding = null; // permite reintentar si IndexedDB falló
      throw err;
    });
  }
  return seeding;
}

async function seedCategories(): Promise<void> {
  await db().transaction('rw', db().categories, async () => {
    if ((await db().categories.count()) > 0) return;
    const now = new Date().toISOString();
    await db().categories.bulkPut(
      GLOBAL_CATEGORIES.map((c) => ({ ...c, id: uuid(), created_at: now, updated_at: now }))
    );
  });
}

const DEMO_PRODUCTS: Array<{
  name: string;
  catName: string;
  unit: Product['unit'];
  stock: number;
  cost: number;
  price: number;
  daysAgo: number;
}> = [
  { name: 'Tomate', catName: 'Verduras', unit: 'kg', stock: 18, cost: 2.2, price: 3.5, daysAgo: 3 },
  { name: 'Plátano de seda', catName: 'Frutas', unit: 'kg', stock: 25, cost: 1.8, price: 3.0, daysAgo: 4 },
  { name: 'Papa blanca', catName: 'Tubérculos', unit: 'saco', stock: 4, cost: 60, price: 85, daysAgo: 6 },
  { name: 'Culantro', catName: 'Hierbas', unit: 'atado', stock: 30, cost: 0.4, price: 1.0, daysAgo: 2 },
  { name: 'Palta fuerte', catName: 'Frutas', unit: 'kg', stock: 12, cost: 4.5, price: 7.0, daysAgo: 5 },
  { name: 'Arroz extra', catName: 'Abarrotes', unit: 'saco', stock: 8, cost: 150, price: 175, daysAgo: 20 },
];

/**
 * Carga productos de ejemplo en local para el dueño actual (solo modo local: no se
 * sincronizan). Devuelve cuántos agregó; 0 si ya tenía productos.
 */
export async function loadDemoProducts(): Promise<number> {
  await ensureSeed();
  let added = 0;
  await db().transaction('rw', [db().meta, db().categories, db().products], async () => {
    const owner = await currentOwnerId();
    if ((await db().products.where('owner_id').equals(owner).count()) > 0) return;
    const cats = await db().categories.toArray();
    const products: Product[] = DEMO_PRODUCTS.map((d) => {
      const cat = cats.find((c) => c.name === d.catName);
      const base: Product = {
        id: uuid(),
        owner_id: owner,
        category_id: cat?.id ?? null,
        name: d.name,
        batch_code: `L-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        unit: d.unit,
        current_stock: d.stock,
        initial_stock: d.stock,
        avg_cost: d.cost,
        sale_price: d.price,
        min_stock: 0,
        freshness: 'verde',
        entry_date: daysAgoISO(d.daysAgo),
        expires_at: null,
        photo_url: null,
        is_active: true,
        created_at: daysAgoISO(d.daysAgo),
        updated_at: new Date().toISOString(),
      };
      base.freshness = computeFreshness(base, cat).state;
      return base;
    });
    await db().products.bulkPut(products);
    added = products.length;
  });
  return added;
}
