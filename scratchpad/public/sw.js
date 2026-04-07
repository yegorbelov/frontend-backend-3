const CACHE_NAME = 'app-shell-v5';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v5';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-16x16.png',
  '/icons/icon-32x32.png',
  '/icons/icon-48x48.png',
  '/icons/icon-64x64.png',
  '/icons/icon-128x128.png',
  '/icons/icon-256x256.png',
  '/icons/icon-512x512.png',
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
          keys
            .filter((k) => k !== CACHE_NAME && k !== DYNAMIC_CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Notification', body: '' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: 'Notification',
        body: event.data.text() || '',
      };
    }
  }
  const options = {
    body: data.body,
    icon: '/icons/icon-128x128.png',
    badge: '/icons/icon-48x48.png',
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/content/')) {
    event.respondWith(
      fetch(request)
        .then((networkRes) => {
          if (networkRes.ok) {
            const clone = networkRes.clone();
            caches
              .open(DYNAMIC_CACHE_NAME)
              .then((cache) => cache.put(request, clone));
          }
          return networkRes;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/content/home.html')),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
