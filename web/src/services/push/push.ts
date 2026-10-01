/* OBAVEŠTENJA (Web Push): uključivanje, isključivanje, stanje i tiho osvežavanje. Šta stoji u poruci računa domen (`weekAnnouncements`); poziva ka
   serveru je `pushApi`; pregledač je iza priključka (`PushBrowser`), pa se ceo tok može proveriti bez pregledača. Ništa ne baca. */

import { IDB_KEYS, type Idb } from '../../pwa/idb';
import type { Background } from '../../pwa/background';
import type { PushApi } from './pushApi';
import { keyBytes, sameKey } from './keys';

export type Permission = 'default' | 'granted' | 'denied' | 'unsupported';

export interface PushSubscriptionLike {
  endpoint: string;
  toJSON(): unknown;
  unsubscribe(): Promise<boolean>;
  options?: { applicationServerKey?: ArrayBuffer | null };
}
export interface PushRegistration {
  pushManager: {
    getSubscription(): Promise<PushSubscriptionLike | null>;
    subscribe(opts: {
      userVisibleOnly: boolean;
      applicationServerKey: Uint8Array;
    }): Promise<PushSubscriptionLike>;
  };
}

export interface PushBrowser {
  /** `serviceWorker`, `PushManager` i `Notification` postoje (iOS ih daje SAMO instaliranoj aplikaciji). */
  supported(): boolean;
  isIos(): boolean;
  permission(): Permission;
  /** MORA iz klika: Chrome i Safari odbijaju `requestPermission()` koji nije pokrenut dodirom. */
  requestPermission(): Promise<Permission>;
  /** `navigator.serviceWorker.ready` nikad ne odbija — zato rok. */
  registration(timeoutMs: number): Promise<PushRegistration | null>;
}

export interface PushDeps {
  api: PushApi;
  browser: PushBrowser;
  background: Background;
  idb: Idb;
  isAuthed(): boolean;
  deviceId(): string | null;
  online(): boolean;
  today(): string;
  /** Najave za narednih osam dana (`weekAnnouncements`). */
  announcements(): Record<string, string>;
  /** Zapamćeno stanje na uređaju (`ui.push`, `ui.najaveDan`). */
  flags: {
    get(): { push: boolean; najaveDan: string | null };
    set(patch: { push?: boolean; najaveDan?: string | null }): void;
  };
}

export type PushResult = { ok: true; periodic?: boolean } | { ok: false; error: string };

export type PushStatus =
  | { kind: 'unsupported'; ios: boolean }
  | { kind: 'denied' }
  | { kind: 'unconfigured' }
  | { kind: 'on' }
  | { kind: 'off' };

export function createPush(deps: PushDeps) {
  const { browser, api } = deps;

  async function currentSubscription(): Promise<PushSubscriptionLike | null> {
    const reg = await browser.registration(2000);
    if (!reg?.pushManager) return null;
    try {
      return await reg.pushManager.getSubscription();
    } catch {
      return null;
    }
  }

  async function enable(): Promise<PushResult> {
    if (!browser.supported())
      return { ok: false, error: 'Ovaj pregledač ne podržava obaveštenja.' };
    if (!deps.isAuthed())
      return {
        ok: false,
        error: 'Za obaveštenja je potrebna prijava — podsetnik šalje server, ne telefon.'
      };
    const key = await api.vapid();
    if (!key) return { ok: false, error: 'Obaveštenja još nisu podešena na serveru.' };
    let permission = browser.permission();
    if (permission === 'default') {
      try {
        permission = await browser.requestPermission();
      } catch {
        permission = 'denied';
      }
    }
    if (permission !== 'granted')
      return {
        ok: false,
        error:
          'Obaveštenja su odbijena. Uključi ih u podešavanjima pregledača za ovu stranicu, pa probaj ponovo.'
      };
    const reg = await browser.registration(4000);
    if (!reg?.pushManager)
      return { ok: false, error: 'Offline kopija se još pravi — probaj za koji trenutak.' };
    let sub: PushSubscriptionLike | null = null;
    try {
      sub = await reg.pushManager.getSubscription();
    } catch {
      /* nema pretplate */
    }
    if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
      try {
        await sub.unsubscribe();
      } catch {
        /* nastavlja se sa novom */
      }
      sub = null;
    }
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(key)
        });
      } catch (e) {
        return {
          ok: false,
          error: `Pretplata nije uspela: ${e instanceof Error && e.message ? e.message : 'nepoznata greška'}`
        };
      }
    }
    const r = await api.send('prijava', {
      pretplata: sub.toJSON(),
      uredjaj: deps.deviceId(),
      najave: deps.announcements()
    });
    if (!r.ok) {
      /* Server nije primio pretplatu — ne ostavljaj je ni u pregledaču, inače Podešavanja pokazuju „uključeno" za nešto što ne može da stigne. */
      try {
        await sub.unsubscribe();
      } catch {
        /* nema šta */
      }
      return { ok: false, error: r.error };
    }
    await deps.idb.remove(IDB_KEYS.unsentSubscription);
    await deps.background.writeAccount(key);
    const periodic = await deps.background.periodicSubscribe();
    deps.flags.set({ push: true, najaveDan: deps.today() });
    return { ok: true, periodic };
  }

  /**
   * Redosled je bitan: PRVO se pretplata poništi u pregledaču, pa tek onda javlja serveru. Poništena pretplata push servis odbija sa 410, a server tada
   * sam briše red — pa čak i ako javljanje ne prođe (odjava bez signala), obaveštenja prestaju da stižu. `token` samo pri odjavi sa naloga.
   */
  async function disable(token?: string): Promise<PushResult> {
    const sub = await currentSubscription();
    let endpoint: string | null = null;
    if (sub) {
      endpoint = sub.endpoint;
      try {
        await sub.unsubscribe();
      } catch {
        /* server će je ionako obrisati na 410 */
      }
    }
    if (endpoint) await api.send('odjava', { endpoint }, token);
    await deps.idb.remove(IDB_KEYS.unsentSubscription);
    await deps.background.periodicUnsubscribe();
    /* Bez upisa zastavice ako je odjava sa naloga u toku — tada je stanje već na putu da se zameni, a upis bi ga vratio. */
    if (!token) deps.flags.set({ push: false });
    return { ok: true };
  }

  /** Brisanje naloga: pretplata se gasi u pregledaču BEZ poziva servera (red je već obrisan, a token više ne važi). */
  async function forget(): Promise<void> {
    const sub = await currentSubscription();
    if (sub) {
      try {
        await sub.unsubscribe();
      } catch {
        /* pregledač će je ionako zaboraviti */
      }
    }
    await deps.background.periodicUnsubscribe();
    await deps.background.forgetAll();
  }

  /** Pretplata nestaje bez našeg znanja (brisanje podataka pregledača, reinstalacija): zapamćeno stanje se USKLAĐUJE sa stvarnim. */
  async function status(): Promise<PushStatus> {
    if (!browser.supported()) return { kind: 'unsupported', ios: browser.isIos() };
    const permission = browser.permission();
    if (permission === 'denied') {
      if (deps.flags.get().push) deps.flags.set({ push: false });
      return { kind: 'denied' };
    }
    const key = await api.vapid();
    if (!key) return { kind: 'unconfigured' };
    const on = !!(await currentSubscription()) && permission === 'granted';
    if (deps.flags.get().push !== on) deps.flags.set({ push: on });
    return { kind: on ? 'on' : 'off' };
  }

  async function test(): Promise<PushResult> {
    const r = await api.send('proba');
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  /**
   * Pri otvaranju: pošalji ono što je service worker ostavio neposlato (`pushsubscriptionchange`) i osveži najave za narednu nedelju. Oboje tiho —
   * nijedno nije razlog za poruku na ekranu. Najave se šalju najviše jednom dnevno.
   */
  async function refreshOnStart(): Promise<void> {
    if (!browser.supported() || !deps.isAuthed() || !deps.online()) return;
    try {
      const waiting = (await deps.idb.read(IDB_KEYS.unsentSubscription)) as {
        pretplata?: unknown;
        uredjaj?: string | null;
      } | null;
      if (waiting?.pretplata) {
        const r = await api.send('prijava', {
          pretplata: waiting.pretplata,
          uredjaj: waiting.uredjaj || deps.deviceId(),
          najave: deps.announcements()
        });
        if (r.ok) {
          await deps.idb.remove(IDB_KEYS.unsentSubscription);
          await deps.background.writeAccount();
        }
        return;
      }
    } catch {
      /* nastavlja se */
    }
    if (browser.permission() !== 'granted') return;
    if (!(await currentSubscription())) return;
    await deps.background.writeAccount();
    try {
      if (deps.flags.get().najaveDan === deps.today()) return;
      const r = await api.send('najave', { najave: deps.announcements() });
      if (r.ok) deps.flags.set({ najaveDan: deps.today() });
    } catch {
      /* dodatak */
    }
  }

  return { enable, disable, forget, status, test, refreshOnStart };
}

export type Push = ReturnType<typeof createPush>;
