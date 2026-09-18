// =============================================================================
// Parser local de comandos de voz en español peruano.
// Ej: "30 kilos de tomate a 2.50"  ->  { qty:30, unit:'kg', name:'tomate', price:2.5 }
// Funciona sin conexión; para frases complejas la app puede delegar a una
// Edge Function con IA, pero esto cubre el 90% de los casos comunes.
// =============================================================================

import type { UnitMeasure } from '@/types';

export interface ParsedVoiceCommand {
  quantity: number | null;
  unit: UnitMeasure | null;
  name: string | null;
  price: number | null;   // precio o costo mencionado tras "a" / "a S/"
  raw: string;
}

const UNIT_WORDS: Record<string, UnitMeasure> = {
  kilo: 'kg', kilos: 'kg', kg: 'kg', 'kilogramo': 'kg', 'kilogramos': 'kg',
  unidad: 'unidad', unidades: 'unidad', 'und': 'unidad',
  atado: 'atado', atados: 'atado', 'manojo': 'atado', 'manojos': 'atado',
  saco: 'saco', sacos: 'saco', 'costal': 'saco', 'costales': 'saco',
  caja: 'caja', cajas: 'caja', 'cajon': 'caja', 'cajón': 'caja', 'cajones': 'caja',
  docena: 'docena', docenas: 'docena',
  litro: 'litro', litros: 'litro',
  bandeja: 'bandeja', bandejas: 'bandeja',
};

// Convierte números escritos comunes a dígitos
const WORD_NUMBERS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, cien: 100,
};

// Conectores que no forman parte del nombre cuando quedan en los bordes
const EDGE_STOPWORDS = new Set(['a', 'de', 'del', 'y', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\bsoles?\b/g, ' ')
    .replace(/\bs\/\.?/g, ' ')
    .replace(/[¡!¿?;:"“”]/g, ' ')
    .replace(/,(?!\d)/g, ' ')           // comas de dictado (no decimales como "2,50")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNumber(token: string | undefined): number | null {
  if (!token) return null;
  if (/^\d+([.,]\d+)?$/.test(token)) {
    const n = parseFloat(token.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return WORD_NUMBERS[token] ?? null;
}

export function parseVoiceCommand(input: string): ParsedVoiceCommand {
  const raw = input;
  const text = normalize(input);
  const tokens = text ? text.split(' ') : [];

  const result: ParsedVoiceCommand = {
    quantity: null,
    unit: null,
    name: null,
    price: null,
    raw,
  };

  // Índices de tokens ya "consumidos" (precio, cantidad, unidad) para no
  // confundirlos entre sí ni meterlos en el nombre del producto.
  const used = new Set<number>();

  // 1) Precio: número que sigue a "a" (ej "a 2.50" / "a dos")
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] !== 'a') continue;
    const n = extractNumber(tokens[i + 1]);
    if (n != null) {
      result.price = n;
      used.add(i);
      used.add(i + 1);
      break;
    }
  }

  // 2) Cantidad + unidad (primer número que no sea el precio)
  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue;
    const num = extractNumber(tokens[i]);
    if (num == null) continue;
    result.quantity = num;
    used.add(i);
    const maybeUnit = tokens[i + 1];
    if (maybeUnit && !used.has(i + 1) && UNIT_WORDS[maybeUnit]) {
      result.unit = UNIT_WORDS[maybeUnit];
      used.add(i + 1);
    }
    break;
  }

  // Unidad sin número ("docena de huevos", "saco de papa") => cantidad implícita 1
  if (result.quantity == null) {
    const ui = tokens.findIndex((t, i) => !used.has(i) && UNIT_WORDS[t]);
    if (ui >= 0) {
      result.quantity = 1;
      result.unit = UNIT_WORDS[tokens[ui]];
      used.add(ui);
    }
  }

  // 3) Nombre: lo que queda, sin conectores en los bordes ("de tomate" -> "tomate")
  const rest = tokens.filter((_, i) => !used.has(i));
  while (rest.length && EDGE_STOPWORDS.has(rest[0])) rest.shift();
  while (rest.length && EDGE_STOPWORDS.has(rest[rest.length - 1])) rest.pop();
  if (rest.length) result.name = rest.join(' ');

  return result;
}
