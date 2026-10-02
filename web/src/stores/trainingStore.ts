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
import {
  ownsEntries,
  personalBaselineVdot,
  personalPlan,
  personalVisible
} from '../domain/personal';
import { isOwnerNow, useIsOwner } from './owner';
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
    const plan = activeOf(s, isOwnerNow());
    return plan ? safeResolve(plan, s.alts, s.moves) : null;
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

/**
 * AKTIVNI PLAN: pravi `genPlan`, a kad njega nema i plan sme da se vidi (vlasnik, ili ko je već upisivao treninge na njega) — ugrađeni lični plan.
 * SAMO za ČITANJE. Pisanja (promena cilja, primena predloga tempa, aktiviranje novog plana) idu na pravi `genPlan`, koji za ugrađeni plan ostaje `null`:
 * ugrađeni plan se nikad ne upisuje u perzistirano stanje.
 */
export function activeOf(
  s: Pick<TrainingSlice, 'genPlan' | 'log'>,
  isOwner: boolean
): GenPlanState | null {
  if (s.genPlan) return s.genPlan;
  return personalVisible({ hasGenPlan: false, isOwner, log: s.log })
    ? personalPlan(personalBaselineVdot(s.log))
    : null;
}

/** Aktivni plan iz TRENUTNOG stanja (izvan komponenti). */
export function activeGenPlan(): GenPlanState | null {
  return activeOf(useTrainingStore.getState(), isOwnerNow());
}

/** Aktivni plan za komponente; ponovo se računa samo kad se promeni ono od čega zavisi (pravi plan, pristup ugrađenom, polazna trka). */
export function useActiveGenPlan(): GenPlanState | null {
  const genPlan = useTrainingStore((s) => s.genPlan);
  const owner = useIsOwner();
  const entries = useTrainingStore((s) => ownsEntries(s.log));
  const baseline = useTrainingStore((s) => (s.genPlan ? null : personalBaselineVdot(s.log)));
  return useMemo(() => {
    if (genPlan) return genPlan;
    if (!(owner || entries) || baseline == null) return null;
    return personalPlan(baseline);
  }, [genPlan, owner, entries, baseline]);
}

/** Izvedeni plan, memoizovan po (aktivni plan, izmene, pomeranja). `null` kad nema plana ili je neispravan. */
export function useResolvedPlan(): ResolvedPlan | null {
  const plan = useActiveGenPlan();
  const alts = useTrainingStore((s) => s.alts);
  const moves = useTrainingStore((s) => s.moves);
  return useMemo(() => (plan ? safeResolve(plan, alts, moves) : null), [plan, alts, moves]);
}

/** Izvedeni plan iz TRENUTNOG stanja (izvan komponenti). `null` kad nema plana ili je neispravan. */
export function currentPlan(): ResolvedPlan | null {
  const s = useTrainingStore.getState();
  const plan = activeOf(s, isOwnerNow());
  return plan ? safeResolve(plan, s.alts, s.moves) : null;
}

export const trainingSlice = (): TrainingSlice =>
  pickKnown(useTrainingStore.getState() as unknown as PersistedState, TRAINING_KEYS);
