'use client';

// Bottom-sheet / modal accesible y ligero (sin dependencias de Radix),
// pensado para pulgares: se desliza desde abajo y tiene overlay para cerrar.
import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

export function Sheet({ open, onClose, children, title, className }: SheetProps) {
  // onClose suele ser una función nueva en cada render: se guarda en un ref para
  // no re-suscribir el listener ni alternar el scroll del body en cada render.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // Atrapa el foco dentro del diálogo
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/55 backdrop-blur-sm"
        onClick={() => onCloseRef.current()}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-t-3xl bg-card p-5 shadow-pop outline-none sm:max-w-lg sm:rounded-3xl',
          'max-h-[92dvh] overflow-y-auto no-scrollbar pb-safe',
          'animate-slide-up sm:animate-scale-in',
          className
        )}
      >
        {/* Barra de "arrastre" para affordance móvil */}
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          {title ? (
            <h2 id={titleId} className="text-xl font-extrabold leading-tight">{title}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => onCloseRef.current()}
            className="-mr-1 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
