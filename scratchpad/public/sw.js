const CACHE_NAME = 'app-shell-v7';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v7';
const SW_META_CACHE = 'scratchpad-sw-meta-v1';
const SW_API_BASE_KEY = () =>
  new URL('/__sw_meta__/api-base', self.location.origin).href;

async function getSnoozeOrigin() {
  try {
    const cache = await caches.open(SW_META_CACHE);
    const res = await cache.match(SW_API_BASE_KEY());
    if (res) {
      const data = await res.json();
      const base = data && data.base;
      if (typeof base === 'string' && /^https?:\/\//i.test(base)) {
        return new URL(base).origin;
      }
    }
  } catch (e) {
    /* ignore */
  }
  return self.location.origin;
}

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
            .filter(
              (k) =>
                k !== CACHE_NAME &&
                k !== DYNAMIC_CACHE_NAME &&
                k !== SW_META_CACHE,
            )
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
    event.waitUntil(
      getSnoozeOrigin()
        .then((origin) => {
          const url = new URL('/snooze', origin);
          if (reminderId != null) {
            url.searchParams.set('reminderId', String(reminderId));
          }
          return fetch(url.toString(), { method: 'POST' });
        })
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
