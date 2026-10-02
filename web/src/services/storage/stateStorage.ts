/* ČUVANJE I UČITAVANJE STANJA.

   Lokalno ostaje izvor istine; sinhronizacija je odložen dodatak. Pravila preuzeta iz starog koda:

   1. NE GURAJ PRAZNO STANJE PREKO SERVERSKE KOPIJE. Kad se lokalni zapis nije mogao pročitati, stanje je prazan
      seed — a serverska kopija je tada jedino mesto gde podaci još postoje. Zato učitavanje vraća `loadFailure`, i
      sync ne piše dok ga čovek svesno ne razreši. SIROV TEKST SE SAČUVA pre svega ostalog (sledeći upis ide preko
      glavnog ključa): „ništa nije obrisano" mora da bude istina.
   2. ODLOŽEN UPIS SAMO ZA POLJA U KOJA SE KUCA. `JSON.stringify` nad stanjem aktivnog korisnika (~450 KB) je 7–13 ms
      na telefonu, a sinhroni upis na disk skuplji; na svako slovo u belešci to je desetak milisekundi po pritisku.
      Brojevi, statusi i izbori idu kroz pun upis. NIŠTA SE NE GUBI: `flush()` na `blur` i odlazak u pozadinu, a svaki
      sledeći puni upis poništava zakazani. */

import { migrateState, seedState, type PersistedState } from '../../domain/state';
import { LS_KEY, LS_RESCUE_KEY } from './keys';
import type { KeyValueStore } from './kv';

export interface LoadFailure {
  reason: string;
  bytes: number;
}

export interface LoadResult {
  state: PersistedState;
  /** `null` = ispravno učitano (ili nema ničega pa je počelo od nule). */
  loadFailure: LoadFailure | null;
}

export function loadState(kv: KeyValueStore, today: string): LoadResult {
  const raw = kv.get(LS_KEY);
  if (raw) {
    try {
      const migrated = migrateState(JSON.parse(raw) as unknown);
      if (migrated) return { state: migrated, loadFailure: null };
      throw new Error('migrate() nije vratio stanje');
    } catch (e) {
      /* Sirov tekst pre svega ostalog — sledeći upis ide preko LS_KEY. */
      kv.set(LS_RESCUE_KEY, raw);
      const reason = e instanceof Error ? e.message : String(e);
      const seed = seedState();
      seed.ui.firstRun = today;
      return { state: seed, loadFailure: { reason, bytes: raw.length } };
    }
  }
  const seed = seedState();
  seed.ui.firstRun = today;
  return { state: seed, loadFailure: null };
}

export interface StateSaverOptions {
  kv: KeyValueStore;
  /** Pozvano JEDNOM po sesiji kad skladište odbije upis (kvota). */
  onWriteFailed?: (errorName: string) => void;
  /** Pozvano posle svakog upisa — okidač odloženog slanja na server. */
  onSaved?: () => void;
  delayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export interface StateSaver {
  /** Puni upis odmah; poništava zakazani. */
  save(state: PersistedState): void;
  /** Odložen upis (kucanje u polje). */
  saveSoon(getState: () => PersistedState): void;
  /** Poslednja prilika: ako je upis zakazan, izvrši ga sada. */
  flush(getState: () => PersistedState): void;
  /** Ima li zakazanog upisa. */
  readonly pending: boolean;
}

export const SAVE_DEBOUNCE_MS = 400;

export function createStateSaver(opts: StateSaverOptions): StateSaver {
  const { kv } = opts;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let writeFailed = false;

  const write = (state: PersistedState): void => {
    const json = JSON.stringify(state);
    const ok = kv.set(LS_KEY, json);
    if (ok) writeFailed = false;
    else if (!writeFailed && kv.persistent) {
      writeFailed = true;
      opts.onWriteFailed?.('QuotaExceededError');
    }
    opts.onSaved?.();
  };

  const cancel = (): void => {
    if (timer != null) clearTimer(timer);
    timer = null;
  };

  return {
    save(state) {
      cancel();
      write(state);
    },
    saveSoon(getState) {
      if (timer != null) return; // već zakazano — ne pomeraj rok unedogled
      timer = setTimer(() => {
        timer = null;
        write(getState());
      }, opts.delayMs ?? SAVE_DEBOUNCE_MS);
    },
    flush(getState) {
      if (timer == null) return;
      cancel();
      write(getState());
    },
    get pending() {
      return timer != null;
    }
  };
}
