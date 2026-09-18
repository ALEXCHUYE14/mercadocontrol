'use client';

// Selector numérico con botones grandes (+/–) para manos ocupadas.
import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepperProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  className?: string;
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 99999, unit, className }: StepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 1000) / 1000));
  return (
    <div className={cn('flex items-stretch gap-2', className)}>
      <button
        type="button"
        aria-label="Restar"
        onClick={() => onChange(clamp(value - step))}
        className="flex h-16 w-16 items-center justify-center rounded-xl bg-secondary text-foreground active:scale-95"
      >
        <Minus className="h-7 w-7" />
      </button>
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-border">
        <span className="text-3xl font-extrabold tabular-nums">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      <button
        type="button"
        aria-label="Sumar"
        onClick={() => onChange(clamp(value + step))}
        className="flex h-16 w-16 items-center justify-center rounded-xl bg-fresco text-fresco-fg active:scale-95"
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  );
}
