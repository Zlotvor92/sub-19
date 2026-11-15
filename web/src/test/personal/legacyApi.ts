/* API STAROG ZAJEDNIČKOG MEHANIZMA — sada samo TIP (stari engine je obrisan posle segmenta 5/5).

   Sve reference (`src/test/fixtures/*-reference.json.gz`) su snimljene iz starog engine-a ovim API-jem na zabeleženim
   commitima (5K i ostale distance `05088e0`, 10K `f745be0`, HM `90f2d0e`, maraton `ad464c0`, lični plan `348391c`).
   Ponovno snimanje se radi u worktree-ju na tim commitima. Ime fajla je zadržano jer ga harnesi uvoze kao ugovor
   (`GeneratorApi`); oblik je isti kao kod svakog generatora (ugovor polumaratona, sa predajom vezanom). */
import type * as hm from '@/domain/generators/halfMarathon';

type HM = typeof hm;
type WithoutHandoff<F extends (...a: never[]) => unknown> = (
  ...a: Parameters<F> extends [...infer P, unknown] ? P : never
) => ReturnType<F>;

export type GeneratorApi = Pick<
  HM,
  | 'generatePlan'
  | 'assess'
  | 'adaptGeneratedPlan'
  | 'resolvePlan'
  | 'executionModel'
  | 'buildRunWalkAdjustment'
  | 'assessRunWalkProgress'
  | 'qualityEntryGate'
  | 'hasRecentMeasuredForm'
  | 'planWithNewGoal'
  | 'planRecalibrated'
  | 'recalibratedPlan'
  | 'reentryPlan'
  | 'graftFuturePlan'
  | 'alignAutomaticOverlays'
  | 'vdotProposal'
  | 'applyVdotProposal'
  | 'undoVdotAdjustments'
  | 'fitnessEvidence'
  | 'planVdotNow'
  | 'matchPlanRows'
  | 'sessKm'
  | 'sessDesc'
  | 't3kVdot'
> & { buildExecutionAdjustment: WithoutHandoff<HM['buildExecutionAdjustment']> };
