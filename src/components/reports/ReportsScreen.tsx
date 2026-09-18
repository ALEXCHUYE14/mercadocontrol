'use client';

import { useMemo, useState } from 'react';
import { BarChart3, FileSpreadsheet, FileText, Percent, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { PageHeader, EmptyState, ErrorNote, Spinner } from '@/components/ui/feedback';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { WeekChart } from '@/components/dashboard/WeekChart';
import { useSalesRange, useTicketBusiness } from '@/hooks/useSales';
import {
  MAX_RANGE_DAYS,
  PRESET_LABELS,
  resolveRange,
  toDateInput,
  type RangePreset,
} from '@/lib/logic/dateRange';
import { bucketSales, filterSales, summarize } from '@/lib/logic/reportSummary';
import { buildItemsCsv, buildReportHtml, buildSalesCsv } from '@/lib/logic/exportReport';
import { PAYMENT_METHODS, paymentLabel } from '@/lib/logic/ticket';
import { downloadTextFile } from '@/lib/print/download';
import { printHtml } from '@/lib/print/printHtml';
import { cn, errorMessage, formatPEN, formatQty } from '@/lib/utils';
import type { PaymentMethod } from '@/types';

const PRESETS: RangePreset[] = ['hoy', 'ayer', '7d', '30d', 'mes', 'custom'];

function stamp(): string {
  return toDateInput(new Date());
}

export function ReportsScreen() {
  const [preset, setPreset] = useState<RangePreset>('7d');
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date()));
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));
  const [payment, setPayment] = useState<PaymentMethod | 'todos'>('todos');
  const [error, setError] = useState<string | null>(null);
  const { data: ctx } = useTicketBusiness();

  const resolved = useMemo(
    () => resolveRange(preset, new Date(), { from: customFrom, to: customTo }),
    [preset, customFrom, customTo]
  );
  const range = resolved.ok ? resolved.range : null;
  const { data: rows, isLoading } = useSalesRange(range?.from ?? null, range?.to ?? null);

  const filtered = useMemo(() => filterSales(rows ?? [], { payment, includeVoided: true }), [rows, payment]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const chart = useMemo(() => {
    if (!range) return [];
    return bucketSales(filtered.map((r) => r.sale), range.from, range.to).map((b) => ({
      day: b.key,
      label: b.label,
      total: b.total,
      count: b.count,
    }));
  }, [filtered, range]);

  const businessName = ctx?.business.name ?? 'Mi Puesto';
  const payLabel = payment === 'todos' ? 'Todos' : paymentLabel(payment);

  const exportCsv = (kind: 'ventas' | 'detalle') => {
    setError(null);
    try {
      const csv = kind === 'ventas' ? buildSalesCsv(filtered) : buildItemsCsv(filtered);
      downloadTextFile(`reporte-${kind}-${stamp()}.csv`, csv);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const exportPdf = async () => {
    if (!range) return;
    setError(null);
    try {
      await printHtml(
        buildReportHtml(summary, {
          businessName,
          rangeLabel: range.label,
          paymentLabel: payLabel,
          generatedAt: new Date().toLocaleString('es-PE'),
        })
      );
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const hasData = summary.count > 0 || summary.voidedCount > 0;

  return (
    <>
      <PageHeader title="Reportes" subtitle="Ventas, ganancia y productos por período" />

      {/* Filtros */}
      <div className="space-y-3">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={preset === p}
              onClick={() => setPreset(p)}
              className={cn(
                'min-h-[48px] shrink-0 rounded-full border-2 px-4 font-semibold transition-colors active:scale-95',
                preset === p ? 'border-bosque bg-bosque text-bosque-fg' : 'border-border bg-card'
              )}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde" htmlFor="rep-from">
              <Input id="rep-from" type="date" max={toDateInput(new Date())} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </Field>
            <Field label="Hasta" htmlFor="rep-to">
              <Input id="rep-to" type="date" max={toDateInput(new Date())} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </Field>
          </div>
        )}
        {!resolved.ok && <ErrorNote message={resolved.error} />}

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {([{ value: 'todos', label: 'Todos los pagos' }, ...PAYMENT_METHODS] as { value: PaymentMethod | 'todos'; label: string }[]).map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={payment === m.value}
              onClick={() => setPayment(m.value)}
              className={cn(
                'min-h-[44px] shrink-0 rounded-full border-2 px-4 text-sm font-semibold transition-colors active:scale-95',
                payment === m.value ? 'border-fresco bg-fresco/10 text-fresco' : 'border-border bg-card'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        {range && <p className="text-sm text-muted-foreground">{range.label} · máximo {MAX_RANGE_DAYS} días</p>}
      </div>

      {isLoading && range ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !range ? null : !hasData ? (
        <div className="mt-5">
          <EmptyState icon={BarChart3} title="Sin ventas en este período" text="Prueba con otro rango de fechas o método de pago." />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <MetricCard label="Total vendido" value={formatPEN(summary.revenue)} icon={TrendingUp} tone="fresco" hint={`${summary.count} ventas`} />
            <MetricCard
              label="Ganancia bruta"
              value={formatPEN(summary.profit)}
              icon={Percent}
              tone="bosque"
              hint={
                summary.profitSalesCount < summary.count
                  ? `Solo ${summary.profitSalesCount} de ${summary.count} ventas tienen costo`
                  : 'Ventas − costo'
              }
            />
            <MetricCard label="Ticket promedio" value={formatPEN(summary.avgTicket)} icon={Receipt} tone="atencion" />
            <MetricCard label="Descuentos" value={formatPEN(summary.discounts)} icon={Percent} tone="alerta" />
            <MetricCard label="Vendido a crédito" value={formatPEN(summary.onCredit)} icon={Wallet} tone="bosque" />
            <MetricCard label="Anuladas" value={String(summary.voidedCount)} icon={Receipt} tone="alerta" hint="No suman a los totales" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Ventas por día</CardTitle>
            </CardHeader>
            <CardContent>
              <WeekChart days={chart} />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Por método de pago</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border/70">
                  {summary.byPayment.map((p) => (
                    <li key={p.method} className="flex items-center justify-between py-2.5">
                      <span className="font-semibold">{paymentLabel(p.method)}</span>
                      <span className="text-sm text-muted-foreground">{p.count} ventas</span>
                      <span className="font-extrabold tabular">{formatPEN(p.total)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Por vendedor</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border/70">
                  {summary.bySeller.map((s) => (
                    <li key={s.name} className="flex items-center justify-between py-2.5">
                      <span className="min-w-0 truncate font-semibold">{s.name}</span>
                      <span className="text-sm text-muted-foreground">{s.count} ventas</span>
                      <span className="font-extrabold tabular">{formatPEN(s.total)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Productos más vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border/70">
                {summary.byProduct.slice(0, 15).map((p) => (
                  <li key={`${p.name}-${p.unit}`} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <span className="text-sm text-muted-foreground">{formatQty(p.quantity, p.unit)}</span>
                    <span className="font-extrabold tabular">{formatPEN(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <ErrorNote message={error} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="outline" onClick={() => exportCsv('ventas')}>
              <FileSpreadsheet className="h-5 w-5" /> Excel · ventas
            </Button>
            <Button variant="outline" onClick={() => exportCsv('detalle')}>
              <FileSpreadsheet className="h-5 w-5" /> Excel · detalle
            </Button>
            <Button onClick={exportPdf}>
              <FileText className="h-5 w-5" /> PDF / imprimir
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Los archivos Excel (CSV) se abren directo en Excel o Google Sheets. El PDF se genera con el diálogo de
            impresión: elige «Guardar como PDF».
          </p>
        </div>
      )}
    </>
  );
}
