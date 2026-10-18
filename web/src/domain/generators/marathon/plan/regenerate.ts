/** Shared regeneration of the remaining plan for execution adjustments and preparation decisions. */
import { addDays, type IsoDate } from '../date';
import type { GenPlanState } from '../exchange';
import { generatePlan } from '../training/generator/generatePlan';
import { derivePred, deriveQSById } from '../training/prediction';
import { isPlanError, type PlanGenerationInput } from '../training/types';
import { adaptGeneratedPlan } from './adapt';
import { graftFuturePlan, type ReplanContext } from './future';
import { fatigueWindowFor } from './fatigueRecovery';
import { guardReturnGrowth } from './returnGrowth';

/** Transparent product defaults, not a physiological or medical recovery model. */
export const RETURN_POLICY = {
  short: { days: 7, fraction: 0.85, easyWeeks: 2 },
  medium: { days: 14, fraction: 0.7, easyWeeks: 3 },
  long: { days: 28, fraction: 0.55, easyWeeks: 4 }
} as const;
/** Oblik povratne politike (neutralan, kao u ugovoru aplikacije); vrednosti su `RETURN_POLICY` ove distance. */
export type ReturnPolicy = {
  readonly days: number;
  readonly fraction: number;
  readonly easyWeeks: number;
};

export function returnPolicyFor(breakDays: number | undefined): ReturnPolicy | null {
  if (breakDays === undefined || !(breakDays > 0)) return null;
  return breakDays >= RETURN_POLICY.long.days
    ? RETURN_POLICY.long
    : breakDays >= RETURN_POLICY.medium.days
      ? RETURN_POLICY.medium
      : RETURN_POLICY.short;
}

/** Persisted on adjusted plans; a later preparation decision reuses the same confirmed facts. */
export interface ExecutionAdjustmentMeta {
  date: IsoDate;
  reason?: 'confirmed-break' | 'fatigue' | 'reduced-volume';
  breakDays: number;
  reportedBaseKm: number;
  startingKm: number;
  /** Absent on plans adjusted before preparation decisions existed. */
  reportedLongRunKm?: number;
}

export interface RegenerationOptions {
  policy: ReturnPolicy | null;
  /** Weekly volume the remaining plan may grow from; omitted keeps the generator's own ramp. */
  guardBaseKm?: number;
  execution?: ExecutionAdjustmentMeta;
  /** Notes added to persisted warnings before finalization. */
  notes?: string[];
  meta?: Record<string, unknown>;
}

/** The return-window easy overlay preserves the dose and removes intensity. */
export function easyReturnWeeks(
  weeks: GenPlanState['weeks'],
  easyWeeks: number
): GenPlanState['weeks'] {
  return weeks.map((week, index) =>
    index >= easyWeeks
      ? week
      : {
          ...week,
          days: week.days.map((day) => {
            if (day.rest || day.tag === 'snaga' || day.tag === 'trka') return day;
            const { finish: _finish, strides: _strides, ...rest } = day;
            if (!day.session) return rest;
            const { session: _session, ...easy } = rest;
            return {
              ...easy,
              tag: 'lako' as const,
              desc: 'Lagano trčanje u razgovornom tempu; bez nadoknade propuštenih treninga.'
            };
          })
        }
  );
}

/** Generate from `input`, apply return guards, then graft only unprotected future days. */
export function regenerateFuture(
  current: GenPlanState,
  input: PlanGenerationInput,
  today: IsoDate,
  context: ReplanContext,
  options: RegenerationOptions
): { result: GenPlanState; generatedStart: IsoDate } | { error: string } {
  const generated = generatePlan(input);
  if (isPlanError(generated)) return { error: generated.error };
  if (options.guardBaseKm !== undefined) {
    const partialFirst = input.startDate !== generated.meta.start;
    generated.weeks = guardReturnGrowth(generated.weeks, options.guardBaseKm, partialFirst);
    generated.pred = derivePred(generated.weeks, generated.meta.raceDistM, generated.meta);
  }
  const fresh = adaptGeneratedPlan(generated);
  if (!fresh || !fresh.meta) return { error: 'Nije moguće napraviti predlog.' };
  fresh.qs = deriveQSById(fresh.weeks);
  const policy = options.policy;
  if (policy) {
    fresh.weeks = easyReturnWeeks(fresh.weeks, policy.easyWeeks);
    fresh.pred = derivePred(fresh.weeks, fresh.meta.raceDistM, fresh.meta).map((row, i) => ({
      ...row,
      id: `g${row.w}_${i}`
    }));
    fresh.qs = deriveQSById(fresh.weeks);
  }
  fresh.meta = {
    ...fresh.meta,
    ...(input.currentReadiness?.reason === 'fatigued' && input.currentReadiness.until > today
      ? {
          fatigueRecovery: fatigueWindowFor(
            current,
            today,
            input.weeklyKm,
            input.currentReadiness.until,
            context
          )
        }
      : {}),
    ...(options.execution ? { executionAdjustment: options.execution } : {}),
    ...(options.meta ?? {}),
    dayWarnings: [...fresh.meta.dayWarnings, ...(options.notes ?? [])]
  };
  const result = graftFuturePlan(
    current,
    { ...fresh, ulaz: input },
    today,
    context,
    policy
      ? {
          returnWindow: {
            start: input.startDate as IsoDate,
            end: addDays(generated.meta.start, policy.easyWeeks * 7),
            requiredWeeks: policy.easyWeeks
          }
        }
      : {}
  );
  return { result, generatedStart: generated.meta.start };
}

/** Final warning lines that previews must repeat verbatim. */
export const finalWarnings = (result: GenPlanState): string[] =>
  (result.meta?.dayWarnings ?? []).filter((s) =>
    /^(Skraćena priprema |Finalni preostali plan:|Povratni period |Konflikt povratne politike:|Neposredni oporavak |Konflikt oporavka:)/.test(
      s
    )
  );
