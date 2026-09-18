'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AddProductModal } from '@/components/inventory/AddProductModal';
import { can } from '@/lib/auth/permissions';
import { useAppStore } from '@/stores/useAppStore';

/** Botón flotante (FAB) para agregar producto, siempre al alcance del pulgar. */
export function AddButton() {
  const [open, setOpen] = useState(false);
  const role = useAppStore((s) => s.role);
  if (!can(role, 'editInventory')) return null; // el cajero no da de alta productos
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Agregar producto"
        className="fixed bottom-24 right-4 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-fresco text-fresco-fg shadow-glow transition-transform active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Plus className="h-8 w-8" strokeWidth={2.5} />
      </button>
      <AddProductModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
