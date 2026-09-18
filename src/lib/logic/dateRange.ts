// =============================================================================
// Rangos de fechas para reportes (PURO). Todo en hora LOCAL del dispositivo.
// Un rango es [from, to): `to` es exclusivo (medianoche del día siguiente al último).
// =============================================================================

export type RangePreset = 'hoy' | 'ayer' | '7d' | '30d' | 'mes' | 'custom';

export interface DateRange {
  from: number; // ms, inclusivo
  to: number; // ms, exclusivo
  label: string;
}

export const MAX_RANGE_DAYS = 366;

export const PRESET_LABELS: Record<RangePreset, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  '7d': '7 días',
  '30d': '30 días',
  mes: 'Este mes',
  custom: 'Personalizado',
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** 'AAAA-MM-DD' -> Date local a medianoche; null si es inválida (incluye 31 de febrero). */
export function parseDateInput(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

export function toDateInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export type RangeResult = { ok: true; range: DateRange } | { ok: false; error: string };

export function resolveRange(
  preset: RangePreset,
  now: Date = new Date(),
  custom?: { from: string; to: string }
): RangeResult {
  const today = startOfDay(now);
  const make = (from: Date, toExclusive: Date, label: string): RangeResult => ({
    ok: true,
    range: { from: from.getTime(), to: toExclusive.getTime(), label },
  });

  switch (preset) {
    case 'hoy':
      return make(today, addDays(today, 1), `Hoy (${fmt(today)})`);
    case 'ayer':
      return make(addDays(today, -1), today, `Ayer (${fmt(addDays(today, -1))})`);
    case '7d':
      return make(addDays(today, -6), addDays(today, 1), `Últimos 7 días (${fmt(addDays(today, -6))} – ${fmt(today)})`);
    case '30d':
      return make(addDays(today, -29), addDays(today, 1), `Últimos 30 días (${fmt(addDays(today, -29))} – ${fmt(today)})`);
    case 'mes': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return make(first, addDays(today, 1), `Este mes (${fmt(first)} – ${fmt(today)})`);
    }
    case 'custom': {
      const from = parseDateInput(custom?.from ?? '');
      const to = parseDateInput(custom?.to ?? '');
      if (!from || !to) return { ok: false, error: 'Elige fechas válidas' };
      if (to < from) return { ok: false, error: 'La fecha final no puede ser anterior a la inicial' };
      if (to > today) return { ok: false, error: 'La fecha final no puede ser futura' };
      const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
      if (days > MAX_RANGE_DAYS) return { ok: false, error: `El rango máximo es de ${MAX_RANGE_DAYS} días` };
      return make(from, addDays(to, 1), `${fmt(from)} – ${fmt(to)}`);
    }
  }
}
