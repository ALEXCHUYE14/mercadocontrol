'use client';

// Estado global de UI (no de datos: los datos viven en Dexie/React Query).
import { create } from 'zustand';

interface AppState {
  online: boolean;
  pendingSync: number;
  lastSync: number | null;
  // Modal de merma a un tap
  wasteModalProductId: string | null;

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

  setOnline: (v) => set({ online: v }),
  setPendingSync: (n) => set({ pendingSync: n }),
  setLastSync: (t) => set({ lastSync: t }),
  openWasteModal: (productId) => set({ wasteModalProductId: productId }),
  closeWasteModal: () => set({ wasteModalProductId: null }),
}));
