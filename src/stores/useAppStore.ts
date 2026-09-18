'use client';

// Estado global de UI (no de datos: los datos viven en Dexie/React Query).
import { create } from 'zustand';
import type { Role } from '@/types';

interface AppState {
  online: boolean;
  pendingSync: number;
  lastSync: number | null;
  // Modal de merma a un tap
  wasteModalProductId: string | null;
  /** Rol de la sesión activa (lo fija SessionGate al abrir la sesión) */
  role: Role;

  setRole: (r: Role) => void;
  setOnline: (v: boolean) => void;
  setPendingSync: (n: number) => void;
  setLastSync: (t: number) => void;
  openWasteModal: (productId: string) => void;
  closeWasteModal: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Valor fijo para que servidor y cliente hidraten igual; Providers lo sincroniza al montar.
  online: true,
  pendingSync: 0,
  lastSync: null,
  wasteModalProductId: null,
  role: 'owner',

  setRole: (r) => set({ role: r }),
  setOnline: (v) => set({ online: v }),
  setPendingSync: (n) => set({ pendingSync: n }),
  setLastSync: (t) => set({ lastSync: t }),
  openWasteModal: (productId) => set({ wasteModalProductId: productId }),
  closeWasteModal: () => set({ wasteModalProductId: null }),
}));
