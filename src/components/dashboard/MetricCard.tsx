import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: 'fresco' | 'atencion' | 'alerta' | 'bosque';
  hint?: string;
}

const TONE: Record<NonNullable<MetricCardProps['tone']>, string> = {
  fresco: 'bg-fresco/12 text-fresco',
  atencion: 'bg-atencion/12 text-atencion',
  alerta: 'bg-alerta/12 text-alerta',
  bosque: 'bg-bosque/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
};

export function MetricCard({ label, value, icon: Icon, tone = 'bosque', hint }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-extrabold leading-none tabular">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
