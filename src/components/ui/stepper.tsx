'use client';

// Selector numérico con botones grandes (+/–) para manos ocupadas.
import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn, formatQty } from '@/lib/utils';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  size?: 'md' | 'sm';
  className?: string;
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 99999,
  unit,
  size = 'md',
  className,
}: StepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 1000) / 1000));
  const small = size === 'sm';
  const btn = small ? 'h-11 w-11 rounded-lg' : 'h-16 w-16 rounded-xl';
  const icon = small ? 'h-5 w-5' : 'h-7 w-7';
  return (
    <div className={cn('flex items-stretch gap-2', className)}>
      <button
        type="button"
        aria-label="Restar"
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={cn('flex items-center justify-center bg-secondary text-foreground active:scale-95 disabled:opacity-40', btn)}
      >
        <Minus className={icon} />
      </button>
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center border-2 border-border bg-card',
          small ? 'min-w-[64px] rounded-lg' : 'rounded-xl'
        )}
        aria-live="polite"
      >
        <span className={cn('font-extrabold tabular', small ? 'text-lg' : 'text-3xl')}>{formatQty(value)}</span>
        {unit && !small && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      <button
        type="button"
        aria-label="Sumar"
        disabled={value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={cn('flex items-center justify-center bg-fresco text-fresco-fg active:scale-95 disabled:opacity-40', btn)}
      >
        <Plus className={icon} />
      </button>
    </div>
  );
}
