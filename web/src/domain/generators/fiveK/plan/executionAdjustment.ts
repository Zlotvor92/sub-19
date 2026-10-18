import { addDays, diffDays, mondayOnOrBefore, parseIsoDate, type IsoDate } from '../date';
import type { GenPlanState } from '../exchange';
import {
  analyzeExecution,
  recommendExecution,
  type ExecutionAnalysis
} from '../training/execution';
import type { PlanGenerationInput } from '../training/types';
import type { ReplanContext } from './future';
import {
  finalWarnings,
  regenerateFuture,
  returnPolicyFor,
  type ExecutionAdjustmentMeta,
  type ReturnPolicy
} from './regenerate';
import type { ResolvedPlan } from './types';

export { RETURN_POLICY } from './regenerate';

/** Potvrđene činjenice iz kojih se plan obnavlja (isti oblik kao aplikaciona odluka o pripremi). */
export interface DecisionBasis {
  input: PlanGenerationInput;
  policy: ReturnPolicy | null;
  execution: ExecutionAdjustmentMeta | null;
  /** Growth guard base; set when the remaining plan restarts from today. */
  guardBaseKm?: number;
}

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

/** Validate confirmed execution facts and derive the regeneration input (`returnInput`); no plan is generated. */
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
  const derived = returnInput(original, today, {
    base,
    longRunKm: lr,
    breakDays: options.breakDays,
    fatigued: analysis.easyHighRpeCount >= 2
  });
  return { ...derived, base, weeklyKm: derived.input.weeklyKm };
}

/** Potvrđene činjenice izvršenja (sopstveno prilagođavanje ili predaja iz drugog generatora). */
export interface ReturnFacts {
  /** Prijavljena ponovljiva nedeljna baza [km]. */
  base: number;
  /** Prijavljena ponovljiva dužina [km]; bez nje dugi određuje generisanje. */
  longRunKm?: number | null | undefined;
  /** Potvrđena pauza [dana]; bez nje (ili 0) nema povratka posle pauze. */
  breakDays?: number | undefined;
  /** Visok napor na laganim treninzima bez potvrđene pauze. */
  fatigued: boolean;
}

/** JEDINO mesto koje iz potvrđenih činjenica izvodi povratni ulaz 5K: početak, obim, dugi, spremnost, nedelje pauze i
 *  oprez, povratnu politiku (`returnPolicyFor`), bazu zaštite rasta i meta izvršenja (`startingKm`). `today` je dan
 *  potvrde činjenica; ostala polja ulaza (distanca, datum trke, cilj, dani…) ostaju iz `original`. Ne validira. */
export function returnInput(
  original: PlanGenerationInput,
  today: IsoDate,
  facts: ReturnFacts
): DecisionBasis & {
  guardBaseKm: number;
  execution: ExecutionAdjustmentMeta;
  returning: boolean;
} {
  const { base, fatigued } = facts;
  const lr = facts.longRunKm;
  const policy = returnPolicyFor(facts.breakDays);
  const returning = policy !== null;
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
          until: addDays(mondayOnOrBefore(recoveryStart), policy.easyWeeks * 7)
        }
      : { reason: fatigued ? 'fatigued' : 'reduced-volume', until: recoveryEnd },
    breakWeeks: returning ? Math.ceil(facts.breakDays! / 7) : 0,
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
      breakDays: facts.breakDays ?? 0,
      reportedBaseKm: base,
      startingKm: weeklyKm,
      ...(lr != null ? { reportedLongRunKm: lr } : {})
    },
    returning
  };
}

export function buildExecutionAdjustment(
  current: GenPlanState,
  today: IsoDate,
  analysis: ExecutionAnalysis,
  options: ExecutionAdjustmentOptions,
  context: ReplanContext = {}
): { result: GenPlanState; notes: string[]; summary: string } | { error: string } {
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
  const summary = policy
    ? `Povratak posle ${options.breakDays} dana pauze, baza ${weeklyKm} km`
    : basis.execution?.reason === 'fatigue'
      ? `Rasterećenje zbog visokog napora, baza ${weeklyKm} km`
      : `Plan prema manjem izvršenom obimu ${weeklyKm} km`;
  /* Odluka o ograničenoj pripremi (`preparationDecision`) postoji samo za polumaraton i maraton
     (`raceDistM >= 21097`); 5K rezultat je uvek `raceDistM === 5000`, pa ta grana ovde ne postoji. */
  return { result, notes, summary };
}
