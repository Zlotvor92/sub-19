/* RADNJE NAD TRKOM: test na 3 km i prilagođavanje tempa formi. Pravila su u `domain/training`; ovde se čita stanje, poziva čista
   funkcija i upisuje rezultat jednim upisom po radnji. */

import { recomputeChain } from '../domain/day';
import {
  generatorForPlan,
  stampForStorage,
  unsupportedPlanReason,
  type RecalibratedStoredPlan,
  type VdotProposal
} from '../domain/generators/select';
import { addT3k, removeT3k, t3kVdot, upsertMeasurement } from '../domain/training/test3k';
import { t3kPossible } from '../domain/training/vdot/limits';
import type { ResolvedPlan } from '../domain/plan';
import { parseIsoDate } from '../domain/date';
import { storedRows, workPaceContext } from './dayActions';
import { activeGenPlan, useTrainingStore } from './trainingStore';
import { useUIStore } from './uiStore';
import { recordPlanRevision } from '../domain/plan/versions';
import {
  alignAutomaticAlts,
  executionModel,
  planStateStamp,
  positiveAdjustmentBlock,
  replanContext
} from './executionActions';

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
  const active = activeGenPlan();
  const meta = active?.meta;
  const generator = generatorForPlan(active);
  if (!meta || !generator) return null;
  const proposal = generator.vdotProposal({
    today,
    plan,
    pred: storedRows(),
    meta,
    log: t.log,
    alts: t.alts,
    vdotChain: t.vdotLog,
    tests: t.t3k,
    enteredPaces: t.pred,
    predLock: t.predLock,
    positiveAdjustmentAllowed: !positiveAdjustmentBlock(plan, today)
  });
  if (proposal) proposalToday.set(proposal, today);
  return proposal;
}

/** „Prilagodi tempo": menja SAMO ciljni tempo (obim ostaje), uz `paceAuto`; vraća broj prilagođenih dana. */
export function applyProposal(plan: ResolvedPlan, proposal: VdotProposal): number {
  const t = useTrainingStore.getState();
  const today = proposalToday.get(proposal);
  if (!today) return 0;
  const fresh = currentVdotProposal(plan, today);
  if (!fresh || JSON.stringify(fresh.changes) !== JSON.stringify(proposal.changes)) return 0;
  const generator = generatorForPlan(activeGenPlan());
  if (!generator) return 0;
  const r = generator.applyVdotProposal(proposal, plan, t.log, t.alts, t.genPlan);
  if (r.applied)
    t.patch({
      alts: r.alts,
      genPlan:
        t.genPlan && r.genPlan
          ? recordPlanRevision(t.genPlan, r.genPlan, {
              reason: 'pace',
              date: proposalToday.get(proposal)!,
              summary: proposal.title
            })
          : r.genPlan
    });
  return r.applied;
}

/** „Vrati planski tempo": poništava SAMO automatska prilagođavanja; ručne izmene ostaju. */
export function undoAdjustments(plan: ResolvedPlan): number {
  const t = useTrainingStore.getState();
  const today = useUIStore.getState().today;
  const generator = generatorForPlan(activeGenPlan());
  if (!generator) return 0;
  const matched = generator.matchPlanRows(plan.weeks, storedRows());
  const eligible = Object.fromEntries(
    Object.entries(t.alts).filter(([id, alt]) => {
      const day = plan.byId.get(id);
      const row = matched.get(id);
      return (
        alt.paceAuto &&
        day &&
        day.date > today &&
        t.log[id]?.status !== 'done' &&
        !(row && (t.pred[row.id] != null || t.predLock[row.id]))
      );
    })
  );
  const r = generator.undoVdotAdjustments(plan, eligible, t.genPlan);
  if (r.applied) {
    const alts = { ...t.alts };
    for (const id of Object.keys(eligible)) delete alts[id];
    Object.assign(alts, r.alts);
    t.patch({
      alts,
      genPlan:
        t.genPlan && r.genPlan
          ? recordPlanRevision(t.genPlan, r.genPlan, {
              reason: 'pace',
              date: today,
              summary: 'Vraćen planski tempo budućih treninga'
            })
          : r.genPlan
    });
  }
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

const recalibrationPreviews = new WeakMap<
  RecalibratedStoredPlan,
  { stamp: string; day: string; result: RecalibratedStoredPlan }
>();
const proposalToday = new WeakMap<VdotProposal, string>();

/**
 * Šta bi rekalibracija uradila — NIŠTA se ne upisuje. Ista kapija kao za predlog tempa (bar 3 merenja, razlika ≥ prag): preračunavanje
 * plana koji se sa formom već slaže bila bi izmena bez razloga.
 */
export function previewRecalibration(plan: ResolvedPlan, today: string): RecalibrationPreview {
  const t = useTrainingStore.getState();
  const gp = t.genPlan;
  if (!gp) return { ok: false, reason: 'Preračunavanje radi samo nad generisanim planom.' };
  const generator = generatorForPlan(gp);
  if (!generator) return { ok: false, reason: unsupportedPlanReason(gp) };
  const execution = executionModel(plan, today).analysis;
  if (execution.daysSinceLastRun !== null && execution.daysSinceLastRun >= 7)
    return {
      ok: false,
      reason:
        'Dnevnik nema novije trčanje. Potvrdi trenutnu bazu i pregledaj povratak posle pauze pre preračunavanja celog plana.'
    };
  const evidence = generator.fitnessEvidence({
    today,
    plan,
    pred: storedRows(),
    meta: gp.meta ?? null,
    log: t.log,
    vdotChain: t.vdotLog,
    tests: t.t3k
  });
  const { form, measurements, distinctDays } = evidence;
  // Kapija rekalibracije pripada generatoru distance plana (iste vrednosti kao ranije zajednička konstanta).
  const minMeasurements = generator.recalibrationMinMeasurements;
  if (form == null || distinctDays < minMeasurements)
    return {
      ok: false,
      reason: `Za preračunavanje treba bar ${minMeasurements} različita dana prihvatljivih merenja u poslednja 42 dana (sada ${distinctDays}, ${measurements} merenja). Kratke repeticije, neodrađeni i stari treninzi ne potvrđuju novu formu.`
    };
  const planVdot = generator.planVdotNow({
    today,
    plan,
    meta: gp.meta ?? null,
    pred: storedRows()
  });
  if (planVdot == null)
    return { ok: false, reason: 'Plan nema putanju forme sa kojom bi se izmerena forma poredila.' };
  if (Math.abs(form - planVdot) < generator.recalibrationThreshold)
    return {
      ok: false,
      reason: `Izmerena forma (VDOT ${form.toFixed(1).replace('.', ',')}) i plan (VDOT ${planVdot.toFixed(1).replace('.', ',')}) se slažu — nema šta da se preračuna.`
    };
  if (form > planVdot) {
    const block = positiveAdjustmentBlock(plan, today);
    if (block) return { ok: false, reason: block };
  }
  const day = parseIsoDate(today);
  if (!day) return { ok: false, reason: 'Neispravan datum.' };
  const result = generator.planRecalibrated(gp, form, day, replanContext());
  if (typeof result.error === 'string') return { ok: false, reason: result.error };
  recalibrationPreviews.set(result, {
    stamp: planStateStamp(),
    day,
    result: JSON.parse(JSON.stringify(result)) as RecalibratedStoredPlan
  });
  return { ok: true, form, planVdot, measurements, result };
}

/** Upis preračunatog plana: jedan upis. Istorija, dnevnik, izmene i lanac forme se NE diraju. */
export function commitRecalibration(result: RecalibratedStoredPlan): boolean {
  const registered = recalibrationPreviews.get(result);
  recalibrationPreviews.delete(result);
  const t = useTrainingStore.getState();
  if (!registered || !t.genPlan || registered.stamp !== planStateStamp()) return false;
  const accepted = registered.result;
  t.patch({
    genPlan: recordPlanRevision(t.genPlan, stampForStorage({ ...t.genPlan, ...accepted }), {
      reason: 'fitness',
      date: registered.day,
      summary: `Plan prema izmerenoj formi VDOT ${accepted.recalibration.form.toFixed(1)}`
    }),
    alts: alignAutomaticAlts(accepted, registered.day)
  });
  return true;
}
