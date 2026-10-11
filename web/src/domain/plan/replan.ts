/* PONOVNO GENERISANJE PLANA USRED PRIPREME: promena cilja, rekalibracija, povratak posle pauze.

   Sa ekranom su povezani `planWithNewGoal` (Podešavanja → Plan → Cilj) i `planRecalibrated` (Podešavanja → Plan → „Preračunaj plan
   prema formi"; ENGINE_CHANGES R1). `recalibratedPlan` je izvorna (stara) funkcija nad generatorskim nedeljama, `planRecalibrated` je ista
   pravila nad perzistiranim planom. `reentryPlan` postoji u starom kodu, testiran, ali ga nijedan ekran ne zove — prenosi se zato što je
   to ugovor (zahtev: ne brisati funkcionalnost jer je „teško migrirati"); poveže se tek uz proveru ekrana. Sve su čiste: ulaz se ne menja.

   Istorija je nepromenljiva: nedelje ISPOD tekuće (i njihovi PRED redovi/ID-jevi, pa i sve što na te ID-jeve
   pokazuje — `pred`, `predLock`, `vdotLog`) ostaju kakve jesu. Ručno zaključana polja sesija se prenose
   na sveže nedelje (`mergeOverrides`) — regeneracija ne sme da pregazi korisnikovu ručnu izmenu. */

import { addDays, parseIsoDate, type IsoDate } from '../date';
import { r1 } from '../format';
import type { GenPlanState, StoredWeek } from '../state';
import { generatePlan } from '../training/generator/generatePlan';
import { derivePred, deriveQS, planVdotForWeek } from '../training/prediction';
import { sessDesc, sessKm } from '../training/sessions/calc';
import { KIND_FROM_GOAL, ZONE_FOR_KIND } from '../training/vdot/zoneForKind';
import {
  isPlanError,
  type PlanGenerationInput,
  type PlanMeta,
  type PredictionRow,
  type Session,
  type TrainingPlan,
  type Week
} from '../training/types';
import { raceTimeForVdot } from '../training/vdot/racePrediction';
import { adaptGeneratedPlan } from './adapt';
import { graftFuturePlan, type ReplanContext } from './future';
import { guardReturnGrowth } from './returnGrowth';
import { analyzeExecution } from '../training/execution';
import { resolvePlan } from './resolve';
import { assessPreparation } from '../training/generator/athleteAssessment';
import { profileFor } from '../training/distances';
export type { ReplanContext } from './future';

function guardedGeneration(plan: TrainingPlan, baseKm: number, startDate: string): TrainingPlan {
  const weeks = guardReturnGrowth(plan.weeks, baseKm, startDate !== plan.meta.start);
  const pred = derivePred(weeks, plan.meta.raceDistM, plan.meta);
  const qs = deriveQS(weeks);
  const profile = profileFor(plan.meta.raceDistM);
  const meta = { ...plan.meta };
  if (profile)
    meta.preparation = assessPreparation({ weeks, pred, qs, meta }, profile.product.minPeakKm);
  return { ...plan, weeks, pred, qs, meta };
}

interface MergeDay {
  dow: number;
  session?: Session;
  km?: number | null;
  desc?: string | null;
}

const prescriptionZone = (session: Session): Session['zone'] =>
  session.zone ??
  (session.kind === 'Oštrina'
    ? 'R'
    : KIND_FROM_GOAL.has(session.kind)
      ? 'RP'
      : ZONE_FOR_KIND[session.kind]);

/**
 * Prenosi ZAKLJUČANA (ručno izmenjena) polja sesija sa starih nedelja na sveže regenerisane, po slotu
 * (nedelja, dan). Ako je rotacija promenila TIP sesije na tom slotu, polja nisu prenosiva. Vraća NOVI niz;
 * ulaz se ne menja. Obe strane moraju koristiti istu konvenciju za `dow`.
 */
export function mergeOverrides<W extends { w: number; days: MergeDay[] }>(
  fresh: readonly W[],
  old: ReadonlyArray<{ w: number; days: readonly MergeDay[] }> | null | undefined
): W[] {
  const oldByKey = new Map<string, Session>();
  for (const w of old ?? [])
    for (const d of w.days) if (d.session) oldByKey.set(`${w.w}-${d.dow}`, d.session);
  return fresh.map((w) => {
    const days = w.days.map((d) => {
      if (!d.session) return d;
      const prev = oldByKey.get(`${w.w}-${d.dow}`);
      if (
        !prev ||
        prev.type !== d.session.type ||
        prev.kind !== d.session.kind ||
        prescriptionZone(prev) !== prescriptionZone(d.session)
      )
        return d;
      const merged: Record<string, unknown> = { ...d.session };
      const overrides: Record<string, boolean> = { ...d.session.overrides };
      let touched = false;
      for (const f of Object.keys(prev.overrides || {})) {
        if (!prev.overrides[f]) continue;
        merged[f] = (prev as unknown as Record<string, unknown>)[f];
        overrides[f] = true;
        touched = true;
      }
      if (!touched) return d;
      const session = { ...merged, overrides } as unknown as Session;
      return { ...d, session, km: sessKm(session), desc: sessDesc(session) };
    });
    return {
      ...w,
      days,
      ...('vol' in w ? { vol: r1(days.reduce((n, d) => n + (d.km ?? 0), 0)) } : {})
    };
  });
}

export type ReplanError = { error: string };

export interface GoalChangeResult extends GenPlanState {
  error?: never;
  weeks: StoredWeek[];
  pred: Array<PredictionRow & { id: string }>;
  qs: Record<string, number[]>;
  meta: PlanMeta & Record<string, unknown>;
  ulaz: PlanGenerationInput;
  goalChange: { week: number; from: number | null; to: number; changedWeeks: number };
}

const isPlainObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** Podaci o rekalibraciji koji moraju preživeti ponovno generisanje (promenu cilja): stvarna polazna forma lanca i trag rekalibracije. */
const RECAL_META_KEYS = ['vdotBase', 'vdotAtRecal', 'recalWeek', 'predictedSecAtStart'] as const;
function carriedRecalibration(meta: unknown): Record<string, unknown> {
  const m = isPlainObject(meta) ? meta : {};
  const out: Record<string, unknown> = {};
  for (const k of RECAL_META_KEYS) if (m[k] !== undefined) out[k] = m[k];
  return out;
}

/** Nedelja stored plana kojoj datum pripada (`null` van plana). */
function storedWeekOf(weeks: readonly StoredWeek[], today: string): StoredWeek | null {
  for (const w of weeks) {
    const start = parseIsoDate(w.start);
    if (start && today >= start && today <= addDays(start, 6)) return w;
  }
  return null;
}

/**
 * Promena ciljnog vremena: regeneriše SAMO nedelje od tekuće nadalje, ne dira ni jedan odrađen dan.
 *
 * `weekOf` vraća `null` iz DVA razloga: PRE početka plana pad na prvu nedelju je tačan; POSLE trke isti pad
 * bi značio „cela istorija je budućnost" — stari kod je na završenom planu prepisivao 13 od 140 odrađenih
 * dana i 11 od 31 PRED reda. Zato se završen plan odbija.
 */
export function planWithNewGoal(
  plan: GenPlanState | null,
  newGoalSec: number,
  today: IsoDate,
  context: ReplanContext = {}
): GoalChangeResult | ReplanError {
  if (!plan) return { error: 'Promena cilja radi samo nad generisanim planom.' };
  const input = plan.ulaz;
  if (!isPlainObject(input))
    return {
      error:
        'Ovaj plan je napravljen pre nego što je aplikacija počela da pamti ulazne podatke, pa se ne može regenerisati bez njih. Cilj se može promeniti tek na planu napravljenom od ove verzije nadalje.'
    };
  if (!Number.isFinite(newGoalSec) || !(newGoalSec > 0))
    return { error: 'Ciljno vreme nije ispravno.' };

  const cur = storedWeekOf(plan.weeks, today);
  const last = plan.weeks[plan.weeks.length - 1];
  const lastStart = last ? parseIsoDate(last.start) : null;
  if (!cur && lastStart && today > addDays(lastStart, 6))
    return {
      error: 'Plan je završen — cilj se više ne može promeniti. Za novu trku napravi nov plan.'
    };
  const idx = cur ? cur.w : 1;

  const goalInput = { ...(input as unknown as PlanGenerationInput), goalSec: newGoalSec };
  const raw = generatePlan(goalInput);
  if (isPlanError(raw)) return raw;
  const originalAnchor = parseIsoDate(plan.meta?.start);
  const rebasedStart = parseIsoDate(goalInput.startDate);
  const rebased = originalAnchor && rebasedStart && rebasedStart > addDays(originalAnchor, 6);
  const generated = rebased ? guardedGeneration(raw, goalInput.weeklyKm, goalInput.startDate) : raw;
  const fresh = adaptGeneratedPlan(generated);
  if (!fresh) return { error: 'Neočekivana greška pri regenerisanju plana.' };

  const grafted = graftFuturePlan(
    plan,
    {
      ...fresh,
      meta: { ...fresh.meta!, ...carriedRecalibration(plan.meta) },
      ulaz: { ...(input as unknown as PlanGenerationInput), goalSec: newGoalSec }
    },
    today,
    context
  );
  const changedWeeks = grafted.weeks.filter(
    (w, i) => JSON.stringify(w) !== JSON.stringify(plan.weeks[i])
  ).length;
  const oldMeta = plan.meta;
  return {
    ...grafted,
    weeks: grafted.weeks,
    pred: grafted.pred as Array<PredictionRow & { id: string }>,
    qs: grafted.qs ?? {},
    meta: grafted.meta!,
    ulaz: grafted.ulaz as PlanGenerationInput,
    goalChange: {
      week: idx,
      from: oldMeta?.goalSec || null,
      to: newGoalSec,
      changedWeeks
    }
  };
}

/** Najmanje ovoliko nedelja (računajući tekuću) mora ostati do trke — kao kod povratka posle pauze. */
export const RECALIBRATION_MIN_WEEKS_LEFT = 4;
/** Forma van ovog opsega nije verodostojna (kao `vdotPossible`): rekalibracija bi pravila besmislen plan. */
const FORM_VDOT_RANGE = { min: 20, max: 85 } as const;

export interface RecalibratedStoredPlan extends GenPlanState {
  error?: never;
  weeks: StoredWeek[];
  pred: Array<PredictionRow & { id: string }>;
  qs: Record<string, number[]>;
  meta: PlanMeta & Record<string, unknown>;
  ulaz: PlanGenerationInput;
  recalibration: {
    /** Prva nedelja koja se preračunava. */
    week: number;
    changedWeeks: number;
    /** Forma (VDOT) po kojoj je plan preračunat. */
    form: number;
    /** Planska forma za tu nedelju PRE preračunavanja (`null` kad plan nema putanju). */
    planBefore: number | null;
    predictedBefore: number;
    predictedAfter: number;
  };
}

/**
 * Preostale nedelje koriste izmerenu formu bez automatskog rasta VDOT-a (D6).
 * Istorija i zaključana polja ostaju; cilj se čuva, ali tempo trkačkih treninga
 * ne može biti brži od trenutne forme. Ista forma i nedelja daju isti plan.
 * `vdotBase` čuva stvarnu početnu formu za istorijski lanac merenja.
 */
export function planRecalibrated(
  plan: GenPlanState | null,
  formVdot: number,
  today: IsoDate,
  context: ReplanContext = {}
): RecalibratedStoredPlan | ReplanError {
  if (!plan) return { error: 'Preračunavanje radi samo nad generisanim planom.' };
  const input = plan.ulaz;
  if (!isPlainObject(input))
    return {
      error:
        'Ovaj plan je napravljen pre nego što je aplikacija počela da pamti ulazne podatke, pa se ne može preračunati. Radi tek na planu napravljenom od ove verzije nadalje.'
    };
  if (
    !Number.isFinite(formVdot) ||
    formVdot < FORM_VDOT_RANGE.min ||
    formVdot > FORM_VDOT_RANGE.max
  )
    return { error: 'Izmerena forma nije verodostojna — plan se ne preračunava.' };

  const original = input as unknown as PlanGenerationInput;
  const total = plan.weeks.length;
  const cur = storedWeekOf(plan.weeks, today);
  const last = plan.weeks[plan.weeks.length - 1];
  const lastStart = last ? parseIsoDate(last.start) : null;
  if (!cur && lastStart && today > addDays(lastStart, 6))
    return { error: 'Plan je završen — nema šta da se preračuna.' };
  const idx = cur ? cur.w : 1;
  if (total - idx + 1 < RECALIBRATION_MIN_WEEKS_LEFT)
    return {
      error: `Do trke je manje od ${RECALIBRATION_MIN_WEEKS_LEFT} nedelje — plan se više ne preračunava, taper ostaje kakav jeste.`
    };

  const oldMeta: Record<string, unknown> = isPlainObject(plan.meta) ? plan.meta : {};
  const predictedBefore = typeof oldMeta['predictedSec'] === 'number' ? oldMeta['predictedSec'] : 0;
  const anchor =
    typeof oldMeta['predictedSecAtStart'] === 'number'
      ? oldMeta['predictedSecAtStart']
      : predictedBefore || null;

  const execution = analyzeExecution({
    plan: resolvePlan(plan.weeks, { alts: context.alts ?? {}, moves: context.moves ?? {} }),
    log: context.log ?? {},
    today
  });
  const coveredWeeks = execution.completeWeeks.filter(
    (w) => w.volumeCoverage >= 0.75 && w.statusCoverage >= 0.75 && w.actualKm > 0
  );
  const observedBase =
    coveredWeeks.length >= 2 && execution.recentWeeklyKm != null && execution.recentWeeklyKm > 0;
  const regenInput = {
    ...recalibrationInput(original, formVdot),
    ...(observedBase
      ? {
          startDate: addDays(today, 1),
          weeklyKm: execution.recentWeeklyKm!,
          recentLongRunKm: execution.recentLongRunKm ?? undefined,
          consistentWeeks: Math.min(coveredWeeks.length, 4)
        }
      : {})
  };
  const raw = generatePlan(regenInput);
  if (isPlanError(raw)) return raw;
  const remainingStart = parseIsoDate(regenInput.startDate);
  const originalStart = parseIsoDate(plan.meta?.start);
  const retainedBaseGuard =
    originalStart && remainingStart && remainingStart > addDays(originalStart, 6);
  const generated =
    observedBase || retainedBaseGuard
      ? guardedGeneration(raw, regenInput.weeklyKm, regenInput.startDate)
      : raw;
  const fresh = adaptGeneratedPlan(generated);
  if (!fresh) return { error: 'Neočekivana greška pri preračunavanju plana.' };

  const freshMeta = fresh.meta as PlanMeta;
  const meta: PlanMeta & Record<string, unknown> = {
    ...freshMeta,
    start: oldMeta['start'] as IsoDate,
    vdotBase: typeof oldMeta['vdotBase'] === 'number' ? oldMeta['vdotBase'] : oldMeta['vdot0'],
    vdotAtRecal: r1(formVdot),
    recalWeek: idx,
    ...(anchor != null ? { predictedSecAtStart: anchor } : {})
  };
  /* Rekalibracija ne dodaje cilj korisniku koji ga nije zadao. */
  if (!original.goalSec) {
    meta.goalSec = (oldMeta['goalSec'] as number | null | undefined) ?? null;
    meta.goalVdot = (oldMeta['goalVdot'] as number | null | undefined) ?? null;
    meta.realno = (oldMeta['realno'] as boolean | null | undefined) ?? null;
  }
  meta.dayWarnings = [
    ...freshMeta.dayWarnings,
    ...(!observedBase
      ? [
          'Nedovoljno potpunih skorašnjih nedelja za procenu stvarnog obima; koristi se prijavljena polazna baza. Pre povećanja proveri da li ona i dalje važi.'
        ]
      : [])
  ];

  const grafted = graftFuturePlan(
    plan,
    {
      ...fresh,
      meta,
      ulaz: {
        ...original,
        pb: regenInput.pb,
        ...(observedBase
          ? {
              startDate: regenInput.startDate,
              weeklyKm: regenInput.weeklyKm,
              recentLongRunKm: regenInput.recentLongRunKm,
              consistentWeeks: regenInput.consistentWeeks
            }
          : {})
      }
    },
    today,
    context
  );
  const changedWeeks = grafted.weeks.filter(
    (w, i) => JSON.stringify(w) !== JSON.stringify(plan.weeks[i])
  ).length;
  const planBefore = planVdotForWeek(isPlainObject(plan.meta) ? plan.meta : null, idx);
  return {
    ...grafted,
    weeks: grafted.weeks,
    pred: grafted.pred as Array<PredictionRow & { id: string }>,
    qs: grafted.qs ?? {},
    meta: grafted.meta!,
    ulaz: grafted.ulaz as PlanGenerationInput,
    recalibration: {
      week: idx,
      changedWeeks,
      form: r1(formVdot),
      planBefore: planBefore == null ? null : r1(planBefore),
      predictedBefore,
      predictedAfter: freshMeta.predictedSec
    }
  };
}

export interface RecalibrationResult {
  weeks: Week[];
  pred: PredictionRow[];
  qs: Record<string, number[]>;
  meta: PlanMeta & { vdotAtRecal: number; recalWeek: number };
}

/** Sintetički PB prenosi izmerenu formu generatoru; cilj ostaje korisnikova odluka. */
function recalibrationInput(
  originalInput: PlanGenerationInput,
  vdotNow: number
): PlanGenerationInput {
  return { ...originalInput, pb: { distM: 5000, sec: raceTimeForVdot(vdotNow, 5000) } };
}

/** Regeneriše preostale nedelje prema trenutnoj formi, uz prenos ručnih zaključavanja. */
export function recalibratedPlan(
  originalInput: PlanGenerationInput,
  currentWeekIdx: number,
  vdotNow: number,
  opts: {
    oldWeeks?: ReadonlyArray<{ w: number; days: readonly MergeDay[] }>;
    originalPredictedSec?: number | null;
  } = {}
): RecalibrationResult | ReplanError {
  const regenInput = recalibrationInput(originalInput, vdotNow);
  const replanned = generatePlan(regenInput);
  if (isPlanError(replanned)) return replanned;
  const slice = replanned.weeks.slice(currentWeekIdx - 1);
  const meta = { ...replanned.meta, vdotAtRecal: r1(vdotNow), recalWeek: currentWeekIdx };
  if (opts.oldWeeks) {
    /* `oldWeeks` su PERZISTIRANE nedelje (dow 0–6), sveže iz generatora imaju dow 1–7. Stari kod ih je
       spajao ključem bez ovog pomeranja, pa je zaključano polje završavalo na sesiji PRETHODNOG dana (A4). */
    const old = opts.oldWeeks.map((w) => ({
      w: w.w,
      days: w.days.map((d) => ({ ...d, dow: d.dow + 1 }))
    }));
    const weeks = mergeOverrides(slice, old);
    return {
      weeks,
      pred: derivePred(weeks, replanned.meta.raceDistM, replanned.meta),
      qs: deriveQS(weeks),
      meta
    };
  }
  return {
    weeks: slice,
    pred: replanned.pred.filter((p) => p.w >= currentWeekIdx),
    qs: Object.fromEntries(
      Object.entries(replanned.qs).filter(([k]) => +(/\d+/.exec(k)?.[0] ?? 0) >= currentWeekIdx)
    ),
    meta
  };
}

export interface ReentryResult {
  weeks: Array<Week & { reentry?: true }>;
  pred: PredictionRow[];
  meta: PlanMeta;
}

/**
 * Plan po povratku posle povrede/pauze kreće od STVARNO poslednje ostvarene nedeljne zapremine, ne od
 * planirane za tu nedelju; `GROW_MAX` iz generatora (+8 %/ned.) vraća volumen na krivu. Tempo se ne
 * pogađa unapred — koriguje ga lanac forme posle prve stvarne sesije. Manje od 4 nedelje do trke: ne.
 */
export function reentryPlan(
  originalInput: PlanGenerationInput,
  resumeWeekIdx: number,
  lastRealizedVolKm: number,
  vdotAtPause: number
): ReentryResult | ReplanError {
  if (
    !Number.isInteger(resumeWeekIdx) ||
    resumeWeekIdx < 1 ||
    !Number.isFinite(lastRealizedVolKm) ||
    lastRealizedVolKm <= 0 ||
    !Number.isFinite(vdotAtPause) ||
    vdotAtPause < 20 ||
    vdotAtPause > 85
  )
    return { error: 'Nedelja, stvarni obim ili referentna forma povratka nisu ispravni.' };
  const original = generatePlan(originalInput);
  if (isPlanError(original)) return original;
  const total = original.weeks.length;
  const weeksLeft = total - resumeWeekIdx + 1;
  if (!Number.isFinite(total) || weeksLeft < 4)
    return {
      error:
        'Manje od 4 nedelje do trke posle pauze — pun re-entry nije moguć. Cilj treba ručno preispitati.'
    };
  const resume = addDays(original.meta.start, (resumeWeekIdx - 1) * 7);
  const replanned = generatePlan({
    ...recalibrationInput(originalInput, vdotAtPause),
    startDate: resume,
    weeklyKm: lastRealizedVolKm,
    recentLongRunKm: Math.min(
      originalInput.recentLongRunKm ?? lastRealizedVolKm * 0.3,
      lastRealizedVolKm * 0.35
    ),
    consistentWeeks: 0,
    breakWeeks: Math.max(1, originalInput.breakWeeks ?? 1),
    trainedRecently: false
  });
  if (isPlanError(replanned)) return replanned;
  const weeks = guardReturnGrowth(replanned.weeks, lastRealizedVolKm).map((w, i) => ({
    ...w,
    w: resumeWeekIdx + i,
    ...(i === 0 ? { reentry: true as const } : {})
  }));
  const meta = { ...replanned.meta, start: original.meta.start, weeks: total };
  const pred = derivePred(weeks, meta.raceDistM, meta);
  const profile = profileFor(meta.raceDistM);
  if (profile)
    meta.preparation = assessPreparation(
      { weeks, pred, qs: deriveQS(weeks), meta },
      profile.product.minPeakKm
    );
  return { weeks, pred, meta };
}
