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
  fresco: 'bg-fresco/10 text-fresco',
  atencion: 'bg-atencion/10 text-atencion',
  alerta: 'bg-alerta/10 text-alerta',
  bosque: 'bg-bosque/10 text-bosque',
};

export function MetricCard({ label, value, icon: Icon, tone = 'bosque', hint }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
        <span className={cn('rounded-lg p-2', TONE[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-2 text-2xl font-extrabold tabular-nums leading-none">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
