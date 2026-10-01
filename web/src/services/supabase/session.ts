/* SESIJA PRIJAVLJENOG KORISNIKA (Supabase Auth, Google). Drži tokene, osvežava ih i odlučuje kada je sesija MRTVA.

   Oblik u skladištu je isti kao u starom kodu (ključ `sub19_sb`, srpska polja) — korisnik koji je već prijavljen ne
   sme da se odjavi pri prelasku na novi frontend.

   Pravila (v. `lib/auth.ts` za čiste delove):
   - JEDAN REFRESH U ISTOM TRENUTKU, MA KOLIKO IH TRAŽILO. Pri pokretanju se `ensure` zove iz pet-šest mesta gotovo
     istovremeno; Supabase ROTIRA refresh token: prvi poziv ga potroši i izda nov, a svaki sledeći sa istim, već
     potrošenim tokenom dobija 400 — što bi se čitalo kao „nalog ne postoji" i spustilo kapiju.
   - MRTVA SESIJA ≠ NEMA SIGNALA. Samo izričito 400/401/403 na refresh obara sesiju; mreža i 5xx ne dira ništa.
   - 401 na `/auth/v1/user` NIJE „nalog ne postoji": token važi sat vremena, a PWA stoji u pozadini danima. Zato se
     prvo osveži, pa se poziv ponovi, i tek ako refresh bude izričito odbijen sesija pada. Zabrana se prepoznaje po
     tekstu odgovora i odmah se prijavljuje. */

import {
  identityFromUser,
  isBannedResponse,
  jwtClaims,
  mergeIdentity,
  refreshVerdict,
  tokenNeedsRefresh
} from '../../lib/auth';
import { SB_KEY } from '../storage/keys';
import type { KeyValueStore } from '../storage/kv';
import { fetchWithTimeout, readJson, type Fetcher } from '../http';
import { RefreshResponse } from '../api/schemas';

/** Stanje sesije — imena polja su deo skladišnog ugovora (ne preimenovati). */
export interface SessionState {
  access: string | null;
  refresh: string | null;
  expiresAt: number;
  email: string | null;
  userId: string | null;
  /** URL slike profila (samo https). */
  slika: string | null;
  ime: string | null;
  /** `updated_at` poslednjeg zapisa na serveru koji je OVAJ uređaj video. */
  seenAt: string | null;
  deviceId: string | null;
}

export const emptySession = (deviceId: string | null): SessionState => ({
  access: null,
  refresh: null,
  expiresAt: 0,
  email: null,
  userId: null,
  slika: null,
  ime: null,
  seenAt: null,
  deviceId
});

export interface SessionDeps {
  kv: KeyValueStore;
  fetcher: Fetcher;
  supabaseUrl: string;
  anonKey: string;
  now?: () => number;
  /** Nasumičan sufiks za ID uređaja. */
  random?: () => string;
  /** Sesija je odbačena (nalog obrisan/zabranjen ili refresh odbijen). `message` je za prikaz. */
  onDead?: (message: string | undefined) => void;
  /** Pozadinski radnik treba da zna novu sesiju / da je zaboravi. */
  onChanged?: (state: SessionState) => void;
}

export const DEAD_SESSION_MESSAGE =
  'Nalog više ne postoji ili je sesija istekla. Podaci na ovom uređaju su netaknuti — prijavi se da nastaviš.';
export const BANNED_MESSAGE =
  'Pristup ovom nalogu je zabranjen. Podaci na ovom uređaju su netaknuti. Ako misliš da je greška, javi se vlasniku aplikacije.';

export interface SessionManager {
  readonly state: SessionState;
  /** Ima li konfigurisan nalog (URL + ključ). */
  isConfigured(): boolean;
  /** Nalog POSTOJI i ima važeći pristupni token. */
  isAuthed(): boolean;
  /** Nalog postoji (refresh token) — kapija propušta i bez signala. */
  hasSession(): boolean;
  /** Važeći pristupni token ili prazan string. */
  token(): Promise<string>;
  /** Drži token svežim: `true` ako se sme zvati server. Jedan refresh u letu. */
  ensure(): Promise<boolean>;
  /** Pita server da li nalog još postoji (pri pokretanju i povratku). `false` = sesija je pala. */
  verify(online?: boolean): Promise<boolean>;
  /** Upisuje delimične izmene (npr. `seenAt`) i čuva. */
  patch(p: Partial<SessionState>): void;
  /** Usvaja tokene iz povratka sa prijave. */
  adopt(tokens: { access: string; refresh: string | null; expiresAt: number }): void;
  logout(): void;
  /** Odbacuje sesiju (token), zadržava `deviceId`. NE briše lokalne podatke. */
  markDead(message?: string): void;
}

export function createSessionManager(deps: SessionDeps): SessionManager {
  const now = deps.now ?? Date.now;
  const random = deps.random ?? (() => Math.random().toString(36).slice(2, 10));
  let state: SessionState = emptySession(null);
  let refreshing: Promise<boolean> | null = null;

  try {
    const raw = deps.kv.get(SB_KEY);
    if (raw) state = { ...state, ...(JSON.parse(raw) as Partial<SessionState>) };
  } catch {
    /* oštećena sesija = odjavljen; stanje podataka se ne dira */
  }

  const persist = (): void => {
    deps.kv.set(SB_KEY, JSON.stringify(state));
    try {
      deps.onChanged?.(state);
    } catch {
      /* IndexedDB pad ne sme da zaustavi sinhronizaciju u prvom planu */
    }
  };
  if (!state.deviceId) {
    state = { ...state, deviceId: `d${random()}` };
    persist();
  }

  const configured = (): boolean => !!(deps.supabaseUrl && deps.anonKey);
  const isAuthed = (): boolean => configured() && !!state.access && !!state.userId;
  const hasSession = (): boolean => configured() && !!state.userId && !!state.refresh;

  const absorbIdentity = (idn: { picture: string | null; name: string | null }): boolean => {
    const r = mergeIdentity({ picture: state.slika, name: state.ime }, idn);
    if (r.changed) state = { ...state, slika: r.value.picture ?? null, ime: r.value.name ?? null };
    return r.changed;
  };
  const absorbFromToken = (): boolean => {
    if (!state.access) return false;
    const c = jwtClaims(state.access);
    return absorbIdentity({ picture: c.picture, name: c.name });
  };

  const markDead = (message?: string): void => {
    if (!state.access) return; // već očišćeno
    state = emptySession(state.deviceId);
    persist();
    deps.onDead?.(message ?? DEAD_SESSION_MESSAGE);
  };

  const refreshNow = (): Promise<boolean> => {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const res = await fetchWithTimeout(
          deps.fetcher,
          `${deps.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
          {
            method: 'POST',
            headers: { apikey: deps.anonKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: state.refresh })
          }
        );
        const verdict = refreshVerdict(res.status);
        if (verdict === 'dead') {
          markDead();
          return false;
        }
        if (verdict !== 'ok') return false; // nepoznato: sesija OSTAJE
        const body = await readJson(res);
        const parsed = body.ok ? RefreshResponse.safeParse(body.value) : null;
        if (!parsed?.success) return false;
        state = {
          ...state,
          access: parsed.data.access_token,
          refresh: parsed.data.refresh_token || state.refresh,
          expiresAt: now() + (parsed.data.expires_in || 3600) * 1000
        };
        /* Ime i slika se čitaju iz SVAKOG novog tokena, ne samo pri prijavi: bez toga bi ih dobio samo onaj ko se
           prijavio posle verzije koja je to počela da čita — svi zatečeni bi doveka imali prazan avatar. */
        absorbFromToken();
        persist();
        return true;
      } catch {
        return false; // mreža — sesija se NE dira
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  };

  const ensure = async (): Promise<boolean> => {
    if (!isAuthed()) return false;
    if (!tokenNeedsRefresh(state.expiresAt, now())) return true;
    if (!state.refresh) return false;
    return refreshNow();
  };

  const callUser = (): Promise<Response> =>
    fetchWithTimeout(deps.fetcher, `${deps.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: deps.anonKey, Authorization: `Bearer ${state.access ?? ''}` }
    });

  const verify = async (online = true): Promise<boolean> => {
    if (!isAuthed() || !online) return true;
    /* Ako je token istekao, osveži ga PRE pitanja. Kad osvežavanje padne zbog mreže, sesija ostaje. */
    if (!(await ensure())) return isAuthed();
    try {
      let res = await callUser();
      if (res.status === 401 || res.status === 403) {
        let banned = isBannedResponse(await safeBody(res));
        if (!banned) {
          /* Drugi pokušaj: token je mogao biti star uprkos `expiresAt` (sat uređaja ume da odluta). */
          if (!(await refreshNow())) return isAuthed();
          res = await callUser();
          if (res.status === 401 || res.status === 403)
            banned = isBannedResponse(await safeBody(res));
        }
        if (res.status === 401 || res.status === 403) {
          markDead(banned ? BANNED_MESSAGE : DEAD_SESSION_MESSAGE);
          return false;
        }
      }
      if (res.ok) {
        const body = await readJson(res);
        if (body.ok && absorbIdentity(identityFromUser(body.value))) persist();
      }
      return true;
    } catch {
      return true; // mreža — ne dira se ništa
    }
  };

  return {
    get state() {
      return state;
    },
    isConfigured: configured,
    isAuthed,
    hasSession,
    async token() {
      try {
        return (await ensure()) ? (state.access ?? '') : '';
      } catch {
        return '';
      }
    },
    ensure,
    verify,
    patch(p) {
      state = { ...state, ...p };
      persist();
    },
    adopt(tokens) {
      const claims = jwtClaims(tokens.access);
      state = {
        ...state,
        access: tokens.access,
        refresh: tokens.refresh,
        expiresAt: tokens.expiresAt,
        email: claims.email,
        userId: claims.userId,
        slika: claims.picture ?? state.slika,
        ime: claims.name ?? state.ime,
        seenAt: null
      };
      persist();
    },
    logout() {
      state = emptySession(state.deviceId);
      persist();
    },
    markDead
  };
}

async function safeBody(res: Response): Promise<unknown> {
  const b = await readJson(res);
  return b.ok ? b.value : null;
}
