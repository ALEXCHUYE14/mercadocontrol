import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../helpers/db';
import { getSettings, saveSettings } from '@/lib/db/settings';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

beforeEach(resetDb);

describe('getSettings / saveSettings', () => {
  it('por defecto: 80 mm y sin QR configurado', async () => {
    const s = await getSettings();
    expect(s.paperWidth).toBe(80);
    expect(s.paymentQr).toEqual({ yape: null, plin: null });
  });

  it('guarda y recupera un ajuste simple', async () => {
    await saveSettings({ paperWidth: 58, address: 'Mercado Central' });
    const s = await getSettings();
    expect(s.paperWidth).toBe(58);
    expect(s.address).toBe('Mercado Central');
  });

  it('un valor inválido se descarta y cae al valor por defecto', async () => {
    await saveSettings({ paperWidth: 999 as never });
    expect((await getSettings()).paperWidth).toBe(80);
  });

  it('subir el QR de Yape no borra el de Plin (guardado parcial por espacio)', async () => {
    await saveSettings({ paymentQr: { yape: PNG } });
    await saveSettings({ paymentQr: { plin: JPG } });
    expect(await getSettings().then((s) => s.paymentQr)).toEqual({ yape: PNG, plin: JPG });
  });

  it('guardar otro ajuste cualquiera no borra los QR ya guardados', async () => {
    await saveSettings({ paymentQr: { yape: PNG, plin: JPG } });
    await saveSettings({ address: 'Nueva dirección' });
    expect(await getSettings().then((s) => s.paymentQr)).toEqual({ yape: PNG, plin: JPG });
  });

  it('quitar un QR (null) conserva el otro', async () => {
    await saveSettings({ paymentQr: { yape: PNG, plin: JPG } });
    await saveSettings({ paymentQr: { yape: null } });
    expect(await getSettings().then((s) => s.paymentQr)).toEqual({ yape: null, plin: JPG });
  });

  it('un valor de QR no permitido (SVG) se descarta al sanear', async () => {
    await saveSettings({ paymentQr: { plin: 'data:image/svg+xml;base64,PHN2Zy8+' } });
    expect(await getSettings().then((s) => s.paymentQr.plin)).toBeNull();
  });

  it('ajustes corruptos guardados directamente en Dexie se limpian al leer', async () => {
    const { db } = await import('@/lib/db/dexie');
    await db().meta.put({ key: 'settings', value: { paymentQr: { yape: '<script>', plin: 42 } } });
    expect(await getSettings().then((s) => s.paymentQr)).toEqual({ yape: null, plin: null });
  });

  it('ajustes antiguos sin el campo paymentQr (de antes de esta función) siguen funcionando', async () => {
    const { db } = await import('@/lib/db/dexie');
    await db().meta.put({ key: 'settings', value: { paperWidth: 58 } });
    const s = await getSettings();
    expect(s.paperWidth).toBe(58);
    expect(s.paymentQr).toEqual({ yape: null, plin: null });
  });
});
