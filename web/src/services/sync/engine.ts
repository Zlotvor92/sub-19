/* MOTOR SINHRONIZACIJE — jedino mesto koje piše na server i jedino koje čita `user_state` radi usvajanja.

   NAJRIZIČNIJI DEO APLIKACIJE: stanje je jedan blob, pa pogrešan upis briše celu tuđu sesiju (kilaža i povrede se
   unose rukom i ne postoje nigde drugde). Pravila su u `domain/sync` kao čiste funkcije sa testovima; ovde je samo
   redosled i zastavice:

   - ZAUZET NIJE ISTO ŠTO I ODRAĐEN. Push koji naiđe na tekući upis ne propada nego pamti `again` i ponavlja se čim
     tekući završi: odloženi upis (4 s) je u letu, čovek prebaci aplikaciju u pozadinu, `visibilitychange` zove push —
     i dobije `false`, a aplikacija je već zamrznuta pa najsvežiju izmenu nema ko da pošalje.
   - ZAUZEĆE SE PODIŽE PRE PROVERE SUKOBA. Provera je mrežni poziv, dakle stvarna pauza; dok traje, drugi push bi prošao
     pored zastavice i oba bi krenula da pišu.
   - PROVERA SUKOBA PRE SVAKOG UPISA, ne samo pri pokretanju (odloženi upis, `visibilitychange` i dugme „Sinhronizuj"
     su svi išli pravo na POST).
   - DOK TRAJE PITANJE O SUKOBU, NIŠTA SE NE ŠALJE. Traka nije modalna (ne sme da zaključa aplikaciju), pa je sve
     ostalo radilo i prepisivalo serversku kopiju lokalnom — na svežem uređaju praznom.
   - NE GURAJ PRAZNO STANJE kad se lokalni zapis nije mogao pročitati.
   - „Uzmi sa servera" zatvara sukob TEK POSLE USPEHA. Neuspelo povlačenje ostavlja sve kako jeste: čovek je izabrao
     „server pobeđuje", a lokalno stanje prvim sledećim upisom pregazi serversko — suprotno od izbora. */

import type { PersistedState } from '../../domain/state';
import { migrateState } from '../../domain/state';
import {
  PUSH_DEBOUNCE_MS,
  adoptServerState,
  canPush,
  decideStartup,
  isForeignNewer,
  isLocalEmpty,
  type ServerRow
} from '../../domain/sync';
import type { UserStateApi } from '../api/userStateApi';
import type { SessionManager } from '../supabase/session';

export interface SyncStatus {
  /** Tekući upis. */
  busy: boolean;
  /** Tuđi noviji zapis čeka odluku; do tada ništa ne ide na server. */
  conflict: { remoteAt: string } | null;
  /** Lokalni zapis se nije mogao pročitati: upis je zaustavljen dok čovek ne odluči. */
  loadFailed: boolean;
}

export interface SyncDeps {
  session: SessionManager;
  api: UserStateApi;
  getState: () => PersistedState;
  /** Usvaja stanje koje je stiglo sa servera (već spojeno sa lokalnim vezama/lokacijom). */
  adopt: (state: PersistedState) => void;
  appVersion: string;
  stateOwner?: () => string | null;
  /** Lokalni zapis se nije mogao pročitati pri učitavanju. */
  loadFailed?: boolean;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  /** Pozadinski red (service worker `sync`): privremeni neuspeh se ponavlja i kad je aplikacija zatvorena. */
  background?: { schedule(): void; cancel(): void };
  /** Uspešan upis — okidač za dodatke (javni profil zajednice). Neuspeh ovde NIKAD ne sme da obori sync. */
  onPushed?: () => void;
}

export type StartOutcome = 'offline' | 'pushed' | 'conflict';
export type ConflictChoice = 'pull' | 'push';
export type ResolveResult =
  | { ok: true }
  | { ok: false; reason: 'pull-failed' | 'push-failed' | 'confirm-empty-needed' | 'no-conflict' };

export interface SyncEngine {
  readonly status: SyncStatus;
  subscribe(listener: (s: SyncStatus) => void): () => void;
  /** Odloženo (4 s) — poziva se posle svakog `save()`. */
  schedulePush(): void;
  /** Odmah (odlazak u pozadinu). */
  pushNow(): Promise<boolean>;
  pull(): Promise<boolean>;
  /** Pri pokretanju, POSLE provere sesije. */
  start(): Promise<StartOutcome>;
  resolveConflict(
    choice: ConflictChoice,
    opts?: { confirmedEmpty?: boolean }
  ): Promise<ResolveResult>;
  /** Čovek je svesno izabrao da server pobedi nad nečitljivim lokalnim zapisom. */
  acknowledgeLoadFailure(): void;
  /** Dugme „Sinhronizuj". */
  syncNow(): Promise<boolean>;
  reset(loadFailed?: boolean): void;
}

export function createSyncEngine(deps: SyncDeps): SyncEngine {
  const setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const listeners = new Set<(s: SyncStatus) => void>();
  let status: SyncStatus = { busy: false, conflict: null, loadFailed: !!deps.loadFailed };
  let again = false;
  let timer: unknown = null;

  const set = (patch: Partial<SyncStatus>): void => {
    status = { ...status, ...patch };
    for (const l of listeners) l(status);
  };
  const toRow = (r: Awaited<ReturnType<UserStateApi['remoteRow']>>): ServerRow | null =>
    r.kind === 'row' ? { at: r.at, device: r.device } : null;

  const openConflict = (remoteAt: string): void => set({ conflict: { remoteAt } });

  async function push(): Promise<boolean> {
    if (!deps.session.isAuthed()) return false;
    /* ZAUZET: pamti se da ima novijeg i ponavlja se čim tekući završi. */
    if (status.busy) {
      again = true;
      return false;
    }
    const verdict = canPush({
      authenticated: true,
      loadFailed: status.loadFailed,
      conflictOpen: status.conflict != null
    });
    if (verdict === 'skip') return false;
    const userId = deps.session.state.userId;
    const sameOwner = (): boolean =>
      deps.session.state.userId === userId && (!deps.stateOwner || deps.stateOwner() === userId);
    if (!sameOwner()) return false;
    set({ busy: true });
    try {
      if (!(await deps.session.ensure()) || !sameOwner()) return false;
      const row = await deps.api.remoteRow();
      if (!sameOwner()) return false;
      if (row.kind === 'unknown') {
        deps.background?.schedule();
        return false;
      }
      const remote = toRow(row);
      if (isForeignNewer(remote, deps.session.state.seenAt, deps.session.state.deviceId)) {
        openConflict((remote as ServerRow).at);
        return false;
      }
      const state = deps.getState();
      const res = await deps.api.push(
        state,
        deps.session.state.deviceId ?? '',
        deps.appVersion,
        row.kind === 'row' ? row.at : null
      );
      if (!sameOwner()) return false;
      if (!res.ok) {
        if (res.conflict) {
          const latest = await deps.api.remoteRow();
          if (sameOwner())
            openConflict(latest.kind === 'row' ? latest.at : row.kind === 'row' ? row.at : '');
        }
        if (res.retryable) deps.background?.schedule();
        return false;
      }
      if (res.updatedAt) deps.session.patch({ seenAt: res.updatedAt });
      deps.background?.cancel();
      try {
        deps.onPushed?.();
      } catch {
        /* dodatak: njegov neuspeh ne sme da prijavi da sinhronizacija nije prošla */
      }
      return true;
    } catch {
      if (sameOwner()) deps.background?.schedule();
      return false;
    } finally {
      set({ busy: false });
      /* Nešto je stiglo dok je ovaj upis trajao — pošalji i to (šalje se najnovije stanje, ne zatečeno). */
      if (again) {
        again = false;
        setTimer(() => {
          void push();
        }, 0);
      }
    }
  }

  async function pull(): Promise<boolean> {
    if (!deps.session.isAuthed()) return false;
    const userId = deps.session.state.userId;
    if (!(await deps.session.ensure()) || deps.session.state.userId !== userId) return false;
    const r = await deps.api.pull();
    if (
      !r.ok ||
      deps.session.state.userId !== userId ||
      (deps.stateOwner && deps.stateOwner() !== userId)
    )
      return false;
    /* `migrateState` vraća null za neprepoznat oblik: bez provere bi stanje postalo null i aplikacija ostala razbijena. */
    const migrated = migrateState(r.data);
    if (!migrated) return false;
    deps.session.patch({ seenAt: r.updatedAt });
    deps.adopt(adoptServerState(migrated, deps.getState()));
    return true;
  }

  return {
    get status() {
      return status;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    schedulePush() {
      if (!deps.session.isAuthed()) return;
      if (status.conflict) return; // dok traje pitanje, ništa se ne zakazuje
      if (timer != null) clearTimer(timer);
      timer = setTimer(() => {
        timer = null;
        void push();
      }, PUSH_DEBOUNCE_MS);
    },
    reset(loadFailed = false) {
      if (timer != null) clearTimer(timer);
      timer = null;
      again = false;
      set({ conflict: null, loadFailed });
    },
    async pushNow() {
      if (timer != null) clearTimer(timer);
      timer = null;
      return push();
    },
    pull,
    async start() {
      const userId = deps.session.state.userId;
      const row = await deps.api.remoteRow();
      if (deps.session.state.userId !== userId || (deps.stateOwner && deps.stateOwner() !== userId))
        return 'offline';
      if (row.kind === 'unknown') return 'offline'; // nema signala — radi lokalno
      const remote = toRow(row);
      const decision = decideStartup(
        deps.session.state.seenAt,
        remote,
        deps.session.state.deviceId
      );
      /* 'ok' ne znači „nema šta da se radi": lokalno je moglo biti izmenjeno POSLE poslednjeg uspešnog upisa koji
         nikad nije stigao (aplikacija zatvorena pre isteka 4 s). Zato i 'ok' i 'push' guraju trenutno stanje. Jedini
         slučaj kad se NE gura je 'ask'. */
      if (decision === 'push' || decision === 'ok') {
        void push();
        return 'pushed';
      }
      openConflict((remote as ServerRow).at);
      return 'conflict';
    },
    async resolveConflict(choice, opts = {}) {
      const conflict = status.conflict;
      if (!conflict) return { ok: false, reason: 'no-conflict' };
      if (choice === 'pull') {
        const ok = await pull().catch(() => false);
        if (!ok) return { ok: false, reason: 'pull-failed' }; // sukob OSTAJE
        set({ conflict: null });
        return { ok: true };
      }
      /* PRAZNO PREKO PUNOG: svež uređaj, ništa lokalno — pita se još jednom, imenom stvari koje odlaze. */
      if (isLocalEmpty(deps.getState()) && !opts.confirmedEmpty)
        return { ok: false, reason: 'confirm-empty-needed' };
      /* IZBOR SE PAMTI: `seenAt` se pomera na verziju koju je čovek upravo video i svesno pregazio — inače bi
         `push` video isti zapis, ponovo digao traku i nikad ne bi prošao. */
      deps.session.patch({ seenAt: conflict.remoteAt });
      set({ conflict: null });
      const ok = await push();
      return ok ? { ok: true } : { ok: false, reason: 'push-failed' };
    },
    acknowledgeLoadFailure() {
      set({ loadFailed: false });
    },
    async syncNow() {
      if (timer != null) clearTimer(timer);
      timer = null;
      return push();
    }
  };
}
