/* PRIJEM PREDAJE IZ DRUGOG GENERATORA (A2) — 10K kao CILJ.

   Odluka o ograničenoj pripremi dužeg generatora (polumaraton → 10K/5K, maraton → polumaraton/10K) nudi kraću distancu
   istog datuma. Izvor predaje SAMO ČINJENICE: ulaz (distanca, datumi, stvarna baza `weeklyKm`), potvrđeno izvršenje
   (datum i trajanje pauze, prijavljena i polazna baza) i to da li preostali plan kreće od stvarne baze. Povratnu politiku
   (`returnPolicyFor`), bazu zaštite rasta i ocenu pokrivenosti pripreme određuje OVAJ generator svojim pravilima; izvor
   ne šalje svoju politiku. */
import type { IsoDate } from '../date';
import type { GenPlanState } from '../exchange';
import type { PlanGenerationInput, PreparationAssessment } from '../training/types';
import type { ReplanContext } from './future';
import { planPolicy } from './policy';
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

/** Najduže trčanje koje pokriva 10K kad je priprema ograničena [km]. */
const HANDOFF_LONG_RUN_KM = 10;

/** Pokrivenost isporučene pripreme (10K) po pravilu ovog generatora: ne-ograničena priprema je puna; ograničena
 *  pokriva distancu kad najduže trčanje dostiže 10 km. */
export function handoffCoverage(prep: PreparationAssessment | undefined): HandoffCoverage {
  if (!prep) return 'insufficient';
  if (prep.endurance !== 'limited') return 'full';
  return prep.peakLongRunKm >= HANDOFF_LONG_RUN_KM ? 'distance' : 'insufficient';
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
  // Kalemljenje nasleđuje `meta` plana izvora, uključujući njegovu oznaku politike; plan ove distance nije napisala ta
  // politika, pa se tuđa oznaka uklanja (upis ga označava ovim generatorom, `stampPlan`).
  const result = built.result;
  if (result.meta && planPolicy(result).status === 'unknown') {
    const { policyId: _id, policyVersion: _version, ...meta } = result.meta;
    result.meta = meta;
  }
  return { result, coverage: handoffCoverage(result.meta?.preparation) };
}
