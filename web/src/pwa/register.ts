/* REGISTRACIJA I ŽIVOTNI CIKLUS service workera u pregledaču. Tanak sloj nad `updates.ts` (koji je proveren bez pregledača).

   `sw-reg.js` ga registruje PRVI, iz <head>, pre svega ostalog (registracija ne sme da čeka na ceo paket). Ovde je `register()` idempotentan:
   isti poziv vraća ISTU registraciju, ne pravi drugu. Provera nove verzije na sat vremena NE VRTI SE dok je aplikacija u pozadini (budjenje bi samo
   trošilo bateriju): kad se aplikacija vrati u prvi plan, proveri se odmah, i interval se ponovo pokreće. */

import { useUpdateStore } from './updateStore';
import {
  swState,
  refreshApp,
  watchUpdates,
  type RegistrationLike,
  type SwState,
  type SwStateEnv,
  type RefreshOutcome
} from './updates';

export const CHECK_EVERY_MS = 60 * 60 * 1000;

function swEnv(): SwStateEnv {
  return {
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    cacheKeys: () => caches.keys(),
    getRegistration: () =>
      navigator.serviceWorker
        .getRegistration()
        .then((r) => (r as unknown as RegistrationLike | undefined) ?? null),
    controller: () => navigator.serviceWorker.controller,
    onMessage: (listener) => {
      const handler = (ev: MessageEvent): void => listener(ev.data);
      navigator.serviceWorker.addEventListener('message', handler);
      return () => navigator.serviceWorker.removeEventListener('message', handler);
    },
    timeout: (ms, fn) => void setTimeout(fn, ms)
  };
}

export const readSwState = (): Promise<SwState> => swState(swEnv());

export function refreshFromUi(
  appVersion: string,
  label?: (text: string) => void
): Promise<RefreshOutcome> {
  return refreshApp({
    ...swEnv(),
    reloadPage: () => window.location.reload(),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    appVersion,
    ...(label ? { label } : {})
  });
}

export interface RegisterOptions {
  /** Poruka „analiza je gotova" stigla dok je aplikacija otvorena: pokupi je odmah. */
  onAiPush(): void;
}

export function startServiceWorker(opts: RegisterOptions): void {
  if (!('serviceWorker' in navigator)) return;
  /* Isti uslov kao u sw-reg.js: service worker radi samo na https ili localhost. */
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  void navigator.serviceWorker
    .register('./sw.js')
    .then((registration) => {
      const reg = registration as unknown as RegistrationLike;
      const track = (): void =>
        watchUpdates(
          reg,
          () => !!navigator.serviceWorker.controller,
          (w) => useUpdateStore.getState().offer(w)
        );
      track();
      void reg.update();
      let timer: ReturnType<typeof setInterval> | null = null;
      const stop = (): void => {
        if (timer) clearInterval(timer);
        timer = null;
      };
      const start = (): void => {
        stop();
        timer = setInterval(() => {
          void reg.update();
          track();
        }, CHECK_EVERY_MS);
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void reg.update();
          track();
          start();
        } else stop();
      });
      if (document.visibilityState !== 'hidden') start();
    })
    .catch(() => undefined); // aplikacija radi i bez service workera, samo bez offline režima
  /* Push koji je stigao dok je aplikacija OTVORENA ne izlazi kao obaveštenje nego kao poruka (v. `tiho` u sw.js): „analiza je gotova" se pokupi odmah. */
  navigator.serviceWorker.addEventListener('message', (ev: MessageEvent) => {
    const d = ev.data as { type?: string; poruka?: { oznaka?: string } } | null;
    if (d?.type === 'PUSH' && d.poruka?.oznaka === 'ai') opts.onAiPush();
  });
}
