/* TRENING: plan, dnevnik, predikcija, lanac forme, testovi, izmene i pomeranja.

   Izvor istine za SVE što korisnik uradi sa planom. Plan se ne mutira: `resolvedPlan` je izvedeno iz (genPlan, alts,
   moves) i računa se kad se išta od toga promeni (stari kod je mutirao klon u `rebuildDateIndex`). */

import { create } from 'zustand';
import { useMemo } from 'react';
import type {
  AltRecord,
  GenPlanState,
  LogEntry,
  PersistedState,
  T3kRecord,
  VdotRecord
} from '../domain/state';
import {
  clearAlt as domainClearAlt,
  resolvePlan,
  setAlt as domainSetAlt,
  swapDays as domainSwapDays,
  undoWeekMoves as domainUndoWeekMoves,
  type AltInput,
  type ResolvedPlan
} from '../domain/plan';
import { pickKnown, requestPersist, TRAINING_KEYS, type PersistMode } from './persistence';

export type TrainingSlice = Pick<PersistedState, (typeof TRAINING_KEYS)[number]>;

export interface TrainingState extends TrainingSlice {
  /** Poslednja greška izvedena iz neispravnog plana (npr. pokvaren `genPlan`); `null` kad je plan ispravan. */
  planError: string | null;
}

export interface TrainingActions {
  hydrate: (slice: TrainingSlice) => void;
  /** Zamena celog plana (promena cilja). Brisanje starih `g` podataka je u `actions.activateNewPlan` (dotiče i oporavak). */
  setGenPlan: (plan: GenPlanState | null) => void;
  patchLog: (id: string, patch: Partial<LogEntry>, mode?: PersistMode) => void;
  setLog: (log: Record<string, LogEntry>) => void;
  setAlt: (id: string, input: AltInput) => { ok: true } | { ok: false; err: string };
  clearAlt: (id: string) => void;
  swapDays: (idA: string, idB: string) => { ok: true } | { ok: false; err: string };
  undoWeekMoves: (weekNumber: number) => boolean;
  setAlts: (alts: Record<string, AltRecord>) => void;
  setPlanAndAlts: (p: { genPlan: GenPlanState | null; alts: Record<string, AltRecord> }) => void;
  setVdotLog: (list: VdotRecord[]) => void;
  setT3k: (list: T3kRecord[]) => void;
  setPred: (pred: Record<string, unknown>) => void;
  /** Više polja odjednom, jedan upis (npr. unos tempa menja pred, zaključavanje, lanac i dnevnik). */
  patch: (p: Partial<TrainingSlice>, mode?: PersistMode) => void;
}

const empty: TrainingSlice = {
  log: {},
  pred: {},
  predLock: {},
  vdotLog: [],
  t3k: [],
  moves: {},
  alts: {},
  genPlan: null
};

export const useTrainingStore = create<TrainingState & TrainingActions>()((set, get) => {
  const commit = (patch: Partial<TrainingSlice>, mode: PersistMode = 'now'): void => {
    set(patch);
    requestPersist(mode);
  };
  const resolved = (): ResolvedPlan | null => {
    const s = get();
    return s.genPlan ? safeResolve(s.genPlan, s.alts, s.moves) : null;
  };
  return {
    ...empty,
    planError: null,
    hydrate(slice) {
      set({ ...slice, planError: null });
    },
    setGenPlan(plan) {
      commit({ genPlan: plan });
    },
    patchLog(id, patch, mode = 'now') {
      const s = get();
      commit({ log: { ...s.log, [id]: { ...s.log[id], ...patch } } }, mode);
    },
    setLog(log) {
      commit({ log });
    },
    setAlt(id, input) {
      const plan = resolved();
      if (!plan) return { ok: false, err: 'nema plana' };
      const s = get();
      const r = domainSetAlt(plan, s.log, s.alts, id, input);
      if (!r.ok) return r;
      commit({ alts: r.alts });
      return { ok: true };
    },
    clearAlt(id) {
      const r = domainClearAlt(get().alts, id);
      if (r.changed) commit({ alts: r.alts });
    },
    swapDays(idA, idB) {
      const plan = resolved();
      if (!plan) return { ok: false, err: 'nema plana' };
      const s = get();
      const r = domainSwapDays(plan, s.log, s.moves, idA, idB);
      if (!r.ok) return r;
      commit({ moves: r.moves });
      return { ok: true };
    },
    undoWeekMoves(weekNumber) {
      const plan = resolved();
      const week = plan?.weeks.find((w) => w.w === weekNumber);
      if (!week) return false;
      const r = domainUndoWeekMoves(week, get().moves);
      if (r.changed) commit({ moves: r.moves });
      return r.changed;
    },
    setAlts(alts) {
      commit({ alts });
    },
    setPlanAndAlts(p) {
      commit(p);
    },
    setVdotLog(vdotLog) {
      commit({ vdotLog });
    },
    setT3k(t3k) {
      commit({ t3k });
    },
    setPred(pred) {
      commit({ pred });
    },
    patch(p, mode = 'now') {
      commit(p, mode);
    }
  };
});

function safeResolve(
  genPlan: GenPlanState,
  alts: Record<string, AltRecord>,
  moves: Record<string, unknown>
): ResolvedPlan | null {
  try {
    return resolvePlan(genPlan.weeks, { alts, moves });
  } catch {
    return null; // pokvaren plan ne sme da obori ekran: nema plana
  }
}

/** Izvedeni plan, memoizovan po (plan, izmene, pomeranja). `null` kad nema plana ili je neispravan. */
export function useResolvedPlan(): ResolvedPlan | null {
  const genPlan = useTrainingStore((s) => s.genPlan);
  const alts = useTrainingStore((s) => s.alts);
  const moves = useTrainingStore((s) => s.moves);
  return useMemo(
    () => (genPlan ? safeResolve(genPlan, alts, moves) : null),
    [genPlan, alts, moves]
  );
}

/** Izvedeni plan iz TRENUTNOG stanja (izvan komponenti). `null` kad nema plana ili je neispravan. */
export function currentPlan(): ResolvedPlan | null {
  const s = useTrainingStore.getState();
  return s.genPlan ? safeResolve(s.genPlan, s.alts, s.moves) : null;
}

export const trainingSlice = (): TrainingSlice =>
  pickKnown(useTrainingStore.getState() as unknown as PersistedState, TRAINING_KEYS);
