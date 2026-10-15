import { addDays, parseIsoDate } from '../domain/date';
import { resolvePlan, type ResolvedPlan } from '../domain/plan';
import type { ExecutionAdjustmentOptions } from '../domain/plan/executionAdjustment';
import {
  UNSUPPORTED_DISTANCE,
  generatorForPlan,
  preparationForPlan
} from '../domain/generators/select';
import type {
  DecisionPoint,
  PreparationChoice,
  PreparationDecision
} from '../domain/plan/preparationDecision';
import type { ReplanContext } from '../domain/plan/future';
import type { RunWalkAdjustmentOptions } from '../domain/plan/runWalkAdjustment';
import {
  getPlanRevisions,
  recordPlanRevision,
  type PlanRevisionReason
} from '../domain/plan/versions';
import type { AltRecord, GenPlanState } from '../domain/state';
import { useRecoveryStore } from './recoveryStore';
import { activeGenPlan, useTrainingStore } from './trainingStore';
import { useUIStore } from './uiStore';
import { sessQKm } from '../domain/training/sessions/calc';

export type PlanChangePreview =
  | {
      ok: true;
      token: string;
      day: string;
      result: GenPlanState;
      reason: PreviewReason;
      summary: string;
      /** Options when the reviewed result is not a full preparation. */
      decision?: PreparationDecision;
      /** Explicit race date / distance / goal change of a preparation choice. */
      change?: { from: DecisionPoint; to: DecisionPoint };
      changes: Array<{
        week: number;
        beforeKm: number;
        afterKm: number;
        longRunKm: number;
        qualityMinutesBefore?: number;
        qualityMinutesAfter?: number;
        demandingDaysBefore?: number;
        demandingDaysAfter?: number;
      }>;
      notes: string[];
    }
  | { ok: false; reason: string; decision?: PreparationDecision };
type PreviewReason = Extract<PlanRevisionReason, 'execution' | 'restore' | 'goal'>;

export function replanContext(): ReplanContext & {
  alts: Record<string, AltRecord>;
  moves: Record<string, unknown>;
} {
  const t = useTrainingStore.getState();
  return { log: t.log, alts: t.alts, moves: t.moves, pred: t.pred, predLock: t.predLock };
}

/** Includes actual history and recovery, excludes service credentials and display preferences. */
export function planStateStamp(): string {
  const t = useTrainingStore.getState();
  const r = useRecoveryStore.getState();
  return JSON.stringify([
    t.genPlan,
    t.log,
    t.alts,
    t.moves,
    t.pred,
    t.predLock,
    t.vdotLog,
    t.t3k,
    r.knee,
    r.vanPlana,
    useUIStore.getState().today
  ]);
}

/**
 * Generator aktivnog plana (sačuvanog ili ugrađenog ličnog); adaptacija pripada generatoru njegove distance
 * (`domain/generators/select.ts`). `null` kad plan nema podržanu distancu — ekrani to prikazuju umesto prilagođavanja.
 */
export const activePlanGenerator = () => generatorForPlan(activeGenPlan());

function planGenerator() {
  const generator = activePlanGenerator();
  if (!generator) throw new Error(UNSUPPORTED_DISTANCE);
  return generator;
}

export function executionModel(plan: ResolvedPlan, today: string) {
  return planGenerator().executionModel(
    plan,
    today,
    replanContext(),
    useRecoveryStore.getState().vanPlana
  );
}

function recentPainMax(todayStr: string, days: number): number | null {
  const today = parseIsoDate(todayStr);
  if (!today) return null;
  const from = addDays(today, -(days - 1));
  const values = useRecoveryStore
    .getState()
    .knee.filter((record) => {
      const date = parseIsoDate(record.date);
      return date && date >= from && date <= today && Number.isFinite(record.pain);
    })
    .map((record) => record.pain);
  return values.length ? Math.max(...values) : null;
}

/** Tolerancija run/walk koraka iz prijavljenog izvršenja; prazan dnevnik ostaje nepoznat. */
export function runWalkModel(plan: ResolvedPlan, today: string) {
  return planGenerator().assessRunWalkProgress({
    plan,
    log: useTrainingStore.getState().log,
    today,
    recentPainMax: recentPainMax(today, 14)
  });
}

/** Kapija za zahtevniji rad kad plan nosi nepotvrđenu formu; `null` kad je plan ne traži. */
export function qualityGateModel(plan: ResolvedPlan, today: string) {
  const t = useTrainingStore.getState();
  const policy = (t.genPlan?.meta as { formPolicy?: { basis?: string } } | null | undefined)
    ?.formPolicy;
  if (policy?.basis !== 'effort-first') return null;
  const generator = planGenerator();
  return generator.qualityEntryGate({
    analysis: executionModel(plan, today).analysis,
    recentPainMax: recentPainMax(today, 14),
    formConfirmed: generator.hasRecentMeasuredForm(today, { t3k: t.t3k, vdotLog: t.vdotLog })
  });
}

/** Conservative gate: reported pain/fatigue or an unconfirmed data gap does not justify faster work. */
export function positiveAdjustmentBlock(plan: ResolvedPlan, todayStr: string): string | null {
  const today = parseIsoDate(todayStr);
  if (!today) return 'Neispravan datum.';
  const recovery = useTrainingStore.getState().genPlan?.meta?.fatigueRecovery;
  if (recovery && today >= recovery.start && today < recovery.end)
    return 'Neposredno rasterećenje zbog visokog napora još traje; brži rad se ne predlaže.';
  const pain = useRecoveryStore.getState().knee.some((record) => {
    const date = parseIsoDate(record.date);
    return (
      date &&
      date >= addDays(today, -6) &&
      date <= today &&
      Number.isFinite(record.pain) &&
      record.pain >= 4
    );
  });
  if (pain) return 'Noviji zapis bola sprečava predlog bržeg rada. Najpre proveri oporavak.';
  if (!activePlanGenerator()) return UNSUPPORTED_DISTANCE;
  const { analysis } = executionModel(plan, today);
  if (analysis.easyHighRpeCount >= 2)
    return 'Više lakih treninga ima visok prijavljeni napor; brži rad se ne predlaže.';
  if (analysis.daysSinceLastRun !== null && analysis.daysSinceLastRun >= 7)
    return 'Nema novijeg upisanog trčanja. Potvrdi kontinuitet ili pregledaj povratak posle pauze pre bržeg rada.';
  return null;
}

type SuccessfulPreview = Extract<PlanChangePreview, { ok: true }>;
type Registered = {
  stamp: string;
  result: GenPlanState;
  reason: PlanRevisionReason;
  day: string;
  summary: string;
};
const previews = new WeakMap<SuccessfulPreview, Registered>();
let sequence = 0;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** A regenerated session must not remain hidden behind an obsolete automatic pace overlay. */
export function alignAutomaticAlts(result: GenPlanState, today: string): Record<string, AltRecord> {
  const t = useTrainingStore.getState();
  // `result` je uvek izlaz nekog generatora; plan bez podržane distance ovde ne sme da stigne.
  const generator = generatorForPlan(result);
  if (!generator) throw new Error(UNSUPPORTED_DISTANCE);
  return generator.alignAutomaticOverlays(t.genPlan, result, today, replanContext());
}

export function planPreviewChanges(
  result: GenPlanState,
  today: string
): SuccessfulPreview['changes'] {
  const t = useTrainingStore.getState();
  const oldPlan = t.genPlan ? resolvePlan(t.genPlan.weeks, replanContext()) : null;
  const newPlan = resolvePlan(result.weeks, {
    moves: t.moves,
    alts: alignAutomaticAlts(result, today)
  });
  const dose = (days: ResolvedPlan['dated']) => {
    const upcoming = days.filter((day) => day.date > today);
    return {
      km: Math.round(upcoming.reduce((sum, day) => sum + (day.km ?? 0), 0) * 10) / 10,
      minutes:
        Math.round(
          upcoming.reduce(
            (sum, day) =>
              sum +
              (day.session ? (sessQKm(day.session) * day.session.paceSec) / 60 : 0) +
              (day.finish ? (day.finish.km * day.finish.paceSec) / 60 : 0),
            0
          ) * 10
        ) / 10,
      hard: upcoming.filter((day) => day.session || day.finish).length
    };
  };
  const changes = newPlan.weeks
    .map((week) => {
      const before = dose(oldPlan?.weeks.find((w) => w.w === week.w)?.days ?? []);
      const after = dose(week.days);
      return {
        week: week.w,
        beforeKm: before.km,
        afterKm: after.km,
        qualityMinutesBefore: before.minutes,
        qualityMinutesAfter: after.minutes,
        demandingDaysBefore: before.hard,
        demandingDaysAfter: after.hard,
        longRunKm: Math.max(
          0,
          ...week.days
            .filter((day) => day.tag === 'lr' && day.date > today)
            .map((day) => day.km ?? 0)
        )
      };
    })
    .filter((week) => {
      const current = newPlan.weeks.find((w) => w.w === week.week);
      return current && current.days.some((day) => day.date > today);
    });
  return changes;
}

function preview(
  result: GenPlanState,
  today: string,
  reason: PreviewReason,
  summary: string,
  notes: string[],
  extra: Pick<SuccessfulPreview, 'decision' | 'change'> = {}
): SuccessfulPreview {
  const changes = planPreviewChanges(result, today);
  const value: SuccessfulPreview = {
    ok: true,
    token: `preview-${++sequence}`,
    day: today,
    result: copy(result),
    reason,
    summary,
    changes,
    notes: [...notes],
    ...extra
  };
  previews.set(value, {
    stamp: planStateStamp(),
    result: copy(result),
    reason,
    day: today,
    summary
  });
  return value;
}

export function previewExecution(
  plan: ResolvedPlan,
  todayStr: string,
  options: ExecutionAdjustmentOptions = {}
): PlanChangePreview {
  const t = useTrainingStore.getState();
  const today = parseIsoDate(todayStr);
  if (!t.genPlan || !today)
    return { ok: false, reason: 'Za prilagođavanje treba generisan plan i ispravan datum.' };
  const generator = generatorForPlan(t.genPlan);
  if (!generator) return { ok: false, reason: UNSUPPORTED_DISTANCE };
  const { analysis } = executionModel(plan, today);
  const built = generator.buildExecutionAdjustment(
    t.genPlan,
    today,
    analysis,
    options,
    replanContext()
  );
  if ('error' in built)
    return {
      ok: false,
      reason: built.error,
      ...(built.decision ? { decision: built.decision } : {})
    };
  const conflicts = built.result.meta?.['futureChanges'] as { conflicts?: string[] } | undefined;
  return preview(
    built.result,
    today,
    'execution',
    built.summary,
    [...built.notes, ...(conflicts?.conflicts ?? [])],
    built.decision ? { decision: built.decision } : {}
  );
}

/** Options for the stored plan when it is already a limited long-distance preparation. */
export function storedPreparationDecision(todayStr: string): PreparationDecision | null {
  const t = useTrainingStore.getState();
  const today = parseIsoDate(todayStr);
  const baseMode =
    (t.genPlan?.meta?.['cycleDecision'] as { kind?: string } | undefined)?.kind === 'base';
  // Odluka pripada generatoru distance plana (HM → HM, maraton → maraton); 5K/10K je nemaju.
  const preparation = preparationForPlan(t.genPlan);
  if (
    !preparation ||
    !t.genPlan?.meta ||
    !today ||
    !(baseMode || preparation.isLimitedLongPreparation(t.genPlan.meta))
  )
    return null;
  const race = parseIsoDate(t.genPlan.meta.raceDate);
  if (!race || race <= today) return null;
  const basis = preparation.basisFromPlan(t.genPlan, today);
  if (!basis) return null;
  const decision = preparation.preparationDecision(
    t.genPlan,
    today,
    basis,
    replanContext(),
    'limited',
    t.genPlan.meta.preparation
  );
  // Already in base mode: continuation means a later date or a shorter distance.
  return baseMode
    ? { ...decision, options: decision.options.filter((o) => o.choice.kind !== 'base') }
    : decision;
}

/**
 * Preview one preparation choice. With execution options the same confirmed break/base is used;
 * without them the stored plan's own facts are reused. Nothing is written until commit.
 */
export function previewPreparationChoice(
  plan: ResolvedPlan,
  todayStr: string,
  options: ExecutionAdjustmentOptions | null,
  choice: PreparationChoice
): PlanChangePreview {
  const t = useTrainingStore.getState();
  const today = parseIsoDate(todayStr);
  if (!t.genPlan || !today)
    return { ok: false, reason: 'Za odluku o pripremi treba generisan plan i ispravan datum.' };
  const generator = generatorForPlan(t.genPlan);
  const preparation = preparationForPlan(t.genPlan);
  if (!generator) return { ok: false, reason: UNSUPPORTED_DISTANCE };
  if (!preparation)
    return { ok: false, reason: 'Odluka o pripremi postoji samo za polumaraton i maraton.' };
  const basis = options
    ? generator.executionBasis(t.genPlan, today, executionModel(plan, today).analysis, options)
    : preparation.basisFromPlan(t.genPlan, today);
  if (!basis) return { ok: false, reason: 'Plan nema sačuvane ulazne podatke.' };
  if ('error' in basis) return { ok: false, reason: basis.error };
  const built = preparation.buildPreparationChoice(
    t.genPlan,
    today,
    basis,
    choice,
    replanContext()
  );
  if ('error' in built) return { ok: false, reason: built.error };
  return preview(
    built.result,
    today,
    choice.kind === 'base' ? 'execution' : 'goal',
    built.summary,
    built.notes,
    { change: built.change }
  );
}

export function previewRunWalk(
  plan: ResolvedPlan,
  todayStr: string,
  options: RunWalkAdjustmentOptions
): PlanChangePreview {
  const t = useTrainingStore.getState();
  const today = parseIsoDate(todayStr);
  if (!t.genPlan || !today)
    return { ok: false, reason: 'Za prilagođavanje treba generisan plan i ispravan datum.' };
  const generator = generatorForPlan(t.genPlan);
  if (!generator) return { ok: false, reason: UNSUPPORTED_DISTANCE };
  const assessment = runWalkModel(plan, today);
  const { analysis } = executionModel(plan, today);
  const built = generator.buildRunWalkAdjustment(
    t.genPlan,
    today,
    assessment,
    { ...options, weeklyKm: options.weeklyKm ?? analysis.recentWeeklyKm ?? undefined },
    replanContext()
  );
  if ('error' in built) return { ok: false, reason: built.error };
  const conflicts = built.result.meta?.['futureChanges'] as { conflicts?: string[] } | undefined;
  return preview(built.result, today, 'execution', built.summary, [
    ...built.notes,
    ...(conflicts?.conflicts ?? [])
  ]);
}

export function previewRestore(revisionId: string, todayStr: string): PlanChangePreview {
  const t = useTrainingStore.getState();
  const today = parseIsoDate(todayStr);
  if (!t.genPlan || !today) return { ok: false, reason: 'Nema plana za vraćanje.' };
  const revision = getPlanRevisions(t.genPlan).find((item) => item.id === revisionId);
  if (!revision) return { ok: false, reason: 'Sačuvana verzija više nije dostupna.' };
  // The restored version is finalized by the generator of the plan being written back.
  const generator = generatorForPlan(revision.snapshot);
  if (!generator) return { ok: false, reason: UNSUPPORTED_DISTANCE };
  const result = generator.graftFuturePlan(t.genPlan, revision.snapshot, today, replanContext());
  const changes = result.meta?.['futureChanges'] as
    { changedDays?: number; conflicts?: string[] } | undefined;
  if (!changes?.changedDays)
    return { ok: false, reason: 'Nema preostalih dana koji se mogu vratiti bez promene istorije.' };
  return preview(result, today, 'restore', `Vraćanje plana: ${revision.summary}`, [
    'Vraćaju se samo nezaštićeni budući treninzi. Dnevnik, merenja, pomeranja i ručne izmene ostaju.',
    ...(changes.conflicts ?? [])
  ]);
}

/** One atomic plan-only write. Preview cannot be replayed, forged or used after actual state changes. */
export function commitPlanChange(
  value: PlanChangePreview
): { ok: true } | { ok: false; reason: string } {
  if (!value.ok) return { ok: false, reason: value.reason };
  const registered = previews.get(value);
  previews.delete(value);
  const t = useTrainingStore.getState();
  if (!registered || !t.genPlan || registered.stamp !== planStateStamp())
    return {
      ok: false,
      reason: 'Plan ili unosi su se promenili. Ponovo pregledaj predlog pre primene.'
    };
  t.patch({
    genPlan: recordPlanRevision(t.genPlan, registered.result, {
      reason: registered.reason,
      date: registered.day,
      summary: registered.summary
    }),
    alts: alignAutomaticAlts(registered.result, registered.day)
  });
  return { ok: true };
}
