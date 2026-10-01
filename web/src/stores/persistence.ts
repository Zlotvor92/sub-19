/* PERZISTENCIJA STORE-OVA — jedan `PersistedState`, sklopljen iz više store-ova.

   Šema (v11) je ugovor sa postojećim korisnicima i serverom: ne sme se deliti na više ključeva. Zato store-ovi drže
   SVOJE POLJE (training: log/pred/plan…, recovery: knee/kg/wellness…, settings: ui/veze, community: zajed), a ovaj modul
   ih sklapa u jedan objekat pri upisu i raspodeljuje pri učitavanju/usvajanju sa servera.

   Nepoznata polja prvog nivoa (novija verzija ih možda koristi) se ČUVAJU u `extras` i vraćaju pri sklapanju — stariji
   klijent ih ne sme brisati. */

import type { PersistedState } from '../domain/state';

export type PersistMode = 'now' | 'soon';
type Listener = (mode: PersistMode) => void;

const listeners = new Set<Listener>();
let suppressed = 0;

/** Okida upis (pun ili odložen — za polja u koja se kuca). Tokom `hydrate` se ne okida. */
export function requestPersist(mode: PersistMode = 'now'): void {
  if (suppressed > 0) return;
  for (const l of listeners) l(mode);
}

export function onPersistRequest(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Izvršava `fn` bez okidanja upisa (učitavanje stanja ne sme da se odmah upiše nazad). */
export function withoutPersist<T>(fn: () => T): T {
  suppressed++;
  try {
    return fn();
  } finally {
    suppressed--;
  }
}

/** Polja prvog nivoa koja drži pojedini store; sve ostalo ide u `extras`. */
export const TRAINING_KEYS = [
  'log',
  'pred',
  'predLock',
  'vdotLog',
  't3k',
  'moves',
  'alts',
  'genPlan'
] as const;
export const RECOVERY_KEYS = ['knee', 'kg', 'wellness', 'vanPlana'] as const;
export const SETTINGS_KEYS = ['ui', 'vreme', 'strava', 'icu'] as const;
export const COMMUNITY_KEYS = ['zajed'] as const;
export const KNOWN_KEYS: readonly string[] = [
  'v',
  ...TRAINING_KEYS,
  ...RECOVERY_KEYS,
  ...SETTINGS_KEYS,
  ...COMMUNITY_KEYS
];

export function pickKnown<T extends readonly (keyof PersistedState)[]>(
  s: PersistedState,
  keys: T
): Pick<PersistedState, T[number]> {
  const out: Partial<PersistedState> = {};
  for (const k of keys) (out as Record<string, unknown>)[k] = s[k];
  return out as Pick<PersistedState, T[number]>;
}

export function extrasOf(s: PersistedState): Record<string, unknown> {
  return Object.fromEntries(Object.entries(s).filter(([k]) => !KNOWN_KEYS.includes(k)));
}
