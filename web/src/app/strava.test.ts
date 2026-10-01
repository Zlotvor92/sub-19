import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';
import { adaptGeneratedPlan } from '../domain/plan/adapt';
import { seedState, type PersistedState } from '../domain/state';
import { generatePlan } from '../domain/training/generator/generatePlan';
import { hydratePersisted, useTrainingStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { LS_KEY, SB_KEY, STRAVA_STATE_KEY } from '../services/storage/keys';
import { createKeyValueStore, type StorageLike } from '../services/storage/kv';
import { emptySession } from '../services/supabase/session';
import { createApp } from './createApp';

/* parity: stravaConnect, handleOAuthReturn, trPovuciAko (app.js) — povezivanje i automatski uvoz kroz ceo createApp. */

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
function state(): PersistedState {
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
  return s;
}

function boot(
  opts: {
    search?: string;
    signedIn?: boolean;
    strava?: Record<string, unknown> | null;
    saved?: string | null;
  } = {}
) {
  const fake = createFakeSupabase();
  fake.clock.value = NOW;
  const store = new Mem();
  const st = { ...state(), strava: opts.strava ?? null } as PersistedState;
  store.setItem(LS_KEY, JSON.stringify(st));
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
  if (opts.saved) store.setItem(STRAVA_STATE_KEY, opts.saved);
  const calls: string[] = [];
  const routes = new Map<string, (url: string) => Response>();
  const notices: string[] = [];
  const navigate = vi.fn();
  const app = createApp({
    kv: createKeyValueStore(store),
    fetcher: (url, init) => {
      if (url.startsWith('/api/') || url.startsWith('https://www.strava.com')) {
        calls.push(url);
        for (const [prefix, h] of routes)
          if (url.startsWith(prefix)) return Promise.resolve(h(url));
        return Promise.resolve(json(404, { message: 'nema' }));
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
  return { app, calls, routes, notices, navigate, store, fake };
}

beforeEach(() => {
  hydratePersisted(seedState());
  useAuthStore.setState({ configured: false, hasSession: false, gate: null, ready: false });
});
afterEach(() => vi.useRealTimers());

describe('Strava u aplikaciji', () => {
  it('povezivanje: state se pamti, a adresa nosi isti state, redirect na koren i potreban opseg', () => {
    const c = boot();
    c.app.strava.connect();
    const saved = JSON.parse(c.store.getItem(STRAVA_STATE_KEY) as string) as {
      st: string;
      exp: number;
    };
    expect(saved).toEqual({ st: 'NONCE123', exp: NOW + 600_000 });
    const url = c.navigate.mock.calls[0]?.[0] as string;
    expect(url).toContain('https://www.strava.com/oauth/authorize?client_id=');
    expect(url).toContain('state=NONCE123');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fsub-19.vercel.app%2F');
    expect(url).toContain('scope=activity:read_all');
  });

  it('povratak sa ispravnim state-om: kod se menja za tokene, upisuje se veza, odmah se povlače trčanja', async () => {
    const c = boot({
      search: '?code=KOD&scope=read,activity:read_all&state=ST1',
      saved: JSON.stringify({ st: 'ST1', exp: NOW + 1000 })
    });
    c.routes.set('/api/auth?code=KOD', () =>
      json(200, {
        access_token: 'AT',
        refresh_token: 'RT',
        expires_at: Math.floor(NOW / 1000) + 21600,
        athlete: { firstname: 'Mika', lastname: 'Mikić' }
      })
    );
    c.routes.set('https://www.strava.com/api/v3/athlete/zones', () =>
      json(200, {
        heart_rate: {
          zones: [
            { min: 0, max: 120 },
            { min: 120, max: -1 }
          ]
        }
      })
    );
    c.routes.set('https://www.strava.com/api/v3/athlete/activities', () => json(200, []));
    await c.app.start();
    expect(useSettingsStore.getState().strava).toMatchObject({
      access: 'AT',
      refresh: 'RT',
      athlete: 'Mika Mikić',
      scope: 'read,activity:read_all',
      hrZones: [
        { min: 0, max: 120 },
        { min: 120, max: null }
      ]
    });
    expect(c.notices[0]).toBe('Strava povezana — Mika Mikić.');
    expect(c.notices[1]).toMatch(/^Sinhronizacija gotova\.\nAžurirano trčanja: 0/);
    expect(c.store.getItem(STRAVA_STATE_KEY)).toBeNull(); // jednokratno
    expect(c.calls[0]).toBe('/api/auth?code=KOD');
  });

  it('povratak sa tuđim kodom (pogrešan state): odbijeno, kod se NE menja za tokene', async () => {
    const c = boot({
      search: '?code=NJEGOV&state=NAPADAC',
      saved: JSON.stringify({ st: 'ST1', exp: NOW + 1000 })
    });
    await c.app.start();
    expect(useSettingsStore.getState().strava).toBeNull();
    expect(c.notices).toHaveLength(1);
    expect(c.notices[0]).toMatch(/^Povezivanje odbijeno — bezbednosna provera nije prošla\./);
    expect(c.calls.filter((u) => u.startsWith('/api/auth'))).toHaveLength(0);
  });

  it('povratak bez prijave: poruka, ništa se ne menja', async () => {
    const c = boot({
      signedIn: false,
      search: '?code=KOD&state=ST1',
      saved: JSON.stringify({ st: 'ST1', exp: NOW + 1000 })
    });
    await c.app.start(); // bez sesije kapija ostaje zatvorena, pa se povratak ne obrađuje
    expect(useSettingsStore.getState().strava).toBeNull();
    expect(c.calls).toHaveLength(0);
  });

  it('automatski uvoz pri pokretanju: samo ako je prošlo više od sat vremena od poslednjeg', async () => {
    const link = {
      access: 'AT',
      refresh: 'RT',
      expiresAt: Math.floor(NOW / 1000) + 21600,
      zonesTs: NOW
    };
    const recent = boot({ strava: { ...link, lastSync: NOW - 30 * 60000 } });
    recent.routes.set('https://www.strava.com/api/v3/athlete/activities', () => json(200, []));
    await recent.app.start();
    await vi.waitFor(() => expect(recent.fake.requests.length).toBeGreaterThan(0));
    expect(recent.calls.filter((u) => u.includes('/athlete/activities'))).toHaveLength(0);

    const stale = boot({ strava: { ...link, lastSync: NOW - 90 * 60000 } });
    stale.routes.set('https://www.strava.com/api/v3/athlete/activities', () => json(200, []));
    await stale.app.start();
    await vi.waitFor(() =>
      expect(stale.calls.filter((u) => u.includes('/athlete/activities'))).toHaveLength(1)
    );
    await vi.waitFor(() =>
      expect((useSettingsStore.getState().strava?.['lastSync'] as number) >= NOW).toBe(true)
    );
  });

  it('dva uvoza se ne preklapaju; greška spiska se vraća kao poruka, nema delimičnog upisa', async () => {
    const link = {
      access: 'AT',
      refresh: 'RT',
      expiresAt: Math.floor(NOW / 1000) + 21600,
      zonesTs: NOW,
      lastSync: 0
    };
    const c = boot({ strava: link });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    c.routes.set('https://www.strava.com/api/v3/athlete/activities', () =>
      json(500, { message: 'Strava je pala' })
    );
    const first = c.app.strava.sync();
    const second = await c.app.strava.sync();
    expect(second).toMatchObject({ ok: false, busy: true });
    release();
    await gate;
    expect(await first).toEqual({ ok: false, error: 'Strava 500 — Strava je pala' });
    expect(useTrainingStore.getState().log).toEqual({});
  });
});
