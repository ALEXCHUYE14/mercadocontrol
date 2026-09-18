import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Une clases de Tailwind resolviendo conflictos (patrón shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea un monto como Soles peruanos. */
export function formatPEN(value: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Formatea cantidades de stock evitando decimales innecesarios. */
export function formatQty(value: number, unit?: string): string {
  const n = Number.isFinite(value) ? value : 0;
  const rounded = round3(n);
  const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
  return unit ? `${s} ${unit}` : s;
}

/** UUID v4 con fallback para navegadores sin crypto.randomUUID. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** true si el texto tiene formato UUID (los ids locales de demo no lo tienen). */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Días transcurridos (con decimales) desde una fecha ISO. 0 si la fecha es inválida. */
export function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / 86_400_000;
}

/** Redondeo monetario a 2 decimales (evita errores de coma flotante). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Redondeo de cantidades a 3 decimales (misma precisión que numeric(12,3) en Postgres). */
export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** Extrae un mensaje legible de cualquier valor lanzado (Error, PostgrestError, string…). */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return 'Error desconocido';
}
