import { addDays, diffDays, mondayOnOrBefore, parseIsoDate, type IsoDate } from '../date';
import { distUReceni } from '../format';
import type { GenPlanState } from '../state';
import {
  analyzeExecution,
  recommendExecution,
  type ExecutionAnalysis
} from '../training/execution';
import type { PlanGenerationInput } from '../training/types';
import type { ReplanContext } from './future';
import {
  isLimitedLongPreparation,
  preparationDecision,
  preparationRequirement,
  type DecisionBasis,
  type PreparationDecision
} from './preparationDecision';
import { finalWarnings, regenerateFuture, returnPolicyFor } from './regenerate';
import type { ResolvedPlan } from './types';

export { RETURN_POLICY } from './regenerate';

export interface ExecutionAdjustmentOptions {
  /** Explicitly confirmed break; undefined means adjust reported execution without assuming a break. */
  breakDays?: number;
  /** Repeatable weekly base before the confirmed break, or current actual base for a reduction. */
  weeklyKm?: number;
  recentLongRunKm?: number;
}

export function executionModel(
  plan: ResolvedPlan,
  today: string,
  context: ReplanContext,
  extras?: Record<string, number>
) {
  const analysis = analyzeExecution({ plan, today, log: context.log ?? {}, extras });
  return { analysis, recommendation: recommendExecution(analysis) };
}

/** Validate confirmed execution facts and derive the regeneration input; no plan is generated. */
export function executionBasis(
  current: GenPlanState,
  today: IsoDate,
  analysis: ExecutionAnalysis,
  options: ExecutionAdjustmentOptions
): (DecisionBasis & { returning: boolean; base: number; weeklyKm: number }) | { error: string } {
  if (!current.ulaz || typeof current.ulaz !== 'object' || Array.isArray(current.ulaz))
    return { error: 'Plan nema sačuvane ulazne podatke. Napravi plan sa trenutnom bazom.' };
  const original = current.ulaz as PlanGenerationInput;
  const race = parseIsoDate(original.raceDate);
  if (!race || diffDays(today, race) < 28)
    return {
      error:
        'Do trke je manje od četiri nedelje. Ne obnavljamo ceo plan niti dodajemo propuštene kilometre u taper.'
    };
  const returning = options.breakDays !== undefined;
  if (
    returning &&
    (!Number.isInteger(options.breakDays) || options.breakDays! < 7 || options.breakDays! > 365)
  )
    return { error: 'Potvrdi trajanje pauze od 7 do 365 dana.' };
  const recommendation = recommendExecution(analysis);
  if (!returning && recommendation.kind !== 'reduce' && recommendation.kind !== 'insufficient-data')
    return { error: recommendation.reason };
  const base = options.weeklyKm ?? analysis.recentWeeklyKm;
  if (typeof base !== 'number' || !Number.isFinite(base) || base <= 0 || base > 200)
    return {
      error:
        'Unesi ponovljivu bazu veću od nule, do 200 km nedeljno. Planirani kilometri nisu dokaz odrađene baze.'
    };
  const lr = options.recentLongRunKm ?? (returning ? undefined : analysis.recentLongRunKm);
  if (lr !== undefined && lr !== null && (!Number.isFinite(lr) || lr <= 0 || lr > base))
    return { error: 'Ponovljiva dužina mora biti pozitivna i ne veća od nedeljne baze.' };
  const policy = returning ? returnPolicyFor(options.breakDays) : null;
  const fatigued = analysis.easyHighRpeCount >= 2;
  const reason = returning ? 'confirmed-break' : fatigued ? 'fatigue' : 'reduced-volume';
  const recoveryStart = addDays(today, 1);
  const recoveryEnd = addDays(mondayOnOrBefore(today), 14);
  const fraction = policy?.fraction ?? (fatigued ? 0.85 : 1);
  const weeklyKm = Math.round(base * fraction * 10) / 10;
  const input: PlanGenerationInput = {
    ...original,
    startDate: addDays(today, 1),
    weeklyKm,
    ...(lr != null
      ? { recentLongRunKm: Math.round(lr * fraction * 10) / 10 }
      : { recentLongRunKm: undefined }),
    consistentWeeks: original.consistentWeeks,
    currentReadiness: returning
      ? {
          reason: 'returning',
          until: addDays(mondayOnOrBefore(recoveryStart), policy!.easyWeeks * 7)
        }
      : { reason: fatigued ? 'fatigued' : 'reduced-volume', until: recoveryEnd },
    breakWeeks: returning ? Math.ceil(options.breakDays! / 7) : 0,
    intensity: 'kons',
    volIntensity: 'kons',
    trainedRecently: !returning
  };
  return {
    input,
    policy,
    guardBaseKm: weeklyKm,
    execution: {
      date: today,
      reason,
      breakDays: options.breakDays ?? 0,
      reportedBaseKm: base,
      startingKm: weeklyKm,
      ...(lr != null ? { reportedLongRunKm: lr } : {})
    },
    returning,
    base,
    weeklyKm
  };
}

export function buildExecutionAdjustment(
  current: GenPlanState,
  today: IsoDate,
  analysis: ExecutionAnalysis,
  options: ExecutionAdjustmentOptions,
  context: ReplanContext = {}
):
  | { result: GenPlanState; notes: string[]; summary: string; decision?: PreparationDecision }
  | { error: string; decision?: PreparationDecision } {
  const basis = executionBasis(current, today, analysis, options);
  if ('error' in basis) return basis;
  const { policy, weeklyKm } = basis;
  const notes = [
    'Neupisani treninzi nisu tretirani kao preskočeni. Propuštena kilometraža se ne nadoknađuje.',
    'Odrađeni dani, merenja i ručne izmene ostaju; zaštićen budući trening može zahtevati posebnu ručnu proveru.',
    basis.returning
      ? 'Vremenski cilj ostaje cilj. Referentni PB ne potvrđuje spremnost niti tempo posle pauze.'
      : 'Vremenski cilj ostaje cilj. Referentni PB ne potvrđuje trenutnu toleranciju opterećenja.'
  ];
  if (policy)
    notes.push(
      `Potvrđena pauza: ${options.breakDays} dana. Polazni obim je ${Math.round(policy.fraction * 100)}% prijavljene baze (${weeklyKm} km). Ovo su oprezne postavke aplikacije, ne medicinska procena.`
    );
  else notes.push(`Polazni obim prati stvarno odrađenu/prijavljenu bazu: ${weeklyKm} km nedeljno.`);
  if (!policy && basis.execution?.reason === 'fatigue') {
    const end = basis.input.currentReadiness!.until;
    notes.push(
      `Visok napor bez potvrđene pauze: kontinuitet je sačuvan. Neposredno rasterećenje ${basis.input.startDate}–${addDays(end, -1)} ostaje bez kvaliteta i ubrzanja; pojedinačni treninzi ne prelaze prethodni raspored, a nedeljni obim ni 85% baze (delimična nedelja srazmerno danima). Deload se ne odlaže ponovnim indeksiranjem faze.`
    );
  } else if (!policy)
    notes.push(
      'Manji izvršeni obim/propušteni treninzi: baza se prilagođava izvršenju, bez pretpostavke pauze i bez brisanja kontinuiteta.'
    );
  const built = regenerateFuture(current, basis.input, today, context, {
    policy,
    guardBaseKm: weeklyKm,
    execution: basis.execution!,
    notes
  });
  if ('error' in built) return { error: built.error };
  const result = built.result;
  notes.push(...finalWarnings(result));
  let summary = policy
    ? `Povratak posle ${options.breakDays} dana pauze, baza ${weeklyKm} km`
    : basis.execution?.reason === 'fatigue'
      ? `Rasterećenje zbog visokog napora, baza ${weeklyKm} km`
      : `Plan prema manjem izvršenom obimu ${weeklyKm} km`;
  if (!isLimitedLongPreparation(result.meta)) return { result, notes, summary };
  // A limited long-distance result is a return plan to the existing date, not a full preparation.
  const decision = preparationDecision(
    current,
    today,
    basis,
    context,
    'limited',
    result.meta!.preparation
  );
  const name = distUReceni(preparationRequirement(result.meta!.raceDistM).name);
  summary = `${summary} — ${policy ? 'povratni plan' : 'ograničen plan'} do postojećeg datuma, nije puna priprema za ${name}`;
  result.meta = {
    ...result.meta!,
    cycleDecision: { kind: 'limited', date: today, fullPreparation: false },
    dayWarnings: [...new Set([decision.statement, ...result.meta!.dayWarnings])]
  };
  return {
    result,
    notes: [decision.statement, ...decision.conditions, ...notes],
    summary,
    decision
  };
}
