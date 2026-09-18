'use client';

import { useMemo, useState } from 'react';
import { PackageOpen, Plus, Search, ShoppingBasket } from 'lucide-react';
import { useCategories, useProducts } from '@/hooks/useProducts';
import { CartSheet, type CartEntry } from '@/components/sales/CartSheet';
import { TicketDialog } from '@/components/ticket/TicketDialog';
import { Button } from '@/components/ui/button';
import { EmptyState, Spinner } from '@/components/ui/feedback';
import { cartSubtotal, parseMoney } from '@/lib/logic/cart';
import { cn, formatPEN, formatQty } from '@/lib/utils';
import type { Product, SaleWithItems } from '@/types';
import Link from 'next/link';

function stepFor(p: Product): number {
  return p.unit === 'kg' || p.unit === 'litro' ? 0.5 : 1;
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Punto de venta: toca productos para armar el carrito y cobra con ticket. */
export function NewSale() {
  const { data: products, isLoading } = useProducts();
  const { data: categories } = useCategories();
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [query, setQuery] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [ticket, setTicket] = useState<SaleWithItems | null>(null);

  const catIcon = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c.icon ?? '📦'])), [categories]);
  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  // Solo líneas de productos que siguen existiendo y con stock; la cantidad se ajusta al stock actual
  const cart = useMemo(
    () =>
      entries
        .map((e) => ({ e, p: byId.get(e.productId) }))
        .filter((x): x is { e: CartEntry; p: Product } => !!x.p && x.p.current_stock > 0)
        .map(({ e, p }) => ({ ...e, quantity: Math.min(e.quantity, p.current_stock) })),
    [entries, byId]
  );

  const sellable = useMemo(() => {
    const q = normalize(query.trim());
    return (products ?? [])
      .filter((p) => p.current_stock > 0)
      .filter((p) => !q || normalize(p.name).includes(q));
  }, [products, query]);

  const inCart = (id: string) => cart.find((e) => e.productId === id)?.quantity ?? 0;

  const add = (p: Product) => {
    setEntries((prev) => {
      const current = prev.find((e) => e.productId === p.id);
      if (!current) return [...prev, { productId: p.id, quantity: Math.min(stepFor(p), p.current_stock), price: String(p.sale_price) }];
      const next = Math.min(current.quantity + stepFor(p), p.current_stock);
      return prev.map((e) => (e.productId === p.id ? { ...e, quantity: next } : e));
    });
  };

  const itemCount = cart.length;
  const validLines = cart
    .map((e) => ({ productId: e.productId, quantity: e.quantity, unitPrice: parseMoney(e.price) }))
    .filter((l): l is { productId: string; quantity: number; unitPrice: number } => l.unitPrice !== null);
  const subtotal = cartSubtotal(validLines);

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
        title="Aún no tienes productos"
        text="Agrega productos a tu inventario para poder venderlos."
        action={
          <Link href="/inventario" className="font-bold text-fresco">
            Ir al inventario
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto para vender…"
          aria-label="Buscar producto para vender"
          className="min-h-touch w-full rounded-xl border-2 border-input bg-card pl-12 pr-4 text-lg placeholder:text-muted-foreground/70 focus-visible:border-fresco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fresco/25"
        />
      </div>

      {sellable.length === 0 ? (
        <p className="rounded-2xl bg-card py-10 text-center text-muted-foreground shadow-card">
          No hay productos con stock que coincidan.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sellable.map((p) => {
            const qty = inCart(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                disabled={qty >= p.current_stock}
                aria-label={`Agregar ${p.name}`}
                className={cn(
                  'relative flex min-h-[112px] flex-col items-start justify-between rounded-2xl border-2 bg-card p-3 text-left shadow-card transition-all active:scale-[0.97] disabled:opacity-60',
                  qty > 0 ? 'border-fresco' : 'border-transparent'
                )}
              >
                {qty > 0 && (
                  <span className="absolute right-2 top-2 rounded-full bg-fresco px-2 py-0.5 text-xs font-extrabold text-fresco-fg tabular">
                    {formatQty(qty)}
                  </span>
                )}
                <span className="text-2xl">{(p.category_id && catIcon.get(p.category_id)) || '📦'}</span>
                <span className="w-full">
                  <span className="line-clamp-2 block font-bold leading-tight">{p.name}</span>
                  <span className="mt-1 flex items-center justify-between text-sm">
                    <span className="font-extrabold text-fresco tabular">{formatPEN(p.sale_price)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatQty(p.current_stock)} {p.unit}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Barra de cobro fija, por encima de la navegación inferior */}
      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-[84px] z-30 px-4 lg:bottom-4 lg:left-64">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-2xl bg-bosque p-3 pl-4 text-bosque-fg shadow-pop">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <ShoppingBasket className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs text-white/75">
                  {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
                </p>
                <p className="text-xl font-extrabold leading-none tabular">{formatPEN(subtotal)}</p>
              </div>
            </div>
            <Button onClick={() => setCartOpen(true)} className="bg-white text-bosque shadow-none hover:bg-white/90">
              <Plus className="hidden h-5 w-5 rotate-45 sm:block" /> Cobrar
            </Button>
          </div>
        </div>
      )}

      <CartSheet
        open={cartOpen && itemCount > 0}
        entries={cart}
        products={byId}
        onChange={setEntries}
        onClose={() => setCartOpen(false)}
        onSold={(sale) => {
          setEntries([]);
          setCartOpen(false);
          setTicket(sale);
        }}
      />
      <TicketDialog data={ticket} justSold onClose={() => setTicket(null)} />
    </div>
  );
}
