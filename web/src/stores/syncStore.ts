/* SINHRONIZACIJA: ogledalo `SyncEngine.status` + zastavice koje UI mora da prikaže (sukob, oštećen zapis, upis ne radi). */

import { create } from 'zustand';
import type { LoadFailure } from '../services/storage/stateStorage';

export interface SyncState {
  busy: boolean;
  /** Tuđi noviji zapis čeka odluku — dok traje, ništa se ne šalje. */
  conflict: { remoteAt: string } | null;
  /** Lokalni zapis se nije mogao pročitati (sirov tekst je spašen). */
  loadFailure: LoadFailure | null;
  /** Skladište je odbilo upis (kvota); rad se nastavlja iz memorije. */
  writeFailed: string | null;
  lastError: string | null;
}

export interface SyncActions {
  set: (patch: Partial<SyncState>) => void;
}

export const useSyncStore = create<SyncState & SyncActions>()((set) => ({
  busy: false,
  conflict: null,
  loadFailure: null,
  writeFailed: null,
  lastError: null,
  set(patch) {
    set(patch);
  }
}));
