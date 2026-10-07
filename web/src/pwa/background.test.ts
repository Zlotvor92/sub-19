import { describe, expect, it } from 'vitest';
import { createBackground, PERIODIC_TAG, SYNC_TAG, type SyncRegistration } from './background';
import { IDB_KEYS, type Idb } from './idb';

/* parity: pozadinskiNalog, pozadinskiZaboravi, pozadinskiZakazi, pozadinskiOtkazi, periodicnaPrijava/Odjava (app.js). */

function memory(initial: Record<string, unknown> = {}): Idb & { map: Map<string, unknown> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    read: (k) => Promise.resolve(map.get(k) ?? null),
    write: (k, v) => (map.set(k, v), Promise.resolve(null)),
    remove: (k) => (map.delete(k), Promise.resolve(null))
  };
}

const SESSION: {
  userId: string | null;
  refresh: string | null;
  access: string | null;
  expiresAt: number;
  deviceId: string | null;
  seenAt: string | null;
} = {
  userId: 'u1',
  refresh: 'R',
  access: 'A',
  expiresAt: 1_900_000_000_000,
  deviceId: 'dev',
  seenAt: '2026-08-01T00:00:00Z'
};

function make(
  opts: {
    session?: Partial<typeof SESSION>;
    reg?: SyncRegistration | null;
    authed?: boolean;
    loadFailed?: boolean;
    idb?: Record<string, unknown>;
    permission?: string | null;
  } = {}
) {
  const idb = memory(opts.idb);
  const bg = createBackground({
    idb,
    registration: () => Promise.resolve(opts.reg === undefined ? {} : opts.reg),
    session: () => ({ ...SESSION, ...opts.session }),
    payload: () => ({ v: 11 }),
    loadFailed: () => !!opts.loadFailed,
    isAuthed: () => opts.authed ?? true,
    supabaseUrl: 'https://x.supabase.co',
    anonKey: 'ANON',
    now: () => 1234,
    periodicPermission: () => Promise.resolve(opts.permission ?? null)
  });
  return { bg, idb };
}

describe('zapis o nalogu za pozadinu', () => {
  it('pristupni token i isticeMs u MILISEKUNDAMA; refresh token NIKAD (rotira se pri upotrebi)', async () => {
    const m = make();
    await m.bg.writeAccount('VAPID');
    const rec = m.idb.map.get(IDB_KEYS.account) as Record<string, unknown>;
    expect(rec).toEqual({
      url: 'https://x.supabase.co',
      anon: 'ANON',
      userId: 'u1',
      uredjaj: 'dev',
      access: 'A',
      isticeMs: 1_900_000_000_000,
      vapid: 'VAPID'
    });
    expect(JSON.stringify(rec)).not.toMatch(/"R"|refresh/);
  });

  it('ključ se čuva kad novi poziv nema ključ; bez prijave ništa ne piše', async () => {
    const m = make({ idb: { [IDB_KEYS.account]: { vapid: 'STARI' } } });
    await m.bg.writeAccount();
    expect((m.idb.map.get(IDB_KEYS.account) as { vapid: string }).vapid).toBe('STARI');
    const anon = make({ session: { userId: null } });
    await anon.bg.writeAccount();
    expect(anon.idb.map.size).toBe(0);
    const noRefresh = make({ session: { refresh: null } });
    await noRefresh.bg.writeAccount();
    expect(noRefresh.idb.map.size).toBe(0);
  });

  it('zaborav briše nalog, neposlato stanje i neposlatu pretplatu', async () => {
    const m = make({
      idb: {
        [IDB_KEYS.account]: 1,
        [IDB_KEYS.queuedState]: 2,
        [IDB_KEYS.unsentSubscription]: 3,
        drugo: 4
      }
    });
    await m.bg.forgetAll();
    expect([...m.idb.map.keys()]).toEqual(['drugo']);
  });
});

describe('odložen upis (Background Sync)', () => {
  it('upisuje KOPIJU stanja i nalog pa registruje `sync`', async () => {
    const tags: string[] = [];
    const m = make({ reg: { sync: { register: (t) => (tags.push(t), Promise.resolve()) } } });
    expect(await m.bg.schedule()).toBe(true);
    expect(tags).toEqual([SYNC_TAG]);
    expect(m.idb.map.get(IDB_KEYS.queuedState)).toEqual({
      userId: 'u1',
      seenAt: '2026-08-01T00:00:00Z',
      podaci: { v: 11 },
      at: 1234
    });
    expect(m.idb.map.has(IDB_KEYS.account)).toBe(true);
    await m.bg.cancel();
    expect(m.idb.map.has(IDB_KEYS.queuedState)).toBe(false);
  });

  it('ne radi bez prijave, kad se stanje nije učitalo ispravno, bez registracije i bez podrške (iOS)', async () => {
    const reg: SyncRegistration = { sync: { register: () => Promise.resolve() } };
    expect(await make({ reg, authed: false }).bg.schedule()).toBe(false);
    expect(await make({ reg, loadFailed: true }).bg.schedule()).toBe(false);
    expect(await make({ reg: null }).bg.schedule()).toBe(false);
    const ios = make({ reg: {} });
    expect(await ios.bg.schedule()).toBe(false);
    expect(ios.idb.map.size).toBe(0);
  });

  it('greška registracije ne baca', async () => {
    const m = make({ reg: { sync: { register: () => Promise.reject(new Error('x')) } } });
    expect(await m.bg.schedule()).toBe(false);
  });
});

describe('povremeno osvežavanje (Periodic Sync)', () => {
  it('prijava samo uz dozvolu (`granted` ili nepoznato); odjava skida oznaku', async () => {
    const registered: Array<[string, number]> = [];
    const unregistered: string[] = [];
    const reg: SyncRegistration = {
      periodicSync: {
        register: (t, o) => (registered.push([t, o.minInterval]), Promise.resolve()),
        unregister: (t) => (unregistered.push(t), Promise.resolve())
      }
    };
    expect(await make({ reg, permission: 'granted' }).bg.periodicSubscribe()).toBe(true);
    expect(await make({ reg, permission: null }).bg.periodicSubscribe()).toBe(true);
    expect(await make({ reg, permission: 'denied' }).bg.periodicSubscribe()).toBe(false);
    expect(await make({ reg: {} }).bg.periodicSubscribe()).toBe(false);
    expect(registered).toEqual([
      [PERIODIC_TAG, 12 * 3600 * 1000],
      [PERIODIC_TAG, 12 * 3600 * 1000]
    ]);
    await make({ reg }).bg.periodicUnsubscribe();
    expect(unregistered).toEqual([PERIODIC_TAG]);
  });
});
