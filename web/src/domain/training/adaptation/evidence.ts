/* Recommendation evidence is separate from the historical/display chain. A prescribed pace or
   a short repetition is not a race result. These thresholds are conservative product gates,
   not a validated physiological model: 42 calendar days, six minutes of T/I work, three days. */
import { diffDays, parseIsoDate } from '../../date';
import type { ResolvedPlan } from '../../plan/types';
import { planBaselineVdot } from '../../plan/baseline';
import type { LogEntry, T3kRecord, VdotRecord } from '../../state/types';
import type { PlanMeta } from '../types';
import { t3kVdot } from '../test3k';
import { isT3kId, vdotPossible } from '../vdot/limits';
import { currentVdot, recomputeVdotChain, sessionClassFor } from './chain';
import { dayZone, matchPlanRows, type StoredPredRow } from './matching';

export const FITNESS_EVIDENCE_WINDOW_DAYS = 42;
export const FITNESS_EVIDENCE_MIN_WORK_SEC = 360;
export type EvidenceExclusion =
  | 'invalid-measurement'
  | 'invalid-date'
  | 'future'
  | 'stale'
  | 'not-performed'
  | 'not-matched'
  | 'not-aerobic-evidence'
  | 'short-work'
  | 'incomplete-work'
  | 'duplicate';

export interface FitnessEvidenceContext {
  today: string;
  plan: ResolvedPlan;
  pred: readonly StoredPredRow[];
  meta: Pick<PlanMeta, 'vdot0'> | null;
  log: Readonly<Record<string, LogEntry>>;
  vdotChain: readonly VdotRecord[];
  tests?: readonly T3kRecord[];
}

export interface FitnessEvidence {
  form: number | null;
  measurements: number;
  distinctDays: number;
  confirmedTests: number;
  trainingMeasurements: number;
  windowDays: number;
  chain: VdotRecord[];
  excluded: Array<{ id: string; reason: EvidenceExclusion }>;
}

export function fitnessEvidence(ctx: FitnessEvidenceContext): FitnessEvidence {
  const today = parseIsoDate(ctx.today);
  const matched = matchPlanRows(ctx.plan.weeks, ctx.pred);
  const rowDays = new Map(
    [...matched].map(([dayId, row]) => [row.id, ctx.plan.byId.get(dayId)] as const)
  );
  const excluded: FitnessEvidence['excluded'] = [];
  const accepted: VdotRecord[] = [];
  const seen = new Set<string>();
  let confirmedTests = 0;
  for (const record of ctx.vdotChain) {
    const id = typeof record.id === 'string' ? record.id : '';
    const reject = (reason: EvidenceExclusion) => excluded.push({ id, reason });
    if (!id || !vdotPossible(record.measured)) {
      reject('invalid-measurement');
      continue;
    }
    if (seen.has(id)) {
      reject('duplicate');
      continue;
    }
    const isTest = isT3kId(id);
    const day = rowDays.get(id);
    const test = ctx.tests?.find((t) => t.id === id);
    // Tests must still exist in the performed-result collection, not only in an orphan chain.
    if (isTest && (!test || t3kVdot(test.sec) !== record.measured)) {
      reject('not-performed');
      continue;
    }
    if (!isTest && !day) {
      reject('not-matched');
      continue;
    }
    if (!isTest && ctx.log[day!.id]?.status !== 'done') {
      reject('not-performed');
      continue;
    }
    const date = parseIsoDate(isTest ? test?.date : (ctx.log[day!.id]?.runDate ?? record.ts));
    if (!today || !date) {
      reject('invalid-date');
      continue;
    }
    const age = diffDays(date, today);
    if (age < 0) {
      reject('future');
      continue;
    }
    if (age > FITNESS_EVIDENCE_WINDOW_DAYS) {
      reject('stale');
      continue;
    }
    if (!isTest) {
      const z = dayZone(matched, day!);
      if (!z || z.row.nemeri || (z.zone !== 'T' && z.zone !== 'I')) {
        reject('not-aerobic-evidence');
        continue;
      }
      // Use observed work pace where available through measured form; scheduled quantity alone
      // cannot certify a result, but it can disqualify an intentionally short introduction.
      if (!(z.row.q * z.row.pt >= FITNESS_EVIDENCE_MIN_WORK_SEC)) {
        reject('short-work');
        continue;
      }
      const actualKm = ctx.log[day!.id]?.km;
      if (typeof actualKm !== 'number' || !Number.isFinite(actualKm) || actualKm < z.row.q) {
        reject('incomplete-work');
        continue;
      }
    }
    seen.add(id);
    if (isTest) confirmedTests++;
    accepted.push({ ...record, ts: date });
  }
  const chain = recomputeVdotChain(accepted, planBaselineVdot(ctx.meta), (id) => {
    const row = ctx.pred.find((r) => r.id === id);
    const day = rowDays.get(id);
    const actualZone = day ? dayZone(matched, day)?.zone : undefined;
    return sessionClassFor(isT3kId(id), row?.l, actualZone ?? row?.zone);
  });
  return {
    form: currentVdot(chain),
    measurements: chain.length,
    distinctDays: new Set(chain.map((e) => e.ts)).size,
    confirmedTests,
    trainingMeasurements: chain.length - confirmedTests,
    windowDays: FITNESS_EVIDENCE_WINDOW_DAYS,
    chain,
    excluded
  };
}
