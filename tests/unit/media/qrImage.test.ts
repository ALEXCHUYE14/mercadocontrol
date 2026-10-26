import { describe, expect, it } from 'vitest';
import { MAX_QR_DATA_URL, fitWithin, isValidQrDataUrl, processQrFile } from '@/lib/media/qrImage';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

describe('isValidQrDataUrl', () => {
  it('acepta PNG y JPEG como data URL', () => {
    expect(isValidQrDataUrl(PNG)).toBe(true);
    expect(isValidQrDataUrl(JPG)).toBe(true);
  });

  it('rechaza SVG (puede llevar <script>), URLs externas y javascript:', () => {
    expect(isValidQrDataUrl('data:image/svg+xml;base64,PHN2Zy8+')).toBe(false);
    expect(isValidQrDataUrl('https://evil.example/x.png')).toBe(false);
    expect(isValidQrDataUrl('javascript:alert(1)')).toBe(false);
    expect(isValidQrDataUrl('data:text/html;base64,PGgxPg==')).toBe(false);
  });

  it('rechaza base64 con caracteres fuera del alfabeto (posible inyección)', () => {
    expect(isValidQrDataUrl('data:image/png;base64,AAAA"><script>')).toBe(false);
  });

  it('rechaza algo demasiado grande', () => {
    expect(isValidQrDataUrl('data:image/png;base64,' + 'A'.repeat(MAX_QR_DATA_URL))).toBe(false);
  });

  it('rechaza valores que no son texto', () => {
    expect(isValidQrDataUrl(null)).toBe(false);
    expect(isValidQrDataUrl(123)).toBe(false);
    expect(isValidQrDataUrl(undefined)).toBe(false);
  });
});

describe('fitWithin', () => {
  it('no agranda una imagen que ya cabe', () => {
    expect(fitWithin(300, 200, 720)).toEqual({ width: 300, height: 200 });
  });

  it('reduce manteniendo la proporción, por el lado mayor', () => {
    expect(fitWithin(1440, 720, 720)).toEqual({ width: 720, height: 360 });
  });

  it('funciona igual con una imagen vertical', () => {
    expect(fitWithin(1000, 4000, 720)).toEqual({ width: 180, height: 720 });
  });

  it('nunca produce un lado de 0 por redondeo', () => {
    expect(fitWithin(1, 100000, 720)).toEqual({ width: 1, height: 720 });
  });

  it('con ancho o alto 0 lanza, en vez de dividir entre 0', () => {
    expect(() => fitWithin(0, 10, 720)).toThrow();
  });
});

describe('processQrFile (validaciones previas a tocar el canvas)', () => {
  it('rechaza un tipo de archivo no permitido (GIF, SVG, PDF)', async () => {
    await expect(processQrFile(new File(['x'], 'a.gif', { type: 'image/gif' }))).rejects.toThrow(/PNG, JPG o WebP/);
    await expect(processQrFile(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))).rejects.toThrow(/PNG, JPG o WebP/);
    await expect(processQrFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).rejects.toThrow(/PNG, JPG o WebP/);
  });

  it('rechaza un archivo demasiado pesado', async () => {
    const big = { type: 'image/png', size: 11 * 1024 * 1024 } as File;
    await expect(processQrFile(big)).rejects.toThrow(/muy pesada/);
  });
});
