import { addDays, diffDays, parseIsoDate, type IsoDate } from '../date';
import type { GenPlanState } from '../state';
import {
  analyzeExecution,
  recommendExecution,
  type ExecutionAnalysis
} from '../training/execution';
import { generatePlan } from '../training/generator/generatePlan';
import { derivePred, deriveQSById } from '../training/prediction';
import { isPlanError, type PlanGenerationInput } from '../training/types';
import { adaptGeneratedPlan } from './adapt';
import { graftFuturePlan, type ReplanContext } from './future';
import type { ResolvedPlan } from './types';
import { guardReturnGrowth } from './returnGrowth';

/** Transparent product defaults, not a physiological or medical recovery model. */
export const RETURN_POLICY = {
  short: { days: 7, fraction: 0.85, easyWeeks: 2 },
  medium: { days: 14, fraction: 0.7, easyWeeks: 3 },
  long: { days: 28, fraction: 0.55, easyWeeks: 4 }
} as const;

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

export function buildExecutionAdjustment(
  current: GenPlanState,
  today: IsoDate,
  analysis: ExecutionAnalysis,
  options: ExecutionAdjustmentOptions,
  context: ReplanContext = {}
): { result: GenPlanState; notes: string[]; summary: string } | { error: string } {
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
  const policy = returning
    ? options.breakDays! >= RETURN_POLICY.long.days
      ? RETURN_POLICY.long
      : options.breakDays! >= RETURN_POLICY.medium.days
        ? RETURN_POLICY.medium
        : RETURN_POLICY.short
    : null;
  const fraction = policy?.fraction ?? (analysis.easyHighRpeCount >= 2 ? 0.85 : 1);
  const weeklyKm = Math.round(base * fraction * 10) / 10;
  const input: PlanGenerationInput = {
    ...original,
    startDate: addDays(today, 1),
    weeklyKm,
    ...(lr != null
      ? { recentLongRunKm: Math.round(lr * fraction * 10) / 10 }
      : { recentLongRunKm: undefined }),
    consistentWeeks: 0,
    breakWeeks: returning ? Math.ceil(options.breakDays! / 7) : 0,
    intensity: 'kons',
    volIntensity: 'kons',
    trainedRecently: !returning
  };
  const generated = generatePlan(input);
  if (isPlanError(generated))
    return {
      error: `Preostalo vreme ne podržava novi pun ciklus: ${generated.error} Datum trke nije automatski pomeren.`
    };
  const partialFirst = addDays(today, 1) !== generated.meta.start;
  generated.weeks = guardReturnGrowth(generated.weeks, weeklyKm, partialFirst);
  generated.pred = derivePred(generated.weeks, generated.meta.raceDistM, generated.meta);
  const fresh = adaptGeneratedPlan(generated);
  if (!fresh || !fresh.meta) return { error: 'Nije moguće napraviti predlog.' };
  fresh.qs = deriveQSById(fresh.weeks);
  // An explicitly confirmed break starts with easy running. Preserve the dose, remove intensity.
  if (policy) {
    fresh.weeks = fresh.weeks.map((week, index) =>
      index >= policy.easyWeeks
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
    fresh.pred = derivePred(fresh.weeks, fresh.meta.raceDistM, fresh.meta).map((row, i) => ({
      ...row,
      id: `g${row.w}_${i}`
    }));
    fresh.qs = deriveQSById(fresh.weeks);
  }
  const notes = [
    'Neupisani treninzi nisu tretirani kao preskočeni. Propuštena kilometraža se ne nadoknađuje.',
    'Odrađeni dani, merenja i ručne izmene ostaju; zaštićen budući trening može zahtevati posebnu ručnu proveru.',
    'Vremenski cilj ostaje cilj. Referentni PB i ovaj predlog ne potvrđuju spremnost niti tempo posle pauze.'
  ];
  if (policy)
    notes.push(
      `Potvrđena pauza: ${options.breakDays} dana. Polazni obim je ${Math.round(policy.fraction * 100)}% prijavljene baze (${weeklyKm} km). Ovo su oprezne postavke aplikacije, ne medicinska procena.`
    );
  else notes.push(`Polazni obim prati stvarno odrađenu/prijavljenu bazu: ${weeklyKm} km nedeljno.`);
  fresh.meta = {
    ...fresh.meta,
    executionAdjustment: {
      date: today,
      breakDays: options.breakDays ?? 0,
      reportedBaseKm: base,
      startingKm: weeklyKm
    },
    dayWarnings: [...fresh.meta.dayWarnings, ...notes]
  };
  const result = graftFuturePlan(
    current,
    { ...fresh, ulaz: input },
    today,
    context,
    policy
      ? {
          returnWindow: {
            start: addDays(today, 1),
            end: addDays(generated.meta.start, policy.easyWeeks * 7),
            requiredWeeks: policy.easyWeeks
          }
        }
      : {}
  );
  notes.push(
    ...result.meta!.dayWarnings.filter((s) =>
      /^(Finalni preostali plan:|Povratni period |Konflikt povratne politike:)/.test(s)
    )
  );
  return {
    result,
    notes,
    summary: policy
      ? `Povratak posle ${options.breakDays} dana pauze, baza ${weeklyKm} km`
      : `Plan prema odrađenoj bazi ${weeklyKm} km`
  };
}
