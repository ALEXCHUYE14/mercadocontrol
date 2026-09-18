/* MercadoControl — Service Worker
 * Estrategia offline-first sencilla y robusta (sin dependencias de build):
 *  - Navegación (HTML): network-first con timeout corto y caída al caché/app shell,
 *    así siempre se sirve la última versión cuando hay red y sigue funcionando sin ella.
 *  - Estáticos (_next/static, iconos, manifest): stale-while-revalidate.
 *  - Todo lo demás (p. ej. la API de Supabase) NO se intercepta: los datos viven en
 *    IndexedDB (Dexie) y se sincronizan desde la app. Cachear respuestas autenticadas
 *    aquí las compartiría entre usuarios del mismo dispositivo.
 *  - Background Sync: al recuperar conexión, avisa a los clientes para que
 *    Dexie vacíe su cola de mutaciones hacia Supabase.
 */

const VERSION = 'v1.1.0';
const APP_SHELL = `mc-shell-${VERSION}`;
const STATIC = `mc-static-${VERSION}`;

const SHELL_URLS = ['/', '/inventario', '/mermas', '/cierre', '/remates', '/manifest.json'];
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL)
      // Un fallo puntual (p. ej. offline al instalar) no debe impedir la instalación
      .then((cache) => Promise.allSettled(SHELL_URLS.map((u) => cache.add(u))))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => ![APP_SHELL, STATIC].includes(k)).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // Las mutaciones van por Dexie + sync

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Terceros (Supabase, CDN…): sin intervenir

  // Navegación (documentos HTML): network-first con respaldo en caché
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetchWithTimeout(request, NAVIGATION_TIMEOUT_MS);
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(APP_SHELL).then((c) => c.put(request, copy)));
          }
          return res;
        } catch {
          return (
            (await caches.match(request)) ||
            (await caches.match('/')) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  // Estáticos: stale-while-revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return (await network) || Response.error();
      })()
    );
  }
});

// Background Sync: cuando vuelve la conexión, notifica a la app
self.addEventListener('sync', (event) => {
  if (event.tag === 'mc-sync-queue') {
    event.waitUntil(notifyClients('SYNC_NOW'));
  }
});

// Permite activar de inmediato una versión nueva del SW desde la app
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function notifyClients(type) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type });
}
