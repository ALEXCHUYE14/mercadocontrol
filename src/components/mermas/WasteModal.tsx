'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Stepper } from '@/components/ui/stepper';
import { WASTE_REASONS, type Product, type WasteReason } from '@/types';
import { formatPEN, formatQty, cn, errorMessage, round2 } from '@/lib/utils';
import { useRegisterWaste } from '@/hooks/useProducts';

interface WasteModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Registro de merma "a un tap":
 *  1. Elige el motivo (botón enorme con emoji).
 *  2. Ajusta la cantidad (stepper con +/–).
 *  3. Ve la pérdida en soles EN VIVO y confirma.
 */
export function WasteModal({ product, open, onClose }: WasteModalProps) {
  if (!open || !product) return null;
  // Se remonta por producto: cantidad y motivo siempre parten limpios
  return <WasteModalBody key={product.id} product={product} onClose={onClose} />;
}

function WasteModalBody({ product, onClose }: { product: Product; onClose: () => void }) {
  const [reason, setReason] = useState<WasteReason | null>(null);
  const [qty, setQty] = useState<number>(() => Math.min(1, product.current_stock));
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedLoss, setSavedLoss] = useState(0);
  const registerWaste = useRegisterWaste();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  const step = product.unit === 'kg' || product.unit === 'litro' ? 0.5 : 1;

  const loss = useMemo(() => round2(qty * product.avg_cost), [qty, product.avg_cost]);
  const reasonMeta = WASTE_REASONS.find((r) => r.reason === reason);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const handleClose = () => {
    clearTimeout(closeTimer.current);
    onClose();
  };

  const confirm = async () => {
    if (!reason) return;
    setError(null);
    try {
      await registerWaste.mutateAsync({ productId: product.id, reason, quantity: qty });
      setSavedLoss(loss);
      setDone(true);
      closeTimer.current = setTimeout(handleClose, 1100);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Sheet open onClose={handleClose} title={`Merma · ${product.name}`}>
      {done ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-fresco text-fresco-fg">
            <Check className="h-10 w-10" />
          </div>
          <p className="text-lg font-bold">¡Registrado!</p>
          <p className="text-sm text-muted-foreground">
            {reasonMeta?.isLoss ? 'Pérdida' : 'Salida'} de {formatPEN(savedLoss)}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Paso 1: motivo */}
          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              1. ¿Qué pasó?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {WASTE_REASONS.map((r) => (
                <button
                  key={r.reason}
                  onClick={() => setReason(r.reason)}
                  className={cn(
                    'flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 text-center font-semibold active:scale-[0.97]',
                    reason === r.reason
                      ? 'border-transparent text-white ' + r.colorClass
                      : 'border-border bg-card text-foreground'
                  )}
                >
                  <span className="text-2xl">{r.emoji}</span>
                  <span className="text-sm leading-tight">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Paso 2: cantidad */}
          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              2. ¿Cuánto? (máx {formatQty(product.current_stock)} {product.unit})
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

          {/* Paso 3: impacto + confirmar */}
          <div className="rounded-xl bg-secondary/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">
                {reasonMeta?.isLoss === false ? 'Valor rescatado' : 'Pérdida estimada'}
              </span>
              <span
                className={cn(
                  'text-2xl font-extrabold tabular-nums',
                  reasonMeta?.isLoss === false ? 'text-fresco' : 'text-alerta'
                )}
              >
                {formatPEN(loss)}
              </span>
            </div>
          </div>

          {error && <p className="rounded-lg bg-alerta/10 px-3 py-2 text-sm font-semibold text-alerta">{error}</p>}

          <button
            onClick={confirm}
            disabled={!reason || qty <= 0 || registerWaste.isPending}
            className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl bg-bosque text-lg font-bold text-bosque-fg active:scale-[0.98] disabled:opacity-50"
          >
            <Check className="h-6 w-6" />
            {registerWaste.isPending ? 'Guardando…' : 'Confirmar merma'}
          </button>
        </div>
      )}
    </Sheet>
  );
}
