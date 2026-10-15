/**
 * Product decision when the available base or time does not support a full preparation.
 *
 * Every number here comes from the existing product rules (minimum cycle weeks, required long
 * run and weekly peak in `assessPreparation`, return policy, 8% return growth guard) or from the
 * delivered plan. Nothing promises readiness; options are previews the runner must apply.
 */
import { addDays, diffDays, mondayOnOrBefore, parseIsoDate, type IsoDate } from '../date';
import { brojNedelja, distUReceni, fmtClock, fmtDayMonthYear, fmtKm, r1 } from '../format';
import type { GenPlanState, StoredWeek } from '../exchange';
import { profileFor } from '../training/distances';
import type { PlanGenerationInput, PreparationAssessment, RaceDistanceM } from '../training/types';
import type { ReplanContext } from './future';
import { fatigueWindowFor } from './fatigueRecovery';
import { graftFuturePlan } from './future';
import {
  finalWarnings,
  regenerateFuture,
  returnPolicyFor,
  type RegenerationOptions,
  type ExecutionAdjustmentMeta,
  type ReturnPolicy
} from './regenerate';
import { resolvePlan } from './resolve';

const LONG_DISTANCE_M = 21097;
/** Maraton (jedina distanca ovog generatora). */
const MARATHON_M = 42195;
/** Product search horizon for a later race date; not a claim that longer is always possible. */
export const EXTEND_SEARCH_WEEKS = 52;
/** Kraće opcije istog datuma; njihov plan pravi generator te distance (`ShorterDistanceHandoff`). Ime prikazane
 *  distance se čita iz plana koji je taj generator napravio (`meta.raceName`), ne iz parametara drugih distanci. */
const SHORTER: Readonly<Record<number, readonly RaceDistanceM[]>> = {
  42195: [21097.5, 10000]
};

export type PreparationChoice =
  | { kind: 'extend'; raceDate: IsoDate }
  | { kind: 'shorter'; raceDistM: RaceDistanceM }
  | { kind: 'base' };

/** Same thresholds as `assessPreparation`, exposed so the decision can name them. Proizvodni podaci postoje samo za
 *  maraton; za kraću opciju iz predaje (polumaraton, 10K) maratonska odluka zadržava izvorno pravilo dužine kojim
 *  ocenjuje tu opciju (polumaraton 16 km, 10K sama distanca). */
export function preparationRequirement(raceDistM: number) {
  const product = profileFor(raceDistM)?.product;
  const longRunKm = raceDistM >= 42195 ? 26 : raceDistM >= LONG_DISTANCE_M ? 16 : raceDistM / 1000;
  return {
    longRunKm,
    exposureKm: r1(longRunKm * 0.85),
    weeklyKm: product?.minPeakKm ?? 0,
    minWeeks: product?.minWeeks ?? 0,
    name: product?.name ?? `${raceDistM / 1000} km`
  };
}

/**
 * full: the delivered plan is not `limited`.
 * distance: the longest run covers the requirement, but weekly peak does not support a time goal.
 * insufficient: the longest run does not cover the product requirement for the distance.
 */
export type Coverage = 'full' | 'distance' | 'insufficient';
export function preparationCoverage(
  prep: PreparationAssessment | undefined,
  raceDistM: number
): Coverage {
  if (!prep) return 'insufficient';
  if (prep.endurance !== 'limited') return 'full';
  return prep.peakLongRunKm >= preparationRequirement(raceDistM).longRunKm
    ? 'distance'
    : 'insufficient';
}

/** A long-distance plan whose delivered preparation is limited is not a full preparation. */
export function isLimitedLongPreparation(meta: GenPlanState['meta'] | undefined): boolean {
  return (
    !!meta &&
    meta.raceDistM >= LONG_DISTANCE_M &&
    preparationCoverage(meta.preparation, meta.raceDistM) !== 'full'
  );
}

/** Confirmed facts a decision regenerates from. */
export interface DecisionBasis {
  input: PlanGenerationInput;
  policy: ReturnPolicy | null;
  execution: ExecutionAdjustmentMeta | null;
  /** Growth guard base; set when the remaining plan restarts from today. */
  guardBaseKm?: number;
}

/** Decision from an already stored plan: reuse a persisted return adjustment if there is one. */
export function basisFromPlan(current: GenPlanState, today: IsoDate): DecisionBasis | null {
  const ulaz = current.ulaz;
  if (!ulaz || typeof ulaz !== 'object' || Array.isArray(ulaz)) return null;
  const execution = current.meta?.['executionAdjustment'] as ExecutionAdjustmentMeta | undefined;
  const input = ulaz as PlanGenerationInput;
  const start = parseIsoDate(input.startDate);
  const anchor = parseIsoDate(current.meta?.start);
  const rebased = !!(start && anchor && start > addDays(anchor, 6));
  if (execution && parseIsoDate(execution.date) && execution.date <= today)
    return {
      input,
      policy: returnPolicyFor(execution.breakDays),
      execution,
      guardBaseKm: input.weeklyKm
    };
  return {
    input,
    policy: null,
    execution: null,
    ...(rebased ? { guardBaseKm: input.weeklyKm } : {})
  };
}

export interface PreparationOption {
  id: string;
  choice: PreparationChoice;
  title: string;
  detail: string;
  raceDate: IsoDate;
  raceDistM: number;
  goalSec: number | null;
  coverage: Coverage;
  peakLongRunKm: number;
  peakWeeklyKm: number;
}

export interface PreparationDecision {
  status: 'rejected' | 'limited';
  fullPreparation: false;
  statement: string;
  conditions: string[];
  options: PreparationOption[];
  /** Explained absence, e.g. no later date within the search horizon gives a full preparation. */
  unavailable: string[];
}

type Built = { result: GenPlanState } | { error: string };

/**
 * Plan kraće distance (polumaraton, 10K) pravi i obrađuje generator te distance, ne maraton. Maraton ga ne uvozi:
 * aplikacioni izbor generatora (`generators/select.ts` → `generators/handoff.ts`) ga predaje ovde kao funkciju. `null`
 * znači da za tu distancu nema drugog generatora, pa plan pravi maraton (produženje datuma iste distance).
 */
export type ShorterDistanceHandoff = (
  raceDistM: number | undefined
) =>
  | ((
      current: GenPlanState,
      input: PlanGenerationInput,
      today: IsoDate,
      context: ReplanContext,
      options: RegenerationOptions
    ) => { result: GenPlanState } | { error: string })
  | null;

function regenerate(
  current: GenPlanState,
  basis: DecisionBasis,
  input: PlanGenerationInput,
  today: IsoDate,
  context: ReplanContext,
  meta: Record<string, unknown>,
  handoff: ShorterDistanceHandoff,
  notes: string[] = []
): Built {
  // A shorter half-marathon or 10K option is planned and finalized by the isolated generator of that distance.
  const regen =
    (input.raceDistM === MARATHON_M ? null : handoff(input.raceDistM)) ?? regenerateFuture;
  const built = regen(current, input, today, context, {
    policy: basis.policy,
    ...(basis.guardBaseKm !== undefined ? { guardBaseKm: basis.guardBaseKm } : {}),
    ...(basis.execution ? { execution: basis.execution } : {}),
    notes,
    meta
  });
  return 'error' in built ? built : { result: built.result };
}

const raceOf = (input: PlanGenerationInput): IsoDate | null => parseIsoDate(input.raceDate);
const distOf = (input: PlanGenerationInput): number => input.raceDistM ?? 5000;

/** Earliest later race date whose delivered plan is a full preparation, searched weekly. */
function findExtension(
  current: GenPlanState,
  basis: DecisionBasis,
  today: IsoDate,
  context: ReplanContext,
  handoff: ShorterDistanceHandoff
): { raceDate: IsoDate; result: GenPlanState } | { best: PreparationAssessment | null } {
  const race = raceOf(basis.input)!;
  const attempt = (k: number) => {
    const raceDate = addDays(race, 7 * k);
    const built = regenerate(
      current,
      basis,
      { ...basis.input, raceDate },
      today,
      context,
      {},
      handoff
    );
    return 'error' in built ? null : { raceDate, result: built.result };
  };
  const full = (x: ReturnType<typeof attempt>) =>
    !!x && preparationCoverage(x.result.meta?.preparation, distOf(basis.input)) === 'full';
  const horizon = attempt(EXTEND_SEARCH_WEEKS);
  if (!full(horizon)) return { best: horizon?.result.meta?.preparation ?? null };
  for (let k = 1; k < EXTEND_SEARCH_WEEKS; k++) {
    const x = attempt(k);
    if (full(x)) return x!;
  }
  return horizon!;
}

function optionFrom(
  id: string,
  choice: PreparationChoice,
  title: string,
  detail: string,
  result: GenPlanState
): PreparationOption {
  const meta = result.meta!;
  return {
    id,
    choice,
    title,
    detail,
    raceDate: meta.raceDate as IsoDate,
    raceDistM: meta.raceDistM,
    goalSec: meta.goalSec ?? null,
    coverage: preparationCoverage(meta.preparation, meta.raceDistM),
    peakLongRunKm: meta.preparation?.peakLongRunKm ?? 0,
    peakWeeklyKm: meta.preparation?.peakWeeklyKm ?? 0
  };
}

/** Easy-only running is never presented as a full preparation for a time goal. */
function baseOption(...args: Parameters<typeof optionFrom>): PreparationOption {
  const option = optionFrom(...args);
  return option.coverage === 'full' ? { ...option, coverage: 'distance' } : option;
}

/** The options a runner can preview; the stored plan is never changed here. */
export function preparationDecision(
  current: GenPlanState,
  today: IsoDate,
  basis: DecisionBasis,
  context: ReplanContext,
  status: 'rejected' | 'limited',
  delivered: PreparationAssessment | undefined,
  handoff: ShorterDistanceHandoff
): PreparationDecision {
  const dist = distOf(basis.input);
  const race = raceOf(basis.input);
  const req = preparationRequirement(dist);
  const options: PreparationOption[] = [];
  const unavailable: string[] = [];
  const name = distUReceni(req.name);

  const extension = race ? findExtension(current, basis, today, context, handoff) : { best: null };
  if ('raceDate' in extension) {
    const weeks = Math.round(diffDays(race!, extension.raceDate) / 7);
    options.push(
      optionFrom(
        'extend',
        { kind: 'extend', raceDate: extension.raceDate },
        `Pomeri trku na ${fmtDayMonthYear(extension.raceDate)}`,
        `Najraniji datum, ${weeks} ned. kasnije, na kome isporučen plan ispunjava pravila pune pripreme za ${name}. Isti cilj i baza.`,
        extension.result
      )
    );
  } else {
    const best = extension.best;
    unavailable.push(
      `Pomeranje trke do ${brojNedelja(EXTEND_SEARCH_WEEKS)} kasnije ne daje punu pripremu sa trenutno potvrđenom bazom${best ? `: najviše ${fmtKm(best.peakLongRunKm)} km najduže i ${fmtKm(best.peakWeeklyKm)} km/ned` : ''}. Prvo treba podići ponovljivu bazu i dužinu.`
    );
  }

  for (const shorter of SHORTER[dist] ?? []) {
    if (!race) break;
    const built = regenerate(
      current,
      basis,
      { ...basis.input, raceDistM: shorter, goalSec: null },
      today,
      context,
      {},
      handoff
    );
    if ('error' in built) continue;
    const coverage = preparationCoverage(built.result.meta?.preparation, shorter);
    if (coverage === 'insufficient') continue;
    const sname = built.result.meta!.raceName;
    options.push(
      optionFrom(
        `shorter-${shorter}`,
        { kind: 'shorter', raceDistM: shorter },
        `Kraća distanca: ${distUReceni(sname)} istog datuma`,
        coverage === 'full'
          ? `Isporučen plan ispunjava pravila pune pripreme za ${distUReceni(sname)}. Vremenski cilj ${name} se ne prenosi; novi cilj postavi posebno.`
          : `Dužina pokriva ${distUReceni(sname)}, ali nedeljni vrhunac ne podržava vremenski cilj. Vremenski cilj ${name} se ne prenosi.`,
        built.result
      )
    );
    break;
  }
  if (!options.some((o) => o.choice.kind === 'shorter') && (SHORTER[dist]?.length ?? 0) > 0)
    unavailable.push('Nijedna kraća distanca istog datuma ne pokriva potrebnu dužinu.');

  const base = race ? buildReturnBase(current, basis, today, context) : null;
  if (base && !('error' in base))
    options.push(
      baseOption(
        'base',
        { kind: 'base' },
        'Povratni/bazni režim do istog datuma, bez vremenskog cilja',
        `Samo lako trčanje i postepen rast od potvrđene baze; nije priprema za vremenski cilj na ${name}. Uslovi nastavka su navedeni ispod.`,
        base.result
      )
    );

  const facts = delivered
    ? `Isporučeno: najduže ${fmtKm(delivered.peakLongRunKm)} km, vrhunac ${fmtKm(delivered.peakWeeklyKm)} km/ned.`
    : '';
  const statement =
    status === 'rejected'
      ? `Pun ciklus za ${name} nije moguć: do trke ${race ? fmtDayMonthYear(race) : ''} plan nije moguće izračunati iz unetih podataka. Proveri podatke ili izaberi drugu opciju.`
      : `Ovo nije puna priprema za ${name}. ${facts} Pravila pune pripreme: najduže ≥ ${fmtKm(req.longRunKm)} km, bar dva trčanja ≥ ${fmtKm(req.exposureKm)} km i vrhunac ≥ ${fmtKm(req.weeklyKm)} km/ned.`;
  const conditions = [
    ...(basis.policy && basis.execution
      ? [
          `Povratni blok: ${basis.policy.easyWeeks} nedelje lakog trčanja od ${fmtDayMonthYear(addDays(basis.execution.date, 1))}, bez nadoknade propuštenog.`
        ]
      : []),
    `Nastavak ka punoj pripremi za ${name}: upisani treninzi treba da potvrde rast ponovljive baze i dužine; zatim ponovo pregledaj opcije u Prilagodi plan.`,
    `Za pun ciklus se preporučuje ${brojNedelja(req.minWeeks)}. Kraći plan za izabrani datum je dozvoljen uz napomenu o skraćenoj pripremi; pomeranje trke, kraća distanca i povratni režim su opcije, a ne uslov nastavka.`
  ];
  return { status, fullPreparation: false, statement, conditions, options, unavailable };
}

type StoredDay = StoredWeek['days'][number];
const runDay = (d: StoredDay): boolean =>
  !d.rest && d.km != null && (d.tag as string) !== 'snaga' && d.tag !== 'trka';
const isMlr = (d: StoredDay): boolean => 'mlr' in d && !!d.mlr;

/**
 * Return/base mode when no full cycle fits or the runner chooses it: easy running only, growth at
 * most 8% per week (the return guard) from the confirmed starting base, never above the
 * reported pre-break base and long run. Race day stays on the calendar without a time goal.
 */
export function buildReturnBase(
  current: GenPlanState,
  basis: DecisionBasis,
  today: IsoDate,
  context: ReplanContext
): { result: GenPlanState } | { error: string } {
  if (!current.meta) return { error: 'Plan nema metapodatke.' };
  const dist = distOf(basis.input);
  const h = profileFor(dist)?.heuristic;
  if (!h) return { error: 'Nepodržana distanca.' };
  const startKm = basis.input.weeklyKm;
  const capKm = Math.max(startKm, basis.execution?.reportedBaseKm ?? startKm);
  const lrStart = basis.input.recentLongRunKm ?? startKm * h.longRun.share;
  const lrCap = Math.max(lrStart, basis.execution?.reportedLongRunKm ?? lrStart);
  const view = resolvePlan(current.weeks, { alts: {}, moves: {} });
  const dateOf = new Map(view.dated.map((d) => [d.id, d.date]));
  const race = raceOf(basis.input)!;
  let k = 0;
  let previous = startKm;
  const weeks = current.weeks.map((w): StoredWeek => {
    const future = w.days.filter((d) => d.id && (dateOf.get(d.id) ?? '') > today);
    if (!future.length) return w;
    const raceWeek =
      w.days.some((d) => d.tag === 'trka') || addDays(parseIsoDate(w.start)!, 6) >= race;
    const allRun = w.days.filter(runDay);
    const runs = future.filter(runDay);
    const fullTarget = Math.min(capKm, startKm * 1.08 ** k);
    let target = fullTarget;
    if (runs.length < allRun.length) target *= runs.length / Math.max(allRun.length, 1);
    if (raceWeek) target = Math.min(target, previous * h.raceWeekFactor);
    else previous = fullTarget;
    const lrDay = raceWeek
      ? undefined
      : (runs.find((d) => d.tag === 'lr' && !isMlr(d)) ?? runs.find((d) => d.tag === 'lr'));
    // Share cap uses the full week, so a partial first week does not shrink the long run below an easy day.
    let lrKm = lrDay
      ? r1(Math.min(lrStart * 1.08 ** k, lrCap, fullTarget * h.longRunMaxShare, target))
      : 0;
    if (lrDay && runs.length > 1 && lrKm < (target - lrKm) / (runs.length - 1))
      lrKm = r1(target / runs.length);
    const others = runs.filter((d) => d !== lrDay);
    const each = others.length ? Math.max(0, (target - lrKm) / others.length) : 0;
    k++;
    const days = w.days.map((d) => {
      if (!future.includes(d)) return d;
      if (d.tag === 'trka')
        return {
          ...d,
          desc: `🏁 TRKA ${fmtKm(dist / 1000)} km — bez vremenskog cilja u povratnom režimu. Start odluči prema uslovima nastavka.`
        };
      if (!runDay(d)) return d;
      const easyKm = r1(Math.floor(each * 10) / 10);
      // Race week never exceeds the original race-week day.
      const km = d === lrDay ? lrKm : raceWeek ? Math.min(easyKm, d.km ?? easyKm) : easyKm;
      // Only identity and calendar slot survive; structure is rebuilt as an easy run.
      const easy: StoredDay =
        d === lrDay
          ? { id: d.id, dow: d.dow, tag: 'lr', km, desc: '' }
          : { id: d.id, dow: d.dow, tag: 'lako', km, desc: '' };
      return easy;
    });
    const { taper: _taper, ...rest } = w;
    return { ...rest, deload: false, days };
  });
  const meta = {
    ...current.meta,
    ...(basis.input.currentReadiness?.reason === 'fatigued' &&
    basis.input.currentReadiness.until > today
      ? {
          fatigueRecovery: fatigueWindowFor(
            current,
            today,
            basis.input.weeklyKm,
            basis.input.currentReadiness.until,
            context
          )
        }
      : {}),
    goalSec: null,
    goalVdot: null,
    realno: null,
    ...(basis.execution ? { executionAdjustment: basis.execution } : {}),
    cycleDecision: { kind: 'base', date: today, fullPreparation: false }
  };
  const fresh: GenPlanState = {
    ...current,
    weeks,
    meta,
    ulaz: { ...basis.input, goalSec: null }
  };
  const result = graftFuturePlan(
    current,
    fresh,
    today,
    context,
    basis.policy && basis.execution
      ? {
          returnWindow: {
            // Same window as a regenerated return: calendar weeks from the generated start.
            start: addDays(basis.execution.date, 1),
            end: addDays(
              mondayOnOrBefore(addDays(basis.execution.date, 1)),
              basis.policy.easyWeeks * 7
            ),
            requiredWeeks: basis.policy.easyWeeks
          }
        }
      : {}
  );
  return { result };
}

export interface ChoiceResult {
  result: GenPlanState;
  summary: string;
  notes: string[];
  change: { from: DecisionPoint; to: DecisionPoint };
}
export interface DecisionPoint {
  raceDate: string;
  raceDistM: number;
  goalSec: number | null;
}

/** Ime distance tačke odluke: maraton iz sopstvenog profila, kraća distanca iz plana koji je napravio njen generator. */
const pointName = (raceDistM: number, raceName?: string): string =>
  profileFor(raceDistM)?.product.name ?? raceName ?? `${raceDistM / 1000} km`;

export const describePoint = (p: DecisionPoint, raceName?: string): string =>
  `${fmtDayMonthYear(p.raceDate)} · ${pointName(p.raceDistM, raceName)} · ${p.goalSec ? `cilj ${fmtClock(p.goalSec)}` : 'bez vremenskog cilja'}`;

/** Build one previewable option. Date, distance and goal change only through this explicit choice. */
export function buildPreparationChoice(
  current: GenPlanState,
  today: IsoDate,
  basis: DecisionBasis,
  choice: PreparationChoice,
  context: ReplanContext,
  handoff: ShorterDistanceHandoff
): ChoiceResult | { error: string } {
  const race = raceOf(basis.input);
  if (!race) return { error: 'Plan nema ispravan datum trke.' };
  const from: DecisionPoint = {
    raceDate: basis.input.raceDate,
    raceDistM: distOf(basis.input),
    goalSec: basis.input.goalSec ?? null
  };
  let built: Built;
  let summary: string;
  if (choice.kind === 'extend') {
    if (!parseIsoDate(choice.raceDate) || choice.raceDate <= race)
      return { error: 'Novi datum trke mora biti posle postojećeg.' };
    built = regenerate(
      current,
      basis,
      { ...basis.input, raceDate: choice.raceDate },
      today,
      context,
      { cycleDecision: { kind: 'extend', date: today, from: from.raceDate } },
      handoff
    );
    summary = `Trka pomerena: ${fmtDayMonthYear(race)} → ${fmtDayMonthYear(choice.raceDate)}`;
  } else if (choice.kind === 'shorter') {
    if (!(SHORTER[from.raceDistM] ?? []).includes(choice.raceDistM))
      return { error: 'Izabrana distanca nije kraća opcija za ovaj plan.' };
    built = regenerate(
      current,
      basis,
      { ...basis.input, raceDistM: choice.raceDistM, goalSec: null },
      today,
      context,
      { cycleDecision: { kind: 'shorter', date: today, from: from.raceDistM } },
      handoff
    );
    summary = `Kraća distanca: ${profileFor(from.raceDistM)?.product.name} → ${'error' in built ? undefined : built.result.meta?.raceName}, ${fmtDayMonthYear(race)}`;
  } else {
    built = buildReturnBase(current, basis, today, context);
    summary = `Povratni/bazni režim do ${fmtDayMonthYear(race)}, bez vremenskog cilja`;
  }
  if ('error' in built) return { error: built.error };
  const meta = built.result.meta!;
  const to: DecisionPoint = {
    raceDate: meta.raceDate,
    raceDistM: meta.raceDistM,
    goalSec: meta.goalSec ?? null
  };
  const coverage = preparationCoverage(meta.preparation, meta.raceDistM);
  const name = distUReceni(pointName(meta.raceDistM, meta.raceName));
  const notes = [
    `Odluka: ${describePoint(from)} → ${describePoint(to, meta.raceName)}.`,
    choice.kind === 'base'
      ? `Povratni/bazni režim: samo lako trčanje, rast najviše 8% nedeljno do prijavljene baze; najduže ${fmtKm(meta.preparation?.peakLongRunKm ?? 0)} km, vrhunac ${fmtKm(meta.preparation?.peakWeeklyKm ?? 0)} km/ned. Bez kvalitetnog rada ovo nije priprema za vremenski cilj; start na trci odluči prema uslovima nastavka.`
      : coverage === 'full'
        ? `Isporučen plan ispunjava pravila pune pripreme za ${name}: najduže ${fmtKm(meta.preparation!.peakLongRunKm)} km, vrhunac ${fmtKm(meta.preparation!.peakWeeklyKm)} km/ned. To nije garancija spremnosti ni vremena.`
        : `Ovo nije puna priprema za ${name}: najduže ${fmtKm(meta.preparation?.peakLongRunKm ?? 0)} km, vrhunac ${fmtKm(meta.preparation?.peakWeeklyKm ?? 0)} km/ned.`,
    'Odrađeni dani, stvarni km/min, pomeranja, merenja i ručne izmene ostaju; menjaju se samo nezaštićeni budući treninzi.',
    ...finalWarnings(built.result),
    ...((meta['futureChanges'] as { conflicts?: string[] } | undefined)?.conflicts ?? [])
  ];
  return { result: built.result, summary, notes: [...new Set(notes)], change: { from, to } };
}
