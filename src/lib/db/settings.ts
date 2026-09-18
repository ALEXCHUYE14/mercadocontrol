'use client';

// =============================================================================
// Perfil del comerciante (se sincroniza) y ajustes del dispositivo (solo locales:
// ancho de papel, pie del ticket, etc.). La impresora es del dispositivo, no de la nube.
// =============================================================================

import { db } from '@/lib/db/dexie';
import { assertCan, currentOwnerId, enqueue, nowISO } from '@/lib/db/internal';
import { requestSync } from '@/lib/db/sync';
import { DEFAULT_LOW_STOCK } from '@/lib/logic/stock';
import { DEFAULT_TICKET_FOOTER, type PaperWidth, type TicketBusiness } from '@/lib/logic/ticket';
import type { Profile } from '@/types';

export interface SavedPrinter {
  /** Id del dispositivo Bluetooth (estable en este navegador) */
  id: string;
  name: string;
}

export interface AppSettings {
  paperWidth: PaperWidth;
  ticketFooter: string;
  address: string;
  taxId: string;
  /** Umbral de stock bajo para productos sin umbral propio */
  lowStockDefault: number;
  /** Impresora térmica Bluetooth emparejada en este dispositivo */
  bluetoothPrinter: SavedPrinter | null;
  /** Enviar comando de corte al terminar (solo si la impresora tiene cortador) */
  autoCut: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  paperWidth: 80,
  ticketFooter: DEFAULT_TICKET_FOOTER,
  address: '',
  taxId: '',
  lowStockDefault: DEFAULT_LOW_STOCK,
  bluetoothPrinter: null,
  autoCut: false,
};

function sanitize(raw: unknown): AppSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppSettings>;
  return {
    paperWidth: r.paperWidth === 58 ? 58 : 80,
    ticketFooter: typeof r.ticketFooter === 'string' ? r.ticketFooter.slice(0, 160) : DEFAULT_SETTINGS.ticketFooter,
    address: typeof r.address === 'string' ? r.address.slice(0, 120) : '',
    taxId: typeof r.taxId === 'string' ? r.taxId.slice(0, 20) : '',
    lowStockDefault:
      typeof r.lowStockDefault === 'number' && Number.isFinite(r.lowStockDefault) && r.lowStockDefault >= 0
        ? Math.min(r.lowStockDefault, 100000)
        : DEFAULT_LOW_STOCK,
    bluetoothPrinter:
      r.bluetoothPrinter && typeof r.bluetoothPrinter.id === 'string' && r.bluetoothPrinter.id
        ? { id: r.bluetoothPrinter.id, name: String(r.bluetoothPrinter.name ?? 'Impresora').slice(0, 60) }
        : null,
    autoCut: r.autoCut === true,
  };
}

export async function getSettings(): Promise<AppSettings> {
  const meta = await db().meta.get('settings');
  return sanitize(meta?.value);
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const next = sanitize({ ...(await getSettings()), ...patch });
  await db().meta.put({ key: 'settings', value: next });
  return next;
}

export async function getProfile(): Promise<Profile | null> {
  const owner = await currentOwnerId();
  return (await db().profiles.get(owner)) ?? null;
}

export interface ProfilePatch {
  full_name: string | null;
  stall_name: string | null;
  phone: string | null;
}

/** Actualiza el perfil local y encola solo esos campos (nunca money_saved). */
export async function updateProfile(patch: ProfilePatch): Promise<Profile> {
  const clean: ProfilePatch = {
    full_name: patch.full_name?.trim().slice(0, 80) || null,
    stall_name: patch.stall_name?.trim().slice(0, 80) || null,
    phone: patch.phone?.trim().slice(0, 20) || null,
  };
  let updated!: Profile;
  await db().transaction('rw', [db().meta, db().profiles, db().syncQueue], async () => {
    await assertCan('editBusiness');
    const owner = await currentOwnerId();
    const current = await db().profiles.get(owner);
    if (!current) throw new Error('Perfil no encontrado');
    updated = { ...current, ...clean, updated_at: nowISO() };
    await db().profiles.put(updated);
    await enqueue('profiles', 'update', { id: owner, ...clean });
  });
  requestSync();
  return updated;
}

/** Datos del negocio para el encabezado del ticket. */
export async function getTicketBusiness(): Promise<{ business: TicketBusiness; settings: AppSettings }> {
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  return {
    settings,
    business: {
      name: profile?.stall_name?.trim() || 'Mi Puesto',
      phone: profile?.phone?.trim() || null,
      address: settings.address.trim() || null,
      taxId: settings.taxId.trim() || null,
    },
  };
}
