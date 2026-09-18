'use client';

import { useState } from 'react';
import { Archive, Save } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { ErrorNote } from '@/components/ui/feedback';
import { useArchiveProduct, useCategories, useUpdateProduct } from '@/hooks/useProducts';
import { parseMoney } from '@/lib/logic/cart';
import { cn, errorMessage, formatPEN, formatQty } from '@/lib/utils';
import type { Product } from '@/types';

/** Edita nombre, categoría, precio y stock mínimo. El stock y el costo cambian solo con movimientos. */
export function EditProductModal({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !product) return null;
  return <EditBody key={product.id} product={product} onClose={onClose} />;
}

function EditBody({ product, onClose }: { product: Product; onClose: () => void }) {
  const { data: categories } = useCategories();
  const update = useUpdateProduct();
  const archive = useArchiveProduct();
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState<string | null>(product.category_id);
  const [price, setPrice] = useState(String(product.sale_price));
  const [minStock, setMinStock] = useState(product.min_stock > 0 ? String(product.min_stock) : '');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceValue = parseMoney(price);
  const minValue = minStock.trim() === '' ? 0 : parseMoney(minStock);
  const canSave = name.trim().length > 0 && priceValue !== null && minValue !== null && !update.isPending;

  const save = async () => {
    if (!canSave || priceValue === null || minValue === null) return;
    setError(null);
    try {
      await update.mutateAsync({
        productId: product.id,
        patch: { name, category_id: categoryId, sale_price: priceValue, min_stock: minValue },
      });
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const doArchive = async () => {
    setError(null);
    try {
      await archive.mutateAsync(product.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Sheet open onClose={onClose} title="Editar producto">
      <div className="space-y-4">
        <p className="rounded-xl bg-secondary/70 px-3 py-2 text-sm text-muted-foreground">
          Stock <b className="text-foreground">{formatQty(product.current_stock, product.unit)}</b> · Costo{' '}
          <b className="text-foreground">{formatPEN(product.avg_cost)}</b>. Para cambiarlos usa Vender, Merma o Reabastecer.
        </p>

        <Field label="Nombre" htmlFor="edit-name">
          <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-muted-foreground">Categoría</p>
          <div className="flex flex-wrap gap-2">
            {categories?.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                className={cn(
                  'flex min-h-[44px] items-center gap-1 rounded-full border-2 px-3 text-sm font-semibold active:scale-95',
                  categoryId === c.id ? 'border-fresco bg-fresco/10 text-fresco' : 'border-border'
                )}
              >
                <span>{c.icon}</span> {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio de venta (S/)" htmlFor="edit-price" error={priceValue === null ? 'Precio inválido' : null}>
            <Input id="edit-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} aria-invalid={priceValue === null} />
          </Field>
          <Field label="Stock mínimo" htmlFor="edit-min" hint="Vacío = valor por defecto" error={minValue === null ? 'Cantidad inválida' : null}>
            <Input id="edit-min" inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value)} aria-invalid={minValue === null} />
          </Field>
        </div>

        <ErrorNote message={error} />

        <Button size="lg" className="w-full" onClick={save} disabled={!canSave}>
          <Save className="h-5 w-5" /> {update.isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>

        {confirmArchive ? (
          <div className="space-y-2 rounded-2xl border-2 border-alerta/30 bg-alerta/5 p-3">
            <p className="text-sm font-bold text-alerta">
              El producto dejará de mostrarse. Tus ventas anteriores se conservan.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setConfirmArchive(false)} disabled={archive.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={doArchive} disabled={archive.isPending}>
                {archive.isPending ? 'Eliminando…' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" className="w-full text-alerta" onClick={() => setConfirmArchive(true)}>
            <Archive className="h-5 w-5" /> Eliminar producto
          </Button>
        )}
      </div>
    </Sheet>
  );
}
