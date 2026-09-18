'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Mic, MicOff, Plus } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAddProduct, useCategories } from '@/hooks/useProducts';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import { parseVoiceCommand } from '@/lib/logic/voiceParser';
import type { UnitMeasure } from '@/types';
import { cn, errorMessage } from '@/lib/utils';

const UNITS: UnitMeasure[] = ['kg', 'unidad', 'atado', 'saco', 'caja', 'docena', 'litro', 'bandeja'];

export function AddProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: categories } = useCategories();
  const addProduct = useAddProduct();
  const speech = useSpeechInput('es-PE');

  // Lo que la persona escribe/elige a mano (null = sin editar). Los valores del
  // dictado se derivan de la transcripción en cada render, sin efectos.
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [unitEdit, setUnitEdit] = useState<UnitMeasure | null>(null);
  const [qtyEdit, setQtyEdit] = useState<string | null>(null);
  const [costEdit, setCostEdit] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [minStockText, setMinStockText] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  // Los resultados parciales llegan varias veces: el formulario se va actualizando
  // hasta la frase final, salvo lo que la persona ya editó a mano.
  const voice = useMemo(
    () => (speech.transcript ? parseVoiceCommand(speech.transcript) : null),
    [speech.transcript]
  );
  const name = nameEdit ?? (voice?.name ? capitalize(voice.name) : '');
  const unit: UnitMeasure = unitEdit ?? voice?.unit ?? 'kg';
  const qty = qtyEdit ?? (voice?.quantity != null ? String(voice.quantity) : '');
  const cost = costEdit ?? (voice?.price != null ? String(voice.price) : '');

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  // Un dictado nuevo reemplaza lo anterior (incluidas las ediciones manuales previas)
  const startDictation = () => {
    setNameEdit(null); setUnitEdit(null); setQtyEdit(null); setCostEdit(null);
    speech.start();
  };

  const reset = () => {
    setNameEdit(null); setCategoryId(null); setUnitEdit(null);
    setQtyEdit(null); setCostEdit(null); setPrice(''); setMinStockText(''); setDone(false); setError(null);
    speech.reset();
  };
  const handleClose = () => {
    clearTimeout(closeTimer.current);
    speech.stop();
    reset();
    onClose();
  };

  const qtyNum = parseFloat(qty);
  const costNum = parseFloat(cost);
  const priceNum = parseFloat(price);
  const canSave = name.trim().length > 0 && qtyNum > 0 && costNum >= 0;

  const save = async () => {
    if (!canSave || addProduct.isPending) return;
    setError(null);
    try {
      await addProduct.mutateAsync({
        name: name.trim(),
        category_id: categoryId,
        unit,
        quantity: qtyNum,
        unit_cost: costNum,
        // Sin precio de venta se sugiere un margen del 30% sobre el costo
        sale_price: priceNum >= 0 ? priceNum : Math.round(costNum * 1.3 * 100) / 100,
        min_stock: parseFloat(minStockText) >= 0 ? parseFloat(minStockText) : 0,
        source: speech.transcript ? 'voz' : 'manual',
      });
      setDone(true);
      closeTimer.current = setTimeout(handleClose, 1000);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Sheet open={open} onClose={handleClose} title="Agregar producto">
      {done ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-fresco text-fresco-fg">
            <Check className="h-10 w-10" />
          </div>
          <p className="text-lg font-bold">Producto agregado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Dictado por voz */}
          {speech.supported && (
            <button
              type="button"
              onClick={speech.listening ? speech.stop : startDictation}
              className={cn(
                'flex min-h-[64px] w-full items-center justify-center gap-3 rounded-xl text-lg font-bold text-white active:scale-[0.98]',
                speech.listening ? 'bg-alerta animate-pulse-soft' : 'bg-bosque'
              )}
            >
              {speech.listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              {speech.listening ? 'Escuchando… habla ahora' : 'Dictar por voz'}
            </button>
          )}
          {speech.transcript && (
            <p className="rounded-lg bg-secondary/70 px-3 py-2 text-sm italic">
              “{speech.transcript}”
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-muted-foreground">Producto</label>
            <Input
              value={name}
              onChange={(e) => setNameEdit(e.target.value)}
              placeholder="Ej. Tomate"
            />
          </div>

          {/* Categorías en mosaico */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted-foreground">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {categories?.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(categoryId === c.id ? null : c.id)}
                  className={cn(
                    'flex min-h-[48px] items-center gap-1 rounded-full border-2 px-3 font-semibold active:scale-95',
                    categoryId === c.id ? 'border-fresco bg-fresco/10 text-fresco' : 'border-border'
                  )}
                >
                  <span>{c.icon}</span> {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Unidad */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-muted-foreground">Unidad de medida</label>
            <div className="flex flex-wrap gap-2">
              {UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnitEdit(u)}
                  className={cn(
                    'min-h-[48px] rounded-full border-2 px-4 font-semibold active:scale-95',
                    unit === u ? 'border-fresco bg-fresco/10 text-fresco' : 'border-border'
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-muted-foreground">Cantidad</label>
              <Input type="number" inputMode="decimal" min={0} step="any" value={qty} onChange={(e) => setQtyEdit(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-muted-foreground">Costo/u</label>
              <Input type="number" inputMode="decimal" min={0} step="any" value={cost} onChange={(e) => setCostEdit(e.target.value)} placeholder="S/" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-muted-foreground">Venta/u</label>
              <Input type="number" inputMode="decimal" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="S/" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-muted-foreground">
              Avisarme cuando queden (opcional)
            </label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={minStockText}
              onChange={(e) => setMinStockText(e.target.value)}
              placeholder="Ej. 5 (vacío = valor por defecto)"
            />
          </div>

          {error && <p className="rounded-lg bg-alerta/10 px-3 py-2 text-sm font-semibold text-alerta">{error}</p>}

          <Button size="lg" variant="primary" className="w-full" disabled={!canSave || addProduct.isPending} onClick={save}>
            <Plus className="h-6 w-6" />
            {addProduct.isPending ? 'Guardando…' : 'Guardar producto'}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
