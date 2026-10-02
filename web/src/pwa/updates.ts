/* PRAĆENJE NOVOG SERVICE WORKER-a.

   Ranije je stajalo samo `reg.addEventListener('updatefound', …)`, a taj događaj se javlja SAMO za nov SW pronađen POSLE vezivanja slušaoca.
   Pregledač sam proverava sw.js pri svakom otvaranju stranice — kad ga tada nađe i instalira pre nego što registracija odgovori, događaj je
   propušten i nov SW zauvek ostane u `reg.waiting`: traka „Osveži" se ne pojavi, stari keš se ne obriše, a offline radi stara verzija. Zato se
   gledaju SVA TRI stanja: već čeka, upravo se instalira, ili tek bude pronađen. Traka se nudi SAMO kad već postoji kontroler — na prvoj
   instalaciji nema stare verzije koju bi menjala. */

export interface WorkerLike {
  state: string;
  addEventListener(type: 'statechange', listener: () => void): void;
  postMessage(message: unknown): void;
}

export interface RegistrationLike {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
  update(): Promise<unknown>;
  /** Slušalac `updatefound` se veže JEDNOM, ne pri svakom `update()`. */
  __pratimo?: number;
}

export function watchUpdates(
  reg: RegistrationLike | null | undefined,
  hasController: () => boolean,
  offer: (worker: WorkerLike) => void
): void {
  if (!reg) return;
  const present = (w: WorkerLike): void => {
    if (hasController()) offer(w);
  };
  const follow = (w: WorkerLike | null): void => {
    if (!w) return;
    if (w.state === 'installed') {
      present(w);
      return;
    }
    w.addEventListener('statechange', () => {
      if (w.state === 'installed') present(w);
    });
  };
  follow(reg.waiting); // nov SW je već instaliran i čeka — najčešći propušten slučaj
  follow(reg.installing); // instalacija je u toku dok smo se registrovali
  if (!reg.__pratimo) {
    reg.__pratimo = 1;
    reg.addEventListener('updatefound', () => follow(reg.installing));
  }
}

export interface SwState {
  supported: boolean;
  /** Verzija koju service worker ZAISTA nosi (ne ona iz paketa koji ide network-first: taj skoči čim deploy prođe, i kad keš još stoji na staroj). */
  active: string | null;
  cache: string | null;
  waiting: boolean;
  caches: string[];
}

export interface SwStateEnv {
  hasServiceWorker: boolean;
  cacheKeys(): Promise<string[]>;
  getRegistration(): Promise<RegistrationLike | null>;
  controller(): { postMessage(message: unknown): void } | null;
  /** Veže slušaoca poruka SW-a; vraća skidanje. */
  onMessage(listener: (data: unknown) => void): () => void;
  timeout(ms: number, fn: () => void): void;
}

/** Pita SAM service worker koju verziju nosi. Odgovor se čeka najviše 1,2 s — stariji SW ne zna za poruku VERSION i nikad neće odgovoriti. */
export async function swState(env: SwStateEnv): Promise<SwState> {
  const out: SwState = { supported: false, active: null, cache: null, waiting: false, caches: [] };
  if (!env.hasServiceWorker) return out;
  out.supported = true;
  try {
    out.caches = (await env.cacheKeys()).filter((k) => /^sub19-cache-/.test(k));
  } catch {
    /* bez spiska keševa */
  }
  let reg: RegistrationLike | null = null;
  try {
    reg = await env.getRegistration();
  } catch {
    /* bez registracije */
  }
  if (!reg) return out;
  out.waiting = !!reg.waiting;
  const sw = env.controller();
  if (!sw) return out;
  out.active = await new Promise<string | null>((resolve) => {
    let done = false;
    const off = env.onMessage((data) => {
      const d = data as { type?: string; version?: unknown; cache?: unknown } | null;
      if (done || !d || d.type !== 'VERSION') return;
      done = true;
      off();
      out.cache = typeof d.cache === 'string' ? d.cache : null;
      resolve(
        typeof d.version === 'string' || typeof d.version === 'number' ? String(d.version) : ''
      );
    });
    try {
      sw.postMessage({ type: 'VERSION' });
    } catch {
      /* stariji SW */
    }
    env.timeout(1200, () => {
      if (done) return;
      done = true;
      off();
      resolve(null);
    });
  });
  return out;
}

export type RefreshOutcome =
  | { kind: 'unsupported' }
  | { kind: 'reload' }
  | { kind: 'applying' }
  | { kind: 'downloading' }
  | { kind: 'up-to-date'; version: string }
  | { kind: 'not-arrived' };

export interface RefreshEnv extends SwStateEnv {
  reloadPage(): void;
  /** Pauza (ms) posle `update()` da se nov SW stigne da pojavi. */
  wait(ms: number): Promise<void>;
  /** Povratna informacija na dugmetu: „Osvežavam…", „Proveravam…", „Preuzimam…". */
  label?(text: string): void;
  appVersion: string;
}

/**
 * Ručno osvežavanje: radi i kad trake nema. Ako nov SW čeka — pusti ga; ako ne čeka — natera proveru pa proba ponovo; ako ni tad nema ništa, znači
 * da si već na najnovijoj i to se KAŽE, umesto da dugme tiho ne uradi ništa.
 */
export async function refreshApp(env: RefreshEnv): Promise<RefreshOutcome> {
  if (!env.hasServiceWorker) return { kind: 'unsupported' };
  const skip = (w: WorkerLike): void => {
    try {
      w.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      /* nema šta */
    }
  };
  let reg: RegistrationLike | null = null;
  try {
    reg = await env.getRegistration();
  } catch {
    /* bez registracije */
  }
  if (!reg) {
    env.reloadPage();
    return { kind: 'reload' };
  }
  if (reg.waiting) {
    env.label?.('Osvežavam…');
    skip(reg.waiting);
    return { kind: 'applying' };
  }
  env.label?.('Proveravam…');
  try {
    await reg.update();
  } catch {
    /* mreža */
  }
  await env.wait(1500);
  if (reg.waiting) {
    env.label?.('Osvežavam…');
    skip(reg.waiting);
    return { kind: 'applying' };
  }
  const installing = reg.installing;
  if (installing) {
    env.label?.('Preuzimam…');
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') skip(installing);
    });
    return { kind: 'downloading' };
  }
  const st = await swState(env);
  return st.active && st.active !== env.appVersion
    ? { kind: 'not-arrived' }
    : { kind: 'up-to-date', version: env.appVersion };
}
