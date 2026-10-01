import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fakeSupabase';
import { seedState, type PersistedState } from '../../domain/state';
import { PUSH_DEBOUNCE_MS } from '../../domain/sync';
import { createUserStateApi } from '../api/userStateApi';
import { SB_KEY } from '../storage/keys';
import { createKeyValueStore, type StorageLike } from '../storage/kv';
import { createSessionManager, emptySession } from '../supabase/session';
import { createSyncEngine, type SyncEngine } from './engine';

/* parity: test/mreza-rok.test.mjs, test/requireuser-kopije.test.mjs, test/istorija.test.mjs, test/otpornost.test.mjs.
   OVO SU TESTOVI GUBITKA PODATAKA: svaki opisuje način na koji je neko već izgubio kilažu ili povrede. */

class Mem implements StorageLike {
  d = new Map<string, string>();
  getItem(k: string): string | null {
    return this.d.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.d.set(k, v);
  }
  removeItem(k: string): void {
    this.d.delete(k);
  }
}

const b64 = (o: unknown): string =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const jwt = `${b64({ alg: 'x' })}.${b64({ sub: 'u1', email: 'a@b.rs' })}.s`;

function filledState(): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  s.log = { g1d1: { status: 'done', km: 8 } };
  s.kg = [{ date: '2026-07-01', kg: 72 }];
  s.knee = [{ date: '2026-07-02', pain: 3 }];
  s.strava = { access_token: 'STRAVA-SECRET', refresh_token: 'STRAVA-REFRESH', athlete: { id: 1 } };
  s.icu = { token: 'ICU-SECRET', apiKey: 'ICU-KEY', athleteId: 'i1' };
  s.ui = { ...s.ui, geo: { lat: 44.81, lon: 20.46 } };
  s.vreme = { at: 1, lat: 44.81, lon: 20.46, sati: {} };
  return s;
}

interface Harness {
  engine: SyncEngine;
  fake: FakeSupabase;
  local: { state: PersistedState };
  adopted: PersistedState[];
  timers: Array<{ id: number; fn: () => void; ms: number }>;
  fireTimers: () => void;
  session: ReturnType<typeof createSessionManager>;
  background: { schedule: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> };
  onPushed: ReturnType<typeof vi.fn>;
}

function harness(
  opts: {
    state?: PersistedState;
    seenAt?: string | null;
    loadFailed?: boolean;
    row?: { at: string; device: string | null };
  } = {}
): Harness {
  const fake = createFakeSupabase();
  if (opts.row)
    fake.row = {
      data: { v: 11, log: { remote: { status: 'done' } } },
      updated_at: opts.row.at,
      device_id: opts.row.device
    };
  const store = new Mem();
  store.setItem(
    SB_KEY,
    JSON.stringify({
      ...emptySession('dME'),
      access: jwt,
      refresh: 'R1',
      userId: 'u1',
      email: 'a@b.rs',
      expiresAt: fake.clock.value + 3600_000,
      seenAt: opts.seenAt ?? null
    })
  );
  const session = createSessionManager({
    kv: createKeyValueStore(store),
    fetcher: fake.fetcher,
    supabaseUrl: 'https://x.supabase.co',
    anonKey: 'anon',
    now: () => fake.clock.value
  });
  const api = createUserStateApi({
    fetcher: fake.fetcher,
    session,
    supabaseUrl: 'https://x.supabase.co',
    anonKey: 'anon'
  });
  const local = { state: opts.state ?? filledState() };
  const adopted: PersistedState[] = [];
  const timers: Harness['timers'] = [];
  let id = 0;
  const background = { schedule: vi.fn(), cancel: vi.fn() };
  const onPushed = vi.fn();
  const engine = createSyncEngine({
    session,
    api,
    getState: () => local.state,
    adopt: (s) => {
      adopted.push(s);
      local.state = s;
    },
    appVersion: '283',
    loadFailed: !!opts.loadFailed,
    setTimer: (fn, ms) => {
      timers.push({ id: ++id, fn, ms });
      return id;
    },
    clearTimer: (i) => {
      const k = timers.findIndex((t) => t.id === i);
      if (k >= 0) timers.splice(k, 1);
    },
    background,
    onPushed
  });
  const fireTimers = (): void => {
    for (const t of timers.splice(0)) t.fn();
  };
  return { engine, fake, local, adopted, timers, fireTimers, session, background, onPushed };
}

const posts = (h: Harness) =>
  h.fake.requests.filter((r) => r.method === 'POST' && r.url.includes('/rest/v1/user_state'));
const flush = async (n = 6): Promise<void> => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

describe('upis', () => {
  it('prvi upis (server prazan): šalje stanje bez tokena i koordinata, pamti `updated_at`, otkazuje pozadinski red', async () => {
    const h = harness();
    expect(await h.engine.pushNow()).toBe(true);
    const [req] = posts(h);
    const sent = JSON.stringify((req?.body as { data: unknown }).data);
    for (const secret of [
      'STRAVA-SECRET',
      'STRAVA-REFRESH',
      'ICU-SECRET',
      'ICU-KEY',
      '44.81',
      '20.46'
    ])
      expect(sent, secret).not.toContain(secret);
    expect(req?.body).toMatchObject({ user_id: 'u1', device_id: 'dME', app_version: '283' });
    expect(req?.headers['prefer']).toContain('resolution=merge-duplicates');
    expect(h.session.state.seenAt).toBe(h.fake.row?.updated_at);
    expect(h.background.cancel).toHaveBeenCalled();
    expect(h.onPushed).toHaveBeenCalledTimes(1);
  });

  it('odložen upis: svaka izmena pomera rok na 4 s, i izvršava se JEDNOM', async () => {
    const h = harness();
    h.engine.schedulePush();
    h.engine.schedulePush();
    h.engine.schedulePush();
    expect(h.timers).toHaveLength(1);
    expect(h.timers[0]?.ms).toBe(PUSH_DEBOUNCE_MS);
    h.fireTimers();
    await flush(20);
    expect(posts(h)).toHaveLength(1);
  });

  it('neprijavljen korisnik ne šalje ništa', async () => {
    const h = harness();
    h.session.logout();
    expect(await h.engine.pushNow()).toBe(false);
    h.engine.schedulePush();
    expect(h.timers).toHaveLength(0);
    expect(h.fake.requests).toHaveLength(0);
  });
});

describe('SUKOB: tuđi noviji zapis se ne gazi', () => {
  it('server ima noviji zapis sa DRUGOG uređaja: podiže se sukob, POST se NE šalje', async () => {
    const h = harness({
      seenAt: '2026-07-01T10:00:00.000Z',
      row: { at: '2026-07-02T10:00:00.000Z', device: 'dTUĐ' }
    });
    expect(await h.engine.pushNow()).toBe(false);
    expect(h.engine.status.conflict).toEqual({ remoteAt: '2026-07-02T10:00:00.000Z' });
    expect(posts(h)).toHaveLength(0);
  });

  it('noviji zapis sa ISTOG uređaja nije sukob (naš sopstveni push koji nismo stigli da zabeležimo)', async () => {
    const h = harness({
      seenAt: '2026-07-01T10:00:00.000Z',
      row: { at: '2026-07-02T10:00:00.000Z', device: 'dME' }
    });
    expect(await h.engine.pushNow()).toBe(true);
    expect(h.engine.status.conflict).toBeNull();
  });

  it('DOK TRAJE PITANJE NIŠTA SE NE ŠALJE: ni odloženo, ni „odmah", ni dugme „Sinhronizuj"', async () => {
    const h = harness({
      seenAt: '2026-07-01T10:00:00.000Z',
      row: { at: '2026-07-02T10:00:00.000Z', device: 'dTUĐ' }
    });
    await h.engine.pushNow();
    h.fake.requests.length = 0;
    h.engine.schedulePush();
    expect(h.timers).toHaveLength(0);
    expect(await h.engine.pushNow()).toBe(false);
    expect(await h.engine.syncNow()).toBe(false);
    expect(posts(h)).toHaveLength(0);
  });

  it('provera servera ne uspe (mreža trepti), a pitanje o sukobu je otvoreno: upis se ipak NE šalje', async () => {
    const h = harness({
      seenAt: '2026-07-01T10:00:00.000Z',
      row: { at: '2026-07-02T10:00:00.000Z', device: 'dTUĐ' }
    });
    await h.engine.pushNow();
    expect(h.engine.status.conflict).not.toBeNull();
    h.fake.readsFail = true; // provera sukoba više ne može da vidi tuđi zapis
    h.fake.requests.length = 0;
    expect(await h.engine.pushNow()).toBe(false);
    expect(posts(h)).toHaveLength(0);
  });

  it('pokretanje: server prazan ili isti → upis; tuđe novije → pitanje (i ništa se ne šalje)', async () => {
    const empty = harness();
    expect(await empty.engine.start()).toBe('pushed');
    await flush(20);
    expect(posts(empty)).toHaveLength(1);

    const ask = harness({
      seenAt: '2026-07-01T10:00:00.000Z',
      row: { at: '2026-07-02T10:00:00.000Z', device: 'dTUĐ' }
    });
    expect(await ask.engine.start()).toBe('conflict');
    await flush(20);
    expect(posts(ask)).toHaveLength(0);
  });

  it('bez signala pri pokretanju: radi se lokalno, ništa se ne menja', async () => {
    const h = harness();
    h.fake.offline = true;
    expect(await h.engine.start()).toBe('offline');
    expect(h.engine.status.conflict).toBeNull();
  });

  it('„Uzmi sa servera" USPEH: stanje se usvaja, sukob se zatvara; veze i lokacija ostaju na uređaju', async () => {
    const h = harness({
      seenAt: '2026-07-01T10:00:00.000Z',
      row: { at: '2026-07-02T10:00:00.000Z', device: 'dTUĐ' }
    });
    await h.engine.pushNow();
    const r = await h.engine.resolveConflict('pull');
    expect(r).toEqual({ ok: true });
    expect(h.engine.status.conflict).toBeNull();
    const adopted = h.adopted[0] as PersistedState;
    expect(adopted.log).toHaveProperty('remote');
    expect(adopted.strava).toMatchObject({ access_token: 'STRAVA-SECRET' });
    expect(adopted.icu).toMatchObject({ token: 'ICU-SECRET' });
    expect(adopted.ui.geo).toEqual({ lat: 44.81, lon: 20.46 });
    expect(h.session.state.seenAt).toBe('2026-07-02T10:00:00.000Z');
  });

  it('„Uzmi sa servera" NEUSPEH (mreža puca): sukob OSTAJE i ništa se ne menja — inače bi lokalno pregazilo serversko', async () => {
    const h = harness({
      seenAt: '2026-07-01T10:00:00.000Z',
      row: { at: '2026-07-02T10:00:00.000Z', device: 'dTUĐ' }
    });
    await h.engine.pushNow();
    h.fake.offline = true;
    const r = await h.engine.resolveConflict('pull');
    expect(r).toEqual({ ok: false, reason: 'pull-failed' });
    expect(h.engine.status.conflict).not.toBeNull();
    expect(h.adopted).toHaveLength(0);
    h.fake.offline = false;
    h.fake.requests.length = 0;
    expect(await h.engine.pushNow()).toBe(false); // i dalje blokirano
    expect(posts(h)).toHaveLength(0);
  });

  it('„Zadrži sa telefona": pamti da je tuđu verziju video i svesno pregazio, pa upis PROLAZI', async () => {
    const h = harness({
      seenAt: '2026-07-01T10:00:00.000Z',
      row: { at: '2026-07-02T10:00:00.000Z', device: 'dTUĐ' }
    });
    await h.engine.pushNow();
    expect(await h.engine.resolveConflict('push')).toEqual({ ok: true });
    expect(posts(h)).toHaveLength(1);
    expect(h.engine.status.conflict).toBeNull();
  });

  it('„Zadrži sa telefona" na PRAZNOM uređaju traži još jednu potvrdu (prazno preko punog)', async () => {
    const h = harness({
      state: JSON.parse(JSON.stringify(seedState())) as PersistedState,
      seenAt: '2026-07-01T10:00:00.000Z',
      row: { at: '2026-07-02T10:00:00.000Z', device: 'dTUĐ' }
    });
    await h.engine.pushNow();
    expect(await h.engine.resolveConflict('push')).toEqual({
      ok: false,
      reason: 'confirm-empty-needed'
    });
    expect(posts(h)).toHaveLength(0);
    expect(h.engine.status.conflict).not.toBeNull();
    expect(await h.engine.resolveConflict('push', { confirmedEmpty: true })).toEqual({ ok: true });
    expect(posts(h)).toHaveLength(1);
  });

  it('bez otvorenog sukoba nema šta da se razrešava', async () => {
    const h = harness();
    expect(await h.engine.resolveConflict('pull')).toEqual({ ok: false, reason: 'no-conflict' });
  });
});

describe('PRAZNO STANJE NE PREGAZI SERVER', () => {
  it('lokalni zapis se nije mogao pročitati: upis je zaustavljen dok čovek svesno ne izabere', async () => {
    const h = harness({ loadFailed: true });
    expect(await h.engine.pushNow()).toBe(false);
    expect(posts(h)).toHaveLength(0);
    h.engine.acknowledgeLoadFailure();
    expect(await h.engine.pushNow()).toBe(true);
  });
});

describe('zauzeće', () => {
  it('push koji naiđe na tekući upis NE propada nego se ponavlja čim tekući završi (najsvežija izmena stiže)', async () => {
    const h = harness();
    let release!: () => void;
    h.fake.pushGate = new Promise<void>((r) => (release = r));
    const first = h.engine.pushNow();
    await flush(30);
    expect(h.engine.status.busy).toBe(true);
    h.local.state = { ...h.local.state, kg: [...h.local.state.kg, { date: '2026-07-12', kg: 71 }] };
    expect(await h.engine.pushNow()).toBe(false); // zauzet
    h.fake.pushGate = null;
    release();
    await first;
    h.fireTimers(); // ponavljanje je zakazano
    await flush(30);
    expect(posts(h)).toHaveLength(2);
    const last = posts(h)[1]?.body as { data: { kg: unknown[] } };
    expect(last.data.kg).toHaveLength(2); // šalje se NAJNOVIJE stanje
  });

  it('zauzeće se podiže PRE mrežne provere sukoba (dva istovremena upisa ne smeju da prođu jedan pored drugog)', async () => {
    const h = harness();
    const p1 = h.engine.pushNow();
    const p2 = h.engine.pushNow();
    await Promise.all([p1, p2]);
    h.fireTimers();
    await flush(30);
    // oba su „krenula", ali je POST bio jedan pa jedan — nikad paralelno
    expect(posts(h).length).toBeGreaterThanOrEqual(1);
    expect(posts(h).length).toBeLessThanOrEqual(2);
  });
});

describe('otkazi upisa', () => {
  it('5xx i mreža su privremeni → pozadinski red; 4xx se ponavljanjem ne popravlja → nema reda', async () => {
    for (const [outcome, queued] of [
      ['http500', true],
      ['network', true],
      ['http403', false]
    ] as const) {
      const h = harness();
      h.fake.nextPush = [outcome];
      expect(await h.engine.pushNow(), outcome).toBe(false);
      expect(h.background.schedule.mock.calls.length > 0, outcome).toBe(queued);
      expect(h.session.state.seenAt).toBeNull(); // neuspeh ne pomera „viđeno"
    }
  });
  it('HTML umesto JSON-a (posrednik, greška platforme) je otkaz, ne izuzetak', async () => {
    const h = harness();
    h.fake.nextPush = ['html'];
    await expect(h.engine.pushNow()).resolves.toBe(false);
  });
  it('neuspeh dodatka (javni profil) NE obara sinhronizaciju', async () => {
    const h = harness();
    h.onPushed.mockImplementation(() => {
      throw new Error('profil');
    });
    expect(await h.engine.pushNow()).toBe(true);
  });
});

describe('povlačenje', () => {
  it('pokvaren oblik na serveru (nije stanje) ne razbija aplikaciju: false, ništa se ne usvaja', async () => {
    const h = harness();
    h.fake.row = { data: 'nije stanje', updated_at: '2026-07-02T10:00:00.000Z', device_id: 'dTUĐ' };
    expect(await h.engine.pull()).toBe(false);
    expect(h.adopted).toHaveLength(0);
  });
  it('stanje iz NOVIJE šeme se ne usvaja', async () => {
    const h = harness();
    h.fake.row = {
      data: { v: 99, log: {} },
      updated_at: '2026-07-02T10:00:00.000Z',
      device_id: 'dTUĐ'
    };
    expect(await h.engine.pull()).toBe(false);
  });
  it('red ne postoji: false', async () => {
    const h = harness();
    expect(await h.engine.pull()).toBe(false);
  });
});
