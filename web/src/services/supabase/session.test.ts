import { describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '@/test/fakeSupabase';
import { SB_KEY } from '../storage/keys';
import { createKeyValueStore, type StorageLike } from '../storage/kv';
import {
  BANNED_MESSAGE,
  DEAD_SESSION_MESSAGE,
  createSessionManager,
  emptySession
} from './session';

/* parity: test/mreza-rok.test.mjs (sbEnsure, sbProveriSesiju), test/ikonica-obavestenja, test/sw-azuriranje.
   Namera: SAMO izričito odbijanje obara sesiju; konkurentni refresh je jedan; sesija preživljava prelazak. */

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
const jwt = (c: unknown): string => `${b64({ alg: 'HS256' })}.${b64(c)}.sig`;
const URL_ = 'https://x.supabase.co';

function setup(
  over: Partial<ReturnType<typeof emptySession>> = {},
  fake = createFakeSupabase(),
  now = () => fake.clock.value
) {
  const store = new Mem();
  const session0 = {
    ...emptySession('dTEST'),
    access: jwt({ sub: 'u1', email: 'a@b.rs' }),
    refresh: 'REFRESH-1',
    userId: 'u1',
    email: 'a@b.rs',
    expiresAt: fake.clock.value + 3600_000,
    ...over
  };
  store.setItem(SB_KEY, JSON.stringify(session0));
  const onDead = vi.fn();
  const onChanged = vi.fn();
  const m = createSessionManager({
    kv: createKeyValueStore(store),
    fetcher: fake.fetcher,
    supabaseUrl: URL_,
    anonKey: 'anon',
    now,
    random: () => 'rnd',
    onDead,
    onChanged
  });
  return { m, fake, store, onDead, onChanged };
}

describe('učitavanje i trajnost', () => {
  it('čita sesiju u starom skladišnom obliku (korisnik se ne odjavljuje pri prelasku)', () => {
    const { m } = setup();
    expect(m.isAuthed()).toBe(true);
    expect(m.hasSession()).toBe(true);
    expect(m.state.deviceId).toBe('dTEST');
  });
  it('bez ID-ja uređaja ga pravi i čuva', () => {
    const store = new Mem();
    const fake = createFakeSupabase();
    const m = createSessionManager({
      kv: createKeyValueStore(store),
      fetcher: fake.fetcher,
      supabaseUrl: URL_,
      anonKey: 'a',
      random: () => 'xyz'
    });
    expect(m.state.deviceId).toBe('dxyz');
    expect((JSON.parse(store.getItem(SB_KEY) as string) as { deviceId: string }).deviceId).toBe(
      'dxyz'
    );
  });
  it('oštećen zapis sesije = odjavljen, bez izuzetka', () => {
    const store = new Mem();
    store.setItem(SB_KEY, '{nije json');
    const fake = createFakeSupabase();
    const m = createSessionManager({
      kv: createKeyValueStore(store),
      fetcher: fake.fetcher,
      supabaseUrl: URL_,
      anonKey: 'a'
    });
    expect(m.isAuthed()).toBe(false);
  });
  it('bez URL-a ili ključa nalog nije podešen', () => {
    const fake = createFakeSupabase();
    const m = createSessionManager({
      kv: createKeyValueStore(new Mem()),
      fetcher: fake.fetcher,
      supabaseUrl: '',
      anonKey: ''
    });
    expect(m.isConfigured()).toBe(false);
    expect(m.isAuthed()).toBe(false);
  });
});

describe('osvežavanje tokena', () => {
  it('važeći token se ne osvežava (nema mrežnog poziva)', async () => {
    const { m, fake } = setup();
    expect(await m.ensure()).toBe(true);
    expect(fake.count('/auth/v1/token')).toBe(0);
  });

  it('istekao token se osvežava, čuva se novi i rok', async () => {
    const fake = createFakeSupabase();
    const { m } = setup({ expiresAt: fake.clock.value - 1 }, fake);
    expect(await m.ensure()).toBe(true);
    expect(m.state.access).toBe('ACCESS-2');
    expect(m.state.refresh).toBe('REFRESH-2');
    expect(m.state.expiresAt).toBeGreaterThan(fake.clock.value);
  });

  it('JEDAN REFRESH za pet istovremenih poziva (Supabase rotira refresh token; drugi poziv sa potrošenim tokenom dobija 400)', async () => {
    const fake = createFakeSupabase();
    const { m } = setup({ expiresAt: fake.clock.value - 1 }, fake);
    const results = await Promise.all([m.ensure(), m.ensure(), m.ensure(), m.token(), m.ensure()]);
    expect(results.slice(0, 3)).toEqual([true, true, true]);
    expect(fake.count('/auth/v1/token', 'POST')).toBe(1);
  });

  it('izričito odbijanje (400/401/403) odbacuje sesiju, čuva ID uređaja i NE dira podatke', async () => {
    for (const status of [400, 401, 403]) {
      const fake = createFakeSupabase();
      fake.refresh.status = status;
      const { m, onDead } = setup({ expiresAt: fake.clock.value - 1 }, fake);
      expect(await m.ensure()).toBe(false);
      expect(m.isAuthed()).toBe(false);
      expect(m.state.deviceId).toBe('dTEST');
      expect(onDead).toHaveBeenCalledWith(DEAD_SESSION_MESSAGE);
    }
  });

  it('5xx i mrežna greška NISU „nalog ne postoji": sesija ostaje (jedan tunel ne sme da te odjavi)', async () => {
    const fake = createFakeSupabase();
    fake.refresh.status = 503;
    const a = setup({ expiresAt: fake.clock.value - 1 }, fake);
    expect(await a.m.ensure()).toBe(false);
    expect(a.m.isAuthed()).toBe(true);
    expect(a.onDead).not.toHaveBeenCalled();
    const fake2 = createFakeSupabase();
    fake2.offline = true;
    const b = setup({ expiresAt: fake2.clock.value - 1 }, fake2);
    expect(await b.m.ensure()).toBe(false);
    expect(b.m.isAuthed()).toBe(true);
  });
});

describe('provera sesije kod servera', () => {
  it('ispravan nalog: prolazi i prepisuje ime i sliku iz odgovora (samo https, prazno ne briše postojeće)', async () => {
    const fake = createFakeSupabase();
    fake.userStatuses = [
      {
        status: 200,
        body: {
          user_metadata: {
            full_name: 'Novo Ime',
            avatar_url: 'https://lh3.googleusercontent.com/x'
          }
        }
      }
    ];
    const { m } = setup({ ime: 'Staro', slika: null }, fake);
    expect(await m.verify()).toBe(true);
    expect(m.state.ime).toBe('Novo Ime');
    expect(m.state.slika).toBe('https://lh3.googleusercontent.com/x');
  });

  it('401 NIJE „nalog ne postoji": osvežava se pa se ponavlja; prolazi ako je sada u redu', async () => {
    const fake = createFakeSupabase();
    fake.userStatuses = [{ status: 401 }, { status: 200 }];
    const { m, onDead } = setup({}, fake);
    expect(await m.verify()).toBe(true);
    expect(onDead).not.toHaveBeenCalled();
    expect(fake.count('/auth/v1/token')).toBe(1);
    expect(fake.count('/auth/v1/user')).toBe(2);
  });

  it('401 i posle osvežavanja: nalog ne postoji → kapija, ali lokalni podaci ostaju', async () => {
    const fake = createFakeSupabase();
    fake.userStatuses = [{ status: 401 }];
    const { m, onDead } = setup({}, fake);
    expect(await m.verify()).toBe(false);
    expect(onDead).toHaveBeenCalledWith(DEAD_SESSION_MESSAGE);
  });

  it('zabrana se prepoznaje po tekstu i prijavljuje odmah, bez ponovnog pokušaja', async () => {
    const fake = createFakeSupabase();
    fake.userStatuses = [{ status: 403, body: { msg: 'User is banned' } }];
    const { m, onDead } = setup({}, fake);
    expect(await m.verify()).toBe(false);
    expect(onDead).toHaveBeenCalledWith(BANNED_MESSAGE);
    expect(fake.count('/auth/v1/token')).toBe(0);
  });

  it('bez mreže ili van mreže: ništa se ne zna, sesija ostaje', async () => {
    const fake = createFakeSupabase();
    fake.offline = true;
    const { m } = setup({}, fake);
    expect(await m.verify()).toBe(true);
    const f2 = createFakeSupabase();
    const s2 = setup({}, f2);
    expect(await s2.m.verify(false)).toBe(true);
    expect(f2.requests).toHaveLength(0);
  });
});

describe('prijava i odjava', () => {
  it('adopt čita email, id, ime i sliku iz tokena i briše `seenAt` (nov nalog nije video ništa)', () => {
    const { m } = setup({ seenAt: 'stari' });
    m.adopt({
      access: jwt({
        sub: 'u9',
        email: 'n@n.rs',
        user_metadata: { full_name: 'Nova', picture: 'https://p/x' }
      }),
      refresh: 'R',
      expiresAt: 5
    });
    expect(m.state).toMatchObject({
      userId: 'u9',
      email: 'n@n.rs',
      ime: 'Nova',
      slika: 'https://p/x',
      seenAt: null
    });
  });
  it('odjava čisti tokene i identitet, zadržava ID uređaja', () => {
    const { m } = setup();
    m.logout();
    expect(m.state).toEqual(emptySession('dTEST'));
  });
  it('promena sesije se javlja pozadinskom radniku', () => {
    const { m, onChanged } = setup();
    onChanged.mockClear();
    m.patch({ seenAt: 'x' });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
