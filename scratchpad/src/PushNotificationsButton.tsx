import { useState, useEffect, useCallback } from 'react';
import {
  subscribeToPush,
  unsubscribeFromPush,
  hasActivePushSubscription,
} from './pushNotifications';

export function PushNotificationsButton() {
  const [pushActive, setPushActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const syncFromBrowser = useCallback(() => {
    void hasActivePushSubscription().then(setPushActive);
  }, []);

  useEffect(() => {
    syncFromBrowser();
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncFromBrowser();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [syncFromBrowser]);

  const handleEnable = useCallback(async () => {
    if (Notification.permission === 'denied') {
      window.alert(
        'Notifications are blocked. Enable them in your browser settings.',
      );
      return;
    }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        window.alert('Please allow notifications to enable this feature.');
        return;
      }
    }
    setBusy(true);
    const result = await subscribeToPush();
    setBusy(false);
    if (result.ok) {
      setPushActive(true);
    } else {
      window.alert(result.message);
      syncFromBrowser();
    }
  }, [syncFromBrowser]);

  const handleDisable = useCallback(async () => {
    setBusy(true);
    const result = await unsubscribeFromPush();
    setBusy(false);
    if (result.ok) {
      setPushActive(false);
    } else {
      window.alert(result.message);
      syncFromBrowser();
    }
  }, [syncFromBrowser]);

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  return (
    <div className='push-header-control'>
      {!pushActive ? (
        <button
          type='button'
          className='btn btn--header-push'
          disabled={busy}
          aria-busy={busy}
          aria-label='Enable notifications'
          onClick={() => void handleEnable()}
        >
          <img
            src={
              busy ? '/svg/BubbleLoading.svg' : '/svg/BellNotification.svg'
            }
            alt=''
            className={
              busy ? 'push-icon push-icon--loading' : 'push-icon push-icon--mono'
            }
            aria-hidden
            draggable={false}
          />
        </button>
      ) : (
        <button
          type='button'
          className='btn btn--header-push'
          disabled={busy}
          aria-busy={busy}
          aria-label='Disable notifications'
          onClick={() => void handleDisable()}
        >
          <img
            src={
              busy
                ? '/svg/BubbleLoading.svg'
                : '/svg/DisableBellNotification.svg'
            }
            alt=''
            className={
              busy ? 'push-icon push-icon--loading' : 'push-icon push-icon--mono'
            }
            aria-hidden
            draggable={false}
          />
        </button>
      )}
    </div>
  );
}
