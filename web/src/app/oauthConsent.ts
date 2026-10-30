/* ZAHTEV ZA ODOBRENJE KOJI ČEKA (Claude konektor, v. `services/supabase/oauthServer.ts`).

   Supabase šalje korisnika na `<Site URL><Authorization Path>?authorization_id=…`. Authorization Path je `/`: tako
   stiže na koren aplikacije koji Vercel već služi, bez nove putanje i bez izmene `vercel.json` (njega drži test
   `deploy/cutover.node.test.ts`). Ako korisnik nije prijavljen, prijava ide preko Google-a i vraća se na `/?sbn=…`, pa
   se `authorization_id` pamti u sessionStorage-u i preživljava taj krug u istoj kartici. Supabase zahtev ističe posle
   10 minuta (`authorization_ttl`); posle `CONSENT_WINDOW_MS` se zaboravlja i ovde. */

import { OAUTH_CONSENT_KEY } from '../services/storage/keys';

/** Ista vrednost stoji u Supabase-u: Authentication → OAuth Server → Authorization Path. */
export const OAUTH_CONSENT_PATH = '/';
export const CONSENT_WINDOW_MS = 10 * 60 * 1000;

/** Supabase daje 32 alfanumerička znaka; dozvoljeni su samo neutralni znakovi adrese (ID se i kodira pri pozivu). */
const VALID_ID = /^[A-Za-z0-9._~-]{8,256}$/;

type SessionStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Na korenu sa `authorization_id` upisuje zahtev i vraća `true` (pozivalac čisti adresu); inače ne radi ništa. */
export function captureConsent(
  loc: { pathname: string; search: string },
  store: SessionStore,
  now: number
): boolean {
  if ((loc.pathname || '/') !== OAUTH_CONSENT_PATH) return false;
  const params = new URLSearchParams(loc.search);
  if (!params.has('authorization_id')) return false;
  const id = params.get('authorization_id') ?? '';
  try {
    if (VALID_ID.test(id))
      store.setItem(OAUTH_CONSENT_KEY, JSON.stringify({ id, exp: now + CONSENT_WINDOW_MS }));
  } catch {
    /* privatni režim bez skladišta: zahtev se gubi, Claude ga ponavlja */
  }
  return true;
}

export function pendingConsent(store: SessionStore, now: number): string | null {
  try {
    const v = JSON.parse(store.getItem(OAUTH_CONSENT_KEY) ?? 'null') as {
      id?: unknown;
      exp?: unknown;
    } | null;
    if (v && typeof v.id === 'string' && VALID_ID.test(v.id) && typeof v.exp === 'number') {
      if (v.exp > now) return v.id;
      store.removeItem(OAUTH_CONSENT_KEY);
    }
  } catch {
    /* oštećen zapis = nema zahteva */
  }
  return null;
}

export function clearConsent(store: SessionStore): void {
  try {
    store.removeItem(OAUTH_CONSENT_KEY);
  } catch {
    /* privatni režim */
  }
}
