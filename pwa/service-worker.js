/* global __PRECACHE__, __FILES__ */
/**
 * Service worker de ANOMALÍA (PWA, M7). Plantilla: el build (vite.config.ts) rellena las
 * cuatro constantes de abajo y la publica como `sw.js`.
 *
 * - Guarda al instalarse la app (HTML, JS y CSS, salvo el PDF): carga rápida y wifi floja.
 * - Los archivos con hash no cambian nunca: se sirven de caché. Así, si alguien publica una
 *   versión durante una clase, los móviles siguen teniendo los archivos de la suya.
 * - Las páginas van primero a la red (siempre la versión publicada) y, sin red, a la caché.
 * - Las imágenes y fuentes se guardan al usarlas y se renuevan en segundo plano.
 * - La música va siempre por streaming (peticiones por rangos): no se toca.
 * - Supabase y la IA están en otro origen: nunca pasan por aquí.
 * - Sin skipWaiting: una versión nueva solo toma el control al volver a abrir la app, nunca a
 *   mitad de partida.
 */
const BASE = '__BASE__';
const BUILD = '__BUILD__';
const PRECACHE = __PRECACHE__;
/** Todos los archivos con hash de esta versión (también los que no se guardan al instalar). */
const FILES = __FILES__;

const SHELL = `anomalia-shell-${BUILD}`;
const ASSETS = 'anomalia-assets';
const MEDIA = 'anomalia-media';
const HASHED = /\/assets\/[^/]+-[\w-]{8,}\.(?:js|css)$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // Un archivo que falle no impide instalar el resto: la app funciona igual sin él.
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))),
    ),
  );
});

// Al activarse ya no queda abierta ninguna pestaña de la versión anterior: se borra lo suyo.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('anomalia-shell-') && key !== SHELL)
          .map((key) => caches.delete(key)),
      );
      const assets = await caches.open(ASSETS);
      const current = new Set(FILES.map((file) => new URL(file, self.location.origin).href));
      const stored = await assets.keys();
      await Promise.all(
        stored
          .filter((request) => !current.has(request.url))
          .map((request) => assets.delete(request)),
      );
    })(),
  );
});

/** Primero la caché; si no está, la red (y se guarda para la próxima vez). */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

/** La caché al momento y, a la vez, una copia nueva para la próxima vez. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(MEDIA);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? fresh;
}

/** Las páginas, de la red; sin red, la app guardada (el enrutado lo hace React). */
async function networkFirstPage(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const shell = await caches.match(`${BASE}index.html`);
    if (shell) return shell;
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  } else if (HASHED.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSETS));
  } else if (/\.(?:webp|png|jpe?g|svg|ttf|woff2?)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
