'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronRight, Moon, Send, TrendingUp, Trash2, Wallet } from 'lucide-react';
import { useCategories, useProducts, useTodayMetrics } from '@/hooks/useProducts';
import { useProfile, useSettings } from '@/hooks/useSales';
import { saveClosure } from '@/lib/db/repository';
import { buildWholesalerOrder, waLink } from '@/lib/logic/whatsapp';
import { computeFreshness } from '@/lib/logic/freshness';
import { formatPEN, formatQty, cn, errorMessage } from '@/lib/utils';
import { MetricCard } from '@/components/dashboard/MetricCard';

/**
 * Cierre nocturno guiado en 3 pasos:
 *  1. Revisar productos urgentes (rojos) para decidir remate/descarte.
 *  2. Ver el resumen del día (ventas, merma, capital).
 *  3. Generar el pedido al mayorista y guardar el cierre.
 */
export function ClosureWizard() {
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: products } = useProducts();
  const { data: categories } = useCategories();
  const { data: metrics } = useTodayMetrics();
  const { data: settings } = useSettings();
  const { data: profile } = useProfile();

  // Semáforo "en vivo" (igual que las tarjetas del inventario), no el valor guardado
  const urgent = useMemo(() => {
    const catMap = new Map((categories ?? []).map((c) => [c.id, c]));
    return (products ?? [])
      .filter((p) => p.current_stock > 0)
      .map((p) => ({
        product: p,
        state: computeFreshness(p, p.category_id ? catMap.get(p.category_id) : null).state,
      }))
      .filter((x) => x.state === 'rojo' || x.state === 'amarillo');
  }, [products, categories]);

  const order = useMemo(
    () => buildWholesalerOrder(products ?? [], {
        lowStockThreshold: settings?.lowStockDefault,
        stallName: profile?.stall_name ?? undefined,
      }),
    [products, settings?.lowStockDefault, profile?.stall_name]
  );

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveClosure();
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Moon className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
        <h1 className="text-2xl font-extrabold">Cierre del día</h1>
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={cn(
              'h-2 flex-1 rounded-full',
              s <= step ? 'bg-fresco' : 'bg-secondary'
            )}
          />
        ))}
      </div>

      {saved ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-fresco text-fresco-fg">
            <Check className="h-12 w-12" />
          </div>
          <h2 className="text-xl font-bold">¡Cierre guardado!</h2>
          <p className="text-muted-foreground">Descansa. Mañana será un buen día de ventas. 🌙</p>
        </div>
      ) : (
        <>
          {/* PASO 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">1. Revisa lo que urge</h2>
              {urgent.length === 0 ? (
                <p className="rounded-xl bg-fresco/10 p-4 font-semibold text-fresco">
                  ✅ Nada urgente. ¡Todo bajo control!
                </p>
              ) : (
                <ul className="space-y-2">
                  {urgent.map(({ product: p, state }) => (
                    <li key={p.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatQty(p.current_stock)} {p.unit} · {state === 'rojo' ? '🔴' : '🟡'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <NextBtn onClick={() => setStep(2)} />
            </div>
          )}

          {/* PASO 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">2. Resumen del día</h2>
              <div className="grid grid-cols-1 gap-3">
                <MetricCard label="Ventas del día" value={formatPEN(metrics?.totalSales ?? 0)} icon={TrendingUp} tone="fresco" />
                <MetricCard label="Pérdida por merma" value={formatPEN(metrics?.wasteLoss ?? 0)} icon={Trash2} tone="alerta" />
                <MetricCard label="Capital en inventario" value={formatPEN(metrics?.inventoryCapital ?? 0)} icon={Wallet} tone="bosque" />
              </div>
              <NextBtn onClick={() => setStep(3)} />
            </div>
          )}

          {/* PASO 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">3. Pedido para mañana</h2>
              <p className="text-sm text-muted-foreground">
                {order.count > 0
                  ? `${order.count} producto(s) por reponer. Envía la lista a tu mayorista:`
                  : 'No necesitas reponer nada por ahora.'}
              </p>
              {order.count > 0 && (
                <pre className="whitespace-pre-wrap rounded-xl bg-secondary/70 p-4 text-sm">{order.text}</pre>
              )}
              {error && <p className="rounded-lg bg-alerta/10 px-3 py-2 text-sm font-semibold text-alerta">{error}</p>}
              <div className="grid grid-cols-1 gap-2">
                {order.count > 0 && (
                  <a
                    href={waLink(order.text)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-white active:scale-[0.98]"
                  >
                    <Send className="h-5 w-5" /> Enviar por WhatsApp
                  </a>
                )}
                <button
                  onClick={finish}
                  disabled={saving}
                  className="flex min-h-[64px] items-center justify-center gap-2 rounded-xl bg-bosque text-lg font-bold text-bosque-fg active:scale-[0.98] disabled:opacity-50"
                >
                  <Check className="h-6 w-6" /> {saving ? 'Guardando…' : 'Guardar cierre'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NextBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-fresco font-bold text-fresco-fg active:scale-[0.98]"
    >
      Siguiente <ChevronRight className="h-5 w-5" />
    </button>
  );
}
