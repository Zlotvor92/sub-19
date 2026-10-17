/* 5K v2 → aplikacija: članovi ugovora koji su ADAPTACIJA ili PREDLOG (segment 08b). Do tada su eksplicitno nepodržani:
   vraćaju odbijanje sa porukom, „nema predloga" ili nepromenjen ulaz — nikad ne prepuštaju posao starom 5K generatoru.
   Merenje forme po redu predikcije ne postoji (v2 plan nema redove), pa merenje nije prihvaćeno, a lanac forme ostaje
   kakav jeste. */

import type { AltRecord, GenPlanState, IsoDate, VdotRecord } from '../../exchange.ts';

/** Poruka u UI-ju umesto prilagođavanja plana 5K v2. */
export const ADAPTATION_UNSUPPORTED =
  'Prilagođavanje plana stiže uskoro. Ovaj 5K plan (v2) se do tada ne menja automatski; treninge beleži kao i do sada.';

const refuse = (): { error: string } => ({ error: ADAPTATION_UNSUPPORTED });

/* --- merenje forme (lanac forme) --- */
export const classifyMeasurement = () => ({
  status: 'rejected' as const,
  reason: 'no-row' as const
});
export const recomputeVdotChain = (entries: readonly VdotRecord[]): VdotRecord[] =>
  entries.map((e) => ({ ...e }));
export const sessionClassFor = () => 'default' as const;
export const currentVdot = (): number | null => null;

/* --- izvršenje, run/walk napredak, kapija kvaliteta --- */
export function executionModel(_plan: unknown, todayStr: string) {
  const today = todayStr as IsoDate;
  return {
    analysis: {
      today,
      windowStart: today,
      completed: 0,
      missed: 0,
      unknown: 0,
      statusCoverage: 0,
      volumeCoverage: 0,
      actualKm: 0,
      plannedKm: 0,
      completeWeeks: [],
      recentWeeklyKm: null,
      lastPositiveWeeklyKm: null,
      recentLongRunKm: null,
      lastRunDate: null,
      daysSinceLastRun: null,
      explicitMisses14d: 0,
      easyHighRpeCount: 0,
      lowerVolumeWeeks: 0,
      reasons: [ADAPTATION_UNSUPPORTED]
    },
    recommendation: {
      kind: null,
      reason: ADAPTATION_UNSUPPORTED,
      actionable: false,
      requiresConfirmation: false,
      reasons: [ADAPTATION_UNSUPPORTED]
    }
  };
}
export const executionBasis = refuse;
export const buildExecutionAdjustment = refuse;
export const buildRunWalkAdjustment = refuse;
export const assessRunWalkProgress = () => ({
  decision: 'not-applicable' as const,
  rung: null,
  finalRung: false,
  considered: 0,
  completed: 0,
  missed: 0,
  tolerated: 0,
  borderline: 0,
  hard: 0,
  unreported: 0,
  reasons: [ADAPTATION_UNSUPPORTED],
  advice: ADAPTATION_UNSUPPORTED
});
export const qualityEntryGate = () => ({
  open: false,
  met: [],
  unmet: [ADAPTATION_UNSUPPORTED],
  unknown: []
});
export const hasRecentMeasuredForm = (): boolean => false;

/* --- promena cilja, rekalibracija, vraćanje verzije, automatske izmene --- */
export const planWithNewGoal = refuse;
export const planRecalibrated = refuse;
/** Bez izmene budućih dana: pregled vraćanja verzije prijavljuje da nema šta da se vrati, uz razlog. */
export const graftFuturePlan = (plan: GenPlanState): GenPlanState => ({
  ...plan,
  meta: {
    ...(plan.meta ?? {}),
    futureChanges: { changedDays: 0, conflicts: [ADAPTATION_UNSUPPORTED] }
  } as GenPlanState['meta']
});
export const alignAutomaticOverlays = (
  _current: unknown,
  _result: unknown,
  _today: string,
  context: { alts?: Readonly<Record<string, AltRecord>> }
): Record<string, AltRecord> => ({ ...(context.alts ?? {}) });

/* --- predlog tempa, dokaz forme --- */
export const vdotProposal = (): null => null;
export const applyVdotProposal = (
  _proposal: unknown,
  _plan: unknown,
  _log: unknown,
  alts: Readonly<Record<string, AltRecord>>,
  genPlan: GenPlanState | null
) => ({ applied: 0, alts: { ...alts }, genPlan });
export const undoVdotAdjustments = (
  _plan: unknown,
  alts: Readonly<Record<string, AltRecord>>,
  genPlan: GenPlanState | null
) => ({ applied: 0, alts: { ...alts }, genPlan });
export const fitnessEvidence = (ctx: { vdotChain: readonly VdotRecord[] }) => ({
  form: null,
  measurements: 0,
  distinctDays: 0,
  confirmedTests: 0,
  trainingMeasurements: 0,
  windowDays: 0,
  chain: ctx.vdotChain.map((e) => ({ ...e })),
  excluded: []
});
export const planVdotNow = (): number | null => null;
export const matchPlanRows = <R>(): Map<string, R> => new Map<string, R>();
/** Kapija rekalibracije se nikad ne otvara (beskonačan prag) dok adaptacija ne postoji. */
export const RECALIBRATION_MIN_MEASUREMENTS = Number.POSITIVE_INFINITY;
export const RECALIBRATION_THRESHOLD = Number.POSITIVE_INFINITY;

/* --- predlog zbog bola, poravnanje sa uvezenim trčanjima --- */
export const injuryProposal = (): null => null;
export const applyInjuryProposal = (
  _proposal: unknown,
  _plan: unknown,
  _log: unknown,
  alts: Readonly<Record<string, AltRecord>>
) => ({ applied: 0, alts: { ...alts } });
export const realignPlan = (input: { moves: Readonly<Record<string, unknown>> }) => ({
  moves: { ...input.moves },
  moved: 0
});
