/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const VERSION = 'v1';
const PRECACHE = `arcade-precache-${VERSION}`;
const STATIC_CACHE = `arcade-static-${VERSION}`;
const RUNTIME_CACHE = `arcade-runtime-${VERSION}`;
const PRECACHE_ASSETS = __PRECACHE_ASSETS__ as string[];

const scopeUrl = new URL(self.registration.scope);
const basePath = scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;

const normalizePath = (input: string): string => {
  const url = new URL(input, scopeUrl.origin + basePath);
  return `${url.pathname}${url.search}`;
};

const offlineFallbackPath = normalizePath('./index.html');

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      const assets = Array.from(new Set([normalizePath('./'), offlineFallbackPath, ...PRECACHE_ASSETS.map(normalizePath)]));
      await cache.addAll(assets);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => ![PRECACHE, STATIC_CACHE, RUNTIME_CACHE].includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached ?? networkPromise;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(offlineFallbackPath);
          if (offline) return offline;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })(),
    );
    return;
  }

  if (!sameOrigin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
    return;
  }

  const path = url.pathname;
  const staticAsset = /\.(?:js|css|html|json|webmanifest|svg|png|jpg|jpeg|webp|woff2|woff|ttf)$/i.test(path);
  const runtimeAsset = /\.(?:mp3|ogg|wav|m4a|aac|flac|webm|avif|gif|woff2|woff|ttf)$/i.test(path);

  if (staticAsset) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (runtimeAsset) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});
