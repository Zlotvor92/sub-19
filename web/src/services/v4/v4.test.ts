import { describe, expect, it } from 'vitest';
import type { PlanDoc, PlanEvent, Run } from '../../domain/v4/engine';
import { createActivityImport } from '../strava/activityImport';
import type { RateLimits } from '../strava/stravaApi';
import type { Result } from '../http';
import {
  commitAction,
  createEventsApi,
  createPlanApi,
  createSupabaseActivityStore,
  createV4Rest,
  readAccess,
  v4Enabled,
  WITHOUT_ROW
} from '.';

/* LAŽAN PostgREST (bez mreže): tabele iz supabase/v4.sql, RLS po tokenu, okidač `rev`, `Prefer: resolution=…`. */
type Row = Record<string, unknown>;
interface Fail {
  method: string;
  table: string;
  /** `pre`: zahtev ne stigne; `posle`: server upiše, a odgovor se izgubi. */
  when: 'pre' | 'posle';
}

function fakeServer() {
  const tables: Record<string, Row[]> = {
    plan_v4: [],
    aktivnost: [],
    plan_v4_dogadjaj: [],
    v4_pristup: []
  };
  const tokens: Record<string, string> = { 'tok-A': 'A', 'tok-B': 'B' };
  const calls: string[] = [];
  let fail: Fail | null = null;
  const keys: Record<string, string[]> = {
    plan_v4: ['user_id'],
    aktivnost: ['user_id', 'id'],
    plan_v4_dogadjaj: ['user_id', 'event_id', 'vrsta'],
    v4_pristup: ['user_id']
  };
  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  const fetcher = (input: string, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? 'GET';
    const u = new URL(input);
    const table = u.pathname.replace('/rest/v1/', '');
    calls.push(`${method} ${table}`);
    const f = fail;
    if (f !== null && f.method === method && f.table === table && f.when === 'pre') {
      fail = null;
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const uid = tokens[(headers['Authorization'] ?? '').replace('Bearer ', '')];
    if (uid === undefined) return Promise.resolve(json(401, { message: 'JWT' }));
    const rows = tables[table];
    if (rows === undefined) return Promise.resolve(json(404, { message: 'nema tabele' }));
    const filters = [...u.searchParams.entries()].filter(
      ([k, v]) => v.startsWith('eq.') && k !== 'select'
    );
    const match = (r: Row): boolean =>
      r['user_id'] === uid &&
      filters.every(([k, v]) => String(r[k]) === decodeURIComponent(v.slice(3)));
    const prefer = headers['Prefer'] ?? '';
    const respond = (status: number, body: unknown): Promise<Response> => {
      if (f !== null && f.method === method && f.table === table && f.when === 'posle') {
        fail = null;
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return Promise.resolve(json(status, body));
    };
    if (method === 'GET') return respond(200, rows.filter(match));
    const body = JSON.parse(typeof init?.body === 'string' ? init.body : 'null') as Row | Row[];
    const list = Array.isArray(body) ? body : [body];
    if (list.some((r) => r['user_id'] !== uid)) return respond(403, { message: 'RLS' });
    const key = keys[table] ?? [];
    const same = (a: Row, b: Row): boolean => key.every((k) => a[k] === b[k]);
    if (method === 'POST') {
      const out: Row[] = [];
      for (const r of list) {
        const i = rows.findIndex((x) => same(x, r));
        if (i >= 0) {
          if (prefer.includes('merge-duplicates')) rows[i] = { ...rows[i], ...r };
          else if (!prefer.includes('ignore-duplicates'))
            return respond(409, { message: 'duplicate' });
          continue;
        }
        const row = table === 'plan_v4' ? { ...r, rev: 1 } : { ...r };
        rows.push(row);
        out.push(row);
      }
      return respond(201, prefer.includes('return=representation') ? out : null);
    }
    if (method === 'PATCH') {
      const out: Row[] = [];
      for (let i = 0; i < rows.length; i++) {
        const cur = rows[i] as Row;
        if (!match(cur)) continue;
        const next: Row = { ...cur, ...(list[0] as Row) };
        if (table === 'plan_v4') next['rev'] = (cur['rev'] as number) + 1;
        rows[i] = next;
        out.push(next);
      }
      return respond(200, out);
    }
    return respond(405, { message: 'metod' });
  };
  return {
    tables,
    calls,
    fetcher,
    failNext: (x: Fail) => {
      fail = x;
    }
  };
}

const session = (uid: string | null, ok = true) => ({
  state: { userId: uid, access: uid === null ? null : `tok-${uid}` } as never,
  ensure: () => Promise.resolve(ok)
});

const restFor = (srv: ReturnType<typeof fakeServer>, uid: string | null, ok = true) =>
  createV4Rest({
    fetcher: srv.fetcher,
    session: session(uid, ok),
    supabaseUrl: 'https://x.supabase.co',
    anonKey: 'anon'
  });

/* Lažan `PlanDoc`: dovoljan za skladište (otisak je izveden iz sadržaja, kao `fingerprint`). */
const doc = (days: string[]): PlanDoc =>
  ({
    schema: 'plan-doc',
    version: 1,
    engineVersion: 'test',
    header: {},
    weeks: [{ days }]
  }) as unknown as PlanDoc;
const daysOf = (d: PlanDoc | null): string[] =>
  (d?.weeks[0] as unknown as { days?: string[] })?.days ?? [];
const withDay = (day: string) => (cur: PlanDoc | null) => {
  const days = [...new Set([...daysOf(cur), day])].sort();
  return { doc: doc(days), otisak: days.join(',') };
};

describe('plan_v4: uslovni upis po `rev`', () => {
  it('prvi upis, pa izmena: rev raste', async () => {
    const srv = fakeServer();
    const api = createPlanApi(restFor(srv, 'A'));
    const a = await commitAction(api, withDay('d1'), 'tel');
    expect(a).toMatchObject({ ok: true, wrote: true, tries: 1 });
    const b = await commitAction(api, withDay('d2'), 'tel');
    expect(b.ok && b.row?.rev).toBe(2);
    expect(srv.tables['plan_v4']).toHaveLength(1);
  });

  it('dva uređaja, isti doc: drugi ne piše (isti otisak nije sukob), rev se ne menja', async () => {
    const srv = fakeServer();
    const tel = createPlanApi(restFor(srv, 'A'));
    const lap = createPlanApi(restFor(srv, 'A'));
    await commitAction(tel, withDay('d1'), 'tel');
    /* laptop je video staro stanje (rev 1) i primenjuje isti događaj — rezultat je bajt-isti */
    const stale = await lap.load();
    if (!stale.ok || stale.row === null) throw new Error('load');
    await commitAction(tel, withDay('d2'), 'tel');
    const r = await commitAction(lap, withDay('d2'), 'lap');
    expect(r).toMatchObject({ ok: true, wrote: false });
    expect(srv.tables['plan_v4']?.[0]?.['rev']).toBe(2);
  });

  it('dva uređaja, različite radnje: sukob → ponovo učitaj → ponovo primeni; obe izmene ostaju', async () => {
    const srv = fakeServer();
    const tel = createPlanApi(restFor(srv, 'A'));
    const lap = createPlanApi(restFor(srv, 'A'));
    await commitAction(tel, withDay('d1'), 'tel');
    /* laptop učita rev 1; telefon upiše između; laptop piše sa starim rev → 0 redova → ponovni pokušaj */
    let raced = false;
    const racing = {
      load: () => lap.load(),
      save: async (next: Parameters<typeof lap.save>[0], rev: number | null, dev: string) => {
        if (!raced) {
          raced = true;
          await commitAction(tel, withDay('d2'), 'tel');
        }
        return lap.save(next, rev, dev);
      }
    };
    const r = await commitAction(racing, withDay('d3'), 'lap');
    expect(r).toMatchObject({ ok: true, wrote: true, tries: 2 });
    expect(daysOf(srv.tables['plan_v4']?.[0]?.['doc'] as PlanDoc)).toEqual(['d1', 'd2', 'd3']);
    expect(srv.tables['plan_v4']?.[0]?.['rev']).toBe(3);
  });

  it('prvi upis sa dva uređaja odjednom: drugi dobija sukob i primenjuje radnju nad prvim', async () => {
    const srv = fakeServer();
    const tel = createPlanApi(restFor(srv, 'A'));
    const lap = createPlanApi(restFor(srv, 'A'));
    let raced = false;
    const racing = {
      load: () => lap.load(),
      save: async (next: Parameters<typeof lap.save>[0], rev: number | null, dev: string) => {
        if (!raced) {
          raced = true;
          await commitAction(tel, withDay('t'), 'tel');
        }
        return lap.save(next, rev, dev);
      }
    };
    const r = await commitAction(racing, withDay('l'), 'lap');
    expect(r).toMatchObject({ ok: true, wrote: true, tries: 2 });
    expect(daysOf(srv.tables['plan_v4']?.[0]?.['doc'] as PlanDoc)).toEqual(['l', 't']);
  });

  it('mreža pala PRE upisa: „network", ništa upisano; ponovni pokušaj upiše jednom', async () => {
    const srv = fakeServer();
    const api = createPlanApi(restFor(srv, 'A'));
    await commitAction(api, withDay('d1'), 'tel');
    srv.failNext({ method: 'PATCH', table: 'plan_v4', when: 'pre' });
    const r = await commitAction(api, withDay('d2'), 'tel');
    expect(r).toMatchObject({ ok: false, reason: 'network', retryable: true });
    expect(srv.tables['plan_v4']?.[0]?.['rev']).toBe(1);
    expect(await commitAction(api, withDay('d2'), 'tel')).toMatchObject({ ok: true, wrote: true });
    expect(srv.tables['plan_v4']?.[0]?.['rev']).toBe(2);
  });

  it('mreža pala POSLE upisa (odgovor izgubljen): ponovni pokušaj vidi isti otisak i ne piše dvaput', async () => {
    const srv = fakeServer();
    const api = createPlanApi(restFor(srv, 'A'));
    await commitAction(api, withDay('d1'), 'tel');
    srv.failNext({ method: 'PATCH', table: 'plan_v4', when: 'posle' });
    expect(await commitAction(api, withDay('d2'), 'tel')).toMatchObject({
      ok: false,
      reason: 'network'
    });
    expect(srv.tables['plan_v4']?.[0]?.['rev']).toBe(2);
    expect(await commitAction(api, withDay('d2'), 'tel')).toMatchObject({ ok: true, wrote: false });
    expect(srv.tables['plan_v4']?.[0]?.['rev']).toBe(2);
  });

  it('stalni sukob: posle `tries` pokušaja „sukob", bez beskonačne petlje', async () => {
    const srv = fakeServer();
    const api = createPlanApi(restFor(srv, 'A'));
    const always = {
      load: () => api.load(),
      save: () => Promise.resolve({ ok: false as const, conflict: true as const })
    };
    expect(await commitAction(always, withDay('d1'), 'tel', 3)).toEqual({
      ok: false,
      reason: 'sukob',
      tries: 3
    });
  });

  it('odjavljen korisnik (ili token nije osvežen): nijedan zahtev', async () => {
    const srv = fakeServer();
    for (const rest of [restFor(srv, null), restFor(srv, 'A', false)]) {
      const r = await commitAction(createPlanApi(rest), withDay('d1'), 'tel');
      expect(r).toMatchObject({ ok: false, reason: 'odjavljen', retryable: false });
    }
    expect(srv.calls).toEqual([]);
  });

  it('tuđ red se ne vidi (RLS): korisnik B ne dobija plan korisnika A', async () => {
    const srv = fakeServer();
    await commitAction(createPlanApi(restFor(srv, 'A')), withDay('d1'), 'tel');
    expect(await createPlanApi(restFor(srv, 'B')).load()).toEqual({ ok: true, row: null });
  });
});

const ev = (id: string): PlanEvent => ({ id, date: '2026-11-14', kind: 'pain', level: 4 });

describe('plan_v4_dogadjaj: samo dopisivanje', () => {
  it('dupli upis istog događaja nije greška i ne pravi drugi red; lista vraća redosled upisa', async () => {
    const srv = fakeServer();
    const api = createEventsApi(restFor(srv, 'A'));
    expect(await api.append([{ event: ev('pain:1'), vrsta: 'pain', revPlana: 1 }], 'tel')).toEqual({
      ok: true
    });
    expect(
      await api.append(
        [
          { event: ev('pain:1'), vrsta: 'pain', revPlana: 1 },
          { event: ev('pain:1'), vrsta: 'odbijeno', revPlana: 1 }
        ],
        'lap'
      )
    ).toEqual({ ok: true });
    const l = await api.list();
    expect(l.ok && l.records.map((r) => `${r.event.id}/${r.vrsta}`)).toEqual([
      'pain:1/pain',
      'pain:1/odbijeno'
    ]);
  });

  it('mreža pala: „network" (ponavlja se); odjavljen: nijedan zahtev', async () => {
    const srv = fakeServer();
    srv.failNext({ method: 'POST', table: 'plan_v4_dogadjaj', when: 'pre' });
    expect(
      await createEventsApi(restFor(srv, 'A')).append(
        [{ event: ev('x'), vrsta: 'pain', revPlana: null }],
        't'
      )
    ).toMatchObject({
      ok: false,
      reason: 'network',
      retryable: true
    });
    const before = srv.calls.length;
    expect(
      await createEventsApi(restFor(srv, null)).append(
        [{ event: ev('x'), vrsta: 'pain', revPlana: null }],
        't'
      )
    ).toMatchObject({
      reason: 'odjavljen'
    });
    expect(srv.calls.length).toBe(before);
  });
});

describe('v4_pristup: značenje na jednom mestu', () => {
  it('bez reda = WITHOUT_ROW; red = njegova vrednost; mreža = isključeno', async () => {
    expect(v4Enabled(null)).toBe(WITHOUT_ROW);
    expect(v4Enabled({ ukljuceno: true })).toBe(true);
    expect(v4Enabled({ ukljuceno: false })).toBe(false);
    expect(v4Enabled('nepoznato')).toBe(false);
    const srv = fakeServer();
    expect(await readAccess(restFor(srv, 'A'))).toEqual({
      enabled: WITHOUT_ROW,
      state: WITHOUT_ROW ? 'ukljucen' : 'iskljucen'
    });
    srv.tables['v4_pristup']?.push({ user_id: 'A', ukljuceno: true });
    expect(await readAccess(restFor(srv, 'A'))).toEqual({ enabled: true, state: 'ukljucen' });
    srv.failNext({ method: 'GET', table: 'v4_pristup', when: 'pre' });
    expect(await readAccess(restFor(srv, 'A'))).toEqual({ enabled: false, state: 'nepoznato' });
    expect(await readAccess(restFor(srv, null))).toEqual({ enabled: false, state: 'nepoznato' });
  });
});

/* `aktivnost` kao pravo skladište: uvoz (lažna Strava) → lažan PostgREST. */
function fakeStrava(n: number) {
  const now = Date.UTC(2026, 10, 14, 19, 0);
  const acts = Array.from({ length: n }, (_, i) => ({
    id: 500 + i,
    type: 'Run',
    start_date: new Date(now - (i + 1) * 864e5).toISOString().replace('.000', ''),
    start_date_local: new Date(now - (i + 1) * 864e5 + 3600e3).toISOString().slice(0, 19),
    distance: 8000,
    moving_time: 2600
  }));
  return {
    now,
    api: {
      getWithLimits(path: string): Promise<{ result: Result<unknown>; limits: RateLimits | null }> {
        const u = new URL(`https://s${path}`);
        const limits = { windowLimit: 1000, windowUsage: 1, dayLimit: 10000, dayUsage: 1 };
        if (u.pathname.includes('/streams'))
          return Promise.resolve({
            result: { ok: false, kind: 'http', status: 404, error: '404' },
            limits
          });
        const before = u.searchParams.get('before');
        const after = u.searchParams.get('after');
        const per = Number(u.searchParams.get('per_page'));
        const page = Number(u.searchParams.get('page') ?? 1);
        const epoch = (a: (typeof acts)[number]) => Date.parse(a.start_date) / 1000;
        const list = acts.filter(
          (a) =>
            (before === null || epoch(a) < Number(before)) &&
            (after === null || epoch(a) > Number(after))
        );
        return Promise.resolve({
          result: { ok: true, data: list.slice((page - 1) * per, page * per), status: 200 },
          limits
        });
      }
    }
  };
}

const memKv = () => {
  const m = new Map<string, string>();
  return {
    get: (k: string) => m.get(k) ?? null,
    set: (k: string, v: string) => (m.set(k, v), true),
    remove: (k: string) => m.delete(k)
  } as never;
};

describe('aktivnost: pravo skladište iza `ActivityStore`', () => {
  it('uvoz cele istorije u bazu; ponovljen uvoz (drugi uređaj) ne pravi duplikate', async () => {
    const srv = fakeServer();
    const st = fakeStrava(230);
    const mk = (dev: string) =>
      createActivityImport({
        api: st.api,
        store: createSupabaseActivityStore({
          rest: restFor(srv, 'A'),
          kv: memKv(),
          deviceId: dev,
          progressKey: (u) => `v4-uvoz:${u}`
        }),
        now: () => st.now
      });
    expect((await mk('tel').run()).status).toBe('gotovo');
    expect(srv.tables['aktivnost']).toHaveLength(230);
    expect((await mk('lap').run()).status).toBe('gotovo');
    expect(srv.tables['aktivnost']).toHaveLength(230);
    const ids = new Set(srv.tables['aktivnost']?.map((r) => r['id']));
    expect(ids.size).toBe(230);
    const one = srv.tables['aktivnost']?.[0];
    expect(one?.['datum']).toBe((one?.['run'] as Run).date);
  });

  it('pad baze usred uvoza: „greska", napredak do poslednje strane ostaje; nastavak dovršava bez duplikata', async () => {
    const srv = fakeServer();
    const st = fakeStrava(230);
    const kv = memKv();
    const imp = createActivityImport({
      api: st.api,
      store: createSupabaseActivityStore({
        rest: restFor(srv, 'A'),
        kv,
        deviceId: 'tel',
        progressKey: (u) => `v4-uvoz:${u}`
      }),
      now: () => st.now
    });
    srv.failNext({ method: 'POST', table: 'aktivnost', when: 'pre' });
    const first = await imp.run();
    expect(first.status).toBe('greska');
    expect((await imp.run()).status).toBe('gotovo');
    expect(srv.tables['aktivnost']).toHaveLength(230);
  });

  it('odjavljen: uvoz vraća „greska" bez ijednog zahteva bazi', async () => {
    const srv = fakeServer();
    const st = fakeStrava(5);
    const r = await createActivityImport({
      api: st.api,
      store: createSupabaseActivityStore({
        rest: restFor(srv, null),
        kv: memKv(),
        deviceId: 't',
        progressKey: (u) => u
      }),
      now: () => st.now
    }).run();
    expect(r.status).toBe('greska');
    expect(srv.calls).toEqual([]);
  });
});
