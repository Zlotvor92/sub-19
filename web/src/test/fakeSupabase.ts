/* LAŽNI SUPABASE ZA TESTOVE SERVISA. Ne zove mrežu: `fetcher` odgovara iz memorije i beleži svaki zahtev.

   Namerno je mali i NE oponaša RLS ili PostgREST do detalja — dovoljno je da testovi proveravaju PONAŠANJE KLIJENTA:
   šta šalje (telo, zaglavlja), koliko puta, i kako reaguje na otkaze (status, mreža, pokvareno telo). */

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface FakeRow {
  data: unknown;
  updated_at: string;
  device_id: string | null;
}

export interface FakeSupabase {
  fetcher: (input: string, init?: RequestInit) => Promise<Response>;
  requests: RecordedRequest[];
  /** Red `user_state` ili `null`. */
  row: FakeRow | null;
  history: Array<{
    id: number;
    napravljeno: string;
    app_version: string | null;
    device_id: string | null;
    data: unknown;
  }>;
  clock: { value: number };
  /** Odgovor na osvežavanje tokena. */
  refresh: { status: number; access: string; refreshToken: string; expiresIn: number };
  /** Odgovor na `/auth/v1/user`: niz statusa po pozivu (poslednji se ponavlja). */
  userStatuses: Array<{ status: number; body?: unknown }>;
  /** Sledeći upis(i) padaju ovim ishodom. */
  nextPush: Array<'ok' | 'http500' | 'http403' | 'network' | 'html'>;
  /** Ceo server nije dostupan. */
  offline: boolean;
  /** Čitanje `user_state` pada (500), upis prolazi — mreža koja trepti. */
  readsFail: boolean;
  /** Kapija: dok je postavljena, POST na `user_state` čeka na nju (simulacija spore mreže). */
  pushGate: Promise<void> | null;
  count(match: string | RegExp, method?: string): number;
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export function createFakeSupabase(): FakeSupabase {
  const requests: RecordedRequest[] = [];
  const fake: FakeSupabase = {
    requests,
    row: null,
    history: [],
    clock: { value: Date.UTC(2026, 6, 12, 10, 0, 0) },
    refresh: { status: 200, access: 'ACCESS-2', refreshToken: 'REFRESH-2', expiresIn: 3600 },
    userStatuses: [{ status: 200, body: { user_metadata: {} } }],
    nextPush: [],
    offline: false,
    readsFail: false,
    pushGate: null,
    count(match, method) {
      return requests.filter(
        (r) =>
          (method == null || r.method === method) &&
          (typeof match === 'string' ? r.url.includes(match) : match.test(r.url))
      ).length;
    },
    async fetcher(input, init = {}) {
      const method = (init.method ?? 'GET').toUpperCase();
      const headers: Record<string, string> = {};
      new Headers(init.headers).forEach((v, k) => (headers[k] = v));
      let body: unknown;
      try {
        body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
      } catch {
        body = init.body;
      }
      requests.push({ method, url: input, headers, body });
      if (fake.offline) throw new TypeError('Failed to fetch');

      if (input.includes('/auth/v1/token')) {
        if (fake.refresh.status !== 200)
          return json(fake.refresh.status, { error: 'refresh_token_not_found' });
        return json(200, {
          access_token: fake.refresh.access,
          refresh_token: fake.refresh.refreshToken,
          expires_in: fake.refresh.expiresIn
        });
      }
      if (input.includes('/auth/v1/user')) {
        const idx = Math.min(
          requests.filter((r) => r.url.includes('/auth/v1/user')).length - 1,
          fake.userStatuses.length - 1
        );
        const s = fake.userStatuses[idx] as { status: number; body?: unknown };
        return json(s.status, s.body ?? {});
      }
      if (input.includes('/rest/v1/user_state_istorija')) {
        if (input.includes('select=data')) {
          const id = /id=eq\.([^&]+)/.exec(input)?.[1];
          const h = fake.history.find((x) => String(x.id) === id);
          return json(200, h ? [{ data: h.data }] : []);
        }
        return json(
          200,
          fake.history.map(({ data: _d, ...rest }) => rest)
        );
      }
      if (input.includes('/rest/v1/user_state')) {
        if (method === 'GET') {
          if (fake.readsFail) return json(500, { error: 'read failed' });
          if (!fake.row) return json(200, []);
          if (input.includes('select=data'))
            return json(200, [{ data: fake.row.data, updated_at: fake.row.updated_at }]);
          return json(200, [{ updated_at: fake.row.updated_at, device_id: fake.row.device_id }]);
        }
        if (method === 'POST' || method === 'PATCH') {
          if (fake.pushGate) await fake.pushGate;
          const next = fake.nextPush.shift() ?? 'ok';
          if (next === 'network') throw new TypeError('Failed to fetch');
          if (next === 'http500') return json(500, { error: 'boom' });
          if (next === 'http403') return json(403, { message: 'denied' });
          if (next === 'html') return new Response('<html>gateway</html>', { status: 200 });
          const expected = new URL(input).searchParams.get('updated_at')?.slice(3);
          if (method === 'PATCH' && (!fake.row || fake.row.updated_at !== expected))
            return json(200, []);
          if (method === 'POST' && headers['prefer']?.includes('ignore-duplicates') && fake.row)
            return json(200, []);
          fake.clock.value += 1000;
          const b = body as { data: unknown; device_id: string };
          fake.row = {
            data: b.data,
            device_id: b.device_id,
            updated_at: new Date(fake.clock.value).toISOString()
          };
          return json(201, [{ updated_at: fake.row.updated_at }]);
        }
      }
      return json(404, { error: 'nepoznata adresa u lažnom serveru: ' + input });
    }
  };
  return fake;
}
