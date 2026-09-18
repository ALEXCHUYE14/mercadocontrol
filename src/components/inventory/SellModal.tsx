'use client';

import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Stepper } from '@/components/ui/stepper';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorNote } from '@/components/ui/feedback';
import type { Product, SaleWithItems } from '@/types';
import { formatPEN, formatQty, errorMessage, round2 } from '@/lib/utils';
import { useSell } from '@/hooks/useProducts';

/**
 * Venta rápida de un producto. El cuerpo solo existe mientras el modal está abierto y
 * se remonta por producto, así cada venta parte de cantidad/precio limpios.
 * Al confirmar entrega la venta (con ticket) a `onSold`.
 */
export function SellModal({
  product,
  open,
  onClose,
  onSold,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onSold: (sale: SaleWithItems) => void;
}) {
  if (!open || !product) return null;
  return <SellModalBody key={product.id} product={product} onClose={onClose} onSold={onSold} />;
}

function SellModalBody({
  product,
  onClose,
  onSold,
}: {
  product: Product;
  onClose: () => void;
  onSold: (sale: SaleWithItems) => void;
}) {
  const [qty, setQty] = useState(() => Math.min(1, product.current_stock));
  const [price, setPrice] = useState(() => String(product.sale_price));
  const [error, setError] = useState<string | null>(null);
  const sell = useSell();

  const step = product.unit === 'kg' || product.unit === 'litro' ? 0.5 : 1;
  const unitPrice = parseFloat(price);
  const validPrice = Number.isFinite(unitPrice) && unitPrice >= 0;
  const total = validPrice ? round2(qty * unitPrice) : 0;

  const confirm = async () => {
    if (!validPrice || qty <= 0 || sell.isPending) return;
    setError(null);
    try {
      const sale = await sell.mutateAsync({ productId: product.id, quantity: qty, unitPrice });
      onSold(sale);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Sheet open onClose={onClose} title={`Vender · ${product.name}`}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">
            Cantidad (quedan {formatQty(product.current_stock)} {product.unit})
          </p>
          <Stepper
            value={qty}
            onChange={setQty}
            step={step}
            min={Math.min(step, product.current_stock)}
            max={product.current_stock}
            unit={product.unit}
          />
        </div>

        <Field label="Precio unitario (S/)" htmlFor="sell-price" error={validPrice ? null : 'Escribe un precio válido'}>
          <Input
            id="sell-price"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-invalid={!validPrice}
          />
        </Field>

        <div className="flex items-center justify-between rounded-2xl bg-fresco/10 p-4">
          <span className="text-sm font-semibold text-muted-foreground">Total venta</span>
          <span className="text-3xl font-extrabold tabular text-fresco">{formatPEN(total)}</span>
        </div>

        <ErrorNote message={error} />

        <Button size="lg" className="w-full" onClick={confirm} disabled={qty <= 0 || !validPrice || sell.isPending}>
          <ShoppingCart className="h-6 w-6" />
          {sell.isPending ? 'Guardando…' : 'Confirmar y ver ticket'}
        </Button>
      </div>
    </Sheet>
  );
}
