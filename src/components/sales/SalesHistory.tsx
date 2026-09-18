'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, ReceiptText } from 'lucide-react';
import { useRecentSales } from '@/hooks/useSales';
import { TicketDialog } from '@/components/ticket/TicketDialog';
import { EmptyState, Spinner } from '@/components/ui/feedback';
import { paymentLabel } from '@/lib/logic/ticket';
import { localDayKey } from '@/lib/logic/reports';
import { cn, formatPEN } from '@/lib/utils';
import type { SaleWithItems } from '@/types';

function dayTitle(key: string): string {
  const now = new Date();
  if (key === localDayKey(now)) return 'Hoy';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === localDayKey(yesterday)) return 'Ayer';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

/** Historial de tickets: toca uno para reimprimirlo o reenviarlo. */
export function SalesHistory() {
  const { data, isLoading } = useRecentSales(100);
  const [selected, setSelected] = useState<SaleWithItems | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, { list: SaleWithItems[]; total: number }>();
    for (const s of data ?? []) {
      const key = localDayKey(new Date(s.sale.created_at));
      const g = map.get(key) ?? { list: [], total: 0 };
      g.list.push(s);
      if (!s.sale.voided_at) g.total += s.sale.total;
      map.set(key, g);
    }
    return [...map.entries()];
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="Todavía no hay ventas"
        text="Cuando cobres tu primera venta, su ticket aparecerá aquí para reimprimirlo."
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(([key, g]) => (
        <section key={key}>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="font-extrabold">{dayTitle(key)}</h3>
            <span className="text-sm font-bold text-fresco tabular">{formatPEN(g.total)}</span>
          </div>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-card">
            {g.list.map((s) => {
              const time = new Date(s.sale.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
              const summary = s.items.map((i) => i.product_name).join(', ');
              return (
                <li key={s.sale.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s)}
                    className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fresco/10 text-fresco">
                      <ReceiptText className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block font-bold', s.sale.voided_at && 'line-through opacity-60')}>
                        N° {s.sale.ticket_number}{' '}
                        <span className="text-xs font-medium text-muted-foreground">
                          · {time} · {paymentLabel(s.sale.payment_method)}
                          {s.sale.seller_name ? ` · ${s.sale.seller_name}` : ''}
                        </span>
                      </span>
                      {s.sale.voided_at && <span className="text-xs font-bold text-alerta">ANULADA</span>}
                      <span className="block truncate text-sm text-muted-foreground">{summary || 'Sin detalle'}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cn('block font-extrabold tabular', s.sale.voided_at && 'line-through opacity-60')}>{formatPEN(s.sale.total)}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <TicketDialog data={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
