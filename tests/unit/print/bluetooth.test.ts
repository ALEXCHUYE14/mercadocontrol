import { describe, expect, it } from 'vitest';
import { bluetoothHelpMessage, detectBluetoothSupport, type BluetoothEnv } from '@/lib/print/bluetooth';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function env(overrides: Partial<BluetoothEnv>): BluetoothEnv {
  return { userAgent: WIN_UA, platform: 'Win32', maxTouchPoints: 0, isSecureContext: true, hasBluetoothApi: true, ...overrides };
}

describe('detectBluetoothSupport', () => {
  it('PC con Chrome y https: soportado', () => {
    expect(detectBluetoothSupport(env({}))).toEqual({ ok: true });
  });

  it('Android con Chrome y https: soportado', () => {
    expect(detectBluetoothSupport(env({ userAgent: ANDROID_UA, platform: 'Linux armv81', maxTouchPoints: 5 }))).toEqual({ ok: true });
  });

  it('iPhone con Safari: no soportado, motivo "ios"', () => {
    expect(
      detectBluetoothSupport(env({ userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5, hasBluetoothApi: false }))
    ).toEqual({ ok: false, reason: 'ios' });
  });

  it('iPad (se presenta como Mac): también se detecta como iOS por la pantalla táctil', () => {
    expect(
      detectBluetoothSupport(env({ userAgent: IPAD_UA, platform: 'MacIntel', maxTouchPoints: 5, hasBluetoothApi: false }))
    ).toEqual({ ok: false, reason: 'ios' });
  });

  it('un Mac de escritorio real (sin pantalla táctil) no se confunde con iPad', () => {
    expect(
      detectBluetoothSupport(env({ userAgent: IPAD_UA, platform: 'MacIntel', maxTouchPoints: 0, hasBluetoothApi: false }))
    ).toEqual({ ok: false, reason: 'no-api' });
  });

  it('iPhone con un navegador que sí trae la API (p. ej. Bluefy): soportado', () => {
    expect(
      detectBluetoothSupport(env({ userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5, hasBluetoothApi: true }))
    ).toEqual({ ok: true });
  });

  it('sin conexión segura (http): motivo "insecure"', () => {
    expect(detectBluetoothSupport(env({ isSecureContext: false, hasBluetoothApi: false }))).toEqual({ ok: false, reason: 'insecure' });
    // Prioriza "insecure" sobre "no-api" cuando ambas faltan
    expect(detectBluetoothSupport(env({ isSecureContext: false }))).toEqual({ ok: false, reason: 'insecure' });
  });

  it('un navegador sin la API (Firefox) en https: motivo "no-api"', () => {
    expect(detectBluetoothSupport(env({ hasBluetoothApi: false }))).toEqual({ ok: false, reason: 'no-api' });
  });
});

describe('bluetoothHelpMessage', () => {
  it('da un mensaje distinto para cada motivo', () => {
    const messages = new Set((['ios', 'insecure', 'no-api'] as const).map(bluetoothHelpMessage));
    expect(messages.size).toBe(3);
  });

  it('el mensaje de iOS menciona la alternativa (Bluefy)', () => {
    expect(bluetoothHelpMessage('ios')).toContain('Bluefy');
  });
});
