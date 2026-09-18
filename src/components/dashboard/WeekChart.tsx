import { cn, formatPEN } from '@/lib/utils';
import type { DaySales } from '@/lib/logic/reports';

/** Barras de ventas de los últimos días (SVG-free: flexbox accesible con etiquetas). */
export function WeekChart({ days }: { days: DaySales[] }) {
  const max = Math.max(...days.map((d) => d.total), 0);
  const total = days.reduce((s, d) => s + d.total, 0);

  return (
    <figure aria-label={`Ventas por día (${days.length} barras): ${formatPEN(total)} en total`}>
      <div className="flex h-36 items-end gap-2">
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          const pct = max > 0 ? Math.max(d.total > 0 ? 6 : 0, (d.total / max) * 100) : 0;
          return (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground tabular">
                {d.total > 0 ? Math.round(d.total) : ''}
              </span>
              <div
                title={`${d.label}: ${formatPEN(d.total)} (${d.count} ventas)`}
                className={cn(
                  'w-full rounded-t-lg transition-all',
                  isToday ? 'bg-fresco' : 'bg-fresco/35',
                  d.total === 0 && 'h-1 bg-border'
                )}
                style={d.total > 0 ? { height: `${pct}%` } : undefined}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {days.map((d, i) => (
          <span
            key={d.day}
            className={cn(
              'flex-1 text-center text-xs font-semibold capitalize',
              i === days.length - 1 ? 'text-fresco' : 'text-muted-foreground'
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
