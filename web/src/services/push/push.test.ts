import { beforeEach, describe, expect, it } from 'vitest';
import type { Background } from '../../pwa/background';
import { IDB_KEYS, type Idb } from '../../pwa/idb';
import { createPushApi } from './pushApi';
import {
  createPush,
  type Permission,
  type PushBrowser,
  type PushRegistration,
  type PushSubscriptionLike
} from './push';
import { createAppApi } from '../api/appApi';
import { keyBytes, sameKey } from './keys';

/* parity: pushVapid, pushPosalji, pushUkljuci, pushIskljuci, osveziObavestenja, pushOsvezi, pushIstiKljuc (app.js). Strana servera (`api/push.js`) se
   ne menja i ostaje pokrivena starim testovima. */

const KEY =
  'BKehPjxi6lJF9-yuESqsl5DQ8rqsfWJcvHnCKYrGqkn83dNsWyvT_ve7_R_HufZ8kqWf9rdUfPw9d9aKfW6Rda8';

function memoryIdb(initial: Record<string, unknown> = {}): Idb & { map: Map<string, unknown> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    read: (k) => Promise.resolve(map.get(k) ?? null),
    write: (k, v) => (map.set(k, v), Promise.resolve(null)),
    remove: (k) => (map.delete(k), Promise.resolve(null))
  };
}

function sub(endpoint = 'https://fcm.example/1', applicationServerKey?: ArrayBuffer | null) {
  const s = {
    endpoint,
    unsubscribed: 0,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: () => (s.unsubscribed++, Promise.resolve(true)),
    ...(applicationServerKey !== undefined ? { options: { applicationServerKey } } : {})
  };
  return s;
}

interface Harness {
  push: ReturnType<typeof createPush>;
  calls: Array<{ url: string; method: string; body: Record<string, unknown>; auth: string | null }>;
  idb: ReturnType<typeof memoryIdb>;
  flags: { push: boolean; najaveDan: string | null };
  background: string[];
  browser: {
    permission: Permission;
    subscription: ReturnType<typeof sub> | null;
    asked: number;
    subscribed: number;
    subscribeError: string | null;
  };
}

function make(
  opts: {
    vapid?: boolean;
    permission?: Permission;
    subscription?: ReturnType<typeof sub> | null;
    supported?: boolean;
    authed?: boolean;
    online?: boolean;
    reply?: (body: Record<string, unknown>) => { status: number; body: unknown };
    idb?: Record<string, unknown>;
    afterPrompt?: Permission;
    flags?: { push: boolean; najaveDan: string | null };
    subscribeError?: string;
  } = {}
): Harness {
  const calls: Harness['calls'] = [];
  const idb = memoryIdb(opts.idb);
  const flags = opts.flags ?? { push: false, najaveDan: null };
  const background: string[] = [];
  const state = {
    permission: opts.permission ?? 'default',
    subscription: opts.subscription ?? null,
    asked: 0,
    subscribed: 0,
    subscribeError: opts.subscribeError ?? null
  };
  const registration: PushRegistration = {
    pushManager: {
      getSubscription: () => Promise.resolve(state.subscription as PushSubscriptionLike | null),
      subscribe: () => {
        state.subscribed++;
        if (state.subscribeError) return Promise.reject(new Error(state.subscribeError));
        state.subscription = sub('https://fcm.example/new');
        return Promise.resolve(state.subscription as PushSubscriptionLike);
      }
    }
  };
  const browser: PushBrowser = {
    supported: () => opts.supported ?? true,
    isIos: () => false,
    permission: () => state.permission,
    requestPermission: () => {
      state.asked++;
      state.permission = opts.afterPrompt ?? 'granted';
      return Promise.resolve(state.permission);
    },
    registration: () => Promise.resolve(registration)
  };
  const fetcher = (url: string, init?: RequestInit): Promise<Response> => {
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body,
      auth: headers['Authorization'] ?? null
    });
    if (!init?.method || init.method === 'GET')
      return Promise.resolve(
        new Response(
          JSON.stringify(
            opts.vapid === false ? { podeseno: false } : { podeseno: true, kljuc: KEY }
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      );
    const r = opts.reply?.(body) ?? { status: 200, body: { ok: true } };
    return Promise.resolve(
      new Response(JSON.stringify(r.body), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  };
  const api = createPushApi({
    api: createAppApi({
      fetcher,
      session: { token: () => Promise.resolve(opts.authed === false ? '' : 'JWT') }
    }),
    fetcher
  });
  const bg = {
    writeAccount: (v?: string | null) => (background.push(`nalog:${v ?? ''}`), Promise.resolve()),
    periodicSubscribe: () => (background.push('periodic+'), Promise.resolve(true)),
    periodicUnsubscribe: () => (background.push('periodic-'), Promise.resolve()),
    forgetAll: () => Promise.resolve(),
    schedule: () => Promise.resolve(true),
    cancel: () => Promise.resolve(null)
  } as unknown as Background;
  const push = createPush({
    api,
    browser,
    background: bg,
    idb,
    isAuthed: () => opts.authed ?? true,
    deviceId: () => 'dev1',
    online: () => opts.online ?? true,
    today: () => '2026-07-14',
    announcements: () => ({ '2026-07-14': 'Tempo · 8 km', '2026-07-15': '' }),
    flags: {
      get: () => flags,
      set: (p) => Object.assign(flags, p)
    }
  });
  return { push, calls, idb, flags, background, browser: state };
}

describe('uključivanje', () => {
  let h: Harness;
  beforeEach(() => {
    h = make();
  });

  it('traži dozvolu iz klika, pretplati se, javi serveru uz najave, pamti stanje i prijavljuje povremeno osvežavanje', async () => {
    expect(await h.push.enable()).toEqual({ ok: true, periodic: true });
    expect(h.browser.asked).toBe(1);
    expect(h.browser.subscribed).toBe(1);
    const post = h.calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe('/api/push');
    expect(post?.auth).toBe('Bearer JWT');
    expect(post?.body).toMatchObject({
      akcija: 'prijava',
      uredjaj: 'dev1',
      najave: { '2026-07-14': 'Tempo · 8 km', '2026-07-15': '' },
      pretplata: { endpoint: 'https://fcm.example/new' }
    });
    expect(h.flags).toEqual({ push: true, najaveDan: '2026-07-14' });
    expect(h.background).toEqual([`nalog:${KEY}`, 'periodic+']);
  });

  it('odbijene prilike: bez podrške, bez prijave, bez ključa na serveru, odbijena dozvola, greška pretplate — bez ikakve promene', async () => {
    expect(await make({ supported: false }).push.enable()).toEqual({
      ok: false,
      error: 'Ovaj pregledač ne podržava obaveštenja.'
    });
    expect(await make({ authed: false }).push.enable()).toMatchObject({
      error: expect.stringMatching(/potrebna prijava/) as string
    });
    expect(await make({ vapid: false }).push.enable()).toEqual({
      ok: false,
      error: 'Obaveštenja još nisu podešena na serveru.'
    });
    const denied = make({ afterPrompt: 'denied' });
    expect(await denied.push.enable()).toMatchObject({
      error: expect.stringMatching(/^Obaveštenja su odbijena\./) as string
    });
    expect(denied.browser.subscribed).toBe(0);
    const failing = make({ subscribeError: 'blokirano' });
    expect(await failing.push.enable()).toEqual({
      ok: false,
      error: 'Pretplata nije uspela: blokirano'
    });
    expect(failing.flags.push).toBe(false);
  });

  it('server nije primio pretplatu → poništava se i u pregledaču (inače bi Podešavanja lagala)', async () => {
    const bad = make({ reply: () => ({ status: 500, body: { error: 'Baza ne radi' } }) });
    const r = await bad.push.enable();
    expect(r).toEqual({ ok: false, error: 'Baza ne radi' });
    expect(bad.browser.subscription?.unsubscribed).toBe(1);
    expect(bad.flags.push).toBe(false);
  });

  it('pretplata od starog ključa se poništava pa pravi nova (inače push servis odbija svaku poruku, a ništa to ne pokazuje)', async () => {
    const old = sub('https://fcm.example/old', new Uint8Array([4, 1, 2, 3]).buffer);
    const m = make({ permission: 'granted', subscription: old });
    await m.push.enable();
    expect(old.unsubscribed).toBe(1);
    expect(m.browser.subscribed).toBe(1);

    const same = sub('https://fcm.example/same', keyBytes(KEY).buffer as ArrayBuffer);
    const k = make({ permission: 'granted', subscription: same });
    await k.push.enable();
    expect(same.unsubscribed).toBe(0);
    expect(k.browser.subscribed).toBe(0);
  });

  it('ključ: Safari ne izlaže options (veruje se); različite dužine nisu isti ključ', () => {
    expect(sameKey(null, KEY)).toBe(true);
    expect(sameKey(undefined, KEY)).toBe(true);
    expect(sameKey(keyBytes(KEY).buffer as ArrayBuffer, KEY)).toBe(true);
    expect(sameKey(new Uint8Array([1, 2]).buffer, KEY)).toBe(false);
    expect(keyBytes(KEY)).toHaveLength(65);
  });
});

describe('isključivanje', () => {
  it('prvo poništava pretplatu u pregledaču, pa javlja serveru; briše neposlato; gasi povremeno; zastavica pada', async () => {
    const s = sub('https://fcm.example/1');
    const m = make({
      permission: 'granted',
      subscription: s,
      flags: { push: true, najaveDan: null },
      idb: { [IDB_KEYS.unsentSubscription]: { pretplata: {} } }
    });
    await m.push.disable();
    expect(s.unsubscribed).toBe(1);
    expect(m.calls.find((c) => c.method === 'POST')?.body).toEqual({
      akcija: 'odjava',
      endpoint: 'https://fcm.example/1'
    });
    expect(m.idb.map.has(IDB_KEYS.unsentSubscription)).toBe(false);
    expect(m.background).toEqual(['periodic-']);
    expect(m.flags.push).toBe(false);
  });

  it('pri odjavi sa naloga ide sa sačuvanim tokenom i NE upisuje zastavicu', async () => {
    const m = make({
      permission: 'granted',
      subscription: sub(),
      flags: { push: true, najaveDan: null }
    });
    await m.push.disable('STARI-TOKEN');
    expect(m.calls.find((c) => c.method === 'POST')?.auth).toBe('Bearer STARI-TOKEN');
    expect(m.flags.push).toBe(true);
  });

  it('bez pretplate ne zove server', async () => {
    const m = make({ permission: 'granted' });
    await m.push.disable();
    expect(m.calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });
});

describe('stanje kartice', () => {
  it('nepodržano (sa napomenom za iPhone), odbijeno, nepodešeno na serveru, uključeno, isključeno', async () => {
    expect(await make({ supported: false }).push.status()).toEqual({
      kind: 'unsupported',
      ios: false
    });
    expect(await make({ permission: 'denied' }).push.status()).toEqual({ kind: 'denied' });
    expect(await make({ vapid: false }).push.status()).toEqual({ kind: 'unconfigured' });
    expect(await make({ permission: 'granted', subscription: sub() }).push.status()).toEqual({
      kind: 'on'
    });
    expect(await make({ permission: 'granted' }).push.status()).toEqual({ kind: 'off' });
  });

  it('zapamćeno stanje se USKLAĐUJE sa stvarnim (pretplata ume da nestane bez našeg znanja)', async () => {
    const gone = make({ permission: 'granted', flags: { push: true, najaveDan: null } });
    await gone.push.status();
    expect(gone.flags.push).toBe(false);
    const denied = make({ permission: 'denied', flags: { push: true, najaveDan: null } });
    await denied.push.status();
    expect(denied.flags.push).toBe(false);
    const alive = make({
      permission: 'granted',
      subscription: sub(),
      flags: { push: false, najaveDan: null }
    });
    await alive.push.status();
    expect(alive.flags.push).toBe(true);
  });

  it('probno obaveštenje: server vraća ishod', async () => {
    expect(await make().push.test()).toEqual({ ok: true });
    expect(
      await make({ reply: () => ({ status: 400, body: { error: 'Nema pretplata' } }) }).push.test()
    ).toEqual({ ok: false, error: 'Nema pretplata' });
  });
});

describe('tiho osvežavanje pri otvaranju', () => {
  it('šalje ono što je service worker ostavio neposlato i čisti red', async () => {
    const m = make({
      idb: {
        [IDB_KEYS.unsentSubscription]: { pretplata: { endpoint: 'https://nov/x' }, uredjaj: 'dev9' }
      }
    });
    await m.push.refreshOnStart();
    const post = m.calls.find((c) => c.method === 'POST');
    expect(post?.body).toMatchObject({
      akcija: 'prijava',
      uredjaj: 'dev9',
      pretplata: { endpoint: 'https://nov/x' }
    });
    expect(m.idb.map.has(IDB_KEYS.unsentSubscription)).toBe(false);
    expect(m.background).toEqual(['nalog:']);
  });

  it('najave najviše jednom dnevno, samo uz dozvolu i pretplatu', async () => {
    const m = make({
      permission: 'granted',
      subscription: sub(),
      flags: { push: true, najaveDan: null }
    });
    await m.push.refreshOnStart();
    expect(m.calls.filter((c) => c.method === 'POST').map((c) => c.body['akcija'])).toEqual([
      'najave'
    ]);
    expect(m.flags.najaveDan).toBe('2026-07-14');
    await m.push.refreshOnStart();
    expect(m.calls.filter((c) => c.method === 'POST')).toHaveLength(1); // isti dan: ništa

    const none = make({ permission: 'default' });
    await none.push.refreshOnStart();
    const nosub = make({ permission: 'granted' });
    await nosub.push.refreshOnStart();
    const off = make({ permission: 'granted', subscription: sub(), online: false });
    await off.push.refreshOnStart();
    const anon = make({ permission: 'granted', subscription: sub(), authed: false });
    await anon.push.refreshOnStart();
    expect(
      [none, nosub, off, anon].flatMap((x) => x.calls.filter((c) => c.method === 'POST'))
    ).toHaveLength(0);
  });
});
