import { describe, expect, it } from 'vitest';
import { buildSampleTicket } from '@/lib/logic/ticket';
import { chunkBytes, encodeText, encodeTicketEscpos, rawbtUrl } from '@/lib/print/escpos';

const biz = { name: 'Frutas Ana', phone: null, address: null, taxId: null };

describe('encodeText', () => {
  it('convierte acentos, ñ y signos a la página de códigos PC858', () => {
    expect(encodeText('Ñandú áéíóú ¿¡ °')).toEqual([
      0xa5, 0x61, 0x6e, 0x64, 0xa3, 0x20, 0xa0, 0x82, 0xa1, 0xa2, 0xa3, 0x20, 0xa8, 0xad, 0x20, 0xf8,
    ]);
  });

  it('sustituye comillas tipográficas por sus equivalentes ASCII', () => {
    expect(encodeText('“hola” — ok…')).toEqual(Array.from('"hola" - ok...').map((c) => c.charCodeAt(0)));
  });

  it('un emoji (o un dingbat tipo ☂/✓) se omite en vez de imprimir basura', () => {
    expect(encodeText('a🍎b')).toEqual([97, 98]);
    expect(encodeText('a☂b')).toEqual([97, 98]);
  });

  it('una letra fuera de ASCII y de la página de códigos se reemplaza por "?"', () => {
    expect(encodeText('aЯb')).toEqual([97, 0x3f, 98]);
  });
});

describe('encodeTicketEscpos', () => {
  const ticket = buildSampleTicket(biz);

  it('empieza con el comando de inicialización ESC @', () => {
    const bytes = encodeTicketEscpos(ticket, 58);
    expect([bytes[0], bytes[1]]).toEqual([0x1b, 0x40]);
  });

  it('selecciona la página de códigos PC858 (ESC t 19)', () => {
    const bytes = Array.from(encodeTicketEscpos(ticket, 58));
    expect(bytes.join(',')).toContain('27,116,19');
  });

  it('sin pedir corte, no incluye el comando GS V', () => {
    const bytes = Array.from(encodeTicketEscpos(ticket, 58, { cut: false }));
    expect(bytes.join(',')).not.toContain('29,86');
  });

  it('pidiendo corte, termina con GS V 66 0', () => {
    const bytes = encodeTicketEscpos(ticket, 80, { cut: true });
    expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });

  it('el avance de papel se acota a 10 líneas como máximo', () => {
    const bytes = encodeTicketEscpos(ticket, 58, { feedLines: 99 });
    expect(Array.from(bytes.slice(-3))).toEqual([0x1b, 0x64, 10]);
  });
});

describe('chunkBytes', () => {
  it('parte en bloques del tamaño pedido, con el resto al final', () => {
    expect(chunkBytes(new Uint8Array(45), 20).map((c) => c.length)).toEqual([20, 20, 5]);
  });

  it('al unir los bloques se reconstruyen los bytes originales', () => {
    const chunks = chunkBytes(Uint8Array.from([1, 2, 3, 4, 5]), 2);
    expect(Array.from(new Uint8Array(chunks.flatMap((c) => Array.from(c))))).toEqual([1, 2, 3, 4, 5]);
  });

  it('un tamaño de bloque 0 o inválido lanza, en vez de colgarse en un bucle infinito', () => {
    expect(() => chunkBytes(new Uint8Array(3), 0)).toThrow();
  });
});

describe('rawbtUrl', () => {
  it('codifica los bytes en base64 dentro del esquema rawbt:', () => {
    expect(rawbtUrl(Uint8Array.from([1, 2, 3]))).toBe('rawbt:base64,AQID');
  });
});
