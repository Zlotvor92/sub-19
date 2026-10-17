/* OPORAVAK: bol (`knee` — ime polja je istorijsko, nosi mapu tela), težina, jutarnja merenja, trčanja pre plana i (08c, samo
   plan 5K v2) trčanja van plana. */

import { create } from 'zustand';
import type {
  OffPlanRun,
  PainRecord,
  PersistedState,
  WeightRecord,
  WellnessRecord
} from '../domain/state';
import { pickKnown, requestPersist, RECOVERY_KEYS, type PersistMode } from './persistence';

export type RecoverySlice = Pick<PersistedState, (typeof RECOVERY_KEYS)[number]>;

export interface RecoveryActions {
  hydrate: (slice: RecoverySlice) => void;
  setPain: (list: PainRecord[], mode?: PersistMode) => void;
  setWeight: (list: WeightRecord[], mode?: PersistMode) => void;
  setWellness: (map: Record<string, WellnessRecord>) => void;
  setOutOfPlan: (map: Record<string, number>) => void;
  setOffPlanRuns: (map: Record<string, OffPlanRun>) => void;
}

export const useRecoveryStore = create<RecoverySlice & RecoveryActions>()((set) => ({
  knee: [],
  kg: [],
  wellness: {},
  vanPlana: {},
  hydrate(slice) {
    set(slice);
  },
  setPain(knee, mode = 'now') {
    set({ knee });
    requestPersist(mode);
  },
  setWeight(kg, mode = 'now') {
    set({ kg });
    requestPersist(mode);
  },
  setWellness(wellness) {
    set({ wellness });
    requestPersist();
  },
  setOutOfPlan(vanPlana) {
    set({ vanPlana });
    requestPersist();
  },
  setOffPlanRuns(vanPlanaV2) {
    set({ vanPlanaV2 });
    requestPersist();
  }
}));

export const recoverySlice = (): RecoverySlice =>
  pickKnown(useRecoveryStore.getState() as unknown as PersistedState, RECOVERY_KEYS);
