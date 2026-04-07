import { getServerBase } from './serverBase';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function fetchVapidPublicKey(): Promise<string> {
  const base = getServerBase();
  const res = await fetch(`${base}/vapid-public`);
  if (!res.ok) throw new Error(`Could not load VAPID key (${res.status})`);
  const data = (await res.json()) as { publicKey?: string };
  if (!data.publicKey) throw new Error('Invalid VAPID response from server');
  return data.publicKey;
}

export type PushResult =
  | { ok: true }
  | { ok: false; message: string };

/** Ensures /sw.js is registered and active (Push requires a service worker). */
export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported');
  }
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

export async function subscribeToPush(): Promise<PushResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, message: 'Push notifications are not supported here.' };
  }

  let subscription: PushSubscription | null = null;

  try {
    const registration = await ensurePushServiceWorker();
    const publicKey = await fetchVapidPublicKey();
    const key = urlBase64ToUint8Array(publicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key.buffer.slice(
        key.byteOffset,
        key.byteOffset + key.byteLength,
      ) as ArrayBuffer,
    });
    const base = getServerBase();
    const res = await fetch(`${base}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    });
    if (!res.ok) {
      await subscription.unsubscribe().catch(() => undefined);
      return {
        ok: false,
        message: `Server rejected subscription (${res.status}). Is the backend running on ${base || 'this origin'}?`,
      };
    }
    console.log('Push subscription sent to server');
    return { ok: true };
  } catch (err) {
    if (subscription) {
      await subscription.unsubscribe().catch(() => undefined);
    }
    const message =
      err instanceof Error ? err.message : 'Could not enable notifications';
    console.error('Push subscribe error:', err);
    return { ok: false, message };
  }
}

export async function unsubscribeFromPush(): Promise<PushResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: true };
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { ok: true };
    const base = getServerBase();
    const res = await fetch(`${base}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `Could not remove subscription on server (${res.status}).`,
      };
    }
    await subscription.unsubscribe();
    console.log('Push subscription removed');
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not disable notifications';
    console.error('Push unsubscribe error:', err);
    return { ok: false, message };
  }
}
