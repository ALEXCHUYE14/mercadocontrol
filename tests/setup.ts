// =============================================================================
// Arranque global de las pruebas (entorno por defecto: Node, sin navegador real).
// Varios módulos de la app llevan 'use client' y asumen que existen `window`,
// `localStorage` y `navigator` (como en cualquier navegador). Aquí se crean
// versiones mínimas suficientes para que esa lógica corra igual que en el cliente.
// El entorno 'jsdom' (declarado por archivo con `// @vitest-environment jsdom`)
// ya trae las suyas y no pasa por este polyfill de `window`.
// =============================================================================

import 'fake-indexeddb/auto';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

if (typeof globalThis.window === 'undefined') {
  // Dexie y los repositorios comprueban `typeof window === 'undefined'` como guarda de SSR.
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}

if (!(globalThis as unknown as { localStorage?: Storage }).localStorage) {
  (globalThis as unknown as { localStorage: Storage }).localStorage = new MemoryStorage();
}

// Node ya trae un `navigator` global (desde la v21); se completa sin reemplazarlo,
// así el motor/versión que reporta Node se conserva para lo que no nos importa.
const existingNavigator = (globalThis as unknown as { navigator?: Record<string, unknown> }).navigator ?? {};
Object.defineProperty(globalThis, 'navigator', {
  value: { ...existingNavigator, onLine: true },
  configurable: true,
  writable: true,
});
