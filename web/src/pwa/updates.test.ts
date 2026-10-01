import { describe, expect, it } from 'vitest';
import {
  refreshApp,
  swState,
  watchUpdates,
  type RegistrationLike,
  type WorkerLike
} from './updates';

/* parity: pratiAzuriranje, swStanje, osveziAplikaciju (app.js); test/sw-azuriranje.test.mjs. */

function setup(
  o: { waiting?: boolean; installing?: boolean; state?: string; controller?: boolean } = {}
) {
  const offered: WorkerLike[] = [];
  const listeners: Record<string, () => void> = {};
  const w: WorkerLike & { posted: unknown[] } = {
    state: o.state ?? 'installed',
    posted: [],
    addEventListener: (t, f) => {
      listeners[t] = f;
    },
    postMessage(m) {
      this.posted.push(m);
    }
  };
  const reg: RegistrationLike = {
    waiting: o.waiting ? w : null,
    installing: o.installing ? w : null,
    addEventListener: (t, f) => {
      listeners[`reg:${t}`] = f;
    },
    update: () => Promise.resolve()
  };
  const hasController = (): boolean => o.controller !== false;
  return { reg, w, offered, listeners, hasController, offer: (x: WorkerLike) => offered.push(x) };
}

describe('nov service worker se primeti u sva tri stanja', () => {
  it('već čeka pri pokretanju (reg.waiting) — ovo je bio propust', () => {
    const s = setup({ waiting: true });
    watchUpdates(s.reg, s.hasController, s.offer);
    expect(s.offered).toHaveLength(1);
  });

  it('instalira se u trenutku registracije (reg.installing): traka tek posle instalacije', () => {
    const s = setup({ installing: true, state: 'installing' });
    watchUpdates(s.reg, s.hasController, s.offer);
    expect(s.offered).toHaveLength(0);
    s.w.state = 'installed';
    s.listeners['statechange']?.();
    expect(s.offered).toHaveLength(1);
  });

  it('pronađen tek kasnije (updatefound)', () => {
    const s = setup();
    watchUpdates(s.reg, s.hasController, s.offer);
    expect(s.offered).toHaveLength(0);
    s.reg.installing = s.w;
    s.w.state = 'installed';
    s.listeners['reg:updatefound']?.();
    expect(s.offered).toHaveLength(1);
  });
});

describe('kada traka NE sme da dođe', () => {
  it('prva instalacija ikad — nema stare verzije koju bi menjala', () => {
    const s = setup({ waiting: true, controller: false });
    watchUpdates(s.reg, s.hasController, s.offer);
    expect(s.offered).toHaveLength(0);
  });

  it('ponovljeni pozivi ne dupliraju slušaoce (poziva se pri registraciji i na svaki sat)', () => {
    const s = setup({ waiting: true });
    let bound = 0;
    s.reg.addEventListener = () => void bound++;
    for (let i = 0; i < 5; i++) watchUpdates(s.reg, s.hasController, s.offer);
    expect(bound).toBe(1);
    expect(s.reg.__pratimo).toBe(1);
  });

  it('bez registracije se ne ruši', () => {
    expect(() =>
      watchUpdates(
        null,
        () => true,
        () => undefined
      )
    ).not.toThrow();
    expect(() =>
      watchUpdates(
        undefined,
        () => true,
        () => undefined
      )
    ).not.toThrow();
  });
});

function env(o: {
  reg?: RegistrationLike | null;
  version?: unknown;
  respond?: boolean;
  caches?: string[];
  controller?: boolean;
}) {
  const log: string[] = [];
  let listener: ((d: unknown) => void) | null = null;
  const environment = {
    hasServiceWorker: true,
    cacheKeys: () => Promise.resolve(o.caches ?? ['sub19-cache-v283-aaaa', 'drugi']),
    getRegistration: () => Promise.resolve(o.reg ?? null),
    controller: () =>
      o.controller === false
        ? null
        : {
            postMessage: () => {
              if (o.respond !== false)
                queueMicrotask(() =>
                  listener?.({
                    type: 'VERSION',
                    version: o.version ?? '283',
                    cache: 'sub19-cache-v283-aaaa'
                  })
                );
            }
          },
    onMessage: (l: (d: unknown) => void) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
    timeout: (ms: number, fn: () => void) => void setTimeout(fn, Math.min(ms, 20)),
    reloadPage: () => void log.push('reload'),
    wait: () => Promise.resolve(),
    label: (t: string) => void log.push(t),
    appVersion: '283'
  };
  return { environment, log };
}

describe('stanje service workera (SAM SW kaže koju verziju nosi)', () => {
  it('verzija i keš iz poruke VERSION; spisak samo naših keševa; čeka li nov', async () => {
    const reg: RegistrationLike = {
      waiting: {} as WorkerLike,
      installing: null,
      addEventListener: () => undefined,
      update: () => Promise.resolve()
    };
    const st = await swState(env({ reg }).environment);
    expect(st).toEqual({
      supported: true,
      active: '283',
      cache: 'sub19-cache-v283-aaaa',
      waiting: true,
      caches: ['sub19-cache-v283-aaaa']
    });
  });

  it('stariji SW ne odgovara: Podešavanja ne smeju da vise (rok), a verzija je nepoznata', async () => {
    const reg: RegistrationLike = {
      waiting: null,
      installing: null,
      addEventListener: () => undefined,
      update: () => Promise.resolve()
    };
    const st = await swState(env({ reg, respond: false }).environment);
    expect(st.active).toBeNull();
    expect(st.waiting).toBe(false);
  });

  it('bez podrške, bez registracije i bez kontrolera', async () => {
    expect((await swState({ ...env({}).environment, hasServiceWorker: false })).supported).toBe(
      false
    );
    expect((await swState(env({ reg: null }).environment)).active).toBeNull();
    const reg: RegistrationLike = {
      waiting: null,
      installing: null,
      addEventListener: () => undefined,
      update: () => Promise.resolve()
    };
    expect((await swState(env({ reg, controller: false }).environment)).active).toBeNull();
  });
});

describe('ručno osvežavanje', () => {
  const base = (): RegistrationLike => ({
    waiting: null,
    installing: null,
    addEventListener: () => undefined,
    update: () => Promise.resolve()
  });

  it('nema podrške → poruka; nema registracije → ponovno učitavanje', async () => {
    expect(await refreshApp({ ...env({}).environment, hasServiceWorker: false })).toEqual({
      kind: 'unsupported'
    });
    const e = env({ reg: null });
    expect(await refreshApp(e.environment)).toEqual({ kind: 'reload' });
    expect(e.log).toContain('reload');
  });

  it('nov SW čeka → pušta se', async () => {
    const posted: unknown[] = [];
    const reg = {
      ...base(),
      waiting: {
        state: 'installed',
        addEventListener: () => undefined,
        postMessage: (m: unknown) => void posted.push(m)
      } as WorkerLike
    };
    const e = env({ reg });
    expect(await refreshApp(e.environment)).toEqual({ kind: 'applying' });
    expect(posted).toEqual([{ type: 'SKIP_WAITING' }]);
    expect(e.log).toEqual(['Osvežavam…']);
  });

  it('ne čeka → provera, pa se pojavi posle `update()` → pušta se', async () => {
    const posted: unknown[] = [];
    const reg = base();
    reg.update = () => {
      reg.waiting = {
        state: 'installed',
        addEventListener: () => undefined,
        postMessage: (m: unknown) => void posted.push(m)
      };
      return Promise.resolve();
    };
    const e = env({ reg });
    expect(await refreshApp(e.environment)).toEqual({ kind: 'applying' });
    expect(e.log).toEqual(['Proveravam…', 'Osvežavam…']);
    expect(posted).toEqual([{ type: 'SKIP_WAITING' }]);
  });

  it('još se instalira → „Preuzimam…" i pušta se čim se instalira', async () => {
    const posted: unknown[] = [];
    let onState: (() => void) | null = null;
    const installing = {
      state: 'installing',
      addEventListener: (_t: string, f: () => void) => void (onState = f),
      postMessage: (m: unknown) => void posted.push(m)
    } as WorkerLike;
    const reg = { ...base(), installing };
    const e = env({ reg });
    expect(await refreshApp(e.environment)).toEqual({ kind: 'downloading' });
    installing.state = 'installed';
    (onState as (() => void) | null)?.();
    expect(posted).toEqual([{ type: 'SKIP_WAITING' }]);
  });

  it('ni tad nema ništa: „već si na najnovijoj" ili „nova verzija još nije stigla" (SW na staroj verziji) — kaže se, ne ćuti se', async () => {
    expect(await refreshApp(env({ reg: base() }).environment)).toEqual({
      kind: 'up-to-date',
      version: '283'
    });
    expect(await refreshApp(env({ reg: base(), version: '282' }).environment)).toEqual({
      kind: 'not-arrived'
    });
  });
});
