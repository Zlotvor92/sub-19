/* RADNJE NAD TRKOM: test na 3 km i prilagođavanje tempa formi. Pravila su u `domain/training`; ovde se čita stanje, poziva čista
   funkcija i upisuje rezultat jednim upisom po radnji. */

import { recomputeChain } from '../domain/day';
import { planRecalibrated, type RecalibratedStoredPlan } from '../domain/plan';
import {
  VDOT_PROPOSAL_MIN_MEASUREMENTS,
  VDOT_PROPOSAL_THRESHOLD
} from '../domain/training/constants/heuristics';
import {
  applyVdotProposal,
  currentVdot,
  planVdotNow,
  undoVdotAdjustments,
  vdotProposal,
  type VdotProposal
} from '../domain/training/adaptation';
import { addT3k, removeT3k, t3kVdot, upsertMeasurement } from '../domain/training/test3k';
import { t3kPossible } from '../domain/training/vdot/limits';
import type { ResolvedPlan } from '../domain/plan';
import { parseIsoDate } from '../domain/date';
import { storedRows, workPaceContext } from './dayActions';
import { activeGenPlan, useTrainingStore } from './trainingStore';

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
  const meta = activeGenPlan()?.meta;
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

/* ------------------------------------------------------------------ rekalibracija plana */

export type RecalibrationPreview =
  | {
      ok: true;
      /** Izmerena forma (VDOT) i planska forma za tekuću nedelju. */
      form: number;
      planVdot: number;
      measurements: number;
      result: RecalibratedStoredPlan;
    }
  | { ok: false; reason: string };

/**
 * Šta bi rekalibracija uradila — NIŠTA se ne upisuje. Ista kapija kao za predlog tempa (bar 3 merenja, razlika ≥ prag): preračunavanje
 * plana koji se sa formom već slaže bila bi izmena bez razloga.
 */
export function previewRecalibration(plan: ResolvedPlan, today: string): RecalibrationPreview {
  const t = useTrainingStore.getState();
  const gp = t.genPlan;
  if (!gp) return { ok: false, reason: 'Preračunavanje radi samo nad generisanim planom.' };
  const form = currentVdot(t.vdotLog);
  const measurements = t.vdotLog.filter((e) => e && e.measured != null).length;
  if (form == null || measurements < VDOT_PROPOSAL_MIN_MEASUREMENTS)
    return {
      ok: false,
      reason: `Za preračunavanje treba bar ${VDOT_PROPOSAL_MIN_MEASUREMENTS} izmerena rezultata forme (sada ${measurements}). Upiši tempo odrađenog treninga ili uradi test na 3 km.`
    };
  const planVdot = planVdotNow({ today, plan, meta: gp.meta ?? null, pred: storedRows() });
  if (planVdot == null)
    return { ok: false, reason: 'Plan nema putanju forme sa kojom bi se izmerena forma poredila.' };
  if (Math.abs(form - planVdot) < VDOT_PROPOSAL_THRESHOLD)
    return {
      ok: false,
      reason: `Izmerena forma (VDOT ${form.toFixed(1).replace('.', ',')}) i plan (VDOT ${planVdot.toFixed(1).replace('.', ',')}) se slažu — nema šta da se preračuna.`
    };
  const day = parseIsoDate(today);
  if (!day) return { ok: false, reason: 'Neispravan datum.' };
  const result = planRecalibrated(gp, form, day);
  if ('error' in result) return { ok: false, reason: result.error };
  return { ok: true, form, planVdot, measurements, result };
}

/** Upis preračunatog plana: jedan upis. Istorija, dnevnik, izmene i lanac forme se NE diraju. */
export function commitRecalibration(result: RecalibratedStoredPlan): void {
  useTrainingStore.getState().setGenPlan({
    weeks: result.weeks,
    pred: result.pred,
    qs: result.qs,
    meta: result.meta,
    ulaz: result.ulaz
  });
}
