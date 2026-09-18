'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AddProductModal } from '@/components/inventory/AddProductModal';

/** Botón flotante (FAB) para agregar producto, siempre al alcance del pulgar. */
export function AddButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Agregar producto"
        className="fixed bottom-24 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-fresco text-fresco-fg shadow-lg shadow-fresco/30 active:scale-95"
      >
        <Plus className="h-8 w-8" strokeWidth={2.5} />
      </button>
      <AddProductModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
