import type { BrowserContext, Page, Route } from '@playwright/test';

/* LAŽNI BACKEND ZA E2E. Presreće SVE što aplikacija zove van svog izvora (Supabase, Strava, Open-Meteo) i naše `/api/*` (preview server ih nema), pa
   testovi rade bez mreže i bez tajni. Namerno je mali: oponaša samo ono što klijent koristi (`user_state` jedan red + istorija, osvežavanje tokena,
   `/auth/v1/user`) i beleži SVAKI zahtev, da testovi mogu da tvrde šta je poslato. Prava provera servera (RLS, JWT) je u `test/api.test.mjs`. */

export const SUPABASE = 'https://clnsxvtulvoeqakchydz.supabase.co';
const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url');
export const jwt = (email: string, sub = 'u-e2e'): string =>
  `${b64({ alg: 'none' })}.${b64({ sub, email })}.sig`;

export interface Recorded {
  method: string;
  url: string;
  body: unknown;
}
export interface Row {
  data: unknown;
  updated_at: string;
  device_id: string | null;
}
type ApiHandler = (
  req: Recorded
) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>;

export class Backend {
  /** Red `user_state` (jedan po korisniku). */
  row: Row | null = null;
  history: Array<{
    id: number;
    napravljeno: string;
    app_version: string;
    device_id: string;
    data: unknown;
  }> = [];
  readonly requests: Recorded[] = [];
  /** Odgovori na naše `/api/*` i strane servise, po prefiksu adrese (najduži prefiks pobeđuje). */
  readonly api = new Map<string, ApiHandler>();
  offline = false;
  private clock = Date.UTC(2026, 0, 14, 9, 0, 0);

  count(match: string | RegExp, method?: string): number {
    return this.requests.filter(
      (r) =>
        (method == null || r.method === method) &&
        (typeof match === 'string' ? r.url.includes(match) : match.test(r.url))
    ).length;
  }

  /** Zahtevi se obrađuju JEDAN PO JEDAN, redom kako stižu: pravi server ih meša, ali test mora da bude ponovljiv, a stari klijent ima trku između upisa i provere. */
  private queue: Promise<unknown> = Promise.resolve();
  handle(route: Route): Promise<void> {
    const run = this.queue.then(() => this.handleNow(route));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async handleNow(route: Route): Promise<void> {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    let body: unknown;
    try {
      body = req.postDataJSON();
    } catch {
      body = req.postData();
    }
    /* Predprovera CORS-a (OPTIONS) ne zanima aplikaciju — odgovara se prazno, bez beleženja. */
    if (method === 'OPTIONS') return void (await route.fulfill({ status: 204, headers: cors }));
    const rec: Recorded = { method, url, body };
    this.requests.push(rec);
    if (this.offline) return void (await route.abort('internetdisconnected'));
    const out = await this.respond(rec);
    await route.fulfill({
      status: out.status ?? 200,
      headers: { ...cors, 'content-type': 'application/json' },
      body: JSON.stringify(out.body ?? {})
    });
  }

  private async respond(r: Recorded): Promise<{ status?: number; body?: unknown }> {
    const { url, method, body } = r;
    const custom = [...this.api]
      .filter(([p]) => url.includes(p))
      .sort((a, b) => b[0].length - a[0].length)[0];
    if (custom) return custom[1](r);
    if (url.includes('/auth/v1/token'))
      return {
        body: { access_token: jwt('e2e@sub20.test'), refresh_token: 'R2', expires_in: 3600 }
      };
    if (url.includes('/auth/v1/user')) return { body: { user_metadata: {} } };
    if (url.includes('/rest/v1/user_state_istorija')) {
      if (url.includes('select=data')) {
        const id = /id=eq\.([^&]+)/.exec(url)?.[1];
        const h = this.history.find((x) => String(x.id) === id);
        return { body: h ? [{ data: h.data }] : [] };
      }
      return { body: this.history.map(({ data: _d, ...rest }) => rest) };
    }
    if (url.includes('/rest/v1/user_state')) {
      if (method === 'GET') {
        if (!this.row) return { body: [] };
        return url.includes('select=data')
          ? { body: [{ data: this.row.data, updated_at: this.row.updated_at }] }
          : { body: [{ updated_at: this.row.updated_at, device_id: this.row.device_id }] };
      }
      if (method === 'POST' || method === 'PATCH') {
        const expected = new URL(url).searchParams.get('updated_at')?.slice(3);
        if (method === 'PATCH' && (!this.row || this.row.updated_at !== expected))
          return { body: [] };
        if (method === 'POST' && this.row) return { body: [] };
        this.clock += 1000;
        const b = body as { data: unknown; device_id: string };
        this.row = {
          data: b.data,
          device_id: b.device_id,
          updated_at: new Date(this.clock).toISOString()
        };
        return { status: 201, body: [{ updated_at: this.row.updated_at }] };
      }
    }
    if (url.includes('/rest/v1/zajednica')) return { body: [] };
    return { status: 404, body: { error: 'nepoznata adresa u lažnom backendu: ' + url } };
  }
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*'
};

/** Presreće spoljne servise i naše `/api/*`. Pozvati PRE `page.goto`. */
export async function installBackend(target: Page | BrowserContext): Promise<Backend> {
  const backend = new Backend();
  const handler = (route: Route): Promise<void> => backend.handle(route);
  await target.route(/^https:\/\/[^/]+\.supabase\.co\//, handler);
  await target.route(/^https:\/\/www\.strava\.com\/(?!oauth)/, handler);
  await target.route(/^https:\/\/api\.open-meteo\.com\//, handler);
  await target.route((u) => u.pathname.startsWith('/api/'), handler);
  return backend;
}

/** Sesija prijavljenog korisnika upisana PRE učitavanja aplikacije — samo jednom po kartici (posle odjave se ne vraća). */
export async function seedSession(
  target: Page | BrowserContext,
  who: { email: string; userId?: string } = { email: 'e2e@sub20.test' }
): Promise<void> {
  const session = {
    access: jwt(who.email, who.userId),
    refresh: 'R1',
    expiresAt: Date.now() + 3_600_000,
    email: who.email,
    userId: who.userId ?? 'u-e2e',
    slika: null,
    ime: 'E2E Trkač',
    seenAt: null,
    deviceId: 'dE2E'
  };
  await target.addInitScript((s) => {
    try {
      if (sessionStorage.getItem('__e2e_seeded')) return;
      sessionStorage.setItem('__e2e_seeded', '1');
      sessionStorage.setItem('sub20-uvod', '1'); // toplo pokretanje: uvodni ekran se preskače (njegov tok ima svoj test)
      localStorage.setItem('sub19_sb', JSON.stringify(s));
    } catch {
      /* bez skladišta nema ni testa */
    }
  }, session);
}

/** Zaključava datum: sve što zavisi od „danas" (plan, nedelje, datumi) postaje determinističko. Tajmeri teku normalno. */
export async function fixToday(page: Page, iso = '2026-01-14T09:00:00'): Promise<void> {
  await page.clock.setFixedTime(new Date(iso));
}
