/* STRAVA API: direktno iz pregledača (`strava.com/api/v3`, bez našeg servera) sa korisnikovim access tokenom; osvežavanje i razmena koda
   idu preko `/api/auth` (server drži client secret). Tokeni žive SAMO na uređaju (`settings.strava`) i ne idu u backup ni na server.

   Principi: nijedan poziv ne baca — ishod je `Result`; 401 se jednom ponavlja posle prinudnog osvežavanja (token je mogao biti
   opozvan pre isteka); 429 ima svoju poruku (prozor od 15 minuta). Odgovor prolazi kroz Zod šemu pre nego što ga neko koristi. */

import { z } from 'zod';
import {
  fetchWithTimeout,
  networkFailure,
  readJson,
  errorMessage,
  type Fetcher,
  type Result
} from '../http';
import type { AppApi } from '../api/appApi';

export const STRAVA_API = 'https://www.strava.com/api/v3';
/** Osvežava se kad do isteka ostane manje od 5 min. */
export const TOKEN_MARGIN_MS = 300_000;

export type StravaLink = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export interface StravaLinkStore {
  get(): StravaLink | null;
  set(v: StravaLink | null): void;
}

const TokenResponse = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().optional().nullable(),
    expires_at: z.number()
  })
  .passthrough();

const ExchangeResponse = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().optional().nullable(),
    expires_at: z.number(),
    athlete: z
      .object({ firstname: z.string().nullish(), lastname: z.string().nullish() })
      .passthrough()
      .nullish()
  })
  .passthrough();

export interface StravaApi {
  /** GET nad `/api/v3` (osvežava token, ponavlja 401 jednom). Telo se NE proverava — pozivalac ga parsira. */
  get(path: string): Promise<Result<unknown>>;
  /** Razmena koda sa povratka sa Strave; uspeh upisuje vezu. */
  exchange(
    code: string,
    scope: string
  ): Promise<{ ok: true; athlete: string } | { ok: false; error: string }>;
}

export interface StravaApiDeps {
  accountKey?: () => string;
  fetcher: Fetcher;
  appApi: AppApi;
  link: StravaLinkStore;
  now: () => number;
}

export function createStravaApi(deps: StravaApiDeps): StravaApi {
  async function ensureToken(force = false): Promise<{ ok: true } | { ok: false; error: string }> {
    const owner = deps.accountKey?.();
    const link = deps.link.get();
    if (!link) return { ok: false, error: 'Strava nije povezana' };
    const expiresAt = typeof link['expiresAt'] === 'number' ? link['expiresAt'] : 0;
    if (!force && expiresAt * 1000 > deps.now() + TOKEN_MARGIN_MS) return { ok: true };
    const r = await deps.appApi.post(
      '/api/auth',
      { refresh_token: str(link['refresh']) },
      TokenResponse
    );
    if (!r.ok) return { ok: false, error: `Osvežavanje Strava tokena nije uspelo — ${r.error}` };
    if (deps.accountKey?.() !== owner) return { ok: false, error: 'Nalog je promenjen.' };
    deps.link.set({
      ...link,
      access: r.data.access_token,
      refresh: r.data.refresh_token || link['refresh'],
      expiresAt: r.data.expires_at
    });
    return { ok: true };
  }

  async function get(path: string, retried = false): Promise<Result<unknown>> {
    const t = await ensureToken(false);
    if (!t.ok) return { ok: false, kind: 'http', error: t.error };
    const access = str(deps.link.get()?.['access']);
    let res: Response;
    try {
      res = await fetchWithTimeout(deps.fetcher, `${STRAVA_API}${path}`, {
        headers: { Authorization: `Bearer ${access}` }
      });
    } catch {
      return networkFailure();
    }
    const body = await readJson(res);
    if (res.ok) {
      if (!body.ok)
        return {
          ok: false,
          kind: 'parse',
          status: res.status,
          error: 'Server nije vratio ispravan odgovor.'
        };
      return { ok: true, data: body.value, status: res.status };
    }
    const msg = body.ok
      ? errorMessage({ message: (body.value as { message?: unknown } | null)?.message }, '')
      : '';
    if (res.status === 401 && !retried) {
      /* istekao/opozvan access token — jedan forsirani refresh pa ponovi */
      const forced = await ensureToken(true);
      if (forced.ok) return get(path, true);
    }
    if (res.status === 429)
      return {
        ok: false,
        kind: 'http',
        status: 429,
        error: `Strava rate limit (429) — sačekaj do isteka 15-min prozora pa pokušaj ponovo${msg ? ` · ${msg}` : ''}`
      };
    const errors =
      body.ok && body.value && typeof body.value === 'object' && 'errors' in body.value
        ? ` · ${JSON.stringify(body.value.errors)}`
        : '';
    return {
      ok: false,
      kind: 'http',
      status: res.status,
      error: `Strava ${res.status}${msg ? ` — ${msg}` : ''}${errors}`
    };
  }

  return {
    get: (path) => get(path),
    async exchange(code, scope) {
      const owner = deps.accountKey?.();
      const r = await deps.appApi.getAuthed(
        `/api/auth?code=${encodeURIComponent(code)}`,
        ExchangeResponse
      );
      if (!r.ok) return { ok: false, error: r.error };
      if (deps.accountKey?.() !== owner) return { ok: false, error: 'Nalog je promenjen.' };
      const a = r.data.athlete;
      const athlete = a ? `${a.firstname ?? ''} ${a.lastname ?? ''}`.trim() : '';
      deps.link.set({
        access: r.data.access_token,
        refresh: r.data.refresh_token ?? undefined,
        expiresAt: r.data.expires_at,
        athlete,
        scope,
        lastSync: 0
      });
      return { ok: true, athlete };
    }
  };
}
