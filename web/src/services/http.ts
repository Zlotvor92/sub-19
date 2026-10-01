/* HTTP SLOJ. Jedini način da kod ove aplikacije izađe na mrežu: komponente ne zovu `fetch`.

   Principi (svi iz iskustva starog koda, v. docs/API_INVENTORY.md):
   - SVAKI poziv ima rok. Bez roka, zavisla veza (tunel, avion) drži ekran „Povlačim…" zauvek. Pozivi ka našem
     `/api/` imaju duži rok (server zove Gemini/intervals.icu), ostali kratak.
   - Očekivani otkazi (nema mreže, 5xx, 429, HTML umesto JSON-a) NISU izuzeci nego VREDNOSTI: `Result`. Izuzetak je
     za greške programera. Stari kod je imao neuhvaćena odbijena obećanja iz rukovaoca dugmeta.
   - Odgovor prolazi kroz Zod šemu PRE nego što stigne do store-a. */

import type { z } from 'zod';

export const NET_TIMEOUT = { fast: 12_000, long: 70_000 } as const;

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export type FailureKind =
  /** Nema veze, rok istekao, prekinuto. */
  | 'network'
  /** Server je odgovorio sa greškom (4xx/5xx). */
  | 'http'
  /** Telo nije JSON (posrednik, greška platforme, prazno telo). */
  | 'parse'
  /** JSON je stigao, ali nije oblik koji klijent poznaje. */
  | 'schema';

export interface Failure {
  ok: false;
  kind: FailureKind;
  /** HTTP status, kad postoji. */
  status?: number;
  /** Poruka servera (`{error}`) ili kratak opis; spremna za prikaz. */
  error: string;
}

export type Success<T> = { ok: true; data: T; status: number };
export type Result<T> = Success<T> | Failure;

/** `AbortSignal.timeout` postoji od Chrome 103 / Safari 16; stariji dobijaju isti efekat preko kontrolera. */
export function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function')
      return AbortSignal.timeout(ms);
    if (typeof AbortController === 'function') {
      const c = new AbortController();
      const t: unknown = setTimeout(() => {
        try {
          c.abort();
        } catch {
          /* već prekinuto */
        }
      }, ms);
      (t as { unref?: () => void } | undefined)?.unref?.();
      return c.signal;
    }
  } catch {
    /* bez roka — kao da ga nema, ništa se ne pogoršava */
  }
  return undefined;
}

const isApiPath = (url: string): boolean => /^\/api\//.test(url);

/** Zamena za `fetch` svuda: poziv koji sam donese `signal` zadržava svoj. */
export function fetchWithTimeout(
  fetcher: Fetcher,
  url: string,
  init: RequestInit = {},
  ms?: number
): Promise<Response> {
  const o: RequestInit = { ...init };
  if (!o.signal) {
    const s = timeoutSignal(
      ms && ms > 0 ? ms : isApiPath(url) ? NET_TIMEOUT.long : NET_TIMEOUT.fast
    );
    if (s) o.signal = s;
  }
  return fetcher(url, o);
}

export const networkFailure = (error = 'Nema veze sa serverom.'): Failure => ({
  ok: false,
  kind: 'network',
  error
});

/** Poruka iz `{error}` ili `{message}` tela greške. */
export function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    for (const k of ['error', 'message', 'msg', 'error_description']) {
      const v = o[k];
      /* `detail` je dijagnostika servera uz grešku (npr. telo odgovora intervals.icu pri 502). */
      if (typeof v === 'string' && v)
        return k === 'error' && typeof o['detail'] === 'string' && o['detail']
          ? `${v} — ${o['detail']}`
          : v;
    }
  }
  return fallback;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  /** Rok u ms; podrazumevano po putanji (`/api/` dug, ostalo kratak). */
  timeoutMs?: number;
}

/** Čita telo kao JSON (nikad ne baca). Kad telo nije JSON, vraća sirov tekst — stranica greške posrednika ili platforme govori više od statusa. */
export async function readJson(
  res: Response
): Promise<{ ok: true; value: unknown } | { ok: false; text: string }> {
  let text = '';
  try {
    text = await res.text();
  } catch {
    return { ok: false, text: '' };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, text };
  }
}

/**
 * Poruka za grešku čije telo NIJE JSON (server je pao ili je odgovorila stranica posrednika). „Request failed with status 502" i slični tekstovi
 * ne znače korisniku ništa i kriju pravi uzrok, pa svaki slučaj dobija rečenicu koja kaže šta da se uradi.
 */
export function httpErrorText(status: number, text: string): string {
  if (status === 401) return 'Nisi prijavljen — prijavi se ponovo.';
  if (status === 404) return 'Serverska putanja ne postoji (proveri da su fajlovi u api/ folderu).';
  const short = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `Server je vratio grešku (${status})${short ? `: ${short}` : ''}`;
}

/**
 * JSON poziv sa proverom oblika. NIKAD ne baca: mreža, status, telo i oblik se vraćaju kao `Failure` sa
 * poukom koja ostaje (npr. 5xx se razlikuje od 4xx jer se 5xx ponavlja, a 4xx ne).
 */
export async function requestJson<T>(
  fetcher: Fetcher,
  url: string,
  schema: z.ZodType<T>,
  opts: RequestOptions = {}
): Promise<Result<T>> {
  const init: RequestInit = { method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST') };
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) {
    headers['Content-Type'] ??= 'application/json';
    init.body = JSON.stringify(opts.body);
  }
  init.headers = headers;
  let res: Response;
  try {
    res = await fetchWithTimeout(fetcher, url, init, opts.timeoutMs);
  } catch {
    return networkFailure();
  }
  const body = await readJson(res);
  if (!res.ok) {
    const msg = body.ok
      ? errorMessage(body.value, `Greška ${res.status}`)
      : httpErrorText(res.status, body.text);
    return { ok: false, kind: 'http', status: res.status, error: msg };
  }
  if (!body.ok)
    return {
      ok: false,
      kind: 'parse',
      status: res.status,
      error: 'Server nije vratio ispravan odgovor.'
    };
  const parsed = schema.safeParse(body.value);
  if (!parsed.success)
    return {
      ok: false,
      kind: 'schema',
      status: res.status,
      error: 'Odgovor servera nije u očekivanom obliku.'
    };
  return { ok: true, data: parsed.data, status: res.status };
}
