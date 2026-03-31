const CACHE_NAME = 'scratchpad-cache-v6';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/48.png',
  '/icons/152.png',
  '/icons/192.png',
  '/icons/512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) => cache.add(url).catch(() => undefined)),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response.ok) {
          const url = new URL(request.url);
          if (url.origin === self.location.origin) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
        }
        return response;
      } catch {
        const accept = request.headers.get('accept');
        if (accept?.includes('text/html')) {
          const fallback = await caches.match('/index.html');
          if (fallback) return fallback;
        }
        return Response.error();
      }
    })(),
  );
});
