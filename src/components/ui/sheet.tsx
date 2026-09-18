'use client';

// Bottom-sheet / modal accesible y ligero (sin dependencias de Radix),
// pensado para pulgares: se desliza desde abajo y tiene overlay para cerrar.
import * as React from 'react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function Sheet({ open, onClose, children, title, className }: SheetProps) {
  // onClose suele ser una función nueva en cada render: se guarda en un ref para
  // no re-suscribir el listener ni alternar el scroll del body en cada render.
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          'relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-card p-5 shadow-2xl',
          'max-h-[90vh] overflow-y-auto no-scrollbar',
          'animate-in slide-in-from-bottom duration-200',
          className
        )}
      >
        {/* Barra de "arrastre" para affordance móvil */}
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
        {title && <h2 className="mb-4 text-xl font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
