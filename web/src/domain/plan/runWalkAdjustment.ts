import { addDays, diffDays, parseIsoDate, type IsoDate } from '../date';
import type { GenPlanState } from '../state';
import { RUN_WALK_LADDER } from '../training/constants/product';
import { generatePlan } from '../training/generator/generatePlan';
import { derivePred, deriveQSById } from '../training/prediction';
import type { RunWalkAssessment } from '../training/runWalkProgress';
import { isPlanError, type PlanGenerationInput } from '../training/types';
import { adaptGeneratedPlan } from './adapt';
import { graftFuturePlan, type ReplanContext } from './future';

/** `hold` ponavlja trenutni korak, `step-back` se vraća jedan korak, `repeat-phase` kreće iz prvog koraka. */
export type RunWalkMode = 'hold' | 'step-back' | 'repeat-phase';

export interface RunWalkAdjustmentOptions {
  mode: RunWalkMode;
  /** Dodatne nedelje na koraku koji se zadržava (1–3, podrazumevano 1). */
  extraWeeks?: number;
  /** Stvarna trenutna baza; bez nje važi dnevnikom potvrđena, pa prijavljena na početku. */
  weeklyKm?: number;
}

/** Lestvica po nedelji za novu run/walk fazu, počevši od nedelje posle danas. */
export function runWalkLadderFor(rung: number, mode: RunWalkMode, extraWeeks = 1): number[] {
  const last = RUN_WALK_LADDER.length;
  const start = mode === 'repeat-phase' ? 1 : mode === 'step-back' ? Math.max(1, rung - 1) : rung;
  const repeats = mode === 'hold' ? Math.max(1, Math.min(3, Math.round(extraWeeks))) : 0;
  const ladder: number[] = [];
  for (let r = start; r <= last; r++) {
    ladder.push(r);
    if (r === start) for (let i = 0; i < repeats; i++) ladder.push(r);
  }
  return ladder;
}

/**
 * Ponavljanje ili zadržavanje run/walk koraka prema prijavljenoj toleranciji. Budući nezaštićeni treninzi se
 * prave iznova; završeni, merom zaključani, ručno izmenjeni i prošli dani ostaju (`graftFuturePlan`).
 */
export function buildRunWalkAdjustment(
  current: GenPlanState,
  today: IsoDate,
  assessment: RunWalkAssessment,
  options: RunWalkAdjustmentOptions,
  context: ReplanContext = {}
): { result: GenPlanState; notes: string[]; summary: string } | { error: string } {
  if (!current.ulaz || typeof current.ulaz !== 'object' || Array.isArray(current.ulaz))
    return { error: 'Plan nema sačuvane ulazne podatke. Napravi plan sa trenutnom bazom.' };
  const original = current.ulaz as PlanGenerationInput;
  if (assessment.rung === null || assessment.decision === 'not-applicable')
    return { error: 'Plan nema započetu fazu trčanja/hoda koju bi trebalo ponoviti.' };
  const race = parseIsoDate(original.raceDate);
  if (!race || diffDays(today, race) < 28)
    return { error: 'Do trke je manje od četiri nedelje. Ne obnavljamo ceo plan.' };
  const base = options.weeklyKm ?? original.weeklyKm;
  if (!Number.isFinite(base) || base <= 0 || base > 200)
    return { error: 'Unesi ponovljivu bazu veću od nule, do 200 km nedeljno.' };
  const ladder = runWalkLadderFor(assessment.rung, options.mode, options.extraWeeks);
  const input: PlanGenerationInput = {
    ...original,
    startDate: addDays(today, 1),
    weeklyKm: Math.round(base * 10) / 10,
    consistentWeeks: 0,
    breakWeeks: 0,
    trainedRecently: false,
    runWalkLadder: ladder
  };
  const generated = generatePlan(input);
  if (isPlanError(generated))
    return {
      error: `Preostalo vreme ne podržava produženi uvod: ${generated.error} Datum trke nije automatski pomeren.`
    };
  generated.pred = derivePred(generated.weeks, generated.meta.raceDistM, generated.meta);
  const fresh = adaptGeneratedPlan(generated);
  if (!fresh || !fresh.meta) return { error: 'Nije moguće napraviti predlog.' };
  fresh.qs = deriveQSById(fresh.weeks);
  const label = (r: number): string => RUN_WALK_LADDER[r - 1]!.label;
  const notes = [
    'Završeni treninzi, upisani kilometri i minuti, ručne izmene i merom zaključani budući treninzi ostaju.',
    'Trčanje/hod se produžava samo za nezaštićene buduće dane; neupisan napor nije tretiran kao neuspeh.',
    `Nova lestvica po nedelji: ${ladder.map(label).join(' → ')}. Posle nje prelaz na neprekidno trčanje ostaje probni.`,
    'Vremenski cilj i datum trke se ne menjaju, a ova promena ne potvrđuje formu.'
  ];
  const result = graftFuturePlan(current, { ...fresh, ulaz: input }, today, context);
  if (result.meta)
    result.meta = {
      ...result.meta,
      dayWarnings: [...new Set([...result.meta.dayWarnings, ...notes])]
    };
  const what =
    options.mode === 'hold'
      ? `Zadržavanje koraka „${label(assessment.rung)}"`
      : options.mode === 'step-back'
        ? 'Povratak za jedan korak trčanja/hoda'
        : 'Ponavljanje faze trčanja/hoda';
  return {
    result,
    notes,
    summary: `${what}, ${ladder.length} ${ladder.length === 1 ? 'nedelja' : 'nedelje'} run/walk`
  };
}
