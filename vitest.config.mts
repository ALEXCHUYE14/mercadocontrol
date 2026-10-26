import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

// Pruebas puras de Node, sin el bundler de Next: por eso el alias se declara a mano
// (coincide con el "@/*" -> "./src/*" de tsconfig.json) y el entorno por defecto es
// 'node'. Los archivos que necesitan DOM real (tema) lo piden con
// `// @vitest-environment jsdom` en su propia cabecera.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    restoreMocks: true,
    // No lo desactives: varias pruebas dependen de que cada ARCHIVO tenga su propio
    // registro de módulos (p. ej. el caché de `ensureSeed` en seed.ts). Ver la nota de
    // aislamiento en tests/integration/db/seed.test.ts.
    isolate: true,
  },
  resolve: {
    alias: {
      '@': srcDir,
    },
  },
});
