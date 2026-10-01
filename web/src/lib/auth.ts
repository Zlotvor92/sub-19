/* SESIJA (Supabase Auth, Google): čiste funkcije oko tokena i odgovora servera.

   MRTVA SESIJA NIJE ISTO ŠTO I NEMA SIGNALA. Aplikacija je offline-first i mora da radi bez signala (na stazi,
   u teretani, u avionu), ali kad nalog VIŠE NE POSTOJI ili je sesija opozvana, aplikacija nastavlja da izgleda
   prijavljeno jer i sesija i podaci žive lokalno — čovek trenira misleći da mu se sve upisuje na server. Razlika
   se čita iz ODGOVORA SERVERA, ne iz činjenice da je poziv pao: izričito 400/401/403 na refresh → sesija se
   odbacuje; mreža ili 5xx → ništa se ne zna, sesija OSTAJE. Zamena ta dva smera znači da te jedan tunel bez
   signala odjavi. */

/** Šta znači HTTP status odgovora na osvežavanje tokena. */
export type RefreshVerdict = 'ok' | 'dead' | 'unknown';

export function refreshVerdict(status: number): RefreshVerdict {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 400 || status === 401 || status === 403) return 'dead';
  return 'unknown';
}

/** Pristupni token važi do isteka; minut ranije se već osvežava. */
export const TOKEN_REFRESH_MARGIN_MS = 60_000;

export const tokenNeedsRefresh = (expiresAt: number, now: number): boolean =>
  now >= expiresAt - TOKEN_REFRESH_MARGIN_MS;

export interface AuthTokens {
  access: string;
  refresh: string | null;
  expiresAt: number;
}

/** Google vraća tokene u hash-u URL-a (`#access_token=…`); Strava koristi `?code=` — ne sudaraju se. */
export function parseAuthHash(hash: string | null | undefined, now: number): AuthTokens | null {
  if (!hash || hash.indexOf('access_token') < 0) return null;
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const access = q.get('access_token');
  if (!access) return null;
  /* `expires_in=abc` je u starom kodu davao NaN rok, a `now < NaN` je uvek netačno: token bi se osvežavao pri
     svakom pozivu. Neupotrebljiv rok pada na podrazumevani sat vremena (docs/ENGINE_CHANGES.md, A5). */
  const n = parseInt(q.get('expires_in') || '3600', 10);
  return {
    access,
    refresh: q.get('refresh_token') || null,
    expiresAt: now + (Number.isFinite(n) && n > 0 ? n : 3600) * 1000
  };
}

export interface Identity {
  email: string | null;
  userId: string | null;
  /** SAMO https: vrednost ide pravo u `img src`, a token ne mora doći od Googlea. */
  picture: string | null;
  name: string | null;
}

const asObject = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' ? (x as Record<string, unknown>) : {};

function pictureOf(meta: Record<string, unknown>): string | null {
  const p = meta['avatar_url'] || meta['picture'] || null;
  return typeof p === 'string' && /^https:\/\//.test(p) ? p : null;
}
function nameOf(meta: Record<string, unknown>): string | null {
  return (
    (typeof meta['full_name'] === 'string' && meta['full_name']) ||
    (typeof meta['name'] === 'string' && meta['name']) ||
    null
  );
}

/**
 * Email, id, ime i slika iz JWT-a — bez dodatnog kruga ka serveru. `atob` radi nad bajtovima; mejl sa
 * ćirilicom ili umlautom se čita preko `TextDecoder` (stari `escape()` ga je izobličavao).
 */
export function jwtClaims(jwt: string | null | undefined): Identity {
  const empty: Identity = { email: null, userId: null, picture: null, name: null };
  try {
    const p = (jwt as string).split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (p == null) return empty;
    const raw = atob(p + '==='.slice((p.length + 3) % 4));
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    const j = asObject(JSON.parse(new TextDecoder('utf-8').decode(bytes)));
    const meta = asObject(j['user_metadata']);
    return {
      email: (j['email'] as string) || null,
      userId: (j['sub'] as string) || null,
      picture: pictureOf(meta),
      name: nameOf(meta)
    };
  } catch {
    return empty;
  }
}

/**
 * Ime i slika iz odgovora `/auth/v1/user`. `user_metadata` je jedini pouzdan izvor: JWT ga NOSI ILI NE NOSI,
 * zavisno od verzije GoTrue-a i toga šta je Google vratio — pa se ne oslanja samo na token.
 */
export function identityFromUser(u: unknown): { picture: string | null; name: string | null } {
  const meta = asObject(asObject(u)['user_metadata']);
  return { picture: pictureOf(meta), name: nameOf(meta) };
}

/** Upisuje SAMO neprazne vrednosti — prijava koja ih ne nosi ne sme da obriše ono što već radi. */
export function mergeIdentity<T extends { picture?: string | null; name?: string | null }>(
  current: T,
  next: { picture: string | null; name: string | null }
): { value: T; changed: boolean } {
  let changed = false;
  const value = { ...current };
  if (next.picture && next.picture !== current.picture) {
    value.picture = next.picture;
    changed = true;
  }
  if (next.name && next.name !== current.name) {
    value.name = next.name;
    changed = true;
  }
  return { value, changed };
}

/** Odgovor na `/auth/v1/user` 401/403: zabrana se prepoznaje po tekstu u telu (jedina razlika koja postoji). */
export const isBannedResponse = (body: unknown): boolean => {
  try {
    return /banned|zabran/i.test(JSON.stringify(body));
  } catch {
    return false;
  }
};

/**
 * PROVERA POVRATKA SA PRIJAVE (CSRF). Marker sam kaže samo „ovaj pregledač je nedavno krenuo u prijavu", ne i
 * CIJI je token stigao — zato se uz `redirect_to` šalje nasumičan `sbn`. NE `state=`: Supabase GoTrue taj naziv
 * koristi interno za svoju zaštitu prema Google-u i prijava bi završila sa `bad_oauth_state`.
 *
 * Četiri ishoda: stigao i poklapa se → prihvati i zapamti da nonce radi; stigao a ne poklapa se → ODBIJ;
 * nije stigao a aplikacija zna da inače radi → ODBIJ (neko ga je skinuo); nije stigao a to još nije videla →
 * prihvati po starom. Poslednji slučaj je jedini razlog za složenost: uvođenje ne sme da zaključa naloge ako
 * Supabase na ovom projektu odbacuje upit u `redirect_to`. Čim jedna prijava prođe sa nonce-om, downgrade
 * (izostavljanje parametra) više nije moguć.
 */
export function checkLoginReturn(
  saved: { st?: string; exp?: number } | null | undefined,
  gotNonce: string | null | undefined,
  nonceKnownToWork: boolean,
  now: number
): { accept: boolean; rememberNonceWorks: boolean } {
  const no = { accept: false, rememberNonceWorks: false };
  if (!saved || !saved.st) return no;
  if (saved.exp != null && now > saved.exp) return no;
  if (gotNonce) {
    if (gotNonce !== saved.st) return no;
    return { accept: true, rememberNonceWorks: true };
  }
  return { accept: !nonceKnownToWork, rememberNonceWorks: false };
}
