import { describe, expect, it } from 'vitest';
import type { Result } from '../http';
import { createActivityImport, memoryActivityStore, runFromActivity } from './activityImport';
import { createAppApi } from '../api/appApi';
import { createStravaApi, parseRateLimits, type RateLimits } from './stravaApi';
import { createStravaSync } from './stravaSync';

/* LAŽNA Strava (bez mreže): skup aktivnosti, `before`/`after`/`per_page`/`page`, tokovi, limiti po prozoru i danu. */
const NOW = Date.UTC(2026, 10, 14, 19, 7); // 14. 11. 2026, 20:07 po Beogradu
const DAY = 86400;

interface FakeActivity {
  id: number;
  type: string;
  start: number; // epoha, s
  distance: number;
  moving: number;
}

function history(n: number): FakeActivity[] {
  const out: FakeActivity[] = [];
  for (let i = 0; i < n; i++) {
    const start = Math.floor(NOW / 1000) - i * DAY - 3600;
    out.push({
      id: 1000 + i,
      type: i % 7 === 3 ? 'Ride' : 'Run',
      start,
      distance: 8000 + (i % 5) * 1000,
      moving: 2400 + (i % 4) * 600
    });
  }
  return out;
}

const iso = (s: number): string => new Date(s * 1000).toISOString().replace('.000', '');
const toJson = (a: FakeActivity) => ({
  id: a.id,
  type: a.type,
  sport_type: a.type,
  start_date: iso(a.start),
  start_date_local: iso(a.start + 3600).replace('Z', ''),
  distance: a.distance,
  moving_time: a.moving,
  average_heartrate: 145
});

function streams(a: FakeActivity) {
  const n = Math.floor(a.distance / 100);
  const distance = Array.from({ length: n + 1 }, (_, i) => i * 100);
  const time = distance.map((d) => Math.round((d / a.distance) * a.moving));
  return {
    distance: { data: distance },
    time: { data: time },
    heartrate: { data: distance.map(() => 140) },
    moving: { data: distance.map(() => true) }
  };
}

interface FakeOpts {
  windowLimit?: number;
  dayLimit?: number;
  /** n-ti zahtev (1-indeksiran) vraća ovaj status. */
  failAt?: Record<number, number>;
  noHeaders?: boolean;
}

function fakeStrava(acts: FakeActivity[], opts: FakeOpts = {}) {
  const windowLimit = opts.windowLimit ?? 200;
  const dayLimit = opts.dayLimit ?? 2000;
  let window = 0;
  let day = 0;
  let n = 0;
  const paths: string[] = [];
  const overReserve: number[] = [];
  const api = {
    getWithLimits(path: string): Promise<{ result: Result<unknown>; limits: RateLimits | null }> {
      n += 1;
      paths.push(path);
      window += 1;
      day += 1;
      const limits: RateLimits | null = opts.noHeaders
        ? null
        : { windowLimit, windowUsage: window, dayLimit, dayUsage: day };
      if (window > windowLimit - 20 || day > dayLimit - 20) overReserve.push(n);
      const fail = opts.failAt?.[n];
      if (fail !== undefined || window > windowLimit)
        return Promise.resolve({
          result: { ok: false, kind: 'http', status: fail ?? 429, error: `Strava ${fail ?? 429}` },
          limits
        });
      const u = new URL(`https://x${path}`);
      const m = /^\/activities\/(\d+)\/streams$/.exec(u.pathname);
      if (m) {
        const a = acts.find((x) => String(x.id) === m[1]);
        return Promise.resolve({
          result: a
            ? { ok: true, data: streams(a), status: 200 }
            : { ok: false, kind: 'http', status: 404, error: '404' },
          limits
        });
      }
      const per = Number(u.searchParams.get('per_page') ?? 30);
      const page = Number(u.searchParams.get('page') ?? 1);
      const before = u.searchParams.get('before');
      const after = u.searchParams.get('after');
      const list = [...acts]
        .sort((a, b) => b.start - a.start)
        .filter(
          (a) =>
            (before === null || a.start < Number(before)) &&
            (after === null || a.start > Number(after))
        );
      const ordered = after !== null ? list.reverse() : list;
      const slice = ordered.slice((page - 1) * per, page * per).map(toJson);
      return Promise.resolve({ result: { ok: true, data: slice, status: 200 }, limits });
    }
  };
  return {
    api,
    paths,
    overReserve,
    newWindow: () => {
      window = 0;
    },
    newDay: () => {
      window = 0;
      day = 0;
    }
  };
}

const runsOf = (acts: FakeActivity[]) => acts.filter((a) => a.type === 'Run');

describe('uvoz aktivnosti za V4', () => {
  it('cela istorija u jednom prolazu: svako trčanje jednom, bez vožnji; podela po km samo 8 nedelja i ≥ 25 min', async () => {
    const acts = history(400);
    const f = fakeStrava(acts, { windowLimit: 1000, dayLimit: 10000 });
    const store = memoryActivityStore();
    const r = await createActivityImport({ api: f.api, store, now: () => NOW }).run();
    expect(r.status).toBe('gotovo');
    const all = store.all();
    expect(all.map((x) => x.id).sort()).toEqual(
      runsOf(acts)
        .map((a) => `strava:${a.id}`)
        .sort()
    );
    const cutoff = NOW / 1000 - 56 * DAY;
    for (const a of runsOf(acts)) {
      const run = all.find((x) => x.id === `strava:${a.id}`);
      const want = a.start >= cutoff && a.moving >= 1500;
      expect(run?.splits !== undefined, String(a.id)).toBe(want);
    }
    expect(store.progress()?.historyDone).toBe(true);
  });

  it('rezerva za redovnu sinhronizaciju: nijedan zahtev kad do limita ostane ≤ 20; pauza do sledećeg prozora; nastavak bez duplikata = isti ishod', async () => {
    const acts = history(400);
    const whole = memoryActivityStore();
    await createActivityImport({
      api: fakeStrava(acts, { windowLimit: 1000, dayLimit: 10000 }).api,
      store: whole,
      now: () => NOW
    }).run();

    const f = fakeStrava(acts, { windowLimit: 26, dayLimit: 10000 });
    const store = memoryActivityStore();
    let now = NOW;
    const imp = createActivityImport({ api: f.api, store, now: () => now });
    const first = await imp.run();
    expect(first.status).toBe('pauza');
    expect(f.overReserve).toEqual([]);
    const until = store.progress()?.pausedUntil ?? 0;
    expect(until).toBe(Math.ceil((NOW + 1) / 900_000) * 900_000);
    /* pre isteka pauze: nijedan zahtev */
    const before = f.paths.length;
    expect((await imp.run()).status).toBe('pauza');
    expect(f.paths.length).toBe(before);
    let guard = 0;
    for (;;) {
      now = (store.progress()?.pausedUntil ?? now) + 1;
      f.newWindow();
      const r = await imp.run();
      expect(f.overReserve).toEqual([]);
      if (r.status === 'gotovo') break;
      expect(r.status).toBe('pauza');
      if (++guard > 200) throw new Error('ne završava');
    }
    expect(store.all()).toEqual(whole.all());
  });

  it('429 usred uvoza: staje, čuva napredak, nastavlja; dnevni limit → pauza do ponoći UTC', async () => {
    const acts = history(250);
    const whole = memoryActivityStore();
    await createActivityImport({
      api: fakeStrava(acts, { windowLimit: 1000, dayLimit: 10000 }).api,
      store: whole,
      now: () => NOW
    }).run();

    const f = fakeStrava(acts, { windowLimit: 1000, dayLimit: 10000, failAt: { 2: 429 } });
    const store = memoryActivityStore();
    let now = NOW;
    const imp = createActivityImport({ api: f.api, store, now: () => now });
    expect((await imp.run()).status).toBe('pauza');
    expect(store.all().length).toBeGreaterThan(0);
    now = (store.progress()?.pausedUntil ?? now) + 1;
    expect((await imp.run()).status).toBe('gotovo');
    expect(store.all()).toEqual(whole.all());

    const d = fakeStrava(acts, { windowLimit: 1000, dayLimit: 23 });
    const s2 = memoryActivityStore();
    expect(
      (await createActivityImport({ api: d.api, store: s2, now: () => NOW }).run()).status
    ).toBe('pauza');
    expect(s2.progress()?.pausedUntil).toBe(Math.ceil(NOW / 864e5) * 864e5);
  });

  it('greška servera: „greska", napredak ostaje, ponovni poziv nastavlja', async () => {
    const acts = history(250);
    const f = fakeStrava(acts, { windowLimit: 1000, dayLimit: 10000, failAt: { 2: 500 } });
    const store = memoryActivityStore();
    const imp = createActivityImport({ api: f.api, store, now: () => NOW });
    const r = await imp.run();
    expect(r.status).toBe('greska');
    expect((await imp.run()).status).toBe('gotovo');
    expect(store.all().length).toBe(runsOf(acts).length);
  });

  it('bez zaglavlja limita: najviše 50 zahteva po pozivu', async () => {
    const acts = history(400);
    const f = fakeStrava(acts, { windowLimit: 100000, dayLimit: 100000, noHeaders: true });
    const store = memoryActivityStore();
    const r = await createActivityImport({ api: f.api, store, now: () => NOW }).run();
    expect(r.status).toBe('pauza');
    expect(r.requests).toBe(50);
  });

  it('posle cele istorije: samo nova trčanja (`after`), mali broj zahteva', async () => {
    const acts = history(150);
    const f = fakeStrava(acts, { windowLimit: 1000, dayLimit: 10000 });
    const store = memoryActivityStore();
    let now = NOW;
    const imp = createActivityImport({ api: f.api, store, now: () => now });
    await imp.run();
    const count = store.all().length;
    acts.push({
      id: 9999,
      type: 'Run',
      start: Math.floor(NOW / 1000) + 7200,
      distance: 10000,
      moving: 3000
    });
    now = NOW + 3 * 3600_000;
    const before = f.paths.length;
    const r = await imp.run();
    expect(r.status).toBe('gotovo');
    const newPaths = f.paths.slice(before);
    expect(newPaths[0]).toContain('after=');
    expect(newPaths.length).toBeLessThanOrEqual(2);
    expect(store.all().length).toBe(count + 1);
    expect(store.all().find((x) => x.id === 'strava:9999')?.splits).toBeDefined();
  });

  it('nema `getWithLimits` → isključeno, bez zahteva', async () => {
    const r = await createActivityImport({
      api: {},
      store: memoryActivityStore(),
      now: () => NOW
    }).run();
    expect(r).toEqual({ status: 'iskljuceno', requests: 0, stored: 0 });
  });
});

describe('aktivnost → Run', () => {
  it('trčanje sa dužinom i trajanjem; vožnja i prazno → null', () => {
    expect(
      runFromActivity({
        id: 5,
        type: 'Run',
        start_date_local: '2026-11-10T07:00:00',
        distance: 8000,
        moving_time: 2400,
        average_heartrate: 150
      })
    ).toEqual({
      id: 'strava:5',
      date: '2026-11-10',
      distanceM: 8000,
      durationSec: 2400,
      source: 'strava',
      avgHr: 150
    });
    expect(
      runFromActivity({
        id: 6,
        type: 'Ride',
        start_date_local: '2026-11-10T07:00:00',
        distance: 8000,
        moving_time: 2400
      })
    ).toBeNull();
    expect(
      runFromActivity({
        id: 7,
        type: 'Run',
        start_date_local: '2026-11-10T07:00:00',
        distance: 0,
        moving_time: 2400
      })
    ).toBeNull();
  });
});

describe('zaglavlja limita', () => {
  const h = (m: Record<string, string>) => ({ get: (k: string) => m[k] ?? null });
  it('prednost imaju limiti čitanja; inače opšti; neispravno → null', () => {
    expect(
      parseRateLimits(
        h({
          'X-ReadRateLimit-Limit': '200,2000',
          'X-ReadRateLimit-Usage': '12,340',
          'X-RateLimit-Limit': '400,4000',
          'X-RateLimit-Usage': '1,1'
        })
      )
    ).toEqual({ windowLimit: 200, dayLimit: 2000, windowUsage: 12, dayUsage: 340 });
    expect(
      parseRateLimits(h({ 'X-RateLimit-Limit': '400,4000', 'X-RateLimit-Usage': '5,6' }))
    ).toEqual({
      windowLimit: 400,
      dayLimit: 4000,
      windowUsage: 5,
      dayUsage: 6
    });
    expect(parseRateLimits(h({ 'X-RateLimit-Limit': 'x', 'X-RateLimit-Usage': '5,6' }))).toBeNull();
    expect(parseRateLimits(h({}))).toBeNull();
  });
});

describe('priključak u redovnu sinhronizaciju (zastavica)', () => {
  const make = (activities?: { enabled(): boolean; run(): Promise<unknown> }) => {
    let calls = 0;
    const sync = createStravaSync({
      api: {
        get: () => {
          calls += 1;
          return Promise.resolve({ ok: true, data: [], status: 200 });
        },
        exchange: () => Promise.resolve({ ok: false, error: 'x' })
      },
      link: { get: () => ({ access: 'AT' }), set: () => undefined },
      ports: { read: () => ({ genPlan: null }) as never, commit: () => undefined },
      now: () => NOW,
      today: () => '2026-11-14',
      ...(activities !== undefined ? { activities } : {})
    });
    return { sync, calls: () => calls };
  };

  it('bez priključka ili ugašen: isti ishod, uvoz se ne zove', async () => {
    let ran = 0;
    const off = { enabled: () => false, run: () => Promise.resolve((ran += 1)) };
    const a = await make().sync.run();
    const b = await make(off).sync.run();
    expect(b).toEqual(a);
    expect(a).toEqual({ ok: false, error: 'Nema plana.' });
    expect(ran).toBe(0);
  });

  it('upaljen: uvoz radi i bez plana, posle redovne; njegova greška ne menja ishod', async () => {
    let ran = 0;
    const on = { enabled: () => true, run: () => Promise.resolve((ran += 1)) };
    expect(await make(on).sync.run()).toEqual({ ok: false, error: 'Nema plana.' });
    expect(ran).toBe(1);
    const broken = { enabled: () => true, run: () => Promise.reject(new Error('pao')) };
    expect(await make(broken).sync.run()).toEqual({ ok: false, error: 'Nema plana.' });
  });
});

describe('Strava API: `getWithLimits`', () => {
  it('isti rezultat kao `get` + limiti iz zaglavlja', async () => {
    const fetcher = (): Promise<Response> =>
      Promise.resolve(
        new Response('[]', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-ReadRateLimit-Limit': '200,2000',
            'X-ReadRateLimit-Usage': '3,40'
          }
        })
      );
    const api = createStravaApi({
      fetcher,
      appApi: createAppApi({ fetcher, session: { token: () => Promise.resolve('JWT') } }),
      link: {
        get: () => ({ access: 'AT', refresh: 'RT', expiresAt: Math.floor(NOW / 1000) + 3600 }),
        set: () => undefined
      },
      now: () => NOW
    });
    const plain = await api.get('/athlete/activities');
    const withLimits = await api.getWithLimits?.('/athlete/activities');
    expect(withLimits?.result).toEqual(plain);
    expect(withLimits?.limits).toEqual({
      windowLimit: 200,
      dayLimit: 2000,
      windowUsage: 3,
      dayUsage: 40
    });
  });
});
