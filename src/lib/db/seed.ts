'use client';

// =============================================================================
// Semilla local: garantiza categorías y (en modo demo) productos de ejemplo,
// para que la app sea usable de inmediato aun sin backend configurado.
// =============================================================================

import { db } from '@/lib/db/dexie';
import { computeFreshness } from '@/lib/logic/freshness';
import { hasBackend } from '@/lib/supabase/client';
import { uuid } from '@/lib/utils';
import type { Category, Product } from '@/types';

const DEMO_OWNER = 'local-demo-user';

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
 * Idempotente y seguro ante llamadas simultáneas (React StrictMode monta los
 * efectos dos veces en desarrollo y duplicaría categorías/productos).
 */
export function ensureSeed(): Promise<void> {
  if (!seeding) {
    seeding = runSeed().catch((err) => {
      seeding = null; // permite reintentar si IndexedDB falló
      throw err;
    });
  }
  return seeding;
}

async function runSeed(): Promise<void> {
  // Owner por defecto en modo local
  const owner = await db().meta.get('owner_id');
  if (!owner) await db().meta.put({ key: 'owner_id', value: DEMO_OWNER });

  // Perfil demo
  const prof = await db().profiles.get(DEMO_OWNER);
  if (!prof) {
    await db().profiles.put({
      id: DEMO_OWNER,
      full_name: 'Comerciante',
      stall_name: 'Mi Puesto',
      stall_type: 'frutas_verduras',
      phone: null,
      money_saved: 0,
      currency: 'PEN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Categorías
  const catCount = await db().categories.count();
  const cats: Category[] = [];
  if (catCount === 0) {
    for (const c of GLOBAL_CATEGORIES) {
      const full: Category = {
        ...c,
        id: uuid(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      cats.push(full);
    }
    await db().categories.bulkPut(cats);
  }

  // Productos demo: solo en modo 100% local. Con backend configurado se subirían
  // datos de ejemplo a la cuenta real del usuario.
  const prodCount = await db().products.count();
  if (prodCount === 0 && !hasBackend()) {
    const allCats = cats.length ? cats : await db().categories.toArray();
    const byName = (n: string) => allCats.find((c) => c.name === n);

    const demo: Array<Partial<Product> & { name: string; catName: string; daysAgo: number }> = [
      { name: 'Tomate', catName: 'Verduras', unit: 'kg', current_stock: 18, avg_cost: 2.2, sale_price: 3.5, daysAgo: 3 },
      { name: 'Plátano de seda', catName: 'Frutas', unit: 'kg', current_stock: 25, avg_cost: 1.8, sale_price: 3.0, daysAgo: 4 },
      { name: 'Papa blanca', catName: 'Tubérculos', unit: 'saco', current_stock: 4, avg_cost: 60, sale_price: 85, daysAgo: 6 },
      { name: 'Culantro', catName: 'Hierbas', unit: 'atado', current_stock: 30, avg_cost: 0.4, sale_price: 1.0, daysAgo: 2 },
      { name: 'Palta fuerte', catName: 'Frutas', unit: 'kg', current_stock: 12, avg_cost: 4.5, sale_price: 7.0, daysAgo: 5 },
      { name: 'Arroz extra', catName: 'Abarrotes', unit: 'saco', current_stock: 8, avg_cost: 150, sale_price: 175, daysAgo: 20 },
    ];

    const products: Product[] = demo.map((d) => {
      const cat = byName(d.catName);
      const base: Product = {
        id: uuid(),
        owner_id: DEMO_OWNER,
        category_id: cat?.id ?? null,
        name: d.name,
        batch_code: `L-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        unit: d.unit as Product['unit'],
        current_stock: d.current_stock!,
        initial_stock: d.current_stock!,
        avg_cost: d.avg_cost!,
        sale_price: d.sale_price!,
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
  }
}
