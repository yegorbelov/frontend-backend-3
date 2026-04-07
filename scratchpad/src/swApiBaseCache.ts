import { getServerBase } from './serverBase';

const SW_META_CACHE = 'scratchpad-sw-meta-v1';

/** Lets the service worker POST /snooze to the real API host (e.g. :3001), not the static file host (:5174). */
export async function persistApiBaseForServiceWorker(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const base = getServerBase();
  try {
    const cache = await caches.open(SW_META_CACHE);
    const keyUrl = new URL('/__sw_meta__/api-base', window.location.origin).href;
    await cache.put(
      new Request(keyUrl),
      new Response(JSON.stringify({ base }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  } catch {
    /* ignore */
  }
}
