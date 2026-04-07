const CACHE_NAME = 'app-shell-v6';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v6';

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
  let data = { title: 'Notification', body: '', reminderId: null };
  if (event.data) {
    try {
      data = { reminderId: null, ...event.data.json() };
    } catch {
      data = {
        title: 'Notification',
        body: event.data.text() || '',
        reminderId: null,
      };
    }
  }
  const options = {
    body: data.body,
    icon: '/icons/icon-128x128.png',
    badge: '/icons/icon-48x48.png',
    data: { reminderId: data.reminderId },
  };
  if (data.reminderId != null) {
    options.actions = [
      { action: 'snooze', title: 'Snooze for 5 minutes' },
    ];
  }
  event.waitUntil(
    self.registration.showNotification(data.title, options),
  );
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  if (action === 'snooze') {
    const reminderId = notification.data?.reminderId;
    const url = new URL('/snooze', self.location.origin);
    if (reminderId != null) url.searchParams.set('reminderId', String(reminderId));
    event.waitUntil(
      fetch(url.toString(), { method: 'POST' })
        .then(() => notification.close())
        .catch((err) => console.error('Snooze failed:', err)),
    );
  } else {
    notification.close();
  }
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
