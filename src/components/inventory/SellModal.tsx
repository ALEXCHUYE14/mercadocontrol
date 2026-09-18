'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Stepper } from '@/components/ui/stepper';
import { Input } from '@/components/ui/input';
import type { Product } from '@/types';
import { formatPEN, formatQty, cn, errorMessage, round2 } from '@/lib/utils';
import { useSell } from '@/hooks/useProducts';

/**
 * El cuerpo solo existe mientras el modal está abierto y se remonta por producto,
 * así cada venta parte de cantidad/precio limpios del producto actual
 * (antes el precio quedaba en 0 en la primera apertura).
 */
export function SellModal({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !product) return null;
  return <SellModalBody key={product.id} product={product} onClose={onClose} />;
}

function SellModalBody({ product, onClose }: { product: Product; onClose: () => void }) {
  const [qty, setQty] = useState(() => Math.min(1, product.current_stock));
  const [price, setPrice] = useState(() => String(product.sale_price));
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soldTotal, setSoldTotal] = useState(0);
  const sell = useSell();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const step = product.unit === 'kg' || product.unit === 'litro' ? 0.5 : 1;
  const unitPrice = parseFloat(price);
  const validPrice = Number.isFinite(unitPrice) && unitPrice >= 0;
  const total = validPrice ? round2(qty * unitPrice) : 0;

  const handleClose = () => {
    clearTimeout(closeTimer.current);
    onClose();
  };

  const confirm = async () => {
    if (!validPrice || qty <= 0) return;
    setError(null);
    try {
      await sell.mutateAsync({ productId: product.id, quantity: qty, unitPrice });
      setSoldTotal(total);
      setDone(true);
      closeTimer.current = setTimeout(handleClose, 1000);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Sheet open onClose={handleClose} title={`Vender · ${product.name}`}>
      {done ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-fresco text-fresco-fg">
            <Check className="h-10 w-10" />
          </div>
          <p className="text-lg font-bold">Venta de {formatPEN(soldTotal)}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              Cantidad (quedan {formatQty(product.current_stock)} {product.unit})
            </p>
            <Stepper value={qty} onChange={setQty} step={step} min={Math.min(step, product.current_stock)} max={product.current_stock} unit={product.unit} />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">Precio unitario (S/)</p>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              aria-invalid={!validPrice}
            />
          </div>

          <div className="rounded-xl bg-secondary/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Total venta</span>
              <span className="text-2xl font-extrabold tabular-nums text-fresco">{formatPEN(total)}</span>
            </div>
          </div>

          {error && <p className="rounded-lg bg-alerta/10 px-3 py-2 text-sm font-semibold text-alerta">{error}</p>}

          <button
            onClick={confirm}
            disabled={qty <= 0 || !validPrice || sell.isPending}
            className={cn(
              'flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl bg-fresco text-lg font-bold text-fresco-fg active:scale-[0.98] disabled:opacity-50'
            )}
          >
            <ShoppingCart className="h-6 w-6" />
            {sell.isPending ? 'Guardando…' : 'Confirmar venta'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
