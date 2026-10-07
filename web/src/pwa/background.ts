/* POZADINA: kopija naloga i neposlatog stanja za service worker, Background Sync i Periodic Sync. Sve je DODATAK — ako pregledač nešto ne podržava (iOS
   nema Background ni Periodic Sync), aplikacija radi potpuno isto, samo bez tog dodatka. Ništa ovde ne baca.

   1. NALOG (`nalog`): pišu se i pristupni token i `isticeMs` (MILISEKUNDE, i to piše u imenu — prva verzija je promašila jedinicu), da SW sam
      proceni važi li token. REFRESH token se NAMERNO ne upisuje: pri upotrebi se rotira, pa bi ga SW potrošio i kopija u localStorage-u postala
      neupotrebljiva — korisnik bi bio odjavljen bez razloga.
   2. ODLOŽEN UPIS (`stanje`): KOPIJA onoga što je ionako u localStorage-u; ako se u pozadini išta ne poklopi, sme da se baci bez gubitka.
   3. POVREMENO OSVEŽAVANJE: traži se samo kad su obaveštenja uključena (u Chrome-u se dozvola ne dobija dijalogom nego procenom korišćenja). */

import type { SessionState } from '../services/supabase/session';
import { IDB_KEYS, type Idb } from './idb';

export interface SyncRegistration {
  sync?: { register(tag: string): Promise<void> };
  periodicSync?: {
    register(tag: string, opts: { minInterval: number }): Promise<void>;
    unregister(tag: string): Promise<void>;
  };
}

export interface BackgroundDeps {
  idb: Idb;
  /** `navigator.serviceWorker.ready` NIKAD ne odbija — ako registracije nema, samo visi; zato rok (ms), pa `null`. */
  registration(timeoutMs: number): Promise<SyncRegistration | null>;
  session(): Pick<
    SessionState,
    'userId' | 'refresh' | 'access' | 'expiresAt' | 'deviceId' | 'seenAt'
  >;
  /** Stanje u obliku u kom ide na server (`toServerPayload`). */
  payload(): unknown;
  /** Stanje se nije učitalo ispravno — ne gura se u pozadini. */
  loadFailed(): boolean;
  isAuthed(): boolean;
  supabaseUrl: string;
  anonKey: string;
  now(): number;
  /** Dozvola `periodic-background-sync` (`granted` | `denied` | `prompt`); `null` kad se ne može proveriti. */
  periodicPermission(): Promise<string | null>;
}

export const SYNC_TAG = 'sub19-stanje';
export const PERIODIC_TAG = 'sub19-osvezi';
export const PERIODIC_INTERVAL_MS = 12 * 3600 * 1000;

export function createBackground(deps: BackgroundDeps) {
  const { idb } = deps;

  /** Zapis o nalogu za pozadinu. Piše se pri prijavi i pri svakom osvežavanju tokena — tačno u trenucima kad se ono što pozadina zna promeni. */
  async function writeAccount(vapid?: string | null): Promise<void> {
    try {
      const s = deps.session();
      if (!s.userId || !s.refresh) return;
      const old = (await idb.read(IDB_KEYS.account)) as { vapid?: string | null } | null;
      if (deps.session().userId !== s.userId || !deps.isAuthed()) return;
      await idb.write(IDB_KEYS.account, {
        url: deps.supabaseUrl,
        anon: deps.anonKey,
        userId: s.userId,
        uredjaj: s.deviceId || null,
        access: s.access || null,
        isticeMs: s.expiresAt || 0,
        vapid: vapid || old?.vapid || null
      });
    } catch {
      /* dodatak */
    }
  }

  /** Odjava / mrtva sesija: pozadina ne sme da gura u tuđe ime (na tuđem telefonu bi to bio tuđ nalog). */
  async function forgetAll(): Promise<void> {
    await Promise.all([
      idb.remove(IDB_KEYS.account),
      idb.remove(IDB_KEYS.queuedState),
      idb.remove(IDB_KEYS.unsentSubscription)
    ]).catch(() => null);
  }

  /** Zove se kad upis ne uspe zbog mreže: `sync` pokreće SW čim se veza vrati, i kad je aplikacija ZATVORENA. */
  async function schedule(): Promise<boolean> {
    try {
      if (!deps.isAuthed() || deps.loadFailed()) return false;
      const userId = deps.session().userId;
      const payload = deps.payload();
      const seenAt = deps.session().seenAt || null;
      const reg = await deps.registration(2000);
      if (deps.session().userId !== userId || !deps.isAuthed()) return false;
      if (!reg?.sync) return false; // iOS nema Background Sync
      await writeAccount();
      await idb.write(IDB_KEYS.queuedState, {
        userId,
        seenAt,
        podaci: payload,
        at: deps.now()
      });
      if (deps.session().userId !== userId || !deps.isAuthed()) {
        await cancel();
        return false;
      }
      await reg.sync.register(SYNC_TAG);
      return true;
    } catch {
      return false;
    }
  }

  const cancel = (): Promise<unknown> => idb.remove(IDB_KEYS.queuedState).catch(() => null);

  async function periodicSubscribe(): Promise<boolean> {
    try {
      const reg = await deps.registration(2000);
      if (!reg?.periodicSync) return false;
      const perm = await deps.periodicPermission();
      if (perm && perm !== 'granted') return false;
      await reg.periodicSync.register(PERIODIC_TAG, { minInterval: PERIODIC_INTERVAL_MS });
      return true;
    } catch {
      return false;
    }
  }

  async function periodicUnsubscribe(): Promise<void> {
    try {
      const reg = await deps.registration(2000);
      if (reg?.periodicSync) await reg.periodicSync.unregister(PERIODIC_TAG);
    } catch {
      /* dodatak */
    }
  }

  return { writeAccount, forgetAll, schedule, cancel, periodicSubscribe, periodicUnsubscribe };
}

export type Background = ReturnType<typeof createBackground>;
