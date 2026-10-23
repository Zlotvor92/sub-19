/* PRIJEM PREDAJE IZ DRUGOG GENERATORA (A2) — 10K kao CILJ.

   Odluka o ograničenoj pripremi dužeg generatora (polumaraton → 10K/5K, maraton → polumaraton/10K) nudi kraću distancu
   istog datuma. Izvor predaje ulaz i ČINJENICE: potvrđeno izvršenje (datum, razlog, trajanje pauze, prijavljena baza i
   dužina) i to da li preostali plan kreće od potvrđene baze. Kad je predati ulaz izveden iz tih činjenica, obim, dugi,
   spremnost i povratnu politiku iz njih izvodi OVAJ generator (`returnInput`); izvedena polja ulaza izvora (njegov
   `weeklyKm`, dugi, spremnost) se prepisuju. Bazu zaštite rasta, `startingKm` i ocenu pokrivenosti pripreme takođe
   određuje ovaj generator; izvor ne šalje svoju politiku. */
import { addDays, type IsoDate } from '../date';
import type { GenPlanState } from '../exchange';
import type { PlanGenerationInput, PreparationAssessment } from '../training/types';
import { returnInput } from './executionAdjustment';
import type { ReplanContext } from './future';
import { planPolicy } from './policy';
import {
  regenerateFuture,
  returnPolicyFor,
  type ExecutionAdjustmentMeta,
  type ReturnPolicy
} from './regenerate';

export interface HandoffFacts {
  /** Potvrđeno izvršenje (datum, razlog, pauza, prijavljena baza i dužina) — činjenice iz kojih ovaj generator izvodi
   *  ulaz; `null` kad ga nema (ulaz izvora je tada stvarna baza korisnika). */
  execution: ExecutionAdjustmentMeta | null;
  /** Preostali plan kreće od potvrđene baze (posle potvrđenog izvršenja ili pomeranja početka). */
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

/** Napomena kad predato izvršenje nema razlog (zapis pre uvođenja razloga): umor se ne pogađa, ulaz se ne izvodi. */
const EXECUTION_WITHOUT_REASON_NOTE =
  'Predato potvrđeno izvršenje nema zabeležen razlog (stariji zapis): obim, dugi i spremnost su preuzeti iz predatog ulaza, bez ponovnog izvođenja i bez pretpostavke umora.';

/** Ulaz i povratne odluke ovog generatora iz predatih činjenica. Izvršenje sa razlogom, a predati ulaz je izveden iz
 *  njega (početak = dan posle potvrde) → `returnInput` od dana potvrde (`execution.date`), pa izvedena polja ulaza
 *  izvora ne utiču na plan. Inače važi predati ulaz kao stvarna baza korisnika: bez izvršenja; ulaz koji nije
 *  izveden iz izvršenja (vraćena ranija verzija plana zadržava `meta.executionAdjustment`); izvršenje bez razloga, uz
 *  napomenu. */
function handoffInput(
  input: PlanGenerationInput,
  facts: HandoffFacts
): {
  input: PlanGenerationInput;
  policy: ReturnPolicy | null;
  guardBaseKm: number;
  execution: ExecutionAdjustmentMeta | null;
  notes: string[];
} {
  const { execution } = facts;
  const notes = facts.notes ?? [];
  if (execution?.reason && input.startDate === addDays(execution.date, 1)) {
    const own = returnInput(input, execution.date, {
      base: execution.reportedBaseKm,
      longRunKm: execution.reportedLongRunKm,
      breakDays: execution.breakDays,
      fatigued: execution.reason === 'fatigue'
    });
    return { ...own, notes };
  }
  return {
    input,
    policy: execution ? returnPolicyFor(execution.breakDays) : null,
    guardBaseKm: input.weeklyKm,
    execution,
    notes: execution && !execution.reason ? [...notes, EXECUTION_WITHOUT_REASON_NOTE] : notes
  };
}

/** Preostali plan ove distance iz činjenica izvora; ulaz, politiku, bazu rasta i pokrivenost određuje ovaj cilj. */
export function handoffFuture(
  current: GenPlanState,
  input: PlanGenerationInput,
  today: IsoDate,
  context: ReplanContext,
  facts: HandoffFacts
): { result: GenPlanState; coverage: HandoffCoverage } | { error: string } {
  const own = handoffInput(input, facts);
  const built = regenerateFuture(current, own.input, today, context, {
    policy: own.policy,
    ...(facts.restartFromBase ? { guardBaseKm: own.guardBaseKm } : {}),
    ...(own.execution ? { execution: own.execution } : {}),
    notes: own.notes,
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
