/* PODEŠAVANJA UREĐAJA: `ui` (backup, odlaganje, sat treninga, lokacija), keš prognoze i VEZE (Strava, intervals.icu).

   Veze i lokacija su PO UREĐAJU i nikad ne idu na server (`domain/sync/payload`); ovde su jer ih korisnik vidi i menja
   u Podešavanjima. Tokeni se ne prikazuju u UI-ju — komponente čitaju samo STATUS (`connected`). */

import { create } from 'zustand';
import type { PersistedState, UiState } from '../domain/state';
import {
  extrasOf,
  pickKnown,
  requestPersist,
  SETTINGS_KEYS,
  type PersistMode
} from './persistence';

export type SettingsSlice = Pick<PersistedState, (typeof SETTINGS_KEYS)[number]> & {
  /** Nepoznata polja prvog nivoa — čuvaju se i vraćaju (novija verzija ih možda koristi). */
  extras: Record<string, unknown>;
};

export interface SettingsActions {
  hydrate: (slice: SettingsSlice) => void;
  patchUi: (patch: Partial<UiState>, mode?: PersistMode) => void;
  setStrava: (v: PersistedState['strava']) => void;
  setIcu: (v: PersistedState['icu']) => void;
  setForecastCache: (v: PersistedState['vreme']) => void;
}

export const useSettingsStore = create<SettingsSlice & SettingsActions>()((set, get) => ({
  ui: {
    firstRun: null,
    lastBackup: null,
    snooze: null,
    seenWeek: null,
    geo: null,
    satTreninga: null,
    novo: null
  },
  vreme: null,
  strava: null,
  icu: null,
  extras: {},
  hydrate(slice) {
    set(slice);
  },
  patchUi(patch, mode = 'now') {
    set({ ui: { ...get().ui, ...patch } });
    requestPersist(mode);
  },
  setStrava(strava) {
    set({ strava });
    requestPersist();
  },
  setIcu(icu) {
    set({ icu });
    requestPersist();
  },
  setForecastCache(vreme) {
    set({ vreme });
    requestPersist();
  }
}));

export const settingsSliceFrom = (s: PersistedState): SettingsSlice => ({
  ...pickKnown(s, SETTINGS_KEYS),
  extras: extrasOf(s)
});

/** Povezanost bez ikakvih tokena — jedino što UI sme da vidi. */
export const useStravaConnected = (): boolean => useSettingsStore((s) => !!s.strava);
export const useIcuConnected = (): boolean =>
  useSettingsStore((s) => {
    const i = s.icu as { athleteId?: unknown; token?: unknown; apiKey?: unknown } | null;
    return !!(i && i.athleteId && (i.token || i.apiKey));
  });
