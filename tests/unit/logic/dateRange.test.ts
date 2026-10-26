import { describe, expect, it } from 'vitest';
import { MAX_RANGE_DAYS, resolveRange } from '@/lib/logic/dateRange';

const now = new Date(2026, 8, 18, 15, 30); // 18 de septiembre de 2026, 3:30pm

describe('resolveRange', () => {
  it('hoy: desde la medianoche hasta la medianoche siguiente', () => {
    const r = resolveRange('hoy', now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(new Date(r.range.from).getDate()).toBe(18);
    expect(new Date(r.range.to).getDate()).toBe(19);
  });

  it('ayer', () => {
    const r = resolveRange('ayer', now);
    if (!r.ok) throw new Error('debía resolver');
    expect(new Date(r.range.from).getDate()).toBe(17);
    expect(new Date(r.range.to).getDate()).toBe(18);
  });

  it('7 días incluye hoy y los 6 anteriores', () => {
    const r = resolveRange('7d', now);
    if (!r.ok) throw new Error('debía resolver');
    expect(new Date(r.range.from).getDate()).toBe(12);
  });

  it('este mes empieza el día 1', () => {
    const r = resolveRange('mes', now);
    if (!r.ok) throw new Error('debía resolver');
    expect(new Date(r.range.from).getDate()).toBe(1);
  });

  it('rango personalizado válido', () => {
    expect(resolveRange('custom', now, { from: '2026-09-01', to: '2026-09-10' }).ok).toBe(true);
  });

  it('rechaza una fecha imposible (30 de febrero)', () => {
    expect(resolveRange('custom', now, { from: '2026-02-30', to: '2026-03-01' }).ok).toBe(false);
  });

  it('rechaza fin anterior al inicio', () => {
    const r = resolveRange('custom', now, { from: '2026-09-10', to: '2026-09-01' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/anterior/i);
  });

  it('rechaza una fecha final futura', () => {
    const r = resolveRange('custom', now, { from: '2026-09-01', to: '2026-12-01' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/futura/i);
  });

  it(`rechaza un rango mayor a ${MAX_RANGE_DAYS} días`, () => {
    const r = resolveRange('custom', now, { from: '2025-01-01', to: '2026-09-18' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/máximo/i);
  });

  it('rechaza fechas vacías', () => {
    expect(resolveRange('custom', now, { from: '', to: '' }).ok).toBe(false);
  });
});
