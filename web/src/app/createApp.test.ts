import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase, type FakeSupabase } from '@/test/fakeSupabase';
import { seedState } from '../domain/state';
import { collectPersisted, hydratePersisted, useTrainingStore } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { LS_KEY, SB_KEY, SB_STATE_KEY } from '../services/storage/keys';
import { createKeyValueStore, type StorageLike } from '../services/storage/kv';
import { emptySession } from '../services/supabase/session';
import { createApp, type AppDeps } from './createApp';

/* parity: test/mreza-rok.test.mjs, test/bezbednost.test.mjs (povratak sa prijave), test/otpornost.test.mjs.
   Ceo tok pokretanja: učitavanje stanja → sesija → sinhronizacija. */

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
const token = (sub: string, email = 'a@b.rs'): string =>
  `${b64({ alg: 'x' })}.${b64({ sub, email })}.s`;

interface Setup {
  app: ReturnType<typeof createApp>;
  fake: FakeSupabase;
  store: Mem;
  navigate: ReturnType<typeof vi.fn>;
  replaceUrl: ReturnType<typeof vi.fn>;
}

function setup(
  over: {
    session?: Partial<ReturnType<typeof emptySession>> | null;
    localState?: unknown;
    hash?: string;
    search?: string;
    fake?: FakeSupabase;
    extra?: Partial<AppDeps>;
  } = {}
): Setup {
  const fake = over.fake ?? createFakeSupabase();
  const store = new Mem();
  if (over.session !== null)
    store.setItem(
      SB_KEY,
      JSON.stringify({
        ...emptySession('dME'),
        access: token('u1'),
        refresh: 'R1',
        userId: 'u1',
        email: 'a@b.rs',
        expiresAt: fake.clock.value + 3600_000,
        ...over.session
      })
    );
  if (over.localState !== undefined)
    store.setItem(
      LS_KEY,
      typeof over.localState === 'string' ? over.localState : JSON.stringify(over.localState)
    );
  const navigate = vi.fn();
  const replaceUrl = vi.fn();
  const app = createApp({
    kv: createKeyValueStore(store),
    fetcher: fake.fetcher,
    now: () => fake.clock.value,
    today: () => '2026-07-12',
    supabaseUrl: 'https://x.supabase.co',
    anonKey: 'anon',
    appVersion: '283',
    randomToken: () => 'NONCE123',
    location: {
      hash: over.hash ?? '',
      search: over.search ?? '',
      origin: 'https://sub-19.vercel.app',
      pathname: '/'
    },
    replaceUrl,
    navigate,
    online: () => true,
    ...over.extra
  });
  return { app, fake, store, navigate, replaceUrl };
}

beforeEach(() => {
  hydratePersisted(seedState());
  useAuthStore.setState({
    configured: false,
    hasSession: false,
    userId: null,
    email: null,
    name: null,
    picture: null,
    gate: null,
    ready: false
  });
  useSyncStore.setState({
    busy: false,
    conflict: null,
    loadFailure: null,
    writeFailed: null,
    lastError: null
  });
});
afterEach(() => vi.useRealTimers());

const readLog = (st: Mem): Record<string, Record<string, unknown>> =>
  (JSON.parse(st.getItem(LS_KEY) as string) as { log: Record<string, Record<string, unknown>> })
    .log;
const posts = (f: FakeSupabase) =>
  f.requests.filter((r) => r.method === 'POST' && r.url.includes('/rest/v1/user_state'));
const filled = () => ({
  ...seedState(),
  v: 11,
  log: { g1d1: { status: 'done', km: 8 } },
  kg: [{ date: '2026-07-01', kg: 72 }]
});

describe('pokretanje', () => {
  it('bez naloga u skladištu: kapija sa praznom porukom, ništa se ne šalje', async () => {
    const s = setup({ session: null });
    await s.app.start();
    expect(useAuthStore.getState()).toMatchObject({
      gate: '',
      ready: true,
      hasSession: false,
      configured: true
    });
    expect(s.fake.requests).toHaveLength(0);
  });

  it('sa ispravnom sesijom: kapija otvorena, stanje se učitava iz skladišta, prvi upis ide na server', async () => {
    const s = setup({ localState: filled() });
    await s.app.start();
    await vi.waitFor(() => expect(posts(s.fake)).toHaveLength(1));
    expect(useAuthStore.getState()).toMatchObject({
      gate: null,
      ready: true,
      hasSession: true,
      userId: 'u1'
    });
    expect(useTrainingStore.getState().log['g1d1']).toMatchObject({ status: 'done' });
    expect((posts(s.fake)[0]?.body as { data: { kg: unknown[] } }).data.kg).toHaveLength(1);
  });

  it('nalog obrisan dok je aplikacija bila zatvorena: kapija sa porukom, NIŠTA se ne šalje, podaci ostaju na uređaju', async () => {
    const fake = createFakeSupabase();
    fake.userStatuses = [{ status: 401 }];
    const s = setup({ localState: filled(), fake });
    await s.app.start();
    expect(useAuthStore.getState().gate).toContain('Nalog više ne postoji');
    expect(posts(fake)).toHaveLength(0);
    expect(useTrainingStore.getState().log['g1d1']).toBeDefined();
    expect(s.store.getItem(LS_KEY)).not.toBeNull();
  });

  it('bez signala pri pokretanju: aplikacija radi lokalno (kapija otvorena)', async () => {
    const fake = createFakeSupabase();
    fake.offline = true;
    const s = setup({ localState: filled(), fake });
    await s.app.start();
    expect(useAuthStore.getState()).toMatchObject({ gate: null, ready: true });
  });

  it('veza visi (mreža jeste tu, odgovora nema): ekran se prikazuje iz lokalnih podataka posle 1,5 s, ne posle roka od 12 s', async () => {
    vi.useFakeTimers();
    const fake = createFakeSupabase();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hang = (input: string, init?: RequestInit) =>
      input.includes('/auth/v1/user')
        ? gate.then(() => fake.fetcher(input, init))
        : fake.fetcher(input, init);
    const s = setup({ localState: filled(), fake, extra: { fetcher: hang } });
    const started = s.app.start();
    await vi.advanceTimersByTimeAsync(1400);
    expect(useAuthStore.getState().ready).toBe(false); // još se čeka (brza provera ne sme da bljesne ekran)
    await vi.advanceTimersByTimeAsync(200);
    expect(useAuthStore.getState()).toMatchObject({ ready: true, gate: null });
    expect(useTrainingStore.getState().log['g1d1']).toBeDefined();
    release();
    await started;
    expect(useAuthStore.getState()).toMatchObject({ ready: true, gate: null });
  });

  it('veza visi, a nalog ne važi: ekran se prikaže, pa kapija stiže sa porukom i ništa se ne šalje', async () => {
    vi.useFakeTimers();
    const fake = createFakeSupabase();
    fake.userStatuses = [{ status: 401 }];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hang = (input: string, init?: RequestInit) =>
      input.includes('/auth/v1/user')
        ? gate.then(() => fake.fetcher(input, init))
        : fake.fetcher(input, init);
    const s = setup({ localState: filled(), fake, extra: { fetcher: hang } });
    const started = s.app.start();
    await vi.advanceTimersByTimeAsync(1600);
    expect(useAuthStore.getState()).toMatchObject({ ready: true, gate: null });
    release();
    await started;
    expect(useAuthStore.getState().gate).toContain('Nalog više ne postoji');
    expect(posts(fake)).toHaveLength(0);
  });

  it('supabase nije podešen: radi bez naloga', async () => {
    const s = setup({ session: null, extra: { supabaseUrl: '', anonKey: '' } });
    await s.app.start();
    expect(useAuthStore.getState()).toMatchObject({ configured: false, gate: null, ready: true });
  });
});

describe('oštećen lokalni zapis', () => {
  it('prazno stanje NE ide na server: upis je zaustavljen, sirov tekst spašen, učitavanje prijavljeno', async () => {
    const fake = createFakeSupabase();
    fake.row = {
      data: { v: 11, log: { stigao: { status: 'done' } } },
      updated_at: '2026-07-01T10:00:00.000Z',
      device_id: 'dME'
    };
    const s = setup({
      localState: '{"v":11,"log":{',
      fake,
      session: { seenAt: '2026-07-01T10:00:00.000Z' }
    });
    await s.app.start();
    await Promise.resolve();
    expect(useSyncStore.getState().loadFailure).toMatchObject({ bytes: 15 });
    expect(posts(fake)).toHaveLength(0);
    expect(s.store.getItem(`${LS_KEY}-osteceno`)).toBe('{"v":11,"log":{');
    expect(await s.app.sync.pushNow()).toBe(false);
    // čovek svesno bira „Uzmi sa servera"
    s.app.sync.acknowledgeLoadFailure();
    useSyncStore.setState({ loadFailure: null });
    // ... lokalno stanje je i dalje prazno, pa bi push bio dopušten tek posle usvajanja servera
  });
});

describe('čuvanje', () => {
  it('izmena u store-u se odmah upisuje na uređaj, a na server posle 4 s (jednom)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const s = setup({ localState: filled() });
    await s.app.start();
    await vi.advanceTimersByTimeAsync(0);
    s.fake.requests.length = 0;
    useTrainingStore.getState().patchLog('g1d1', { km: 9 });
    useTrainingStore.getState().patchLog('g1d1', { km: 10 });
    expect(readLog(s.store)['g1d1']?.['km']).toBe(10);
    expect(posts(s.fake)).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(4100);
    await vi.waitFor(() => expect(posts(s.fake)).toHaveLength(1));
  });

  it('kucanje u belešku ide odloženo (400 ms), a odlazak u pozadinu upisuje odmah', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const s = setup({ session: null, localState: filled() });
    useTrainingStore.getState().patchLog('g1d1', { note: 'a' }, 'soon');
    expect(readLog(s.store)['g1d1']?.['note']).toBeUndefined();
    s.app.onHidden();
    expect(readLog(s.store)['g1d1']?.['note']).toBe('a');
  });

  it('sklopljeno stanje je isto što je učitano (nema gubitka polja)', () => {
    const state = filled();
    const s = setup({ session: null, localState: state });
    expect(collectPersisted()).toEqual(JSON.parse(s.store.getItem(LS_KEY) as string));
  });
});

describe('prijava', () => {
  it('login: nonce se pamti 3 minuta i ide kao `sbn` u povratnoj adresi (NE kao `state`)', () => {
    const s = setup({ session: null });
    s.app.login();
    const url = s.navigate.mock.calls[0]?.[0] as string;
    expect(url).toContain('/auth/v1/authorize?provider=google');
    expect(decodeURIComponent(url)).toContain('/?sbn=NONCE123');
    expect(url).not.toContain('&state=');
    expect(JSON.parse(s.store.getItem(SB_STATE_KEY) as string)).toMatchObject({ st: 'NONCE123' });
  });

  it('povratak sa ispravnim nonce-om: sesija se usvaja, adresa se čisti, nonce je jednokratan', async () => {
    const fake = createFakeSupabase();
    const s = setup({
      session: null,
      fake,
      hash: `#access_token=${token('u7', 'n@n.rs')}&refresh_token=RR&expires_in=3600`,
      search: '?sbn=NONCE123'
    });
    s.store.setItem(
      SB_STATE_KEY,
      JSON.stringify({ st: 'NONCE123', exp: fake.clock.value + 60_000 })
    );
    await s.app.start();
    expect(useAuthStore.getState()).toMatchObject({ userId: 'u7', email: 'n@n.rs', gate: null });
    expect(s.replaceUrl).toHaveBeenCalledWith('/');
    expect(s.store.getItem(SB_STATE_KEY)).toBeNull();
  });

  it('povratak sa PODMETNUTIM tokenom (nonce se ne poklapa): odbija se, adresa se čisti, sesija se ne usvaja', async () => {
    const fake = createFakeSupabase();
    const s = setup({
      session: null,
      fake,
      hash: `#access_token=${token('napadac')}&refresh_token=RR`,
      search: '?sbn=TUDJ'
    });
    s.store.setItem(
      SB_STATE_KEY,
      JSON.stringify({ st: 'NONCE123', exp: fake.clock.value + 60_000 })
    );
    await s.app.start();
    expect(useAuthStore.getState()).toMatchObject({ userId: null, gate: '' });
    expect(s.replaceUrl).toHaveBeenCalledWith('/');
  });

  it('token za DRUGOG korisnika se odbija dok je prijavljen prethodni (inače bi se lični podaci gurali u napadačev red)', async () => {
    const fake = createFakeSupabase();
    const s = setup({
      fake,
      hash: `#access_token=${token('napadac')}&refresh_token=RR`,
      search: '?sbn=NONCE123'
    });
    s.store.setItem(
      SB_STATE_KEY,
      JSON.stringify({ st: 'NONCE123', exp: fake.clock.value + 60_000 })
    );
    await s.app.start();
    expect(s.app.session.state.userId).toBe('u1');
    expect(s.replaceUrl).toHaveBeenCalledWith('/');
  });

  it('greška sa Google strane se prikazuje na kapiji', async () => {
    const s = setup({
      session: null,
      hash: '#error=access_denied&error_description=Korisnik+je+odbio'
    });
    await s.app.start();
    expect(useAuthStore.getState().gate).toBe('Korisnik je odbio');
  });

  it('odjava zatvara kapiju i briše tokene, ali ne i podatke', () => {
    const s = setup({ localState: filled() });
    s.app.logout();
    expect(useAuthStore.getState()).toMatchObject({ gate: '', hasSession: false });
    expect(s.app.session.isAuthed()).toBe(false);
    expect(s.store.getItem(LS_KEY)).not.toBeNull();
  });
});

describe('podaci: backup, uvoz, ranije verzije, zaboravljanje', () => {
  const withLinks = () => ({
    ...filled(),
    strava: { access: 'STRAVA-TOKEN', athlete: 'x' },
    icu: { athleteId: 'i1', token: 'ICU-TOKEN' }
  });

  it('izvoz: bez tokena, sa podacima; beleži datum backupa i gasi odlaganje', () => {
    const s = setup({ localState: withLinks() });
    const text = s.app.exportBackup();
    expect(text).not.toContain('STRAVA-TOKEN');
    expect(text).not.toContain('ICU-TOKEN');
    const parsed = JSON.parse(text) as { app: string; state: { log: unknown } };
    expect(parsed.app).toBe('SUB-19');
    expect(parsed.state.log).toEqual({ g1d1: { status: 'done', km: 8 } });
    expect(collectPersisted().ui.lastBackup).toBe('2026-07-12');
  });

  it('uvoz: provera ne menja ništa; potvrđen uvoz zamenjuje podatke, a veze ostaju SVOJE (ne iz fajla)', () => {
    const s = setup({ localState: withLinks() });
    const foreign = {
      app: 'SUB-19',
      state: {
        ...seedState(),
        v: 11,
        log: { g2d2: { status: 'done' } },
        icu: { athleteId: 'TUDJ', token: 'TUDJ-TOKEN' }
      }
    };
    const prep = s.app.prepareImport(foreign);
    expect(prep.ok).toBe(true);
    expect(useTrainingStore.getState().log['g1d1']).toBeDefined(); // još ništa nije promenjeno
    if (!prep.ok) return;
    expect(s.app.commitImport(prep.state)).toEqual({ ok: true });
    const now = collectPersisted();
    expect(now.log).toEqual({ g2d2: { status: 'done' } });
    expect(now.icu).toEqual({ athleteId: 'i1', token: 'ICU-TOKEN' });
    expect(now.strava).toEqual({ access: 'STRAVA-TOKEN', athlete: 'x' });
    expect(readLog(s.store)).toEqual({ g2d2: { status: 'done' } });
  });

  it('uvoz: neispravan identifikator se odbija, ništa se ne dira', () => {
    const s = setup({ localState: withLinks() });
    const bad = {
      app: 'SUB-19',
      state: { ...seedState(), v: 11, log: { '"><img src=x>': { status: 'done' } } }
    };
    const r = s.app.prepareImport(bad);
    expect(r).toMatchObject({ ok: false, reason: 'bad-id' });
    expect(useTrainingStore.getState().log['g1d1']).toBeDefined();
  });

  it('vraćanje ranije verzije: stanje se usvaja uz zadržane veze i odmah ide na server', async () => {
    const fake = createFakeSupabase();
    fake.history = [
      {
        id: 7,
        napravljeno: '2026-07-01T10:00:00.000Z',
        app_version: '283',
        device_id: 'dME',
        data: { ...seedState(), v: 11, log: { stara: { status: 'done' } } }
      }
    ];
    fake.row = { data: filled(), updated_at: '2026-07-10T10:00:00.000Z', device_id: 'dME' };
    const s = setup({
      localState: withLinks(),
      fake,
      session: { seenAt: '2026-07-10T10:00:00.000Z' }
    });
    const r = await s.app.restoreVersion(7);
    expect(r).toEqual({ ok: true });
    expect(useTrainingStore.getState().log).toEqual({ stara: { status: 'done' } });
    expect(collectPersisted().icu).toEqual({ athleteId: 'i1', token: 'ICU-TOKEN' });
    await vi.waitFor(() => expect(posts(fake).length).toBeGreaterThan(0));
  });

  it('vraćanje: nepostojeća verzija i verzija iz novije šeme daju poruku, stanje ostaje', async () => {
    const fake = createFakeSupabase();
    fake.history = [
      { id: 8, napravljeno: 'x', app_version: null, device_id: null, data: { v: 999, log: {} } }
    ];
    const s = setup({ localState: filled(), fake });
    expect(await s.app.restoreVersion(99)).toMatchObject({ ok: false });
    const newer = await s.app.restoreVersion(8);
    expect(newer).toMatchObject({ ok: false });
    expect(useTrainingStore.getState().log['g1d1']).toBeDefined();
  });

  it('zaboravljanje: brišu se svi ključevi naloga i stanje, sesija je odjavljena', () => {
    const s = setup({ localState: withLinks() });
    s.app.forgetEverything();
    expect(s.store.getItem(LS_KEY)).toBeNull();
    expect(s.store.getItem(SB_KEY)).toBeNull();
    expect(useTrainingStore.getState().log).toEqual({});
    expect(s.app.session.hasSession()).toBe(false);
  });
});
