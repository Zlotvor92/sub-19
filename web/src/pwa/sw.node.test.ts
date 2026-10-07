import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { renderServiceWorker, STATIC_ASSETS } from '../../scripts/sw-build.mjs';

/* parity: test/push.test.mjs (service worker u sandbox-u), test/sw-azuriranje.test.mjs (verzije, keš, spisak), test/ikonica-obavestenja.test.mjs.
   Service worker je običan JS i ne može da uvozi module, pa je izvor `sw/sw.js` ponašanje starog SW-a bez izmene; ovde se IZGRAĐENI fajl puštaju
   u pravom sandbox-u (lažni IndexedDB, caches, clients, registration). */

const SOURCE = readFileSync(new URL('../../sw/sw.js', import.meta.url), 'utf8');
const BUILD = {
  version: '283',
  files: [
    'index.html',
    'assets/index-AAAA1111.js',
    'assets/index-BBBB2222.css',
    'assets/index-AAAA1111.js.map'
  ]
};
const SW = renderServiceWorker(SOURCE, BUILD);
const ORIGIN = 'https://sub-19.vercel.app';

type Call = {
  url?: string;
  opt?: RequestInit & { body?: string };
  notification?: string;
  options?: Record<string, unknown>;
};
interface Opts {
  idb?: Record<string, unknown>;
  fetch?: (url: string, opt: RequestInit) => Promise<unknown>;
  clients?: unknown[];
}

function fakeIdb(initial: Record<string, unknown> = {}) {
  const map = new Map(Object.entries(initial));
  const request = (v: unknown) => {
    const z: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
    queueMicrotask(() => {
      z.result = v;
      z.onsuccess?.();
    });
    return z;
  };
  const store = {
    get: (k: string) => request(map.get(k)),
    put: (v: unknown, k: string) => {
      map.set(k, v);
      return request(undefined);
    },
    delete: (k: string) => {
      map.delete(k);
      return request(undefined);
    }
  };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    transaction: () => ({ objectStore: () => store })
  };
  return { map, api: { open: () => request(db) } };
}

function runSw(opts: Opts = {}, source: string = SW) {
  const idb = fakeIdb(opts.idb);
  const listeners: Record<string, (e: unknown) => unknown> = {};
  const calls: Call[] = [];
  const location = { href: `${ORIGIN}/sw.js`, origin: ORIGIN };
  const ctx: Record<string, unknown> = {
    console,
    Response,
    queueMicrotask,
    setTimeout,
    clearTimeout,
    URL,
    Intl,
    atob: (s: string) => Buffer.from(s, 'base64').toString('binary'),
    indexedDB: idb.api,
    caches: {
      open: () => Promise.resolve({ add: () => Promise.resolve(), put: () => Promise.resolve() }),
      keys: () => Promise.resolve([]),
      match: () => Promise.resolve(null),
      delete: () => Promise.resolve(true)
    },
    fetch: (u: string, o: RequestInit = {}) => {
      calls.push({ url: String(u), opt: o as Call['opt'] });
      return (opts.fetch ?? (() => Promise.resolve({ ok: true, status: 200 })))(String(u), o);
    },
    location,
    self: {
      addEventListener: (t: string, f: (e: unknown) => unknown) => {
        listeners[t] = f;
      },
      location,
      registration: {
        scope: `${ORIGIN}/`,
        showNotification: (n: string, o: Record<string, unknown>) => {
          calls.push({ notification: n, options: o });
          return Promise.resolve();
        },
        update: () => Promise.resolve(),
        pushManager: { subscribe: () => Promise.resolve(null) }
      },
      clients: {
        matchAll: () => Promise.resolve(opts.clients ?? []),
        claim: () => Promise.resolve(),
        openWindow: () => Promise.resolve()
      },
      skipWaiting: () => undefined
    }
  };
  ctx['globalThis'] = ctx;
  runInNewContext(source, ctx);
  return { listeners, calls, idb, ctx };
}

type Sw = ReturnType<typeof runSw>;
function fire(sw: Sw, type: string, event: Record<string, unknown>): Promise<unknown> {
  let promise: unknown = null;
  sw.listeners[type]?.({ waitUntil: (p: unknown) => (promise = p), ...event });
  return Promise.resolve(promise);
}

const ACCOUNT = {
  url: 'https://x.supabase.co',
  anon: 'anon',
  userId: 'u1',
  uredjaj: 'ovaj',
  access: 'jwt',
  isticeMs: Date.now() + 3600e3,
  vapid: 'BPubKey'
};
const QUEUE = {
  userId: ACCOUNT.userId,
  seenAt: '2026-08-06T10:00:00Z',
  podaci: { v: 9 },
  at: Date.now()
};
const posts = (sw: Sw): Call[] =>
  sw.calls.filter((c) => c.opt?.method === 'POST' || c.opt?.method === 'PATCH');
const json = (v: unknown) => () => Promise.resolve(v);

describe('izgradnja service workera', () => {
  it('upisuje verziju, ime keša sa hešom spiska i spisak hešovanih fajlova (bez mapa izvora)', () => {
    expect(SW).toMatch(/const APP_VERSION = '283';/);
    const cache = /const CACHE = '([^']+)';/.exec(SW)?.[1] ?? '';
    expect(cache).toMatch(/^sub19-cache-v283-[0-9a-f]{8}$/);
    for (const f of ['./assets/index-AAAA1111.js', './assets/index-BBBB2222.css'])
      expect(SW).toContain(`'${f}'`);
    expect(SW).not.toContain('.js.map');
    for (const a of STATIC_ASSETS) expect(SW).toContain(`'${a}'`);
    expect(SW).not.toContain('__');
  });

  it('promena spiska menja ime keša (inače se stari keš ne bi brisao u `activate`) i bajtove fajla (inače pregledač ne vidi novu verziju)', () => {
    const other = renderServiceWorker(SOURCE, {
      ...BUILD,
      files: [...BUILD.files, 'assets/new-CCCC3333.js']
    });
    expect(other).not.toBe(SW);
    expect(/const CACHE = '([^']+)'/.exec(other)?.[1]).not.toBe(
      /const CACHE = '([^']+)'/.exec(SW)?.[1]
    );
    expect(renderServiceWorker(SOURCE, BUILD)).toBe(SW); // ista izgradnja → isti bajtovi
  });

  it('ime keša prati APP_VERSION; sw-reg.js i privacy/uputstvo su na spisku; nema app.js', () => {
    expect(/const CACHE = '([^']+)'/.exec(SW)?.[1]).toMatch(/v283/);
    expect(SW).toContain("'./sw-reg.js'");
    expect(SW).toContain("'./privacy.html'");
    expect(SW).not.toContain("'./app.js'");
  });

  it('bedž je jednobojan (Android ga crta kao masku): badge-96, ne ikonica u boji', () => {
    expect(SW).toMatch(/badge: '\.\/badge-96\.png'/);
  });

  it('sluša sve događaje koje aplikacija registruje', () => {
    for (const e of [
      'install',
      'activate',
      'fetch',
      'message',
      'push',
      'notificationclick',
      'pushsubscriptionchange',
      'sync',
      'periodicsync'
    ])
      expect(SW).toContain(`addEventListener('${e}'`);
  });

  it('pozadina čita `isticeMs` bez množenja sa 1000 (prva verzija je promašila jedinicu)', () => {
    expect(SW).toMatch(/nalog\.isticeMs/);
    expect(/isticeMs[^\n]*\*\s*1000/.test(SW)).toBe(false);
  });
});

describe('životni ciklus i keš', () => {
  it('instalacija NE preskače čekanje (čeka „Osveži"); SKIP_WAITING poruka ga preskače; VERSION odgovara verzijom i kešom', async () => {
    let skipped = 0;
    const sw = runSw();
    (sw.ctx['self'] as { skipWaiting: () => void }).skipWaiting = () => skipped++;
    await fire(sw, 'install', {});
    expect(skipped).toBe(0);
    sw.listeners['message']?.({ data: { type: 'SKIP_WAITING' } });
    expect(skipped).toBe(1);
    const sent: unknown[] = [];
    sw.listeners['message']?.({
      data: { type: 'VERSION' },
      source: { postMessage: (m: unknown) => sent.push(m) }
    });
    expect(sent[0]).toMatchObject({ type: 'VERSION', version: '283' });
  });

  it('jedan fajl koji ne može da se keširira NE obara instalaciju (allSettled, ne addAll)', async () => {
    const sw = runSw();
    const added: string[] = [];
    (sw.ctx['caches'] as { open: () => Promise<unknown> }).open = () =>
      Promise.resolve({
        add: (a: string) =>
          a === './icon-32.png'
            ? Promise.reject(new Error('404'))
            : (added.push(a), Promise.resolve())
      });
    await expect(fire(sw, 'install', {})).resolves.toBeUndefined();
    expect(added.length).toBeGreaterThan(10);
  });

  it('aktivacija briše sve keševe osim trenutnog i preuzima kontrolu', async () => {
    const sw = runSw();
    const current = /const CACHE = '([^']+)'/.exec(SW)?.[1];
    const deleted: string[] = [];
    let claimed = 0;
    const caches = sw.ctx['caches'] as Record<string, unknown>;
    caches['keys'] = () => Promise.resolve(['sub19-cache-v282', current, 'tudji']);
    caches['delete'] = (k: string) => (deleted.push(k), Promise.resolve(true));
    (sw.ctx['self'] as { clients: { claim: () => Promise<void> } }).clients.claim = () => (
      claimed++,
      Promise.resolve()
    );
    await fire(sw, 'activate', {});
    expect(deleted.sort()).toEqual(['sub19-cache-v282', 'tudji'].sort());
    expect(claimed).toBe(1);
  });

  it('fetch: /api/, Strava i tuđi domeni se ne presreću; POST se ne presreće; navigacija ide network-first', () => {
    const sw = runSw();
    const responded: unknown[] = [];
    const ev = (url: string, over: Record<string, unknown> = {}) => ({
      request: { url, method: 'GET', mode: 'cors', ...over },
      respondWith: (p: unknown) => responded.push(p)
    });
    sw.listeners['fetch']?.(ev(`${ORIGIN}/api/analyze`));
    sw.listeners['fetch']?.(ev('https://www.strava.com/api/v3/athlete'));
    sw.listeners['fetch']?.(ev('https://lh3.googleusercontent.com/a/x'));
    sw.listeners['fetch']?.(ev(`${ORIGIN}/`, { method: 'POST' }));
    expect(responded).toHaveLength(0);
    sw.listeners['fetch']?.(ev(`${ORIGIN}/`, { mode: 'navigate' }));
    sw.listeners['fetch']?.(ev(`${ORIGIN}/assets/index-AAAA1111.js`));
    expect(responded).toHaveLength(2);
  });
});

describe('pozadinski upis stanja (Background Sync)', () => {
  const merge = (rows: unknown[]) => (u: string) =>
    Promise.resolve(
      u.includes('select=updated_at')
        ? { ok: true, status: 200, json: json(rows) }
        : { ok: true, status: 201 }
    );

  it('uspešan upis briše red — inače bi se ponavljao doveka', async () => {
    const sw = runSw({ idb: { nalog: ACCOUNT, stanje: QUEUE }, fetch: merge([]) });
    await fire(sw, 'sync', { tag: 'sub19-stanje' });
    expect(sw.idb.map.has('stanje')).toBe(false);
    const post = posts(sw)[0];
    expect(post).toBeDefined();
    expect((JSON.parse(post?.opt?.body as string) as { device_id: string }).device_id).toBe('ovaj');
  });

  it('tuđa novija izmena se NE gazi — stanje je jedan blob', async () => {
    const sw = runSw({
      idb: { nalog: ACCOUNT, stanje: QUEUE },
      fetch: merge([{ updated_at: '2026-08-06T12:00:00Z', device_id: 'drugi' }])
    });
    await fire(sw, 'sync', { tag: 'sub19-stanje' });
    expect(posts(sw)).toHaveLength(0);
    expect(sw.idb.map.has('stanje')).toBe(false);
  });

  it('zastareli pozadinski red ne gazi noviji foreground upis istog uređaja', async () => {
    const sw = runSw({
      idb: { nalog: ACCOUNT, stanje: QUEUE },
      fetch: merge([{ updated_at: '2026-08-06T12:00:00Z', device_id: 'ovaj' }])
    });
    await fire(sw, 'sync', { tag: 'sub19-stanje' });
    expect(posts(sw)).toHaveLength(0);
  });

  it('istekao token odustaje TIHO; token se NE osvežava iz pozadine (rotacija bi odjavila korisnika)', async () => {
    const expired = runSw({
      idb: { nalog: { ...ACCOUNT, isticeMs: Date.now() - 10e3 }, stanje: QUEUE }
    });
    await fire(expired, 'sync', { tag: 'sub19-stanje' });
    expect(expired.calls).toHaveLength(0);
    expect(expired.idb.map.has('stanje')).toBe(false);

    const ok = runSw({ idb: { nalog: ACCOUNT, stanje: QUEUE }, fetch: merge([]) });
    await fire(ok, 'sync', { tag: 'sub19-stanje' });
    expect(ok.calls.some((c) => c.url?.includes('grant_type=refresh_token'))).toBe(false);
    expect(JSON.stringify([...ok.idb.map.values()])).not.toMatch(/refresh/);
  });

  it('privremena greška (5xx) baca da bi pregledač ponovio; trajna (4xx) ne ponavlja', async () => {
    const down = runSw({
      idb: { nalog: ACCOUNT, stanje: QUEUE },
      fetch: (u) =>
        Promise.resolve(
          u.includes('select=updated_at')
            ? { ok: true, status: 200, json: json([]) }
            : { ok: false, status: 503 }
        )
    });
    await expect(fire(down, 'sync', { tag: 'sub19-stanje' })).rejects.toThrow();
    expect(down.idb.map.has('stanje')).toBe(true);

    const rejected = runSw({
      idb: { nalog: ACCOUNT, stanje: QUEUE },
      fetch: (u) =>
        Promise.resolve(
          u.includes('select=updated_at')
            ? { ok: true, status: 200, json: json([]) }
            : { ok: false, status: 401 }
        )
    });
    await fire(rejected, 'sync', { tag: 'sub19-stanje' });
    expect(rejected.idb.map.has('stanje')).toBe(false);
  });

  it('tuđa oznaka se ignoriše', async () => {
    const sw = runSw({ idb: { nalog: ACCOUNT, stanje: QUEUE } });
    await fire(sw, 'sync', { tag: 'nesto-drugo' });
    expect(sw.calls).toHaveLength(0);
    expect(sw.idb.map.has('stanje')).toBe(true);
  });
});

describe('obaveštenja u service workeru', () => {
  const shown = (sw: Sw): Call | undefined => sw.calls.find((c) => c.notification);

  it('svaki push završi kao vidljivo obaveštenje (userVisibleOnly: inače pregledač oduzme dozvolu)', async () => {
    const sw = runSw();
    await fire(sw, 'push', {
      data: { json: () => ({ naslov: 'Danas na planu', telo: '8×400 m', url: './?tab=danas' }) }
    });
    expect(shown(sw)).toMatchObject({
      notification: 'Danas na planu',
      options: { body: '8×400 m', data: { url: './?tab=danas' } }
    });

    const bad = runSw();
    await fire(bad, 'push', {
      data: {
        json: () => {
          throw new Error('nije JSON');
        },
        text: () => 'gola poruka'
      }
    });
    expect(shown(bad)).toBeDefined();
  });

  it('„tiho" ćuti SAMO kad je aplikacija stvarno vidljiva', async () => {
    const messages: unknown[] = [];
    const visible = {
      visibilityState: 'visible',
      url: `${ORIGIN}/`,
      postMessage: (m: unknown) => messages.push(m)
    };
    const a = runSw({ clients: [visible] });
    await fire(a, 'push', {
      data: { json: () => ({ naslov: 'Analiza je gotova', oznaka: 'ai', tiho: true }) }
    });
    expect(shown(a)).toBeUndefined();
    expect(messages[0]).toMatchObject({ type: 'PUSH' });

    const hidden = { visibilityState: 'hidden', url: `${ORIGIN}/`, postMessage: () => undefined };
    const b = runSw({ clients: [hidden] });
    await fire(b, 'push', {
      data: { json: () => ({ naslov: 'Analiza je gotova', oznaka: 'ai', tiho: true }) }
    });
    expect(shown(b)).toBeDefined();
  });

  it('klik fokusira otvorenu aplikaciju umesto da otvori drugu; bez otvorene — otvara', async () => {
    let focused = 0;
    let opened = 0;
    let navigated: string | null = null;
    const client: Record<string, unknown> = {
      url: `${ORIGIN}/`,
      focus: () => focused++,
      navigate: (u: string) => {
        navigated = u;
        return Promise.resolve(client);
      }
    };
    const sw = runSw({ clients: [client] });
    (sw.ctx['self'] as { clients: { openWindow: () => Promise<void> } }).clients.openWindow =
      () => (opened++, Promise.resolve());
    await fire(sw, 'notificationclick', {
      notification: { close: () => undefined, data: { url: './?tab=danas' } }
    });
    expect(opened).toBe(0);
    expect(navigated).toBe(`${ORIGIN}/?tab=danas`);
    expect(focused).toBe(1);

    let url: string | null = null;
    const none = runSw({ clients: [] });
    (
      none.ctx['self'] as { clients: { openWindow: (u: string) => Promise<void> } }
    ).clients.openWindow = (u) => ((url = u), Promise.resolve());
    await fire(none, 'notificationclick', {
      notification: { close: () => undefined, data: { url: './' } }
    });
    expect(url).toBe(`${ORIGIN}/`);
  });

  it('nova pretplata se sačuva i kad je ne može odmah javiti; sa važećim tokenom se javi i red se očisti', async () => {
    const fresh = {
      toJSON: () => ({ endpoint: 'https://nov.example/x', keys: { p256dh: 'p', auth: 'a' } })
    };
    const expired = runSw({ idb: { nalog: { ...ACCOUNT, isticeMs: Date.now() - 10e3 } } });
    await fire(expired, 'pushsubscriptionchange', { newSubscription: fresh });
    expect(expired.idb.map.get('pretplata-neposlata')).toMatchObject({
      pretplata: { endpoint: 'https://nov.example/x' }
    });
    expect(expired.calls).toHaveLength(0);

    const live = runSw({
      idb: { nalog: ACCOUNT },
      fetch: () => Promise.resolve({ ok: true, status: 200 })
    });
    await fire(live, 'pushsubscriptionchange', { newSubscription: fresh });
    expect(live.calls[0]?.url?.endsWith('/api/push')).toBe(true);
    expect((JSON.parse(live.calls[0]?.opt?.body as string) as { akcija: string }).akcija).toBe(
      'prijava'
    );
    expect(live.idb.map.has('pretplata-neposlata')).toBe(false);
  });
});

describe('povremeno osvežavanje (Periodic Sync)', () => {
  it('osvežava offline kopiju i pita za novu verziju; tuđa oznaka ne radi ništa', async () => {
    let updated = 0;
    let cached = 0;
    const sw = runSw();
    (sw.ctx['self'] as { registration: { update: () => Promise<void> } }).registration.update =
      () => (updated++, Promise.resolve());
    (sw.ctx['caches'] as { open: () => Promise<unknown> }).open = () =>
      Promise.resolve({ add: () => (cached++, Promise.resolve()), put: () => Promise.resolve() });
    await fire(sw, 'periodicsync', { tag: 'sub19-osvezi' });
    expect(updated).toBe(1);
    expect(cached).toBeGreaterThan(5);
    await fire(sw, 'periodicsync', { tag: 'nesto' });
    expect(updated).toBe(1);
  });
});
