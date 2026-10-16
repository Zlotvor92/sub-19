/* PRIJEM PREDAJE IZ DRUGOG GENERATORA (A2) — polumaraton kao CILJ.

   Odluka o ograničenoj pripremi dužeg generatora (polumaraton → 10K/5K, maraton → polumaraton/10K) nudi kraću distancu
   istog datuma. Izvor predaje SAMO ČINJENICE: ulaz (distanca, datumi, stvarna baza `weeklyKm`), potvrđeno izvršenje
   (datum i trajanje pauze, prijavljena i polazna baza) i to da li preostali plan kreće od stvarne baze. Povratnu politiku
   (`returnPolicyFor`), bazu zaštite rasta i ocenu pokrivenosti pripreme određuje OVAJ generator svojim pravilima; izvor
   ne šalje svoju politiku. */
import type { IsoDate } from '../date';
import type { GenPlanState } from '../exchange';
import type { PlanGenerationInput, PreparationAssessment } from '../training/types';
import type { ReplanContext } from './future';
import { preparationCoverage } from './preparationDecision';
import { regenerateFuture, returnPolicyFor, type ExecutionAdjustmentMeta } from './regenerate';

export interface HandoffFacts {
  /** Potvrđeno izvršenje (pauza, baza) koje važi od danas; `null` kad ga nema. */
  execution: ExecutionAdjustmentMeta | null;
  /** Preostali plan kreće od stvarne baze iz ulaza (posle potvrđenog izvršenja ili pomeranja početka). */
  restartFromBase: boolean;
  notes?: string[];
  meta?: Record<string, unknown>;
}

export type HandoffCoverage = 'full' | 'distance' | 'insufficient';

const HALF_MARATHON_M = 21097.5;

/** Pokrivenost isporučene pripreme (polumaraton) po pravilu ovog generatora (`preparationCoverage`). */
export function handoffCoverage(prep: PreparationAssessment | undefined): HandoffCoverage {
  return preparationCoverage(prep, HALF_MARATHON_M);
}

/** Preostali plan ove distance iz činjenica izvora; politika, baza rasta i pokrivenost su odluke ovog generatora. */
export function handoffFuture(
  current: GenPlanState,
  input: PlanGenerationInput,
  today: IsoDate,
  context: ReplanContext,
  facts: HandoffFacts
): { result: GenPlanState; coverage: HandoffCoverage } | { error: string } {
  const policy = facts.execution ? returnPolicyFor(facts.execution.breakDays) : null;
  const guardBaseKm = facts.restartFromBase ? input.weeklyKm : undefined;
  const built = regenerateFuture(current, input, today, context, {
    policy,
    ...(guardBaseKm !== undefined ? { guardBaseKm } : {}),
    ...(facts.execution ? { execution: facts.execution } : {}),
    notes: facts.notes ?? [],
    ...(facts.meta !== undefined ? { meta: facts.meta } : {})
  });
  if ('error' in built) return built;
  return { result: built.result, coverage: handoffCoverage(built.result.meta?.preparation) };
}
