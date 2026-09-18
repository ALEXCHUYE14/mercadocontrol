'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-base font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none',
  {
    variants: {
      variant: {
        primary: 'bg-fresco text-fresco-fg hover:bg-fresco/90 shadow-sm',
        forest: 'bg-bosque text-bosque-fg hover:bg-bosque/90 shadow-sm',
        warn: 'bg-atencion text-atencion-fg hover:bg-atencion/90 shadow-sm',
        danger: 'bg-alerta text-alerta-fg hover:bg-alerta/90 shadow-sm',
        outline: 'border-2 border-border bg-card hover:bg-secondary text-foreground',
        ghost: 'hover:bg-secondary text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      },
      size: {
        // Todos cumplen el mínimo táctil (>=48-56px)
        default: 'min-h-touch px-5 py-3',
        lg: 'min-h-[64px] px-6 py-4 text-touch-lg',
        sm: 'min-h-[48px] px-4 py-2 text-sm',
        icon: 'h-14 w-14',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
