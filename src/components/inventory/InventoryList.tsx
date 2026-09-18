'use client';

import { useMemo, useState } from 'react';
import type { FreshnessState, Product } from '@/types';
import { useCategories, useProducts } from '@/hooks/useProducts';
import { computeFreshness } from '@/lib/logic/freshness';
import { ProductCard } from './ProductCard';
import { WasteModal } from '@/components/mermas/WasteModal';
import { SellModal } from './SellModal';
import { cn } from '@/lib/utils';

type Filter = 'todos' | FreshnessState;

const FILTERS: { key: Filter; label: string; dot?: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'rojo', label: 'Urgente', dot: 'bg-semaforo-rojo' },
  { key: 'amarillo', label: 'Prioritario', dot: 'bg-semaforo-amarillo' },
  { key: 'verde', label: 'Fresco', dot: 'bg-semaforo-verde' },
];

export function InventoryList({ limit }: { limit?: number }) {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const [filter, setFilter] = useState<Filter>('todos');
  const [wasteProduct, setWasteProduct] = useState<Product | null>(null);
  const [sellProduct, setSellProduct] = useState<Product | null>(null);

  const catMap = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    let list = products ?? [];
    if (filter !== 'todos') {
      list = list.filter(
        (p) => computeFreshness(p, p.category_id ? catMap.get(p.category_id) : null).state === filter
      );
    }
    // Urgentes primero
    const order: Record<FreshnessState, number> = { rojo: 0, amarillo: 1, verde: 2 };
    list = [...list].sort((a, b) => {
      const sa = computeFreshness(a, a.category_id ? catMap.get(a.category_id) : null).state;
      const sb = computeFreshness(b, b.category_id ? catMap.get(b.category_id) : null).state;
      return order[sa] - order[sb];
    });
    return limit ? list.slice(0, limit) : list;
  }, [products, filter, catMap, limit]);

  if (isLoading) {
    return <div className="py-10 text-center text-muted-foreground">Cargando…</div>;
  }

  if (!products?.length) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
        <p className="text-lg font-semibold">Tu puesto está vacío</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Toca el botón verde “+” para agregar tu primer producto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros por semáforo (chips grandes) */}
      {!limit && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'flex min-h-[48px] shrink-0 items-center gap-2 rounded-full border-2 px-4 font-semibold active:scale-95',
                filter === f.key ? 'border-bosque bg-bosque text-bosque-fg' : 'border-border'
              )}
            >
              {f.dot && <span className={cn('h-3 w-3 rounded-full', f.dot)} />}
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            category={p.category_id ? catMap.get(p.category_id) : null}
            onWaste={setWasteProduct}
            onSell={setSellProduct}
          />
        ))}
      </div>

      <WasteModal product={wasteProduct} open={!!wasteProduct} onClose={() => setWasteProduct(null)} />
      <SellModal product={sellProduct} open={!!sellProduct} onClose={() => setSellProduct(null)} />
    </div>
  );
}
