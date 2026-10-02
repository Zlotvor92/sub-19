/* PONOVNO GENERISANJE PLANA USRED PRIPREME: promena cilja, rekalibracija, povratak posle pauze.

   Sa ekranom su povezani `planWithNewGoal` (Podešavanja → Plan → Cilj) i `planRecalibrated` (Podešavanja → Plan → „Preračunaj plan
   prema formi"; ENGINE_CHANGES R1). `recalibratedPlan` je izvorna (stara) funkcija nad generatorskim nedeljama, `planRecalibrated` je ista
   pravila nad perzistiranim planom. `reentryPlan` postoji u starom kodu, testiran, ali ga nijedan ekran ne zove — prenosi se zato što je
   to ugovor (zahtev: ne brisati funkcionalnost jer je „teško migrirati"); poveže se tek uz proveru ekrana. Sve su čiste: ulaz se ne menja.

   Istorija je nepromenljiva: nedelje ISPOD tekuće (i njihovi PRED redovi/ID-jevi, pa i sve što na te ID-jeve
   pokazuje — `pred`, `predLock`, `vdotLog`) ostaju kakve jesu. Ručno zaključana polja sesija se prenose
   na sveže nedelje (`mergeOverrides`) — regeneracija ne sme da pregazi korisnikovu ručnu izmenu. */

import { addDays, diffDays, mondayOnOrAfter, parseIsoDate, type IsoDate } from '../date';
import { r1 } from '../format';
import type { GenPlanState, StoredWeek } from '../state';
import { GROW_MAX, RAMP_CAP_WEEKS, VDOT_RAMP_PER_WEEK } from '../training/constants/heuristics';
import { generatePlan } from '../training/generator/generatePlan';
import { derivePred, deriveQS, deriveQSById, planVdotForWeek } from '../training/prediction';
import { sessDesc, sessKm } from '../training/sessions/calc';
import {
  isPlanError,
  type PlanGenerationInput,
  type PlanMeta,
  type PredictionRow,
  type Session,
  type Week
} from '../training/types';
import { raceTimeForVdot } from '../training/vdot/racePrediction';
import { adaptGeneratedPlan } from './adapt';

interface MergeDay {
  dow: number;
  session?: Session;
  km?: number | null;
  desc?: string | null;
}

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
  return fresh.map((w) => ({
    ...w,
    days: w.days.map((d) => {
      if (!d.session) return d;
      const prev = oldByKey.get(`${w.w}-${d.dow}`);
      if (!prev || prev.type !== d.session.type) return d;
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
    })
  }));
}

export type ReplanError = { error: string };

export interface GoalChangeResult {
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
  today: IsoDate
): GoalChangeResult | ReplanError {
  if (!plan) return { error: 'Promena cilja radi samo nad generisanim planom.' };
  const input = plan.ulaz;
  if (!isPlainObject(input))
    return {
      error:
        'Ovaj plan je napravljen pre nego što je aplikacija počela da pamti ulazne podatke, pa se ne može regenerisati bez njih. Cilj se može promeniti tek na planu napravljenom od ove verzije nadalje.'
    };
  if (!(newGoalSec > 0)) return { error: 'Ciljno vreme nije ispravno.' };

  const cur = storedWeekOf(plan.weeks, today);
  const last = plan.weeks[plan.weeks.length - 1];
  const lastStart = last ? parseIsoDate(last.start) : null;
  if (!cur && lastStart && today > addDays(lastStart, 6))
    return {
      error: 'Plan je završen — cilj se više ne može promeniti. Za novu trku napravi nov plan.'
    };
  const idx = cur ? cur.w : 1;

  const generated = generatePlan({
    ...(input as unknown as PlanGenerationInput),
    goalSec: newGoalSec
  });
  if (isPlanError(generated)) return generated;
  const fresh = adaptGeneratedPlan(generated);
  if (!fresh) return { error: 'Neočekivana greška pri regenerisanju plana.' };

  const oldWeeks = plan.weeks.filter((x) => x.w < idx);
  const newWeeks = mergeOverrides(
    fresh.weeks.filter((x) => x.w >= idx),
    plan.weeks
  );
  if (!newWeeks.length)
    return { error: 'Nema nijedne nedelje koja tek dolazi — cilj se više ne može promeniti.' };

  const freshMeta = fresh.meta as PlanMeta;
  /* Redosled je bitan: prvo stari redovi, pa novi — redovi iz prošlosti zadržavaju indeks i ID, a uz
     njih i sve što na taj ID pokazuje. */
  const pred = plan.pred
    .filter((r) => r.w < idx)
    .concat(derivePred(newWeeks, freshMeta.raceDistM, freshMeta))
    .map((r, i) => ({ ...r, id: `g${r.w}_${i}` }));
  const qs: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(plan.qs ?? {})) {
    const m = /^g(\d+)d/.exec(k);
    if (m && +(m[1] as string) < idx) qs[k] = v;
  }
  Object.assign(qs, deriveQSById(newWeeks));

  const oldMeta = plan.meta as { goalSec?: number | null; start?: unknown } | undefined;
  return {
    weeks: [...oldWeeks, ...newWeeks],
    pred,
    qs,
    meta: { ...freshMeta, ...carriedRecalibration(plan.meta), start: oldMeta?.start as IsoDate },
    ulaz: { ...(input as unknown as PlanGenerationInput), goalSec: newGoalSec },
    goalChange: {
      week: idx,
      from: oldMeta?.goalSec || null,
      to: newGoalSec,
      changedWeeks: newWeeks.length
    }
  };
}

/** Najmanje ovoliko nedelja (računajući tekuću) mora ostati do trke — kao kod povratka posle pauze. */
export const RECALIBRATION_MIN_WEEKS_LEFT = 4;
/** Forma van ovog opsega nije verodostojna (kao `vdotPossible`): rekalibracija bi pravila besmislen plan. */
const FORM_VDOT_RANGE = { min: 20, max: 85 } as const;

export interface RecalibratedStoredPlan {
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
 * REKALIBRACIJA PLANA: preostale nedelje (od tekuće) se regenerišu po putanji koja kroz tekuću nedelju prolazi TAČNO kroz izmerenu formu
 * (`formVdot`). Iste garancije kao promena cilja: nedelje ISPOD tekuće i svi njihovi ID-jevi/PRED redovi ostaju netaknuti, ručno
 * zaključana polja sesija se prenose (`mergeOverrides`), odrađeni dani se ne diraju.
 *
 * Šta se NE menja: tempo trke (`racePace`; oslonac je cilj, ili — kad cilja nema — projekcija iz prve rekalibracije), kalendar, struktura
 * nedelje. Šta se menja: tempi sesija i (preko vremenskih plafona, D1) kilometraža za najviše nekoliko km, projektovano vreme na dan trke.
 *
 * `meta.vdot0` postaje VIRTUELNA polazna tačka putanje; stvarna polazna forma ide u `meta.vdotBase` (v. `planBaselineVdot`) da lanac
 * forme ne bi menjao prošlost. Idempotentno: ista forma, ista nedelja → isti plan.
 */
export function planRecalibrated(
  plan: GenPlanState | null,
  formVdot: number,
  today: IsoDate
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

  const regenInput = recalibrationInput(original, idx, formVdot, anchor);
  const generated = generatePlan(regenInput);
  if (isPlanError(generated)) return generated;
  const fresh = adaptGeneratedPlan(generated);
  if (!fresh) return { error: 'Neočekivana greška pri preračunavanju plana.' };

  const oldWeeks = plan.weeks.filter((x) => x.w < idx);
  const newWeeks = mergeOverrides(
    fresh.weeks.filter((x) => x.w >= idx),
    plan.weeks
  );
  if (!newWeeks.length) return { error: 'Nema nijedne nedelje koja tek dolazi.' };

  const freshMeta = fresh.meta as PlanMeta;
  const pred = plan.pred
    .filter((r) => r.w < idx)
    .concat(derivePred(newWeeks, freshMeta.raceDistM, freshMeta))
    .map((r, i) => ({ ...r, id: `g${r.w}_${i}` }));
  const qs: Record<string, number[]> = {};
  for (const [k, v] of Object.entries(plan.qs ?? {})) {
    const m = /^g(\d+)d/.exec(k);
    if (m && +(m[1] as string) < idx) qs[k] = v;
  }
  Object.assign(qs, deriveQSById(newWeeks));

  const meta: PlanMeta & Record<string, unknown> = {
    ...freshMeta,
    start: oldMeta['start'] as IsoDate,
    vdotBase: typeof oldMeta['vdotBase'] === 'number' ? oldMeta['vdotBase'] : oldMeta['vdot0'],
    vdotAtRecal: r1(formVdot),
    recalWeek: idx,
    ...(anchor != null ? { predictedSecAtStart: anchor } : {})
  };
  /* Bez zadatog cilja je generator dobio STABILAN cilj samo kao oslonac tempa trke — to ne sme postati cilj plana. */
  if (!original.goalSec) {
    meta.goalSec = (oldMeta['goalSec'] as number | null | undefined) ?? null;
    meta.goalVdot = (oldMeta['goalVdot'] as number | null | undefined) ?? null;
    meta.realno = (oldMeta['realno'] as boolean | null | undefined) ?? null;
  }
  meta.dayWarnings = (oldMeta['dayWarnings'] as string[] | undefined) ?? freshMeta.dayWarnings;

  const planBefore = planVdotForWeek(isPlainObject(plan.meta) ? plan.meta : null, idx);
  return {
    weeks: [...oldWeeks, ...newWeeks],
    pred,
    qs,
    meta,
    /* Ulaz dobija virtuelni PB (putanja ostaje ista pri kasnijoj promeni cilja); cilj korisnika se ne dira. */
    ulaz: { ...original, pb: regenInput.pb },
    recalibration: {
      week: idx,
      changedWeeks: newWeeks.length,
      form: r1(formVdot),
      planBefore: planBefore == null ? null : r1(planBefore),
      predictedBefore,
      predictedAfter: freshMeta.predictedSec
    }
  };
}

const weeksTotal = (input: PlanGenerationInput): number => {
  const start = parseIsoDate(input.startDate);
  const race = parseIsoDate(input.raceDate);
  if (!start || !race) return Number.NaN;
  return Math.round(diffDays(mondayOnOrAfter(start), race) / 7) + 1;
};

export interface RecalibrationResult {
  weeks: Week[];
  pred: PredictionRow[];
  qs: Record<string, number[]>;
  meta: PlanMeta & { vdotAtRecal: number; recalWeek: number };
}

/**
 * Ulaz generatora koji reprodukuje POPRAVLJENU putanju forme: „virtuelni PB" (5K) koji bi originalnom formulom, primenjenom od
 * nedelje 1, dao tačno `vdotNow` na tekućoj nedelji, i STABILAN cilj (v. `recalibratedPlan`). Zajednički za `recalibratedPlan`
 * i `planRecalibrated`, da pravilo postoji na JEDNOM mestu.
 */
function recalibrationInput(
  originalInput: PlanGenerationInput,
  currentWeekIdx: number,
  vdotNow: number,
  originalPredictedSec: number | null | undefined
): PlanGenerationInput {
  const total = weeksTotal(originalInput);
  const rampWeeks = Math.min(total - 2, RAMP_CAP_WEEKS);
  const backdated =
    vdotNow - VDOT_RAMP_PER_WEEK[originalInput.intensity] * Math.min(currentWeekIdx, rampWeeks);
  const virtualPbSec = raceTimeForVdot(Math.max(backdated, 20), 5000);
  const raceDistM = originalInput.raceDistM || 5000;
  const stableGoalSec =
    originalInput.goalSec || originalPredictedSec || raceTimeForVdot(vdotNow, raceDistM);
  return { ...originalInput, pb: { distM: 5000, sec: virtualPbSec }, goalSec: stableGoalSec };
}

/**
 * Regeneriše SAMO preostale nedelje (≥ `currentWeekIdx`) po ispravljenoj putanji: računa „virtuelni PB" koji
 * bi originalnom formulom, primenjenom od nedelje 1, dao tačno `vdotNow` na tekućoj nedelji. Forma tačno
 * NA planskoj putanji mora biti no-op (`min(w, rampWeeks)` koraka rampe, ne `w−1`).
 *
 * `racePace` mora ostati STABILAN: oslonac je projektovana forma na KRAJU originalnog plana
 * (`originalPredictedSec`), ne današnja forma — inače se tempo trke menja pri svakoj rekalibraciji, bez
 * ijedne korisnikove odluke.
 */
export function recalibratedPlan(
  originalInput: PlanGenerationInput,
  currentWeekIdx: number,
  vdotNow: number,
  opts: {
    oldWeeks?: ReadonlyArray<{ w: number; days: readonly MergeDay[] }>;
    originalPredictedSec?: number | null;
  } = {}
): RecalibrationResult | ReplanError {
  const regenInput = recalibrationInput(
    originalInput,
    currentWeekIdx,
    vdotNow,
    opts.originalPredictedSec
  );
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
  const total = weeksTotal(originalInput);
  const weeksLeft = total - resumeWeekIdx + 1;
  if (weeksLeft < 4)
    return {
      error:
        'Manje od 4 nedelje do trke posle pauze — pun re-entry nije moguć. Cilj treba ručno preispitati.'
    };
  const backdated =
    vdotAtPause -
    VDOT_RAMP_PER_WEEK[originalInput.intensity] *
      Math.min(resumeWeekIdx - 1, Math.min(total - 2, RAMP_CAP_WEEKS));
  const virtualPbSec = raceTimeForVdot(Math.max(backdated, 20), 5000);
  const raceDistM = originalInput.raceDistM || 5000;
  const stableGoalSec = originalInput.goalSec || raceTimeForVdot(vdotAtPause, raceDistM);
  const replanned = generatePlan({
    ...originalInput,
    pb: { distM: 5000, sec: virtualPbSec },
    goalSec: stableGoalSec
  });
  if (isPlanError(replanned)) return replanned;
  const w0 = replanned.weeks[resumeWeekIdx - 1];
  if (!w0) return { error: 'Nedelja povratka je van plana.' };
  const scale = w0.vol > 0 ? Math.min(lastRealizedVolKm * GROW_MAX, w0.vol) / w0.vol : 1;
  const first = {
    ...w0,
    vol: r1(w0.vol * scale),
    days: w0.days.map((d) => (d.km != null ? { ...d, km: r1(d.km * scale) } : d)) as Week['days'],
    reentry: true as const
  };
  return {
    weeks: [first, ...replanned.weeks.slice(resumeWeekIdx)],
    pred: replanned.pred.filter((p) => p.w >= resumeWeekIdx),
    meta: replanned.meta
  };
}
