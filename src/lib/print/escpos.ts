// =============================================================================
// Codificador ESC/POS (PURO): convierte un Ticket en los bytes que entiende una
// impresora térmica. Sin DOM ni Bluetooth, así se puede probar en Node.
// Página de códigos: PC858 (Europa occidental + €): acentos, ñ, ¿, ¡.
// =============================================================================

import { PAPER_COLS, layoutTicket, type PaperWidth, type Ticket } from '@/lib/logic/ticket';

const ESC = 0x1b;
const GS = 0x1d;
const FS = 0x1c;
const LF = 0x0a;

/** Caracteres no ASCII más comunes en español → byte en PC858. */
const CP858: Record<string, number> = {
  Ç: 0x80, ü: 0x81, é: 0x82, â: 0x83, ä: 0x84, à: 0x85, ç: 0x87, ê: 0x88, ë: 0x89, è: 0x8a,
  ï: 0x8b, î: 0x8c, ì: 0x8d, Ä: 0x8e, É: 0x90, ô: 0x93, ö: 0x94, ò: 0x95, û: 0x96, ù: 0x97,
  Ö: 0x99, Ü: 0x9a, á: 0xa0, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, ª: 0xa6, º: 0xa7,
  '¿': 0xa8, '¡': 0xad, '«': 0xae, '»': 0xaf, Á: 0xb5, Â: 0xb6, À: 0xb7, Í: 0xd6, Ó: 0xe0,
  Ú: 0xe9, '°': 0xf8, '·': 0xfa, '€': 0xd5,
};

/** Sustitutos ASCII para signos tipográficos frecuentes. */
const ASCII_FALLBACK: Record<string, string> = {
  '“': '"', '”': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '…': '...', ' ': ' ', '\t': ' ',
};

/** Texto → bytes PC858. Emojis y caracteres desconocidos se reemplazan por '?'. */
export function encodeText(text: string): number[] {
  const out: number[] = [];
  for (const ch of text.normalize('NFC')) {
    const sub = ASCII_FALLBACK[ch] ?? ch;
    for (const c of sub) {
      const code = c.codePointAt(0) ?? 0;
      if (code >= 0x20 && code <= 0x7e) out.push(code);
      else if (CP858[c] !== undefined) out.push(CP858[c]);
      else if (code > 0xffff || (code >= 0x2190 && code <= 0x2bff) || code === 0xfe0f || code === 0x200d) continue; // emojis/símbolos: se omiten
      else out.push(0x3f); // '?'
    }
  }
  return out;
}

export interface EscposOptions {
  /** Enviar corte al final (solo impresoras con cortador) */
  cut?: boolean;
  /** Líneas en blanco al final para que el papel sobresalga */
  feedLines?: number;
}

/** Bytes ESC/POS de un ticket para el ancho de papel dado. */
export function encodeTicketEscpos(t: Ticket, paper: PaperWidth, opts: EscposOptions = {}): Uint8Array {
  const cols = PAPER_COLS[paper];
  const bytes: number[] = [];
  const push = (...b: number[]) => bytes.push(...b);

  push(ESC, 0x40); // inicializar
  push(FS, 0x2e); // cancelar modo kanji (impresoras chinas que interpretan GBK)
  push(ESC, 0x74, 19); // página de códigos PC858
  push(ESC, 0x32); // interlineado por defecto

  for (const row of layoutTicket(t, cols, { doubleSize: true })) {
    push(ESC, 0x61, row.align === 'center' ? 1 : 0);
    push(ESC, 0x45, row.bold ? 1 : 0);
    push(GS, 0x21, row.big ? 0x11 : 0x00);
    // Una fila jamás debe pasar del ancho: se recorta para no desalinear todo el ticket
    const maxChars = row.big ? Math.floor(cols / 2) : cols;
    push(...encodeText(row.text.slice(0, maxChars)), LF);
  }

  // Restablecer estilo, dejar salir el papel y (opcional) cortar
  push(ESC, 0x61, 0, ESC, 0x45, 0, GS, 0x21, 0x00);
  push(ESC, 0x64, Math.min(Math.max(opts.feedLines ?? 4, 0), 10));
  if (opts.cut) push(GS, 0x56, 0x42, 0x00);
  return Uint8Array.from(bytes);
}

/** Trozos de `size` bytes (las impresoras BLE aceptan escrituras pequeñas). */
export function chunkBytes(bytes: Uint8Array, size: number): Uint8Array[] {
  if (!Number.isInteger(size) || size <= 0) throw new Error('Tamaño de bloque inválido');
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) out.push(bytes.slice(i, i + size));
  return out;
}

/** URL para la app RawBT de Android (impresoras Bluetooth clásicas), con los bytes en base64. */
export function rawbtUrl(bytes: Uint8Array): string {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return `rawbt:base64,${btoa(bin)}`;
}
