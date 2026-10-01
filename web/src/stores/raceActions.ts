/* RADNJE NAD TRKOM: test na 3 km i prilagođavanje tempa formi. Pravila su u `domain/training`; ovde se čita stanje, poziva čista
   funkcija i upisuje rezultat jednim upisom po radnji. */

import { recomputeChain } from '../domain/day';
import {
  applyVdotProposal,
  undoVdotAdjustments,
  vdotProposal,
  type VdotProposal
} from '../domain/training/adaptation';
import { addT3k, removeT3k, t3kVdot, upsertMeasurement } from '../domain/training/test3k';
import { t3kPossible } from '../domain/training/vdot/limits';
import type { ResolvedPlan } from '../domain/plan';
import { storedRows, workPaceContext } from './dayActions';
import { useTrainingStore } from './trainingStore';

const ctx = () => workPaceContext({ id: '' });

/** Novi test. `suffix` daje pozivalac (nasumičan), da id bude jedinstven. Nemoguće vreme se ne upisuje (`null`). */
export function addTest(date: string, sec: number, suffix: string): string | null {
  const t = useTrainingStore.getState();
  const r = addT3k({ t3k: t.t3k, vdotLog: t.vdotLog }, date, sec, suffix);
  if (!r) return null;
  t.patch({ t3k: [...r.t3k], vdotLog: recomputeChain(r.vdotLog, ctx()) });
  return r.id;
}

/** Izmena datuma/vremena postojećeg testa; lanac se preračunava. `false` kad test ne postoji ili vreme nije moguće. */
export function editTest(id: string, date: string, sec: number): boolean {
  const t = useTrainingStore.getState();
  const s = Math.round(sec);
  if (!t.t3k.some((x) => x && x.id === id) || !t3kPossible(s)) return false;
  const measured = t3kVdot(s);
  if (measured == null) return false;
  t.patch({
    t3k: t.t3k.map((x) => (x && x.id === id ? { ...x, date, sec: s } : x)),
    vdotLog: recomputeChain(upsertMeasurement(t.vdotLog, id, date, measured), ctx())
  });
  return true;
}

export function removeTest(id: string): void {
  const t = useTrainingStore.getState();
  const r = removeT3k({ t3k: t.t3k, vdotLog: t.vdotLog }, id);
  t.patch({ t3k: [...r.t3k], vdotLog: recomputeChain(r.vdotLog, ctx()) });
}

/** Predlog novih tempa iz forme; `null` kad ga nema. */
export function currentVdotProposal(plan: ResolvedPlan, today: string): VdotProposal | null {
  const t = useTrainingStore.getState();
  const meta = t.genPlan?.meta;
  if (!meta) return null;
  return vdotProposal({
    today,
    plan,
    pred: storedRows(),
    meta,
    log: t.log,
    alts: t.alts,
    vdotChain: t.vdotLog
  });
}

/** „Prilagodi tempo": menja SAMO ciljni tempo (obim ostaje), uz `paceAuto`; vraća broj prilagođenih dana. */
export function applyProposal(plan: ResolvedPlan, proposal: VdotProposal): number {
  const t = useTrainingStore.getState();
  const r = applyVdotProposal(proposal, plan, t.log, t.alts, t.genPlan);
  if (r.applied) t.patch({ alts: r.alts, genPlan: r.genPlan });
  return r.applied;
}

/** „Vrati planski tempo": poništava SAMO automatska prilagođavanja; ručne izmene ostaju. */
export function undoAdjustments(plan: ResolvedPlan): number {
  const t = useTrainingStore.getState();
  const r = undoVdotAdjustments(plan, t.alts, t.genPlan);
  if (r.applied) t.patch({ alts: r.alts, genPlan: r.genPlan });
  return r.applied;
}
