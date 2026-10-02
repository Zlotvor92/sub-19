/* POVRATAK SA OAuth-a (Strava i intervals.icu). Oba se vraćaju na ISTU adresu sa `?code=`; razlikuju se po tome čiji `state` je sačuvan
   pri pokretanju — svaki čuva svoj ključ i briše ga pri proveri, pa jedan povratak ne može da potroši tuđ state.

   CSRF zaštita: bez `state` napadač može da pošalje link `…/?code=NJEGOV_KOD` i aplikacija bi se povezala na NJEGOV nalog i počela da
   uvlači njegove treninge kao tvoje. `state` je kriptografski nasumičan niz koji se pravi pre odlaska i proverava po povratku (jednokratno,
   rok 10 minuta). Skladište je trajno (ne `sessionStorage`): PWA na iOS-u ume da izgubi sesijsko skladište pri povratku sa spoljne stranice. */

import type { KeyValueStore } from './storage/kv';
import { ICU_STATE_KEY, STRAVA_STATE_KEY } from './storage/keys';

export const OAUTH_STATE_TTL_MS = 600_000;

export type OAuthKind = 'strava' | 'icu';

interface Saved {
  st?: unknown;
  exp?: unknown;
}

/** Pravi i pamti `state` za dati servis; vraća ga za ugradnju u adresu. */
export function makeOAuthState(
  kv: KeyValueStore,
  kind: OAuthKind,
  random: () => string,
  now: number
): string {
  const st = random();
  kv.set(
    kind === 'strava' ? STRAVA_STATE_KEY : ICU_STATE_KEY,
    JSON.stringify({ st, exp: now + OAUTH_STATE_TTL_MS })
  );
  return st;
}

/** Proverava `state` (jednokratno: ključ se briše bez obzira na ishod). */
export function checkOAuthState(
  kv: KeyValueStore,
  kind: OAuthKind,
  got: string,
  now: number
): boolean {
  const key = kind === 'strava' ? STRAVA_STATE_KEY : ICU_STATE_KEY;
  let saved: Saved | null = null;
  try {
    saved = JSON.parse(kv.get(key) || 'null') as Saved | null;
  } catch {
    saved = null;
  }
  kv.remove(key);
  if (!saved || typeof saved.st !== 'string' || !saved.st) return false;
  if (typeof saved.exp !== 'number' || now > saved.exp) return false;
  return got === saved.st;
}

export type OAuthReturn =
  | { kind: 'none' }
  | { kind: 'rejected'; service: OAuthKind | 'unknown' }
  | { kind: 'ok'; service: OAuthKind; code: string; scope: string };

/**
 * Šta je povratak: bez `code` nije ništa; sa `code` se po sačuvanom stanju odlučuje čiji je. Prvo se gleda intervals.icu (ako je njegov
 * state sačuvan i poklapa se), pa Strava.
 */
export function classifyOAuthReturn(search: string, kv: KeyValueStore, now: number): OAuthReturn {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search || '');
  } catch {
    return { kind: 'none' };
  }
  const code = q.get('code');
  if (!code) return { kind: 'none' };
  const scope = q.get('scope') || '';
  const got = q.get('state') || '';
  let icu: Saved | null = null;
  try {
    icu = JSON.parse(kv.get(ICU_STATE_KEY) || 'null') as Saved | null;
  } catch {
    icu = null;
  }
  if (icu && typeof icu.st === 'string' && icu.st && got === icu.st)
    return checkOAuthState(kv, 'icu', got, now)
      ? { kind: 'ok', service: 'icu', code, scope }
      : { kind: 'rejected', service: 'icu' };
  return checkOAuthState(kv, 'strava', got, now)
    ? { kind: 'ok', service: 'strava', code, scope }
    : { kind: 'rejected', service: 'strava' };
}

export const STRAVA_REJECTED_MESSAGE =
  'Povezivanje odbijeno — bezbednosna provera nije prošla.\n\nOvo se dešava ako si otvorio link za povezivanje sa strane, ili je prošlo previše vremena. Pokreni povezivanje ponovo iz Podešavanja.';
export const ICU_REJECTED_MESSAGE = 'Povezivanje odbijeno — bezbednosna provera nije prošla.';

export function stravaAuthorizeUrl(clientId: string, origin: string, state: string): string {
  return `https://www.strava.com/oauth/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(`${origin}/`)}&approval_prompt=auto&scope=activity:read_all&state=${encodeURIComponent(state)}`;
}
