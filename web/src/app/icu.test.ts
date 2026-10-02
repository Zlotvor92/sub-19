import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';
import { adaptGeneratedPlan } from '../domain/plan/adapt';
import { seedState, type PersistedState } from '../domain/state';
import { generatePlan } from '../domain/training/generator/generatePlan';
import { hydratePersisted, useTrainingStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { useRecoveryStore } from '../stores/recoveryStore';
import { useSettingsStore } from '../stores/settingsStore';
import { ICU_STATE_KEY, LS_KEY, SB_KEY } from '../services/storage/keys';
import { createKeyValueStore, type StorageLike } from '../services/storage/kv';
import { emptySession } from '../services/supabase/session';
import { createApp } from './createApp';

/* parity: icuConnect, icuFinish, icuAutoSync, sinhronizujTreninge, trPovuciAko, ručno povezivanje ključem (app.js). */

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
const token = `${b64({ alg: 'x' })}.${b64({ sub: 'u1', email: 'a@b.rs' })}.s`;
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const NOW = Date.UTC(2026, 1, 20, 9);
function state(extra: Partial<PersistedState> = {}): PersistedState {
  const s = JSON.parse(JSON.stringify(seedState())) as PersistedState;
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: '2026-01-05',
      raceDate: '2026-04-12',
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2700 },
      goalSec: 2520,
      weeklyKm: 40,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!a) throw new Error('plan');
  s.genPlan = a;
  return { ...s, ...extra };
}
const OLD_LINK = { athleteId: 'i1', token: 'abcdefgh1234', lastSync: 0 };

function boot(
  opts: {
    search?: string;
    icu?: Record<string, unknown> | null;
    strava?: Record<string, unknown> | null;
    saved?: string | null;
    signedIn?: boolean;
  } = {}
) {
  const fake = createFakeSupabase();
  fake.clock.value = NOW;
  const store = new Mem();
  store.setItem(
    LS_KEY,
    JSON.stringify(state({ icu: opts.icu ?? null, strava: opts.strava ?? null }))
  );
  if (opts.signedIn !== false)
    store.setItem(
      SB_KEY,
      JSON.stringify({
        ...emptySession('dME'),
        access: token,
        refresh: 'R1',
        userId: 'u1',
        email: 'a@b.rs',
        expiresAt: NOW + 3600_000
      })
    );
  if (opts.saved) store.setItem(ICU_STATE_KEY, opts.saved);
  const calls: Array<{ url: string; body: Record<string, unknown> | null }> = [];
  const routes: Array<[string, (url: string, body: Record<string, unknown> | null) => Response]> =
    [];
  const notices: string[] = [];
  const navigate = vi.fn();
  const app = createApp({
    kv: createKeyValueStore(store),
    fetcher: (url, init) => {
      if (url.startsWith('/api/') || url.startsWith('https://www.strava.com')) {
        const body = init?.body
          ? (JSON.parse(init.body as string) as Record<string, unknown>)
          : null;
        calls.push({ url, body });
        const hit = routes.find(([prefix]) => url.startsWith(prefix));
        return Promise.resolve(hit ? hit[1](url, body) : json(404, { error: 'nema' }));
      }
      return fake.fetcher(url, init);
    },
    now: () => NOW,
    today: () => '2026-02-20',
    supabaseUrl: 'https://x.supabase.co',
    anonKey: 'anon',
    appVersion: '283',
    randomToken: () => 'NONCE123',
    location: {
      hash: '',
      search: opts.search ?? '',
      origin: 'https://sub-19.vercel.app',
      pathname: '/'
    },
    replaceUrl: vi.fn(),
    navigate,
    online: () => true,
    notify: (m) => notices.push(m)
  });
  const on = (
    prefix: string,
    h: (url: string, body: Record<string, unknown> | null) => Response
  ): void => {
    routes.push([prefix, h]);
  };
  return { app, calls, on, notices, navigate, store };
}
const icuCalls = (c: ReturnType<typeof boot>, sta: string) =>
  c.calls.filter((x) => x.url === '/api/icu' && x.body?.['sta'] === sta);

beforeEach(() => {
  hydratePersisted(seedState());
  useAuthStore.setState({ configured: false, hasSession: false, gate: null, ready: false });
});
afterEach(() => vi.useRealTimers());

describe('intervals.icu u aplikaciji', () => {
  it('povezivanje: traži se adresa sa serverom (state se pamti), pa se ide na odobravanje; bez prijave se ne šalje ništa', async () => {
    const c = boot();
    c.on('/api/icu-oauth?akcija=url', (url) => {
      expect(url).toContain('state=NONCE123');
      return json(200, { url: 'https://intervals.icu/oauth/authorize?x=1' });
    });
    expect(await c.app.icu.connect()).toEqual({ ok: true });
    expect(c.navigate).toHaveBeenCalledWith('https://intervals.icu/oauth/authorize?x=1');
    expect(JSON.parse(c.store.getItem(ICU_STATE_KEY) as string)).toEqual({
      st: 'NONCE123',
      exp: NOW + 600_000
    });

    const anon = boot({ signedIn: false });
    expect(await anon.app.icu.connect()).toEqual({
      ok: false,
      error: 'Moraš biti prijavljen da bi povezao intervals.icu.'
    });
    expect(anon.calls).toHaveLength(0);
  });

  it('povratak sa odobravanja: kod se menja za token, veza se upisuje (bez ključeva u backup), povlači se 120 dana merenja', async () => {
    const c = boot({
      search: '?code=KOD&state=ST9',
      saved: JSON.stringify({ st: 'ST9', exp: NOW + 1000 })
    });
    c.on('/api/icu-oauth', (_u, body) => {
      expect(body).toEqual({ code: 'KOD' });
      return json(200, {
        athleteId: 'i77',
        token: 'TOKEN-ZA-ICU',
        scope: 'ACTIVITY:READ,WELLNESS:READ'
      });
    });
    c.on('/api/icu', () =>
      json(200, { dani: [{ datum: '2026-02-19', hrv: 61, pulsUMiru: 47, sanH: 7.2 }] })
    );
    await c.app.start();
    expect(useSettingsStore.getState().icu).toMatchObject({
      athleteId: 'i77',
      token: 'TOKEN-ZA-ICU',
      scope: 'ACTIVITY:READ,WELLNESS:READ'
    });
    expect(c.notices[0]).toBe('intervals.icu povezan. Povučeno zapisa: 1.');
    expect(useRecoveryStore.getState().wellness['2026-02-19']).toMatchObject({
      hrv: 61,
      pulsUMiru: 47
    });
    const w = icuCalls(c, 'wellness')[0];
    expect(w?.body).toMatchObject({
      athleteId: 'i77',
      token: 'TOKEN-ZA-ICU',
      oldest: '2025-10-23',
      newest: '2026-02-20'
    });
    expect(w?.body).not.toHaveProperty('apiKey');
  });

  it('povratak sa tuđim kodom: odbijeno, nijedna razmena', async () => {
    const c = boot({
      search: '?code=NJEGOV&state=NAPADAC',
      saved: JSON.stringify({ st: 'ST9', exp: NOW + 1000 })
    });
    await c.app.start();
    expect(useSettingsStore.getState().icu).toBeNull();
    expect(c.notices).toHaveLength(1);
    expect(c.notices[0]).toMatch(/^Povezivanje odbijeno — bezbednosna provera nije prošla\./); // tuđ state nije ničiji — isto kao u starom kodu
    expect(c.calls.filter((x) => x.url === '/api/icu-oauth')).toHaveLength(0);
  });

  it('povezivanje ključem: proveri se jednim povlačenjem; neuspeh vraća stanje kakvo je bilo', async () => {
    const c = boot();
    c.on('/api/icu', (_u, body) =>
      body?.['apiKey'] === 'ispravankljuc'
        ? json(200, { dani: [] })
        : json(401, { error: 'intervals.icu je odbio pristup.' })
    );
    expect(await c.app.icu.connectWithKey('abc', 'ispravankljuc')).toEqual({
      ok: false,
      error: 'ID sportiste izgleda kao broj, npr. i123456.'
    });
    expect(await c.app.icu.connectWithKey('i123', 'kratak')).toEqual({
      ok: false,
      error: 'API ključ deluje prekratak.'
    });
    expect(c.calls).toHaveLength(0);
    expect(await c.app.icu.connectWithKey('i123', 'pogresankljuc')).toEqual({
      ok: false,
      error: 'intervals.icu je odbio pristup.'
    });
    expect(useSettingsStore.getState().icu).toBeNull();
    expect(await c.app.icu.connectWithKey('i123', 'ispravankljuc')).toEqual({ ok: true, n: 0 });
    expect(useSettingsStore.getState().icu).toMatchObject({
      athleteId: 'i123',
      apiKey: 'ispravankljuc'
    });
    expect(icuCalls(c, 'wellness').at(-1)?.body).toMatchObject({ apiKey: 'ispravankljuc' });
    expect(icuCalls(c, 'wellness').at(-1)?.body).not.toHaveProperty('token');
  });

  it('izvor treninga: intervals.icu ako sme da čita treninge, inače Strava; stara veza (samo wellness) ide na Stravu', async () => {
    const stravaLink = {
      access: 'AT',
      refresh: 'RT',
      expiresAt: Math.floor(NOW / 1000) + 21600,
      zonesTs: NOW
    };
    const old = boot({ icu: { ...OLD_LINK, scope: 'WELLNESS:READ' }, strava: stravaLink });
    old.on('https://www.strava.com/api/v3/athlete/activities', () => json(200, []));
    expect(await old.app.activities.sync(false)).toMatchObject({ ok: true, source: 'strava' });
    expect(icuCalls(old, 'activities')).toHaveLength(0);

    const c = boot({ icu: OLD_LINK, strava: stravaLink });
    c.on('/api/icu', () => json(200, { treninzi: [] }));
    expect(await c.app.activities.sync(false)).toMatchObject({ ok: true, source: 'icu', n: 0 });
    expect(c.calls.some((x) => x.url.includes('strava.com'))).toBe(false);
    expect(useSettingsStore.getState().icu?.['trSync']).toBe(NOW);
  });

  it('icu otkaže: pada se na Stravu (uz poruku pri ručnom uvozu); bez Strave greška ide pozivaocu', async () => {
    const stravaLink = {
      access: 'AT',
      refresh: 'RT',
      expiresAt: Math.floor(NOW / 1000) + 21600,
      zonesTs: NOW
    };
    const c = boot({ icu: OLD_LINK, strava: stravaLink });
    c.on('/api/icu', () => json(502, { error: 'intervals.icu greška (HTTP 500).' }));
    c.on('https://www.strava.com/api/v3/athlete/activities', () => json(200, []));
    expect(await c.app.activities.sync(true)).toMatchObject({ ok: true, source: 'strava' });
    expect(c.notices).toEqual([
      'intervals.icu nije odgovorio (intervals.icu greška (HTTP 500).).\nPokušavam preko Strave…'
    ]);

    const only = boot({ icu: OLD_LINK });
    only.on('/api/icu', () => json(502, { error: 'intervals.icu greška (HTTP 500).' }));
    const r = await only.app.activities.sync(true);
    expect(r).toEqual({ ok: false, source: 'icu', error: 'intervals.icu greška (HTTP 500).' });
    expect(only.app.activities.message(r)).toBe('intervals.icu: intervals.icu greška (HTTP 500).');
  });

  it('automatski uvoz pri pokretanju: treninzi tek posle 60 min; jutarnja merenja jednom dnevno (dan se pamti samo na uspeh)', async () => {
    const c = boot({ icu: { ...OLD_LINK, trSync: NOW - 30 * 60000 } });
    c.on('/api/icu', (_u, body) =>
      body?.['sta'] === 'wellness'
        ? json(200, { dani: [{ datum: '2026-02-20', hrv: 55 }] })
        : json(200, { treninzi: [] })
    );
    await c.app.start();
    await vi.waitFor(() => expect(icuCalls(c, 'wellness')).toHaveLength(1));
    expect(icuCalls(c, 'activities')).toHaveLength(0); // trening je povučen pre 30 min
    await vi.waitFor(() => expect(useSettingsStore.getState().icu?.['autoDan']).toBe('2026-02-20'));
    c.app.icu.sync.autoSync(true).catch(() => undefined);
    await Promise.resolve();
    expect(icuCalls(c, 'wellness')).toHaveLength(1); // danas je već povučeno

    const failing = boot({ icu: OLD_LINK });
    failing.on('/api/icu', () => json(503, { error: 'Nema veze sa intervals.icu.' }));
    await failing.app.start();
    await vi.waitFor(() => expect(icuCalls(failing, 'wellness').length).toBeGreaterThan(0));
    expect(useSettingsStore.getState().icu?.['autoDan']).toBeUndefined();
  });

  it('„Povuci sve": merenja + zone + treninzi; veza bez dozvole za treninge to kaže, merenja ipak stižu', async () => {
    const c = boot({ icu: OLD_LINK });
    c.on('/api/icu', (_u, body) => {
      if (body?.['sta'] === 'wellness')
        return json(200, { dani: [{ datum: '2026-02-19', hrv: 60 }] });
      if (body?.['sta'] === 'zone')
        return json(200, {
          zone: [
            { min: 1, max: 130, ime: 'Z1' },
            { min: 131, max: null, ime: null }
          ],
          lthr: 170,
          maxHr: 190,
          razlog: null
        });
      return json(200, { treninzi: [] });
    });
    const r = await c.app.icu.syncAll(true);
    expect(r).toEqual({ ok: true, wellness: 1, runs: 0, details: 0, activitiesNote: null });
    expect(useSettingsStore.getState().icu).toMatchObject({
      hrZones: [
        { min: 1, max: 130, ime: 'Z1' },
        { min: 131, max: null, ime: null }
      ],
      lthr: 170,
      maxHr: 190
    });

    const oldLink = boot({ icu: { ...OLD_LINK, scope: 'WELLNESS:READ' } });
    oldLink.on('/api/icu', (_u, body) =>
      body?.['sta'] === 'wellness'
        ? json(200, { dani: [] })
        : json(500, { error: 'ne sme da stigne' })
    );
    const r2 = await oldLink.app.icu.syncAll(false);
    expect(r2).toMatchObject({
      ok: true,
      runs: null,
      activitiesNote: 'Veza nema dozvolu za treninge — otkači pa ponovo poveži.'
    });
    expect(useSettingsStore.getState().icu?.['zoneGreska']).toMatch(/starija od ove funkcije/);
    expect(icuCalls(oldLink, 'zone')).toHaveLength(0);
    expect(icuCalls(oldLink, 'activities')).toHaveLength(0);
  });

  it('zone: najviše jednom nedeljno osim ručno; neuspeh se pamti sa razlogom, uspeh ga briše', async () => {
    const c = boot({ icu: { ...OLD_LINK, zonesTs: NOW - 2 * 864e5 } });
    c.on('/api/icu', () =>
      json(200, {
        zone: null,
        lthr: null,
        maxHr: null,
        razlog: 'U intervals.icu Sport Settings za trčanje nisu podešene zone pulsa.'
      })
    );
    expect(await c.app.icu.sync.syncZones(false)).toBe(false);
    expect(icuCalls(c, 'zone')).toHaveLength(0); // keš od pre 2 dana
    expect(await c.app.icu.sync.syncZones(true)).toBe(false);
    expect(useSettingsStore.getState().icu?.['zoneGreska']).toBe(
      'U intervals.icu Sport Settings za trčanje nisu podešene zone pulsa.'
    );
    expect(useTrainingStore.getState().log).toEqual({});
  });
});
