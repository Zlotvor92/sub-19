/* PREGLEDAČ iza priključaka: jedino mesto koje dodiruje `navigator.serviceWorker`, `PushManager`, `Notification` i `indexedDB`. */

import type { SyncRegistration } from './background';
import { createIdb } from './idb';
import type { PushBrowser, PushRegistration, Permission } from '../services/push/push';

type Registration = PushRegistration & SyncRegistration;

/** `navigator.serviceWorker.ready` NIKAD ne odbija — ako registracije nema, samo visi zauvek. Bez roka bi svako mesto koje ga čeka tiho stalo. */
export function swReady(timeoutMs = 4000): Promise<Registration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator))
    return Promise.resolve(null);
  return Promise.race([
    navigator.serviceWorker.ready.then((r) => r as unknown as Registration).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
  ]);
}

export function browserPush(): PushBrowser {
  const nav = typeof navigator === 'undefined' ? null : navigator;
  const permission = (): Permission => {
    try {
      return 'Notification' in window ? Notification.permission : 'unsupported';
    } catch {
      return 'unsupported';
    }
  };
  return {
    supported: () =>
      !!nav && 'serviceWorker' in nav && 'PushManager' in window && 'Notification' in window,
    isIos: () => /iPad|iPhone|iPod/.test(nav?.userAgent ?? ''),
    permission,
    async requestPermission() {
      return await Notification.requestPermission();
    },
    registration: (ms) => swReady(ms)
  };
}

export async function periodicPermission(): Promise<string | null> {
  try {
    if (!navigator.permissions?.query) return null;
    const st = await navigator.permissions.query({
      name: 'periodic-background-sync' as PermissionName
    });
    return st.state;
  } catch {
    return null;
  }
}

export function browserPwa() {
  return {
    idb: createIdb(typeof indexedDB === 'undefined' ? undefined : indexedDB),
    registration: swReady,
    periodicPermission,
    push: browserPush()
  };
}
