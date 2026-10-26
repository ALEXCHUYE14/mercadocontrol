import { describe, expect, it } from 'vitest';
import { computeFreshness } from '@/lib/logic/freshness';

const now = Date.now();
const day = 86_400_000;
const iso = (daysAgo: number) => new Date(now - daysAgo * day).toISOString();
const cat = { avg_shelf_life_days: 4, yellow_threshold: 0.45, red_threshold: 0.75 };

describe('computeFreshness', () => {
  it('verde cuando recién entró', () => {
    expect(computeFreshness({ entry_date: iso(1), expires_at: null }, cat).state).toBe('verde');
  });

  it('amarillo al cruzar el umbral', () => {
    expect(computeFreshness({ entry_date: iso(2), expires_at: null }, cat).state).toBe('amarillo');
  });

  it('rojo al cruzar el umbral rojo', () => {
    expect(computeFreshness({ entry_date: iso(3.5), expires_at: null }, cat).state).toBe('rojo');
  });

  it('un vencimiento explícito ya pasado manda sobre el cálculo por antigüedad', () => {
    // entry_date de hoy (daría "verde" por antigüedad) pero expires_at de ayer: ya venció
    expect(computeFreshness({ entry_date: iso(0), expires_at: iso(1) }, cat).state).toBe('rojo');
  });

  it('daysLeft respeta el vencimiento explícito, no solo la vida útil de la categoría', () => {
    const future = new Date(now + 1.5 * day).toISOString();
    const r = computeFreshness({ entry_date: iso(0), expires_at: future }, cat);
    expect(Math.round(r.daysLeft * 10) / 10).toBe(1.5);
  });

  it('una fecha de ingreso inválida no revienta: se trata como recién ingresado', () => {
    expect(computeFreshness({ entry_date: 'fecha-invalida', expires_at: null }, cat).state).toBe('verde');
  });

  it('sin categoría usa los valores por defecto (7 días, 50%/80%)', () => {
    expect(computeFreshness({ entry_date: iso(3), expires_at: null })).toMatchObject({ state: 'verde' });
    expect(computeFreshness({ entry_date: iso(6), expires_at: null }).state).toBe('rojo');
  });
});
