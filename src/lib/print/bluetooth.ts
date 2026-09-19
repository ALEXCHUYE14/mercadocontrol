// =============================================================================
// Impresión térmica por Bluetooth Low Energy (Web Bluetooth) con ESC/POS.
// Compatibilidad: Chrome/Edge en Android y escritorio, con HTTPS (o localhost).
// NO funciona en iPhone/iPad ni Firefox. Solo impresoras BLE: las de Bluetooth
// "clásico" (SPP) no las expone Web Bluetooth; para esas se ofrece RawBT o el
// diálogo de impresión del sistema.
// =============================================================================

import { chunkBytes } from '@/lib/print/escpos';

/** Servicios BLE habituales de impresoras térmicas (deben declararse para poder usarlos). */
export const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

// Tipos mínimos de Web Bluetooth (no vienen en lib.dom de TypeScript)
interface GattCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue(data: BufferSource): Promise<void>;
  writeValueWithoutResponse?(data: BufferSource): Promise<void>;
}
interface GattService {
  uuid: string;
  getCharacteristics(): Promise<GattCharacteristic[]>;
}
interface GattServer {
  connected: boolean;
  getPrimaryServices(): Promise<GattService[]>;
}
interface BtDevice {
  id: string;
  name?: string;
  gatt?: { connected: boolean; connect(): Promise<GattServer>; disconnect(): void };
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}
interface BluetoothApi {
  requestDevice(options: { acceptAllDevices: true; optionalServices: string[] }): Promise<BtDevice>;
  getDevices?(): Promise<BtDevice[]>;
}

export type BluetoothFailure = 'unsupported' | 'cancelled' | 'not-paired' | 'connect' | 'no-writable' | 'write';

/** Error con mensaje listo para mostrar y un código para que la UI decida (p. ej. volver a emparejar). */
export class BluetoothPrintError extends Error {
  constructor(public readonly code: BluetoothFailure, message: string) {
    super(message);
    this.name = 'BluetoothPrintError';
  }
}

export interface PairedPrinter {
  id: string;
  name: string;
}

function api(): BluetoothApi | null {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return null;
  if (!window.isSecureContext) return null; // Web Bluetooth exige HTTPS o localhost
  return ((navigator as unknown as { bluetooth?: BluetoothApi }).bluetooth) ?? null;
}

export type BluetoothUnsupportedReason = 'ios' | 'insecure' | 'no-api';
export type BluetoothSupport = { ok: true } | { ok: false; reason: BluetoothUnsupportedReason };

/** Datos del entorno que deciden si hay Bluetooth web (separado para poder probarlo). */
export interface BluetoothEnv {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  isSecureContext: boolean;
  hasBluetoothApi: boolean;
}

/**
 * Explica POR QUÉ no hay Bluetooth web (para mostrar la ayuda correcta):
 *  - ios: iPhone/iPad no lo permiten en ningún navegador salvo apps como Bluefy.
 *  - insecure: la página no está en HTTPS (ni localhost).
 *  - no-api: navegador sin la función (Firefox, Safari de escritorio…).
 */
export function detectBluetoothSupport(env: BluetoothEnv): BluetoothSupport {
  if (env.hasBluetoothApi && env.isSecureContext) return { ok: true };
  // iPadOS 13+ se presenta como Mac: se distingue por la pantalla táctil
  const isIos = /iPhone|iPad|iPod/i.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
  if (isIos && !env.hasBluetoothApi) return { ok: false, reason: 'ios' };
  if (!env.isSecureContext) return { ok: false, reason: 'insecure' };
  return { ok: false, reason: 'no-api' };
}

export function bluetoothSupport(): BluetoothSupport {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return { ok: false, reason: 'no-api' };
  return detectBluetoothSupport({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    isSecureContext: window.isSecureContext,
    hasBluetoothApi: 'bluetooth' in navigator,
  });
}

/** Texto de ayuda para cada motivo (sin tecnicismos). */
export function bluetoothHelpMessage(reason: BluetoothUnsupportedReason): string {
  switch (reason) {
    case 'ios':
      return 'iPhone y iPad no permiten Bluetooth desde Safari ni Chrome. Para imprimir por Bluetooth abre MercadoControl en el navegador gratuito «Bluefy» (App Store) con el enlace de abajo, o usa «Imprimir con el sistema / PDF».';
    case 'insecure':
      return 'El Bluetooth necesita una conexión segura (https). Abre la app desde su dirección https o usa «Imprimir con el sistema / PDF».';
    case 'no-api':
      return 'Este navegador no incluye Bluetooth web. Abre MercadoControl en Chrome o Edge (Android o PC) o usa «Imprimir con el sistema / PDF».';
  }
}

export function isBluetoothSupported(): boolean {
  return api() !== null;
}

// Conexión en memoria: evita re-emparejar y reconectar en cada ticket
let device: BtDevice | null = null;
let writer: { char: GattCharacteristic; withoutResponse: boolean } | null = null;

function forget(): void {
  writer = null;
}

/** Abre el selector del navegador para emparejar una impresora. Debe llamarse desde un toque del usuario. */
export async function pairPrinter(): Promise<PairedPrinter> {
  const bt = api();
  if (!bt) {
    throw new BluetoothPrintError(
      'unsupported',
      'Este navegador o dispositivo no permite Bluetooth desde la web. Usa Chrome en Android o imprime con el diálogo del sistema.'
    );
  }
  try {
    const picked = await bt.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
    picked.addEventListener('gattserverdisconnected', forget);
    device = picked;
    forget();
    return { id: picked.id, name: picked.name?.trim() || 'Impresora Bluetooth' };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      throw new BluetoothPrintError('cancelled', 'No se eligió ninguna impresora');
    }
    throw new BluetoothPrintError('connect', 'No se pudo abrir el selector de Bluetooth');
  }
}

/** Recupera un dispositivo ya autorizado antes (si el navegador lo permite). */
async function resolveDevice(saved: PairedPrinter | null): Promise<BtDevice> {
  if (device && (!saved || device.id === saved.id)) return device;
  const bt = api();
  if (!bt) throw new BluetoothPrintError('unsupported', 'Bluetooth no disponible en este navegador');
  if (saved && bt.getDevices) {
    try {
      const known = (await bt.getDevices()).find((d) => d.id === saved.id);
      if (known) {
        known.addEventListener('gattserverdisconnected', forget);
        device = known;
        return known;
      }
    } catch { /* getDevices no permitido: se pedirá emparejar de nuevo */ }
  }
  throw new BluetoothPrintError('not-paired', 'Vuelve a emparejar la impresora (toca «Emparejar» en Ajustes)');
}

async function connect(dev: BtDevice): Promise<void> {
  if (!dev.gatt) throw new BluetoothPrintError('connect', 'La impresora no expone conexión GATT');
  if (writer && dev.gatt.connected) return;
  let server: GattServer | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3 && !server; attempt++) {
    try {
      server = await dev.gatt.connect();
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  if (!server) {
    void lastError;
    throw new BluetoothPrintError('connect', 'No se pudo conectar. Enciende la impresora y acércala al teléfono');
  }

  // Primero los servicios de impresión conocidos: otros (batería, info) también pueden tener
  // características escribibles y no imprimen.
  const rank = (uuid: string) => {
    const i = PRINTER_SERVICES.indexOf(uuid.toLowerCase());
    return i === -1 ? PRINTER_SERVICES.length : i;
  };
  const services = (await server.getPrimaryServices()).sort((a, b) => rank(a.uuid) - rank(b.uuid));
  for (const svc of services) {
    for (const char of await svc.getCharacteristics()) {
      if (char.properties.write || char.properties.writeWithoutResponse) {
        writer = { char, withoutResponse: !char.properties.write && char.properties.writeWithoutResponse };
        return;
      }
    }
  }
  throw new BluetoothPrintError('no-writable', 'Esta impresora no acepta datos por Bluetooth Low Energy (BLE)');
}

/** Tamaño seguro para cualquier impresora BLE (MTU mínimo 23 - 3 bytes de cabecera). */
const BLE_CHUNK = 20;

/** Escribe por bloques; devuelve cuántos bloques alcanzó a enviar antes de fallar (o lanza si falla). */
async function writeChunks(bytes: Uint8Array): Promise<{ sent: number; error: unknown }> {
  if (!writer) return { sent: 0, error: new Error('sin conexión') };
  const { char, withoutResponse } = writer;
  let sent = 0;
  try {
    for (const chunk of chunkBytes(bytes, BLE_CHUNK)) {
      if (withoutResponse && char.writeValueWithoutResponse) await char.writeValueWithoutResponse(chunk as BufferSource);
      else await char.writeValue(chunk as BufferSource);
      sent++;
      await new Promise((r) => setTimeout(r, 25)); // evita desbordar el búfer de la impresora
    }
    return { sent, error: null };
  } catch (error) {
    return { sent, error };
  }
}

/**
 * Envía los bytes ESC/POS a la impresora. Si la conexión estaba caída y no se alcanzó a
 * enviar nada, reconecta y reintenta UNA vez; si ya salió parte del ticket no se reintenta
 * (saldría duplicado).
 */
export async function printBytes(bytes: Uint8Array, saved: PairedPrinter | null): Promise<void> {
  const dev = await resolveDevice(saved);
  await connect(dev);
  let result = await writeChunks(bytes);
  if (result.error && result.sent === 0) {
    forget();
    await connect(dev);
    result = await writeChunks(bytes);
  }
  if (result.error) {
    forget();
    throw new BluetoothPrintError(
      'write',
      result.sent > 0
        ? 'Se perdió la conexión a mitad de la impresión. Revisa el papel e inténtalo de nuevo'
        : 'No se pudo enviar el ticket a la impresora'
    );
  }
}

/** Corta la conexión (p. ej. al olvidar la impresora). */
export function disconnectPrinter(): void {
  try {
    device?.gatt?.disconnect();
  } catch { /* ya estaba desconectada */ }
  device = null;
  forget();
}
