'use client';

import { useMemo, useState } from 'react';
import { PackageOpen, Search } from 'lucide-react';
import type { FreshnessState, Product, SaleWithItems } from '@/types';
import { useCategories, useInvalidate, useProducts } from '@/hooks/useProducts';
import { useSettings } from '@/hooks/useSales';
import { can } from '@/lib/auth/permissions';
import { isLowStock } from '@/lib/logic/stock';
import { useAppStore } from '@/stores/useAppStore';
import { EditProductModal } from './EditProductModal';
import { computeFreshness } from '@/lib/logic/freshness';
import { loadDemoProducts } from '@/lib/db/seed';
import { hasBackend } from '@/lib/supabase/client';
import { ProductCard } from './ProductCard';
import { WasteModal } from '@/components/mermas/WasteModal';
import { SellModal } from './SellModal';
import { TicketDialog } from '@/components/ticket/TicketDialog';
import { Button } from '@/components/ui/button';
import { EmptyState, Spinner } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';

type Filter = 'todos' | 'bajo' | FreshnessState;

const FILTERS: { key: Filter; label: string; dot?: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'rojo', label: 'Urgente', dot: 'bg-semaforo-rojo' },
  { key: 'amarillo', label: 'Prioritario', dot: 'bg-semaforo-amarillo' },
  { key: 'verde', label: 'Fresco', dot: 'bg-semaforo-verde' },
  { key: 'bajo', label: 'Stock bajo', dot: 'bg-atencion' },
];

const ORDER: Record<FreshnessState, number> = { rojo: 0, amarillo: 1, verde: 2 };

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function InventoryList({ limit }: { limit?: number }) {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const invalidate = useInvalidate();
  const { data: settings } = useSettings();
  const role = useAppStore((s) => s.role);
  const lowDefault = settings?.lowStockDefault;
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [filter, setFilter] = useState<Filter>('todos');
  const [query, setQuery] = useState('');
  const [wasteProduct, setWasteProduct] = useState<Product | null>(null);
  const [sellProduct, setSellProduct] = useState<Product | null>(null);
  const [ticket, setTicket] = useState<SaleWithItems | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const catMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const state = (p: Product) => computeFreshness(p, p.category_id ? catMap.get(p.category_id) : null).state;
    let list = (products ?? []).map((p) => ({ p, s: state(p) }));
    if (filter === 'bajo') list = list.filter((x) => isLowStock(x.p, lowDefault));
    else if (filter !== 'todos') list = list.filter((x) => x.s === filter);
    if (q) list = list.filter((x) => normalize(x.p.name).includes(q));
    list.sort((a, b) => ORDER[a.s] - ORDER[b.s]);
    const out = list.map((x) => x.p);
    return limit ? out.slice(0, limit) : out;
  }, [products, filter, query, catMap, limit, lowDefault]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (!products?.length) {
    return (
      <EmptyState
        icon={PackageOpen}
        title="Tu puesto está vacío"
        text="Toca el botón verde “+” para agregar tu primer producto."
        action={
          !hasBackend() && !limit ? (
            <Button
              variant="soft"
              size="sm"
              disabled={loadingDemo}
              onClick={async () => {
                setLoadingDemo(true);
                try {
                  await loadDemoProducts();
                  invalidate();
                } finally {
                  setLoadingDemo(false);
                }
              }}
            >
              {loadingDemo ? 'Cargando…' : 'Cargar productos de ejemplo'}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {!limit && (
        <>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar producto…"
              aria-label="Buscar producto"
              className="min-h-touch w-full rounded-xl border-2 border-input bg-card pl-12 pr-4 text-lg placeholder:text-muted-foreground/70 focus-visible:border-fresco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fresco/25"
            />
          </div>

          {/* Filtros por semáforo (chips grandes) */}
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  'flex min-h-[48px] shrink-0 items-center gap-2 rounded-full border-2 px-4 font-semibold transition-colors active:scale-95',
                  filter === f.key ? 'border-bosque bg-bosque text-bosque-fg' : 'border-border bg-card'
                )}
              >
                {f.dot && <span className={cn('h-3 w-3 rounded-full', f.dot)} />}
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-2xl bg-card py-10 text-center text-muted-foreground shadow-card">
          No hay productos que coincidan.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              category={p.category_id ? catMap.get(p.category_id) : null}
              onWaste={setWasteProduct}
              onSell={setSellProduct}
              onEdit={can(role, 'editInventory') ? setEditProduct : undefined}
              lowStock={isLowStock(p, lowDefault)}
              canWaste={can(role, 'waste')}
              canSell={can(role, 'sell')}
            />
          ))}
        </div>
      )}

      <WasteModal product={wasteProduct} open={!!wasteProduct} onClose={() => setWasteProduct(null)} />
      <SellModal
        product={sellProduct}
        open={!!sellProduct}
        onClose={() => setSellProduct(null)}
        onSold={(sale) => {
          setSellProduct(null);
          setTicket(sale);
        }}
      />
      <EditProductModal product={editProduct} open={!!editProduct} onClose={() => setEditProduct(null)} />
      <TicketDialog data={ticket} justSold onClose={() => setTicket(null)} />
    </div>
  );
}
