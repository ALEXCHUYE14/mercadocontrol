import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
  {
    variants: {
      variant: {
        verde: 'bg-semaforo-verde/15 text-semaforo-verde',
        amarillo: 'bg-semaforo-amarillo/15 text-semaforo-amarillo',
        rojo: 'bg-semaforo-rojo/15 text-semaforo-rojo',
        neutral: 'bg-secondary text-secondary-foreground',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
