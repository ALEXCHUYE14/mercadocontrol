import { describe, expect, it } from 'vitest';
import { parseVoiceCommand } from '@/lib/logic/voiceParser';

const v = (text: string) => {
  const r = parseVoiceCommand(text);
  return [r.quantity, r.unit, r.name, r.price] as const;
};

describe('parseVoiceCommand', () => {
  it('frase básica: cantidad, unidad, producto y precio', () => {
    expect(v('30 kilos de tomate a 2.50')).toEqual([30, 'kg', 'tomate', 2.5]);
  });

  it('ignora la palabra "soles" sin cortar nombres que la contienen', () => {
    expect(v('30 kilos de tomate a 2.50 soles')).toEqual([30, 'kg', 'tomate', 2.5]);
    expect(v('5 kilos de girasoles')).toEqual([5, 'kg', 'girasoles', null]);
  });

  it('reconoce el símbolo S/', () => {
    expect(v('10 kilos de papa a S/ 1,80')).toEqual([10, 'kg', 'papa', 1.8]);
  });

  it('un número tras "a" es el precio, no la cantidad', () => {
    expect(v('tomate a 2.50')).toEqual([null, null, 'tomate', 2.5]);
  });

  it('números escritos con palabras', () => {
    expect(v('una docena de huevos a 12')).toEqual([1, 'docena', 'huevos', 12]);
    expect(v('treinta atados de culantro a dos')).toEqual([30, 'atado', 'culantro', 2]);
  });

  it('nombre de producto compuesto con "de" adentro', () => {
    expect(v('3 sacos de papa de seda a 60')).toEqual([3, 'saco', 'papa de seda', 60]);
  });

  it('coma de dictado (no decimal) se ignora', () => {
    expect(v('30 kilos de tomate, a 2.50')).toEqual([30, 'kg', 'tomate', 2.5]);
  });

  it('texto vacío no revienta', () => {
    expect(v('')).toEqual([null, null, null, null]);
  });
});
