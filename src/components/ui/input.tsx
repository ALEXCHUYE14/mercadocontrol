import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex min-h-touch w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-lg',
      'placeholder:text-muted-foreground/70 transition-colors',
      'focus-visible:border-fresco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fresco/25',
      'aria-[invalid=true]:border-alerta',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };

/** Etiqueta + control + ayuda/error, con asociación accesible por id. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-sm font-medium text-alerta">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Campo con icono a la izquierda y, opcionalmente, un control a la derecha (p. ej. ver contraseña). */
export const IconInput = React.forwardRef<
  HTMLInputElement,
  InputProps & { icon: import('lucide-react').LucideIcon; trailing?: React.ReactNode }
>(({ icon: Icon, trailing, className, ...props }, ref) => (
  <div className="relative">
    <Icon aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
    <Input ref={ref} className={cn('pl-12', trailing ? 'pr-14' : '', className)} {...props} />
    {trailing && <div className="absolute right-1 top-1/2 -translate-y-1/2">{trailing}</div>}
  </div>
));
IconInput.displayName = 'IconInput';
