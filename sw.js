/*
 * Al-Basar AI — offline-first application shell.
 * The service worker precaches the built HTML, its hashed JS/CSS bundles,
 * the web manifest and the install icons. Runtime fetches are then served
 * cache-first, so school screening continues with no network at all.
 */
const CACHE_PREFIX = 'albasar-app-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v17`;

const OPTIONAL_APP_SHELL_FILES = [
  './manifest.webmanifest',
  './pwa-icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch('./', { cache: 'reload' });
    if (!response.ok) throw new Error('Unable to cache the application shell.');
    await cache.put('./', response.clone());

    const html = await response.text();
    const assets = Array.from(html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^\"]*)?)"/g))
      .map((match) => new URL(match[1], self.location.href).href)
      .filter((url) => new URL(url).origin === self.location.origin);

    const optionalFiles = OPTIONAL_APP_SHELL_FILES.map((path) => new URL(path, self.location.href).href);

    await Promise.all([...assets, ...optionalFiles].map(async (url) => {
      try {
        const assetResponse = await fetch(url, { cache: 'reload' });
        if (assetResponse.ok) await cache.put(url, assetResponse);
      } catch {
        // An optional icon/manifest asset never blocks the offline shell.
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  // Keep all application traffic same-origin; Google Fonts remain optional.
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE_NAME)).put('./', response.clone());
        return response;
      } catch {
        return (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  if (/\.(?:js|css|svg|png|webmanifest)$/.test(new URL(request.url).pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) (await caches.open(CACHE_NAME)).put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })());
  }
});
