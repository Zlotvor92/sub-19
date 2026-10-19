/* Provera plana prema policy.ts (H1–H17, HI*). SAMO prijavljuje prekršaje; plan se nikad ne menja i nema
   petlji skraćivanja (Uslov 1). Greške obaraju plan (generate.ts → PLAN_VIOLATES_POLICY); upozorenja idu u
   plan. Svaka odluka konstruktora ima proveru ovde (rule = kod prekršaja). Veličine koje koriste i
   konstruktor i validator (cilj po pravilu, minimum nedelje, dugi rasterećenja/tapera, doza rasterećenja i
   tapera, dan oštrenja) imaju JEDNU funkciju (pouka 24). */

import { addDays as isoAdd, daysBetween, mustDay, weekdayOf } from './dates.ts';
import { checkInput } from './input.ts';
import {
  deloadEasyShort,
  deloadLengths,
  deloadLong10,
  EASY_MIN10,
  longCap10,
  longFor10,
  longKmCap10,
  longShareCap10,
  longestLong10,
  longsOf10,
  rollingLongCap10,
  taperLongCap10,
  week1LongCap10
} from './lengths.ts';
import {
  assessGoal,
  feelPaces,
  midEasy,
  pacesFromVdot,
  raceTimeForVdot,
  round1,
  vdotFromResult
} from './paces.ts';
import {
  buildAllowed,
  deloadAllowed,
  deloadWeeks,
  firstOfPhase,
  isBuildPhase,
  periodize,
  phasesOf,
  testWeekOf
} from './periodize.ts';
import { HM_V2_POLICY as P, planRule } from './policy.ts';
import {
  advance,
  beginnerTaperT,
  buildLadder,
  capM,
  carries,
  deloadDose,
  deloadLadder,
  deloadSlot,
  type BuildLimit,
  type DayFits,
  fitsDay,
  floorM,
  INITIAL_QUALITY,
  ladderFor,
  nextLevel,
  pickSlot,
  type QualityState,
  startLevel,
  taperDoses
} from './quality.ts';
import { adjacentDays } from './schedule.ts';
import {
  A17_MAX_RUN,
  appliedRestarts,
  basisAt,
  framesFor,
  initialState,
  inRange,
  jumpRecentKm,
  pacesAt,
  restartWeeks
} from './steps.ts';
import type {
  DateRange,
  DayRole,
  Dose,
  HmV2Plan,
  LadderId,
  Paces,
  Structure,
  Phase,
  PlanWeek,
  QualityType,
  Violation,
  Workout,
  WorkZone
} from './types.ts';
import {
  capacityLimits,
  capacityMessage,
  fewerDaysAdvice,
  adaptNominal10,
  adaptVolume,
  enterWeek,
  initialAdaptHistory,
  leaveAdaptWeek,
  leaveWeek,
  nominal10,
  peakCap10,
  startKm10,
  weekMin10
} from './volume.ts';
import {
  buildDayLimit,
  type DayLimitContext,
  deloadDayLimit,
  HARD_ROLES,
  limitLongOf,
  lowestBuild,
  oneDayLimit,
  raceWeekRest,
  raceWeekRuns,
  SECOND_EASY_NOTE,
  secondQualityEasy,
  sharpenerAllowed,
  sharpenerDate,
  taperDayLimit
} from './week.ts';
import {
  doseOf,
  fmtKm,
  ladderLevels,
  qualityDaySec,
  qualityWorkout,
  recoveryOf,
  repsOf,
  rpeOf,
  sameStructure,
  structuresForDose,
  warmupCooldown,
  zoneOf
} from './workouts.ts';

const EPS = 1e-6;
const PHASES: readonly Phase[] = ['base', 'development', 'specific', 'taper', 'race'];
const ZONES: readonly WorkZone[] = ['R', 'I', 'T', 'RP'];
const to10 = (km: number): number => Math.round(km * 10);
const to100 = (km: number): number => Math.round(km * 100);

type SlotTypes = Readonly<
  Record<Phase, { q1: readonly QualityType[]; q2: readonly QualityType[] }>
>;
/** H10: dozvoljeni tipovi kvaliteta po fazi i slotu (druga struktura: T kontinuirano ↔ deonice; RP
    kontinuirano je tip RP). */
const SLOT_TYPES: SlotTypes = {
  base: { q1: ['R'], q2: ['T_continuous', 'T_cruise'] },
  development: { q1: ['I'], q2: ['T_cruise', 'T_continuous'] },
  specific: { q1: ['RP'], q2: ['T_cruise', 'T_continuous'] },
  taper: { q1: ['RP'], q2: ['T_cruise', 'T_continuous'] },
  race: { q1: [], q2: [] }
};
/** H10/H15: 3 dana — jedan kvalitet (Q1) T kontinuirano → T cruise → RP, bez I i R; taper samo RP (HI6). */
const SLOT_TYPES_ONE: SlotTypes = {
  base: { q1: ['T_continuous', 'T_cruise'], q2: [] },
  development: { q1: ['T_cruise', 'T_continuous'], q2: [] },
  specific: { q1: ['RP'], q2: [] },
  taper: { q1: ['RP'], q2: [] },
  race: { q1: [], q2: [] }
};
/** H17/HI10: početnik — kao 3 dana, uz T kontinuirano kad prvi nivo lestvice faze ne staje u plafon (lestvicu
    nedelje proverava buildLadder) i T kontinuirano tapera kad RP ne staje. */
const SLOT_TYPES_BEGINNER: SlotTypes = {
  ...SLOT_TYPES_ONE,
  specific: { q1: ['RP', 'T_continuous', 'T_cruise'], q2: [] },
  taper: { q1: ['RP', 'T_continuous'], q2: [] }
};

const isSteady = (w: PlanWeek): boolean => isBuildPhase(w.phase) && !w.deload;
const slotDose = (w: PlanWeek, role: 'q1' | 'q2'): Dose | null =>
  w.days.find((d) => d.role === role)?.workout.dose ?? null;
/** H12: glavna doza = rad T + I + RP u treninzima kvaliteta [m]. */
export const mainDoseM = (w: PlanWeek): number =>
  w.days.reduce(
    (a, d) =>
      a +
      (d.workout.kind === 'quality'
        ? Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP) * 1000)
        : 0),
    0
  );
const hasQuality = (w: PlanWeek): boolean => w.days.some((d) => d.workout.kind === 'quality');
const qualityKey = (w: PlanWeek): string =>
  JSON.stringify(
    w.days.filter((d) => d.workout.kind === 'quality').map((d) => [d.role, d.workout.blocks])
  );

export function validatePlan(plan: HmV2Plan): Violation[] {
  const out: Violation[] = [];
  const err = (rule: string, message: string, week?: number, date?: string): void => {
    out.push({
      rule,
      severity: 'error',
      message,
      ...(week !== undefined ? { week } : {}),
      ...(date ? { date } : {})
    });
  };
  const warn = (rule: string, message: string, week?: number): void => {
    out.push({ rule, severity: 'warning', message, ...(week !== undefined ? { week } : {}) });
  };
  const weeks = plan.weeks;
  const input = plan.input;
  const p = plan.paces;
  const N = weeks.length;
  const rule = planRule(
    input.runDays.length,
    input.experience === 'beginner' ? 'beginner' : 'regular'
  );
  if (!rule) {
    err('RUN_DAYS', `Broj dana ${input.runDays.length} nije u tabeli H15 / H17.`);
    return out;
  }
  const pat = plan.pattern;
  const nq = rule.quality;
  const B0 = rule.beginner;
  const slotTypes = rule.beginner ? SLOT_TYPES_BEGINNER : nq === 1 ? SLOT_TYPES_ONE : SLOT_TYPES;
  const intro = (w: { index: number }): boolean => w.index <= rule.introWeeks;
  // H16: osnova tempa iz ulaza (nezavisno od plana) — pouzdan rezultat ≤ 84 dana i VDOT ≥ 30, inače osećaj.
  const res = input.recentResult;
  const resDay = res ? mustDay(res.date) : 0;
  const reliable =
    !!res &&
    mustDay(input.startDate) - resDay <= P.input.resultMaxAgeDays &&
    round1(vdotFromResult(res.distanceM, res.timeSec)) >= P.input.vdotMin;
  const feel = !reliable;
  const feelTest = feel && rule.feelTest;
  if ((pat.q2 === null) !== (nq === 1))
    err('ROLES', `Šablon mora imati ${nq} kvalitetna dana (H15, H9).`);
  // Segment 04 (H18): adaptacija — koraci, mešovite nedelje, tempo i osnova tempa nedelje, okviri iz koraka.
  const ad = plan.adaptation;
  const steps = ad?.steps ?? [];
  const mixed = new Set(ad?.mixedWeeks ?? []);
  const checked = (w: { index: number }): boolean => !mixed.has(w.index);
  const chk = ad ? checkInput(input) : null;
  const pace = chk?.ok ? chk.pace : null;
  if (ad && !pace) {
    err('ADAPTATION', 'Ulaz adaptiranog plana nije ispravan (A15).');
    return out;
  }
  const pw = (w: { index: number }): Paces => (pace ? pacesAt(pace, steps, w.index) : p);
  const feelW = (w: { index: number }): boolean =>
    pace ? basisAt(pace, steps, w.index) === 'feel' : feel;
  const base0 = pace ? periodize(input.startDate, N, pace.kind === 'feel' && rule.feelTest) : null;
  /** A17 (pouka 22): ukinuta redovna rasterećenja (isti podatak kao konstruktor, steps.framesFor). */
  const droppedD = new Map<number, number>();
  const frames =
    pace && base0 && base0.length === N
      ? framesFor(base0, pat, input.runDays, input.raceDate, pace, steps, droppedD)
      : null;
  const restarts = pace && base0 ? appliedRestarts(base0, steps) : new Set<number>();
  /** A3: nov start počinje progresiju doze iznova i kad faze ostaju. */
  const doseRestarts = restartWeeks(steps);
  const firstAdapted = steps.length > 0 ? Math.min(...steps.map((x) => x.firstWeek)) : Infinity;
  /** A18: nedelja posle smanjenja obima (isto kao construct ctxAt, volume.adaptVolume). */
  const reducedFrom = steps.length > 0 ? adaptVolume(steps).reducedFrom : Infinity;
  const adaptedW = (w: { index: number }): boolean => w.index >= reducedFrom;
  const forced = (w: { index: number }): boolean =>
    steps.some((x) => x.deload && x.fromWeek === w.index);
  /** A12: početak segmenta izgradnje (nov start sa rePeriodize) za nedelju i. */
  const segStart = (i: number): number => Math.max(1, ...[...restarts].filter((r) => r <= i));
  /** A4/A9: nedelja sa manje kvaliteta — ograničenje koraka ili napomena A9 konstruktora. */
  const reducedQ = (w: PlanWeek): boolean =>
    w.limits?.quality !== undefined || w.notes.some((n) => n.includes('(A9)'));
  const noneQ = (w: PlanWeek): boolean =>
    w.limits?.quality === 'none' || w.notes.some((n) => n.includes('nedelja bez kvaliteta'));
  const restOf = (w: PlanWeek): Set<string> => new Set(w.limits?.rest ?? []);
  const painOf = (w: PlanWeek): Set<string> => new Set(w.limits?.pain ?? []);
  const dateIn = (w: { startDate: string }, wd: string): string =>
    Array.from({ length: 7 }, (_, i) => isoAdd(w.startDate, i)).find((d) => weekdayOf(d) === wd)!;

  // --- Uslov 6: oznaka politike.
  if (plan.policyId !== P.id || plan.policyVersion !== P.version)
    err('POLICY_STAMP', `Plan mora nositi ${P.id}/${P.version}.`);

  // --- Struktura i datumi.
  if (N === 0) {
    err('STRUCTURE', 'Plan nema nedelja.');
    return out;
  }
  if (weeks[0]!.startDate !== input.startDate)
    err('STRUCTURE', 'Prva nedelja ne počinje startom.', 1);
  if (weeks[N - 1]!.endDate !== input.raceDate)
    err('STRUCTURE', 'Poslednja nedelja se ne završava danom trke.', N);
  weeks.forEach((w, i) => {
    if (w.index !== i + 1) err('STRUCTURE', `Redni broj nedelje ${w.index} ≠ ${i + 1}.`, w.index);
    if (daysBetween(w.startDate, w.endDate) !== 6)
      err('STRUCTURE', 'Nedelja nema 7 dana.', w.index);
    if (i > 0 && daysBetween(weeks[i - 1]!.endDate, w.startDate) !== 1)
      err('STRUCTURE', 'Nedelje nisu uzastopne.', w.index);
    const dates = new Set<string>();
    for (const d of w.days) {
      if (mustDay(d.date) < mustDay(w.startDate) || mustDay(d.date) > mustDay(w.endDate))
        err('STRUCTURE', `Dan ${d.date} je van nedelje.`, w.index, d.date);
      if (dates.has(d.date)) err('STRUCTURE', `Dva treninga na ${d.date}.`, w.index, d.date);
      dates.add(d.date);
      if (weekdayOf(d.date) !== d.weekday)
        err('STRUCTURE', 'Pogrešan dan u nedelji.', w.index, d.date);
      if (d.role !== 'race' && !input.runDays.includes(d.weekday))
        err('RUN_DAYS', `Trening na dan koji nije izabran (${d.weekday}).`, w.index, d.date);
      if (d.hard !== HARD_ROLES.includes(d.role))
        err('HARD_FLAG', `Oznaka zahtevnog dana ne odgovara ulozi ${d.role}.`, w.index, d.date);
    }
  });

  // --- H4 / Uslov 6: faza svake nedelje iz odluke generatora. Segment 04: iz koraka (nov start: A3/A12);
  // okvir nedelje (rasterećenje, ograničenja) = steps.framesFor.
  const expected = frames ? frames.map((f) => f.phase) : phasesOf(N);
  for (const w of weeks) {
    if (!PHASES.includes(w.phase)) err('NO_PHASE', 'Nedelja bez faze.', w.index);
    else if (checked(w) && w.phase !== expected[w.index - 1])
      err('PHASES', `Faza ${w.phase} ≠ ${expected[w.index - 1]} (H4, A12).`, w.index);
    const f = frames?.[w.index - 1];
    if (
      f &&
      checked(w) &&
      (f.deload !== w.deload ||
        JSON.stringify(f.limits ?? null) !== JSON.stringify(w.limits ?? null))
    )
      err(
        'FRAMES',
        'Rasterećenje ili ograničenja nedelje ≠ koraci adaptacije (A3–A5, A17).',
        w.index
      );
  }
  const phases = weeks.map((w) => w.phase);

  // --- H5 (pouka 4): gde su rasterećenja — pravila i jedini raspored pretrage. Segment 04: relativno od
  // novog starta (A12); prinudno rasterećenje (A5) sme bilo gde u izgradnji; niz posle ukinutog rasterećenja
  // (pouka 22) najviše A17_MAX_RUN nedelja.
  let run = 0;
  let afterForced = false;
  let afterDropped = false;
  for (const w of weeks) {
    const s0 = segStart(w.index);
    const rel = phases.slice(s0 - 1);
    const k = w.index - s0 + 1;
    if (restarts.has(w.index)) [run, afterForced, afterDropped] = [0, false, false];
    if (w.deload && checked(w) && !forced(w) && !deloadAllowed(rel, k)) {
      const why = !isBuildPhase(w.phase)
        ? `u fazi ${w.phase}`
        : k < P.deload.firstAllowedWeek
          ? 'u nedeljama 1–2'
          : firstOfPhase(rel, k)
            ? 'na prvoj nedelji faze'
            : 'na poslednjoj nedelji pre tapera';
      err('DELOAD_PLACEMENT', `Rasterećenje ${why} (H5).`, w.index);
    }
    if (!isBuildPhase(w.phase)) continue;
    if (w.deload) [run, afterForced, afterDropped] = [0, forced(w), false];
    else {
      if (droppedD.has(w.index)) [run, afterDropped] = [0, true];
      const allowed = afterDropped ? run + 1 <= A17_MAX_RUN : buildAllowed(rel, k, run);
      if (!allowed && !afterForced && checked(w))
        err(
          'DELOAD_RUN',
          `${run + 1} uzastopne nedelje izgradnje bez rasterećenja (H5${afterDropped ? ', A17' : ''}).`,
          w.index
        );
      run++;
    }
  }
  if (!ad) {
    const wantDeloads = deloadWeeks(expected) ?? [];
    const gotDeloads = weeks.filter((w) => w.deload).map((w) => w.index);
    if (JSON.stringify(gotDeloads) !== JSON.stringify(wantDeloads))
      err(
        'DELOAD_SCHEDULE',
        `Rasterećenja ${gotDeloads.join(', ') || '—'} ≠ raspored H5 ${wantDeloads.join(', ') || '—'}.`
      );
  }

  // --- H9: uloge dana po šablonu. Rasterećenje: samo T slot (Q2; 3 dana Q1, HI6) ili bez kvaliteta
  // (odstupanje H5); taper: Q1 (RP) i Q2 (T), samo RP ili bez kvaliteta (odstupanje H7); H16: test na danu Q1
  // (u rasterećenju na danu T slota); H17: uvod bez kvaliteta, početnik bez kvaliteta kad ni 1,5 km ne staje;
  // ostali dani šablona lagani.
  const dSlot = deloadSlot(nq);
  for (const w of weeks) {
    if (w.phase === 'race' || !checked(w)) continue;
    const has = (r: DayRole): boolean => w.days.some((d) => d.role === r);
    const rest = restOf(w);
    if (w.index >= firstAdapted && (reducedQ(w) || rest.size > 0)) {
      // A4/A9: dani odmora bez treninga; dan kvaliteta šablona sme biti lagan ili nositi jedini kvalitet
      // (uloga q1/q2), ukupno najviše dozvoljeno kvaliteta (ograničenje koraka; A9 manje od pravila).
      const qSlots: [DayRole, string][] = [
        ['q1', pat.q1],
        ...(pat.q2 ? [['q2', pat.q2] as [DayRole, string]] : [])
      ];
      const wantR: [DayRole, string][] = [
        ...qSlots,
        ['long', pat.long],
        ...pat.easy.map((wd): [DayRole, string] => ['easy', wd])
      ];
      const max = noneQ(w) ? 0 : reducedQ(w) ? 1 : nq;
      const roleAt = new Map(w.days.map((d) => [d.weekday as string, d.role]));
      const bad = wantR.filter(([r, wd]) => {
        const got = roleAt.get(wd);
        if (rest.has(dateIn(w, wd))) return got !== undefined;
        const isQ = qSlots.some(([, q]) => q === wd);
        return isQ
          ? !(got === 'q1' || got === 'q2' || got === 'easy' || got === 'test')
          : got !== r;
      });
      const nQ = w.days.filter((d) => d.role === 'q1' || d.role === 'q2').length;
      if (
        bad.length > 0 ||
        w.days.length !== wantR.filter(([, wd]) => !rest.has(dateIn(w, wd))).length ||
        nQ > max
      )
        err(
          'ROLES',
          `Dani ${w.days.map((d) => `${d.role}@${d.weekday}`).join(', ')} ne odgovaraju šablonu uz ograničenja (H9, A4, A9).`,
          w.index
        );
      if (intro(w) && hasQuality(w))
        err('INTRO', `Nedelja uvoda ${w.index} ima kvalitet (H17, HI13).`, w.index);
      continue;
    }
    const roleOf = (r: 'q1' | 'q2'): DayRole => {
      if (w.test && r === (w.deload ? dSlot : 'q1')) return 'test';
      if (intro(w)) return 'easy';
      if (w.deload) return r === dSlot && has(r) ? r : 'easy';
      if (w.phase === 'taper' || rule.beginner) return has(r) ? r : 'easy';
      // Pouka 35: drugi dan kvaliteta lagan (opravdanost proverava progresija doze, ista funkcija).
      if (r === 'q2' && w.notes.some((n) => n.includes(SECOND_EASY_NOTE))) return 'easy';
      return r;
    };
    const want = [
      `${roleOf('q1')}@${pat.q1}`,
      ...(pat.q2 ? [`${roleOf('q2')}@${pat.q2}`] : []),
      `long@${pat.long}`,
      ...pat.easy.map((wd) => `easy@${wd}`)
    ].sort();
    const got = w.days.map((d) => `${d.role}@${d.weekday}`).sort();
    if (JSON.stringify(got) !== JSON.stringify(want))
      err('ROLES', `Dani ${got.join(', ')} ≠ šablon ${want.join(', ')} (H9).`, w.index);
    if (
      w.deload &&
      w.days.some((d) => d.workout.kind === 'quality' && d.role !== dSlot) &&
      !(reducedQ(w) && w.days.filter((d) => d.workout.kind === 'quality').length === 1)
    )
      err('ROLES', 'Rasterećenje ima samo T kvalitet (H5).', w.index);
    // H17/HI13: uvod bez kvaliteta (i kad je rasteretna nedelja).
    if (intro(w) && hasQuality(w))
      err('INTRO', `Nedelja uvoda ${w.index} ima kvalitet (H17, HI13).`, w.index);
  }

  // --- H16: test 5 km — plan po osećaju koji nije početnik: tačno jedan, u poslednjoj nedelji baze (oznaka
  // nedelje), na danu Q1 ili na danu kvaliteta rasterećenja; plan sa rezultatom i početnik: nijedan.
  const tests = weeks.flatMap((w) =>
    w.days.filter((d) => d.workout.kind === 'test' || d.role === 'test').map((d) => ({ w, d }))
  );
  const flagged = weeks.filter((w) => w.test).map((w) => w.index);
  const wantTest = feelTest ? testWeekOf(weeks.map((w) => w.phase)) : null;
  if (pace) {
    // Segment 04 (A13): najviše jedan test, samo plan po osećaju koji nije početnik, u nedelji izgradnje po
    // osećaju; oznaka nedelje ⇔ dan testa (mešovite nedelje: samo dan).
    const tw0 = tests[0]?.w.index;
    if (
      tests.length > 1 ||
      (tests.length === 1 && (pace.kind !== 'feel' || !rule.feelTest)) ||
      (tw0 !== undefined && (!feelW({ index: tw0 }) || !isBuildPhase(weeks[tw0 - 1]!.phase)))
    )
      err('TEST', 'Adaptiran plan: najviše jedan test, u nedelji izgradnje po osećaju (A13, H17).');
    for (const w of weeks)
      if (checked(w) && (w.test === true) !== tests.some((x) => x.w.index === w.index))
        err('TEST', 'Oznaka nedelje testa ≠ dan testa (A13).', w.index);
  } else if (wantTest === null) {
    if (tests.length > 0 || flagged.length > 0)
      err(
        'TEST',
        rule.beginner ? 'Početnik nema test 5 km (H17).' : 'Plan sa rezultatom nema test (H16).'
      );
  } else if (
    tests.length !== 1 ||
    flagged.join() !== String(wantTest) ||
    tests[0]!.w.index !== wantTest
  )
    err(
      'TEST',
      `Plan po osećaju ima tačno jedan test 5 km, u poslednjoj nedelji baze (${wantTest}) (H16).`,
      tests[0]?.w.index
    );

  // --- H9: zahtevni dani nikad uzastopni (i preko granice nedelje).
  const hard = weeks.flatMap((w) => w.days.filter((d) => d.hard).map((d) => ({ w: w.index, d })));
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!.d.date, hard[i]!.d.date) < 2)
      err(
        'HARD_ADJACENT',
        `Zahtevni dani ${hard[i - 1]!.d.date} i ${hard[i]!.d.date} su susedni (H9).`,
        hard[i]!.w,
        hard[i]!.d.date
      );
  if (
    adjacentDays(pat.q1, pat.long) ||
    (pat.q2 !== null && (adjacentDays(pat.q1, pat.q2) || adjacentDays(pat.q2, pat.long)))
  )
    err('HARD_ADJACENT', 'Šablon ima susedne zahtevne dane (H9).');

  // --- Aritmetika i Uslov 8 (H15).
  for (const w of weeks) {
    for (const d of w.days) {
      const s = d.workout.segments;
      if (
        s.length === 0 ||
        d.workout.km <= 0 ||
        d.workout.sec <= 0 ||
        s.some((x) => x.km <= 0 || x.sec <= 0)
      )
        err(
          'EMPTY_WORKOUT',
          'Prazan trening ili segment bez km/trajanja (Uslov 8).',
          w.index,
          d.date
        );
      if (s.reduce((a, x) => a + to100(x.km), 0) !== to100(d.workout.km))
        err('ARITHMETIC', 'Km dana ≠ zbir segmenata.', w.index, d.date);
      if (s.reduce((a, x) => a + x.sec, 0) !== d.workout.sec)
        err('ARITHMETIC', 'Trajanje dana ≠ zbir segmenata.', w.index, d.date);
      if (d.role === 'easy' && w.phase !== 'race' && to10(d.workout.km) < EASY_MIN10)
        err(
          'EASY_MIN',
          `Lagan ${d.workout.km} km < ${P.lengths.easyMinKm} km (H13).`,
          w.index,
          d.date
        );
      if (d.countsToWeek === (d.role === 'race'))
        err('RACE_DAY', 'Samo trka je van obima nedelje (H8).', w.index, d.date);
    }
    const planned = w.days.reduce((a, d) => a + (d.countsToWeek ? to100(d.workout.km) : 0), 0);
    if (planned !== to100(w.plannedKm)) err('ARITHMETIC', 'Planirano ≠ zbir dana.', w.index);
    // Pouka 30: trkačka nedelja čije su sve trke pre trke dani odmora (A4) ima samo trku — skraćena
    // trkačka nedelja (RACE_WEEK_SHORT), ne prazna.
    const raceOnly =
      w.phase === 'race' &&
      w.days.length === 1 &&
      w.days[0]!.role === 'race' &&
      (w.limits?.rest ?? []).length > 0;
    if (w.days.filter((d) => d.countsToWeek).length === 0 && !raceOnly)
      err('EMPTY_WEEK', 'Nedelja bez treninga (Uslov 8).', w.index);
    // Segment 04: mešovita nedelja — samo dani; nedelja sa danima bola/odmora (A4, pouka 25): planirano ≤
    // cilj (upozorenje).
    if (!checked(w)) continue;
    const limited = restOf(w).size > 0 || painOf(w).size > 0;
    if (limited && w.plannedKm <= w.targetKm + P.tolerance.plannedKm + EPS) {
      if (w.plannedKm + P.tolerance.plannedKm + EPS < w.targetKm)
        warn(
          'PLANNED_BELOW_TARGET_LIMITS',
          `Planirano ${w.plannedKm} km < cilj obima ${w.targetKm} km (odmor/bol, A4, pouka 25).`,
          w.index
        );
    } else if (Math.abs(w.plannedKm - w.targetKm) > P.tolerance.plannedKm + EPS)
      err('PLANNED_VS_TARGET', `Planirano ${w.plannedKm} km ≠ cilj ${w.targetKm} km.`, w.index);
    // Uslov 8: nedelja ≥ minimum (trkačka: planirano + trka, H8 — potpuno zadata, pa upozorenje). A4:
    // nedelja sa danima bola/odmora sme ispod minimuma (upozorenje).
    const load10 = to10(w.plannedKm + (w.phase === 'race' ? P.raceWeek.raceKm : 0));
    if (load10 < weekMin10(rule) && limited && w.phase !== 'race')
      warn(
        'WEEK_MIN_LIMITS',
        `Nedelja ${w.plannedKm} km < ${rule.weekMinKm} km — dani bola/odmora (A4, pouka 25).`,
        w.index
      );
    else if (load10 < weekMin10(rule)) {
      if (w.phase === 'race')
        warn(
          'RACE_WEEK_SHORT',
          `Trkačka nedelja ${w.plannedKm} km + trka ${P.raceWeek.raceKm} km < ${rule.weekMinKm} km (Uslov 8).`,
          w.index
        );
      else
        err(
          'WEEK_MIN_VOLUME',
          `Nedelja ${w.plannedKm} km < ${rule.weekMinKm} km (Uslov 8, H15).`,
          w.index
        );
    }
  }

  // --- H13: dužine (dugi ≤ udeo i ≤ 150 min; dugi ≥ svaki lagan; korak 0,1 km).
  /** Pouka 28: dugi svake nedelje (null bez dugog) i „nedelja 0" (pouka 34) — iste funkcije kao konstruktor. */
  const longsAll10 = longsOf10(weeks);
  const recentJ = jumpRecentKm(input.recentLongRunKm, steps);
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.phase === 'race') {
      if (long) err('RACE_WEEK', 'Trkačka nedelja nema dugi (trka ga zamenjuje, H8).', w.index);
      continue;
    }
    // Mešovita nedelja: zadržani dani (prošlost) i konstruisani dani nisu ista nedelja (samo provere dana).
    if (!checked(w)) continue;
    if (!long) {
      if (!restOf(w).has(dateIn(w, pat.long))) err('ROLES', 'Nedelja nema dugi trk.', w.index);
      continue;
    }
    const pk = pw(w);
    // A4: dugi na danu bola ≤ 60 min.
    const longMaxSec = painOf(w).has(long.date)
      ? Math.min(rule.longMaxSec, P.adapt.painLongMaxSec)
      : rule.longMaxSec;
    const l10 = to10(long.workout.km);
    if (Math.abs(long.workout.km * 10 - l10) > EPS)
      err('LENGTH_STEP', 'Dugi nije u koraku 0,1 km (H13).', w.index, long.date);
    if (l10 > longShareCap10(to10(w.targetKm), rule))
      err(
        'LONG_SHARE',
        `Dugi ${long.workout.km} km > ${Math.round(rule.longMaxShare * 100)} % cilja ${w.targetKm} km (H13).`,
        w.index,
        long.date
      );
    if (long.workout.km * pk.E.slow > longMaxSec + EPS)
      err(
        'LONG_DURATION',
        `Dugi ${long.workout.km} km > ${longMaxSec / 60} min sporim E (H13${rule.beginner ? ', H17' : ''}, A4).`,
        w.index,
        long.date
      );
    if (l10 > longKmCap10())
      err(
        'LONG_KM',
        `Dugi ${long.workout.km} km > ${P.lengths.longMaxKm} km (H13).`,
        w.index,
        long.date
      );
    const roll10 = rollingLongCap10(w.index, longsAll10, recentJ);
    if (l10 > roll10)
      err(
        'LONG_ROLLING',
        `Dugi ${long.workout.km} km > ${roll10 / 10} km = max(1,1 × L, L + 1 km), L najduži prethodne 4 nedelje (u ned 1–4 i skorašnji najduži) (pouka 28).`,
        w.index,
        long.date
      );
    if (long.workout.segments.some((s) => s.zone !== 'E'))
      err('LONG_NOT_EASY', 'Dugi trk je samo lagan.', w.index, long.date);
    const easyKm = w.days.filter((d) => d.role === 'easy').map((d) => to10(d.workout.km));
    if (easyKm.length > 1 && Math.max(...easyKm) - Math.min(...easyKm) > 1 && painOf(w).size === 0)
      err('EASY_UNEQUAL', `Lagani dani ${easyKm.map((x) => x / 10).join(' / ')} km.`, w.index);
    for (const d of w.days)
      if (d.role === 'easy') {
        if (to10(d.workout.km) > l10)
          err(
            'LONG_SHORTER_THAN_EASY',
            `Dugi ${long.workout.km} km < lagan ${d.workout.km} km (H13, pouka 2).`,
            w.index,
            d.date
          );
        if (Math.abs(d.workout.km * 10 - to10(d.workout.km)) > EPS)
          err('LENGTH_STEP', 'Lagan nije u koraku 0,1 km (H13).', w.index, d.date);
      }
  }
  // Faza 4a N9: najduži dugi preko SVIH nedelja plana (i mešovitih — upisani dani su plan), ista funkcija kao
  // konstruktor; bilo samo preko proverenih nedelja (5/2928 lažnih upozorenja posle adaptacije).
  const longestAll10 = longestLong10(weeks);
  if (longestAll10 < to10(rule.longWarnKm))
    warn(
      'LONG_RUN_SHORT',
      `Najduži dugi ${longestAll10 / 10} km < ${rule.longWarnKm} km (${rule.beginner ? 'H17' : 'H13'}): preporuka više dana ili obima.`
    );

  // --- Pouka 32: plafon zone, drugi član — dan kvaliteta iznad najnižeg nivoa zone traje ≤ dugi iste
  // nedelje (trajanje sporim krajem tempa zone, workouts.qualityDaySec). Izuzeci (upozorenje dole): najniži
  // nivo zone (izgradnja: prvi nivo lestvice; rasterećenje/taper: najmanja doza) i dan testa.
  const wcQ = warmupCooldown(input.currentWeeklyKm, rule.beginner);
  const tFloorM = Math.round((B0 ? P.beginner.tFirstKm : P.deload.tMinKm) * 1000);
  const rpMinM = P.taper.rpMin.reps * P.taper.rpMin.repM;
  const lowestOf = (w: PlanWeek, d: Dose): boolean =>
    w.deload || w.phase === 'taper' || reducedQ(w)
      ? d.doseM <= (d.zone === 'RP' ? rpMinM : tFloorM)
      : lowestBuild(d, B0);
  for (const w of weeks) {
    const long = w.days.find((d) => d.role === 'long');
    if (w.phase === 'race' || !long || !checked(w)) continue;
    for (const d of w.days) {
      const dose = d.workout.dose;
      if (d.workout.kind !== 'quality' || !dose || lowestOf(w, dose)) continue;
      const sec = qualityDaySec(dose, pw(w), wcQ);
      if (sec > long.workout.sec)
        err(
          'QUALITY_OVER_LONG',
          `${dose.zone} ${dose.doseM} m: dan ${Math.round(sec / 60)} min > dugi ${Math.round(long.workout.sec / 60)} min (pouka 32, plafon zone).`,
          w.index,
          d.date
        );
    }
  }

  // --- HI3 (pouka 14): upozorenje — kvalitetni dan (ili dan testa) duži od dugog po trajanju; posle pouke 32
  // samo najniži nivo zone i test, u izgradnji i rasterećenju. Taper (H7: dugi ≤ 0,6 × najduži, RP ≥ 2 × 2000 m)
  // nema upozorenje — preporuka manje dana ne menja taj odnos (HI15).
  const longer = weeks.flatMap((w) => {
    const long = w.days.find((d) => d.role === 'long');
    if (!isBuildPhase(w.phase) || !long || !checked(w)) return [];
    const q = Math.max(
      0,
      // Odluka HM-03: dan testa se računa kao kvalitetni dan (ista provera, isti kod).
      ...w.days
        .filter((d) => d.workout.kind === 'quality' || d.workout.kind === 'test')
        .map((d) => d.workout.sec)
    );
    return q > long.workout.sec ? [{ w: w.index, q, long: long.workout.sec }] : [];
  });
  if (longer.length > 0) {
    const f = longer[0]!;
    warn(
      'LONG_SHORTER_THAN_QUALITY',
      `Kvalitetni dan duži od dugog po trajanju u ${longer.length} od ${weeks.filter((w) => isBuildPhase(w.phase)).length} nedelja izgradnje i rasterećenja (ned ${f.w}: ${Math.round(f.q / 60)} > ${Math.round(f.long / 60)} min; najniži nivo zone ili test, pouka 32; HI3)${fewerDaysAdvice(input.runDays.length, input.currentWeeklyKm, rule)}.`,
      f.w
    );
  }

  // --- H11: jedan plafon po zoni, po treningu (trkačka nedelja: H8).
  for (const w of weeks) {
    if (w.phase === 'race' || !checked(w)) continue;
    for (const d of w.days)
      for (const z of ZONES) {
        const m = Math.round(d.workout.workKm[z] * 1000);
        if (m > capM(z, w.targetKm))
          err(
            'ZONE_CAP',
            `${z} ${m} m > ${P.caps[z] * 100} % cilja ${w.targetKm} km (H11).`,
            w.index,
            d.date
          );
      }
  }

  // --- H10 tipovi po fazi; H14 WU/CD i oporavci; najmanja deonica po zoni; H16 RPE i struktura testa.
  const wc = warmupCooldown(input.currentWeeklyKm, rule.beginner);
  for (const w of weeks)
    for (const d of w.days) {
      // Segment 04: tempo i osnova tempa nedelje (A1, pouka 16).
      const pk = pw(w);
      const mid = midEasy(pk);
      const feelD = feelW(w);
      const wo = d.workout;
      if (wo.kind !== 'quality' && wo.rpe !== undefined)
        err('RPE', 'RPE samo na treningu kvaliteta (H16).', w.index, d.date);
      if (wo.kind === 'test') {
        const seg = wo.segments;
        const t = seg.filter((x) => x.kind === 'test');
        if (
          d.role !== 'test' ||
          !d.countsToWeek ||
          wo.dose !== null ||
          seg.length !== 3 ||
          t.length !== 1 ||
          t[0]!.km !== P.test.km ||
          t[0]!.zone !== 'test' ||
          t[0]!.sec !== raceTimeForVdot(pk.vdot, P.test.km * 1000) ||
          seg[0]!.kind !== 'warmup' ||
          seg[0]!.sec !== wc.warmupSec ||
          seg[2]!.kind !== 'cooldown' ||
          seg[2]!.sec !== wc.cooldownSec
        )
          err(
            'TEST',
            `Test: WU ${wc.warmupSec / 60} min + ${P.test.km} km + CD ${wc.cooldownSec / 60} min, u obimu nedelje, bez doze (H16).`,
            w.index,
            d.date
          );
        continue;
      }
      if (d.role === 'test') err('TEST', 'Dan testa bez testa (H16).', w.index, d.date);
      if (wo.kind !== 'quality') {
        if (wo.dose) err('DOSE', 'Doza na treningu koji nije kvalitet.', w.index, d.date);
        continue;
      }
      const dose = wo.dose;
      if (!dose) {
        err('DOSE', 'Kvalitet bez doze.', w.index, d.date);
        continue;
      }
      // A4/A9: jedini kvalitet doze rasterećenja sme na drugi dan kvaliteta kad je dan slota u zabrani.
      const swapOk = (slot: 'q1' | 'q2'): boolean =>
        reducedQ(w) &&
        (d.role === 'q1' || d.role === 'q2') &&
        (w.limits?.noQuality ?? []).includes(dateIn(w, slot === 'q1' ? pat.q1 : pat.q2!));
      if (!checked(w)) {
        // Mešovita nedelja: samo provere dana (ispod).
      } else if (w.phase === 'race') {
        if (d.role !== 'sharpener' || wo.qualityType !== 'RP_sharpener')
          err('PHASE_QUALITY', 'Trkačka nedelja ima samo oštrenje (H8).', w.index, d.date);
      } else if (w.deload || (reducedQ(w) && isBuildPhase(w.phase))) {
        // Rasterećenje (H5) i nedelja izgradnje sa jednim kvalitetom doze rasterećenja (A4/A9; doza:
        // ONE_QUALITY).
        if ((d.role !== dSlot && !swapOk(dSlot)) || dose.ladder !== deloadLadder(w.phase))
          err(
            'PHASE_QUALITY',
            `Rasterećenje: jedini kvalitet je T (${deloadLadder(w.phase)}) na danu ${dSlot.toUpperCase()} (H5).`,
            w.index,
            d.date
          );
      } else if (w.phase === 'taper' && reducedQ(w) && swapOk('q1')) {
        // A4/A9: taper samo RP (početnik T) na drugom danu kvaliteta (dan Q1 u zabrani); doza: TAPER_QUALITY.
      } else {
        const role = d.role === 'q1' || d.role === 'q2' ? d.role : null;
        if (!role || !wo.qualityType || !slotTypes[w.phase][role].includes(wo.qualityType))
          err(
            'PHASE_QUALITY',
            `${wo.qualityType} ne pripada fazi ${w.phase} (${d.role}) (H10).`,
            w.index,
            d.date
          );
        else if (
          isBuildPhase(w.phase) &&
          dose.ladder !==
            (role === 'q1' ? buildLadder(w.phase, w.targetKm, rule) : ladderFor(w.phase, role, nq))
        )
          err(
            'PHASE_QUALITY',
            `Lestvica ${dose.ladder} ≠ faza ${w.phase} (H10${rule.beginner ? ', HI10' : ''}).`,
            w.index,
            d.date
          );
      }
      // H16: plan po osećaju — RPE zone na svakom kvalitetu (i oštrenju); plan sa rezultatom bez RPE.
      const r = rpeOf(dose.zone);
      if (
        feelD
          ? !wo.rpe || wo.rpe.min !== r.min || wo.rpe.max !== r.max || wo.rpe.cue !== r.cue
          : wo.rpe !== undefined
      )
        err(
          'RPE',
          feelD
            ? `Kvalitet ${dose.zone} nosi RPE ${r.min}–${r.max} („${r.cue}") (H16).`
            : 'Plan sa rezultatom nema RPE (H16).',
          w.index,
          d.date
        );
      if (Math.round(wo.workKm[dose.zone] * 1000) !== dose.doseM)
        err('DOSE', 'Rad u zoni ≠ doza.', w.index, d.date);
      const seg = wo.segments;
      const wu = seg[0];
      const cd = seg[seg.length - 1];
      if (
        !wu ||
        wu.kind !== 'warmup' ||
        wu.sec !== wc.warmupSec ||
        to100(wu.km) !== Math.round((wu.sec * 100) / mid)
      )
        err(
          'WARMUP',
          `Zagrevanje mora biti ${wc.warmupSec / 60} min E (km po srednjem E) (H14).`,
          w.index,
          d.date
        );
      if (
        !cd ||
        cd.kind !== 'cooldown' ||
        cd.sec !== wc.cooldownSec ||
        to100(cd.km) !== Math.round((cd.sec * 100) / mid)
      )
        err(
          'COOLDOWN',
          `Hlađenje mora biti ${wc.cooldownSec / 60} min E (km po srednjem E) (H14).`,
          w.index,
          d.date
        );
      if (seg.filter((x) => x.kind === 'warmup' || x.kind === 'cooldown').length !== 2)
        err('WARMUP', 'Tačno jedno zagrevanje i jedno hlađenje (H14).', w.index, d.date);
      const s = dose.structure;
      const a = P.alternatives;
      // H10: T deonice ≥ 1000 m; RP deonice ≥ 2000 m, kontinuirano do 10 km (oštrenje: H8).
      const repMin = dose.zone === 'T' ? a.tRepMinM : dose.zone === 'RP' ? a.rpRepMinM : 0;
      if (repsOf(s).some((m) => m < repMin))
        err('REP_MIN', `${dose.zone} deonica < ${repMin} m (H10).`, w.index, d.date);
      // Faza 4a N6: RP nikad ispod najnižeg nivoa (ista funkcija kao konstruktor, quality.floorM).
      if (dose.zone === 'RP' && dose.doseM < floorM('RP', B0))
        err(
          'RP_FLOOR',
          `RP ${dose.doseM} m < najniži nivo ${floorM('RP', B0)} m (H10).`,
          w.index,
          d.date
        );
      if (dose.zone === 'RP' && s.form === 'continuous' && dose.doseM > a.rpContinuousMaxKm * 1000)
        err('REP_MIN', `RP kontinuirano > ${a.rpContinuousMaxKm} km (H10).`, w.index, d.date);
      if (dose.zone === 'I' && repsOf(s).some((m) => m < a.iRepMinM || m > a.iRepMaxM))
        err('REP_MIN', `I deonica van ${a.iRepMinM}–${a.iRepMaxM} m (H10, HI5).`, w.index, d.date);
      if ((dose.zone === 'R' || dose.zone === 'I') && s.form === 'continuous')
        err('PHASE_QUALITY', `${dose.zone} nema kontinuiranu strukturu (H10).`, w.index, d.date);
      const reps = seg.filter((x) => x.kind === 'rep');
      const recs = seg.filter((x) => x.kind === 'recovery');
      if (s.form !== 'continuous') {
        const want = repsOf(s);
        const okRec = recs.every((x, i) => {
          const rec = recoveryOf(dose.ladder, want[i]!, pk);
          return 'm' in rec ? to100(x.km) === Math.round(rec.m / 10) : x.sec === rec.sec;
        });
        const okReps = reps.every((x, i) => to100(x.km) === Math.round(want[i]! / 10));
        if (reps.length !== want.length || recs.length !== want.length - 1 || !okRec || !okReps)
          err('RECOVERY', `Oporavak deonica ne odgovara H14 (${dose.ladder}).`, w.index, d.date);
      } else if (recs.length > 0 || reps.length > 0)
        err('RECOVERY', 'Kontinuiran blok nema deonice ni oporavak.', w.index, d.date);
    }

  // --- H12: progresija po slotu kroz ne-rasteretne nedelje izgradnje. Slot bez treninga (test H16, uvod i
  // nedelja bez kvaliteta početnika H17) ne menja stanje slota; „glavna doza ne opada" preskače nedelje bez
  // pravog kvaliteta Q1 (test, uvod).
  const B = rule.beginner;
  // Segment 04: lanac ne-rasteretnih nedelja izgradnje; nedelja sa ograničenjem kvaliteta (A4/A9) ne menja
  // stanje doze i preskače se; nov start (A3) i nedelja posle sidra bola (pouka 18) počinju progresiju iznova
  // ('restart'); mešovita nedelja se ne proverava, a stanje doze daje iz upisanih dana ({ state }) — isto
  // kao konstruktor (pouka 29: generate.writtenPicks); poređenja sa njom (glavna doza, cilj) se preskaču.
  const chain: (PlanWeek | 'restart' | { state: PlanWeek })[] = [];
  // Pouka 34 (dopuna N7): posle umora pre starta progresija doze kreće iznova u nedelji 2 (steps.restartWeeks) —
  // doza nedelje 2 = doza planirane nedelje 1; stanje reference čita samo rasterećenje nedelje 1 (initialState).
  for (const w of weeks) {
    if (doseRestarts.has(w.index)) chain.push('restart');
    if (!isSteady(w) || reducedQ(w)) continue;
    chain.push(checked(w) ? w : { state: w });
  }
  const steady = chain.filter((x): x is PlanWeek => typeof x !== 'string' && !('state' in x));
  for (const b of steady)
    if (B && !b.test && !intro(b) && !slotDose(b, 'q1')) {
      if (doseOf(ladderLevels('T_continuous', true)[0]!) > capM('T', b.targetKm))
        warn(
          'BUILD_NO_QUALITY',
          `Nedelja izgradnje bez kvaliteta: ni T ${P.beginner.tFirstKm} km ne staje u plafon (H11 ispred H17).`,
          b.index
        );
      else err('BUILD_NO_QUALITY', 'Početnik: nedelja izgradnje bez kvaliteta (H17).', b.index);
    }
  let lastOf: Record<'q1' | 'q2', Dose | null> = { q1: null, q2: null };
  let prevMain: PlanWeek | null = null;
  let prevW: PlanWeek | null = null;
  // Pouka 32: drugi član plafona zone po slotu — isti predikat kao konstruktor (week.buildDayLimit).
  const dlOf = (w: { index: number }): DayLimitContext => ({
    paces: pw(w),
    wc: wcQ,
    rule,
    adapted: adaptedW(w)
  });
  const limitOf = (b: PlanWeek): BuildLimit =>
    buildDayLimit(
      dlOf(b),
      to10(b.targetKm),
      pat.easy.length,
      rollingLongCap10(b.index, longsAll10, recentJ),
      nq === 2 ? ladderFor(b.phase, 'q2') : null,
      b.days.find((d) => d.workout.kind === 'test')?.workout ?? null
    );
  const slotFits = (b: PlanWeek, role: 'q1' | 'q2'): DayFits =>
    role === 'q1' ? limitOf(b).q1 : limitOf(b).q2(slotDose(b, 'q1'));
  const fit = (b: PlanWeek, role: 'q1' | 'q2', ladder: LadderId, s: Structure) =>
    fitsDay(ladder, s, role === 'q1' && B, slotFits(b, role));
  for (const c of chain) {
    if (typeof c === 'string') {
      [lastOf, prevMain, prevW] = [{ q1: null, q2: null }, null, null];
      continue;
    }
    if ('state' in c) {
      for (const role of ['q1', 'q2'] as const)
        lastOf[role] = slotDose(c.state, role) ?? lastOf[role];
      [prevMain, prevW] = [null, null];
      continue;
    }
    const b = c;
    // Pouka 35: broj dana kvaliteta — ista funkcija kao konstruktor (week.secondQualityEasy).
    const secondEasy = nq === 2 && !intro(b) && b.notes.some((n) => n.includes(SECOND_EASY_NOTE));
    if (nq === 2 && !intro(b)) {
      const first = b.days.find((d) => d.role === 'q1' || d.role === 'test')?.workout ?? null;
      const q2d = b.days.find((d) => d.role === 'q2')?.workout ?? null;
      const roll = rollingLongCap10(b.index, longsAll10, recentJ);
      const decide = (w2: Workout): boolean =>
        !!first &&
        secondQualityEasy(dlOf(b), to10(b.targetKm), pat.easy.length, roll, first, w2) !== null;
      if (q2d && decide(q2d))
        err(
          'SECOND_QUALITY',
          'Sa dva dana kvaliteta dugi nije najduži trening nedelje — drugi dan kvaliteta je lagan (pouka 35).',
          b.index
        );
      if (secondEasy) {
        const prev = lastOf.q2;
        const st = prev
          ? { ladder: prev.ladder as LadderId, doseM: prev.doseM, structure: prev.structure }
          : null;
        const lim = limitOf(b).q2(slotDose(b, 'q1'));
        const pickQ2 = (drop: boolean) =>
          pickSlot(st, ladderFor(b.phase, 'q2'), b.targetKm, pw(b), drop, false, false, lim);
        const cand = pickQ2(false) ?? pickQ2(true);
        if (q2d || !cand || !decide(qualityWorkout(cand, pw(b), wcQ, feelW(b))))
          err(
            'SECOND_QUALITY',
            'Drugi dan kvaliteta lagan bez razloga: sa njim bi dugi ostao najduži (pouka 35).',
            b.index
          );
      }
    }
    // A2/A3/A8: u adaptiranoj nedelji sa manjim ciljem od nedelje poređenja doza sme da padne sa obimom; pouka 35:
    // nedelja bez drugog dana kvaliteta.
    let dropped =
      secondEasy ||
      (b.index >= firstAdapted && prevMain !== null && to10(b.targetKm) < to10(prevMain.targetKm));
    for (const role of ['q1', 'q2'] as const) {
      const da = lastOf[role];
      const db = slotDose(b, role);
      if (db) lastOf[role] = db;
      if (!db) continue;
      if (db.step === 'drop') {
        dropped = true;
        const ladder = db.ladder as LadderId;
        const cap = capM(db.zone, b.targetKm);
        if (da && da.doseM > cap) {
          // Pouka 12: H11 ispred H12 samo u nedelji ograničenoj kapacitetom — prethodna doza ne staje u
          // plafon ove nedelje, najviši nivo lestvice u plafonu, uz napomenu.
          // Pouka 32: najviši nivo u oba člana plafona zone.
          const best = ladderLevels(ladder, role === 'q1' && B)
            .filter((x) => doseOf(x) <= cap && fit(b, role, ladder, x) === 'fits')
            .map(doseOf)
            .pop();
          if (db.doseM !== best || !b.notes.some((n) => n.includes('spušten sa')))
            err('DOSE_DROP', `${role}: spuštanje doze bez razloga iz plafona (H11/H12).`, b.index);
          else
            warn(
              'DOSE_DROPPED',
              `${role}: doza spuštena ${da.doseM} → ${db.doseM} m (plafon, nijedan cilj nije izvodljiv bez toga).`,
              b.index
            );
          continue;
        }
        // Pouka 32: pad doze kao kapacitet — doza staje u oba člana plafona zone, a sledeći nivo lestvice ne
        // staje (najviši takav nivo), uz napomenu.
        const nl = nextLevel(ladder, db.doseM, role === 'q1' && B);
        if (
          db.doseM > cap ||
          fit(b, role, ladder, db.structure) !== 'fits' ||
          (nl !== null && doseOf(nl) <= cap && fit(b, role, ladder, nl) === 'fits') ||
          !b.notes.some((n) => n.includes('pouka 32, plafon zone'))
        )
          err(
            'DOSE_DROP',
            `${role}: spuštanje doze bez razloga iz plafona zone (pouka 32: najviši nivo čiji dan nije duži od dugog).`,
            b.index
          );
        else
          warn(
            'DOSE_DROPPED',
            `${role}: doza ${db.doseM} m${da ? ` (bilo ${da.doseM} m)` : ''} — viša bi dan kvaliteta učinila dužim od dugog (pouka 32).`,
            b.index
          );
        continue;
      }
      if (!da) continue;
      if (da.ladder === db.ladder) {
        const ladder = db.ladder as LadderId;
        const nl = nextLevel(ladder, da.doseM, B);
        if (db.doseM < da.doseM)
          err('DOSE_DECREASE', `${role}: doza ${db.doseM} m < ${da.doseM} m (H12).`, b.index);
        else if (db.doseM > da.doseM && (!nl || db.doseM !== doseOf(nl)))
          err(
            'DOSE_JUMP',
            `${role}: više od jednog nivoa (${da.doseM} → ${db.doseM} m) (H12).`,
            b.index
          );
        else if (db.doseM === da.doseM) {
          if (nl && doseOf(nl) <= capM(db.zone, b.targetKm) && fit(b, role, ladder, nl) !== 'over')
            err(
              'DOSE_STALL',
              `${role}: sledeći nivo ${doseOf(nl)} m staje u plafon, a nije uzet (H12).`,
              b.index
            );
          // Pouka 32: druga struktura koja ne staje u trajanje dugog se ne računa.
          const others = structuresForDose(ladder, da.doseM).some(
            (x) => !sameStructure(x, da.structure) && fit(b, role, ladder, x) !== 'over'
          );
          if (sameStructure(da.structure, db.structure) && others)
            err(
              'SLOT_REPEAT',
              `${role}: ista doza iste strukture, a druga struktura postoji (H12).`,
              b.index
            );
        }
      } else if (carries(da.ladder as LadderId, db.ladder as LadderId) && db.doseM < da.doseM)
        err(
          'TRANSITION_DOSE',
          `${role}: ${db.ladder} ${db.doseM} m < poslednje ${da.ladder} ${da.doseM} m (H12).`,
          b.index
        );
    }
    // H16/H17: nedelja testa i uvoda ne ulaze u poređenje glavne doze.
    const counted = !b.test && !intro(b);
    if (counted && prevMain && mainDoseM(b) < mainDoseM(prevMain) && !dropped)
      err(
        'MAIN_DOSE_DECREASE',
        `Glavna doza ${mainDoseM(b)} m < ${mainDoseM(prevMain)} m (H12, pouka 3).`,
        b.index
      );
    if (counted) prevMain = b;
    if (prevW) {
      const repeat = (['q1', 'q2'] as const).some((r) => slotDose(b, r)?.step === 'repeat');
      if (hasQuality(b) && qualityKey(prevW) === qualityKey(b)) {
        if (!(repeat && b.notes.some((n) => n.includes('ponovljen'))))
          err('IDENTICAL_WEEKS', `Isti kvalitet kao nedelja ${prevW.index} (H12).`, b.index);
        else {
          // Faza 4a N10.1 (MASTER pouka 32, kao maraton): ponavljanje doze je upozorenje kad za svaki slot ni druga
          // struktura iste doze ni sledeći nivo ne staju u plafon zone (oba člana, ista funkcija kao konstruktor).
          const inCap = (role: 'q1' | 'q2', lad: LadderId, x: Structure, zone: WorkZone): boolean =>
            doseOf(x) <= capM(zone, b.targetKm) && fit(b, role, lad, x) !== 'over';
          const forced = (['q1', 'q2'] as const)
            .filter((r) => slotDose(b, r))
            .every((r) => {
              const d = slotDose(b, r)!;
              const lad = d.ladder as LadderId;
              const nl = nextLevel(lad, d.doseM, r === 'q1' && B);
              return (
                !structuresForDose(lad, d.doseM).some(
                  (x) => !sameStructure(x, d.structure) && inCap(r, lad, x, d.zone)
                ) && !(nl && inCap(r, lad, nl, d.zone))
              );
            });
          if (forced)
            warn(
              'IDENTICAL_WEEKS',
              `Isti kvalitet kao nedelja ${prevW.index}: druga struktura iste doze i sledeći nivo ne staju u plafon zone (pouka 32, H10).`,
              b.index
            );
        }
      }
      // Baza bez platoa (pouka 3): T slota (Q2; 3 dana Q1) raste ili, kad sledeći nivo ne staje, menja
      // strukturu.
      if (prevW.phase === 'base' && b.phase === 'base' && !dropped) {
        const ta = slotDose(prevW, dSlot);
        const tb = slotDose(b, dSlot);
        if (ta && tb) {
          const tl = ta.ladder as LadderId;
          const nl = nextLevel(tl, ta.doseM, B);
          const blocked =
            !nl || doseOf(nl) > capM('T', b.targetKm) || fit(b, dSlot, tl, nl) === 'over';
          // HI10: doza bez druge strukture (T 1,5 km) sme da se ponovi kad sledeći nivo ne staje; pouka 32:
          // druga struktura koja ne staje u trajanje dugog se ne računa.
          const only = !structuresForDose(tl, ta.doseM).some(
            (x) => !sameStructure(x, ta.structure) && fit(b, dSlot, tl, x) !== 'over'
          );
          if (!(
            tb.doseM > ta.doseM ||
            (blocked && (!sameStructure(ta.structure, tb.structure) || only))
          ))
            err(
              'BASE_PLATEAU',
              `Baza: T doza ${tb.doseM} m bez rasta ili druge strukture (H12).`,
              b.index
            );
        }
      }
    }
    prevW = b;
  }

  // --- H12: početni nivo (prva nedelja slota; I i RP na prvoj nedelji nove zone; RP ≥ poslednje I).
  let lastWeek: Record<'q1' | 'q2', PlanWeek | null> = { q1: null, q2: null };
  for (const c of chain) {
    if (c === 'restart') lastWeek = { q1: null, q2: null };
    if (typeof c === 'string') continue;
    if ('state' in c) {
      for (const role of ['q1', 'q2'] as const)
        if (slotDose(c.state, role)) lastWeek[role] = c.state;
      continue;
    }
    const b = c;
    for (const role of ['q1', 'q2'] as const) {
      const db = slotDose(b, role);
      if (!db) continue;
      const a = lastWeek[role];
      lastWeek[role] = b;
      if ((a && a.phase === b.phase) || db.step === 'drop') continue;
      const ladder = db.ladder as LadderId;
      const da = a ? slotDose(a, role) : null;
      const carry = da !== null && carries(da.ladder as LadderId, ladder);
      if (da && (da.ladder === ladder || (carry && zoneOf(da.ladder) === zoneOf(ladder)))) continue;
      const st = startLevel(ladder, b.targetKm, B);
      let want = st ? doseOf(st) : NaN;
      if (da && carry) {
        const lv = structuresOfLadder(ladder, B).find((m) => m >= Math.max(want, da.doseM));
        if (lv === undefined || lv > capM(zoneOf(ladder), b.targetKm)) continue;
        want = lv;
      }
      if (db.doseM !== want)
        err(
          'START_LEVEL',
          `${role}: početni nivo ${ladder} ${db.doseM} m ≠ ${want} m (${B ? 'prvi nivo, HI10' : '≤ 60 % plafona, H12'}).`,
          b.index
        );
    }
  }

  // --- H5 sadržaj rasterećenja i H7 taper: doza iz stanja poslednje ne-rasteretne izgradnje (ista
  // funkcija kao konstruktor), dugi 0,8 × poslednji / ≤ 0,6 × najduži. H16: rasterećenje sa testom; HI13:
  // rasterećenje u uvodu bez kvaliteta; HI10: početnik (min T 1,5 km, taper T kad RP ne staje). Segment 04:
  // stanje doze menjaju samo nedelje izgradnje bez ograničenja kvaliteta (A4/A9), iz upisanih dana (pouka 29,
  // isto kao konstruktor); nov start i nedelja posle sidra bola ga brišu; ograničenje 'none' → bez kvaliteta,
  // 'one' → jedan kvalitet (rasterećenje: T doza H5, i na drugom danu kvaliteta kad je dan slota u zabrani;
  // taper: samo RP); izgradnja sa ograničenjem: najviše 1 kvalitet doze rasterećenja (ONE_QUALITY).
  // Pouka 34: početno stanje (umor pre starta: nedelja 1 generatora) — ista funkcija kao konstruktor.
  const init = initialState(steps);
  let state: QualityState = init.quality;
  let lastLong10: number | null = init.lastLong10;
  /** Faza 4a N11: skraćen dugi rasterećenja (HI14) — upozorenje jednom po planu. */
  const shortened: { w: number; long10: number; want10: number }[] = [];
  const same = (x: Dose | null, y: Dose): boolean =>
    !!x && x.doseM === y.doseM && sameStructure(x.structure, y.structure);
  const otherSlot = (r: 'q1' | 'q2'): 'q1' | 'q2' => (r === 'q1' ? 'q2' : 'q1');
  const qDaysN = nq;
  for (const w of weeks) {
    if (doseRestarts.has(w.index)) state = INITIAL_QUALITY;
    const long = w.days.find((d) => d.role === 'long');
    const pk = pw(w);
    const rest = restOf(w);
    const capLong = limitLongOf(w, pat, pk);
    const hurtLong = long !== undefined && painOf(w).has(long.date);
    if (w.deload && lastLong10 !== null && checked(w)) {
      const roll10 = rollingLongCap10(w.index, longsAll10, recentJ);
      // H11 na dozi po pravilu; drugi član plafona zone (pouka 32) — ista funkcija kao konstruktor.
      const want0 = deloadDose(state, w.phase, rule);
      const want =
        !w.test && !intro(w) && want0.doseM <= capM('T', w.targetKm)
          ? deloadDose(
              state,
              w.phase,
              rule,
              deloadDayLimit(
                dlOf(w),
                to10(w.targetKm),
                input.runDays.length - 2,
                lastLong10,
                roll10,
                capLong
              )
            )
          : want0;
      const t =
        slotDose(w, dSlot) ?? (reducedQ(w) && nq === 2 ? slotDose(w, otherSlot(dSlot)) : null);
      const nQuality = w.days.filter((d) => d.workout.kind === 'quality').length;
      const nTest = w.days.filter((d) => d.workout.kind === 'test').length;
      const want10 = Math.min(
        deloadLong10(lastLong10, adaptedW(w)),
        longCap10(to10(w.targetKm), rule, pk, roll10)
      );
      // HI14: dužine rasterećenja — ista funkcija kao konstruktor (dugi ≤ 0,8 ×, skraćen kad lagani ne bi bili
      // ≥ 4 km); kvalitet otpada samo kad ni uz skraćen dugi ne staje. Broj dana iz šablona (pre dana
      // odmora/bola, A4).
      const nRuns = input.runDays.length - 1;
      const last10 = lastLong10;
      const testDay = w.days.find((d) => d.workout.kind === 'test');
      // Pouka 32: u nedelji testa dugi naviše do trajanja dana testa (ista funkcija dužina).
      const minLong10 = testDay ? longFor10(testDay.workout.sec, pk) : 0;
      const lenWith = (km: number, nEasy: number) =>
        deloadLengths(
          to10(w.targetKm),
          to100(km),
          nEasy,
          last10,
          rule,
          pk,
          roll10,
          minLong10,
          adaptedW(w)
        );
      const tFits = want.doseM <= capM('T', w.targetKm);
      if (noneQ(w)) {
        if (nQuality !== 0 || nTest !== 0)
          err('DELOAD_CONTENT', 'Rasterećenje bez kvaliteta (adaptacija, A3/A4/A9).', w.index);
      } else if (w.test || intro(w)) {
        if (nQuality !== 0)
          err(
            'DELOAD_CONTENT',
            w.test
              ? 'Rasterećenje sa testom: test umesto kvaliteta (H16).'
              : 'Rasterećenje u uvodu: bez kvaliteta (HI13).',
            w.index
          );
      } else if (!tFits) {
        if (nQuality !== 0 || !w.notes.some((n) => n.includes('bez kvaliteta')))
          err(
            'DELOAD_CONTENT',
            `Rasterećenje: T ${want.doseM} m > plafon → bez kvaliteta, uz napomenu (H11 ispred H5).`,
            w.index
          );
        else warn('DELOAD_NO_QUALITY', `Rasterećenje bez kvaliteta: T ${want.doseM} m.`, w.index);
      } else if (
        nQuality === 0 &&
        lenWith(qualityWorkout(want, pk, wc, feelW(w)).km, nRuns - 1) === null &&
        deloadEasyShort(
          to10(w.targetKm),
          to100(qualityWorkout(want, pk, wc, feelW(w)).km),
          nRuns - 1,
          last10,
          rule,
          pk,
          roll10,
          adaptedW(w)
        )
      ) {
        if (!w.notes.some((n) => n.includes('ni uz skraćen dugi')))
          err('DELOAD_CONTENT', 'Rasterećenje bez kvaliteta (HI14) bez napomene.', w.index);
        else
          warn(
            'DELOAD_NO_QUALITY',
            `Rasterećenje bez kvaliteta: ni uz skraćen dugi T ${want.doseM} m ne ostavlja lagane ≥ ${P.lengths.easyMinKm} km (HI14).`,
            w.index
          );
      } else if (nQuality !== 1 || !same(t, want))
        err(
          'DELOAD_CONTENT',
          `Rasterećenje: 1 kvalitet T ${want.doseM} m (≈ 60 % poslednje T doze, min ${B ? P.beginner.tFirstKm : P.deload.tMinKm} km) (H5${B ? ', HI10' : ''}).`,
          w.index
        );
      if (long && !hurtLong) {
        const dayKm = testDay
          ? testDay.workout.km
          : w.days
              .filter((d) => d.workout.kind === 'quality')
              .reduce((a, d) => a + d.workout.km, 0);
        const len = lenWith(dayKm, nRuns - (nQuality + nTest > 0 ? 1 : 0));
        const exp10 = len ? len.long10 : want10;
        if (to10(long.workout.km) !== exp10)
          err(
            'DELOAD_LONG',
            `Dugi rasterećenja ${long.workout.km} km ≠ ${exp10 / 10} km (0,8 × poslednji, H5; skraćen samo da lagani ostanu ≥ 4 km, HI14).`,
            w.index
          );
        else if (exp10 > want10) {
          if (!w.notes.some((n) => n.includes('podignut')))
            err(
              'DELOAD_LONG',
              'Podignut dugi rasterećenja sa testom bez napomene (pouka 32).',
              w.index
            );
        } else if (exp10 < want10) {
          if (!w.notes.some((n) => n.includes('kraćen')))
            err('DELOAD_LONG', 'Skraćen dugi rasterećenja bez napomene (HI14).', w.index);
          if (w.test)
            warn(
              'TEST_DELOAD_LONG',
              `Rasterećenje sa testom: dugi ${exp10 / 10} km < 0,8 × poslednji (${want10 / 10} km) da lagani ostanu ≥ ${P.lengths.easyMinKm} km (H16 ispred H5, HI11).`,
              w.index
            );
          else shortened.push({ w: w.index, long10: exp10, want10 });
        }
      }
      if (
        w.days.filter((d) => d.role === 'easy').length !==
        input.runDays.length - rest.size - (long ? 1 : 0) - nQuality - nTest
      )
        err('DELOAD_CONTENT', 'Rasterećenje: ostali dani su lagani (H5).', w.index);
    }
    if (w.phase === 'taper' && checked(w)) {
      // H11 na dozama po pravilu; drugi član plafona zone (pouka 32) — ista funkcija kao konstruktor. A4/A9
      // ('one'): samo RP (početnik T) i na drugom danu kvaliteta kad je dan Q1 u zabrani.
      const one = reducedQ(w) && !noneQ(w);
      const nqT: 1 | 2 = one ? 1 : nq;
      // Pouka 32: „samo RP" (druga pretraga) — drugi član za nedelju sa jednim danom kvaliteta (konstruktor).
      const rpOnly = nq === 2 && !slotDose(w, 'q2') && w.notes.some((n) => n.includes('samo RP'));
      const kept: 1 | 2 = rpOnly ? 1 : nqT;
      // H7 (pouka 24): najduži dugi pre tapera — ista funkcija kao konstruktor (lengths.longestLong10).
      const longest10 = longestLong10(weeks.slice(0, w.index - 1));
      const tl = taperDayLimit(
        dlOf(w),
        to10(w.targetKm),
        qDaysN - kept + pat.easy.length,
        longest10,
        rollingLongCap10(w.index, longsAll10, recentJ),
        kept,
        capLong
      );
      const want0 = taperDoses(state, nqT);
      const want = taperDoses(state, nqT, tl);
      let rp = slotDose(w, 'q1');
      let t = slotDose(w, 'q2');
      if (one && !rp && t) [rp, t] = [t, null];
      const rpFits = want0.q1.doseM <= capM('RP', w.targetKm);
      // HI10: početnik — RP ne staje → T kontinuirano ≈ 60 % poslednje T doze (min 1,5 km).
      const bt0 = B && !rpFits ? beginnerTaperT(state) : null;
      const bt = bt0 && bt0.doseM <= capM('T', w.targetKm) ? beginnerTaperT(state, tl.q1) : null;
      if (noneQ(w)) {
        if (rp || t) err('TAPER_QUALITY', 'Taper bez kvaliteta (adaptacija, A3/A4/A9).', w.index);
      } else if (bt) {
        if (!same(rp, bt) || t)
          err(
            'TAPER_QUALITY',
            `Taper početnika: RP ne staje → T ${bt.doseM} m kontinuirano (≈ 60 % poslednje T doze, HI10).`,
            w.index
          );
      } else if (!rpFits) {
        if (rp || t || !w.notes.some((n) => n.includes('bez kvaliteta')))
          err(
            'TAPER_QUALITY',
            `Taper: RP ${want0.q1.doseM} m > plafon → bez kvaliteta, uz napomenu (H11 ispred H7).`,
            w.index
          );
        else warn('TAPER_NO_QUALITY', `Taper bez kvaliteta: RP ${want0.q1.doseM} m.`, w.index);
      } else if (!same(rp, want.q1))
        err('TAPER_QUALITY', `Taper: RP ${want.q1.doseM} m (≈ 60 % poslednje doze) (H7).`, w.index);
      else if (want.q2 === null) {
        if (t)
          err(
            'TAPER_QUALITY',
            'Taper sa jednim kvalitetom: samo RP (jedan kvalitetni dan, HI6, A4/A9).',
            w.index
          );
      } else if (!t) {
        if (!w.notes.some((n) => n.includes('samo RP')))
          err('TAPER_QUALITY', `Taper: T ${want.q2.doseM} m (H7).`, w.index);
        else
          warn(
            'TAPER_RP_ONLY',
            'Taper samo sa RP: sa RP i T nijedan cilj nije izvodljiv.',
            w.index
          );
      } else if (!same(t, want.q2))
        err('TAPER_QUALITY', `Taper: T ${want.q2.doseM} m (≈ 60 % poslednje doze) (H7).`, w.index);
      if (long && to10(long.workout.km) > taperLongCap10(longest10))
        err(
          'TAPER_LONG',
          `Dugi tapera ${long.workout.km} km > 0,6 × najduži ${longest10 / 10} km (H7).`,
          w.index
        );
      if (w.days.length !== input.runDays.length - rest.size)
        err(
          'TAPER_DAYS',
          `Taper zadržava svih ${input.runDays.length} dana trčanja (H7).`,
          w.index
        );
    }
    // A4/A9: doza ne raste u nedelji izgradnje sa ograničenjem — najviše 1 kvalitet doze rasterećenja (T ≈ 60 %
    // poslednje doze slota, lestvica rasterećenja faze, drugi član plafona) ili bez kvaliteta.
    if (isSteady(w) && checked(w) && reducedQ(w) && !w.test && !intro(w)) {
      const qs = w.days.filter((d) => d.workout.kind === 'quality');
      const roll10 = rollingLongCap10(w.index, longsAll10, recentJ);
      const want = deloadDose(
        state,
        w.phase,
        rule,
        oneDayLimit(dlOf(w), to10(w.targetKm), input.runDays.length - 2, roll10, capLong)
      );
      const dose = qs[0]?.workout.dose;
      if (
        qs.length > (noneQ(w) ? 0 : 1) ||
        (dose &&
          (dose.ladder !== deloadLadder(w.phase) ||
            dose.doseM > capM('T', w.targetKm) ||
            !same(dose, want)))
      )
        err(
          'ONE_QUALITY',
          `Nedelja sa ograničenjem: najviše 1 kvalitet doze rasterećenja T ${want.doseM} m (A4, A9).`,
          w.index
        );
    }
    if (isSteady(w)) {
      if (long) lastLong10 = to10(long.workout.km);
      // Slot bez treninga (test, uvod) zadržava stanje pre nedelje (H16); t = poslednja T doza (HI10). Pouka 29:
      // iz upisanih dana i u mešovitoj nedelji; pouka 24: ista funkcija kao konstruktor (quality.advance).
      if (!reducedQ(w)) state = advance({ q1: slotDose(w, 'q1'), q2: slotDose(w, 'q2') }, state);
    }
  }

  if (shortened.length > 0)
    warn(
      'DELOAD_LONG_SHORTENED',
      `Rasterećenje: dugi kraći od 0,8 × poslednji da lagani ostanu ≥ ${P.lengths.easyMinKm} km (najmanji obim, HI14) — ${shortened.map((x) => `ned ${x.w}: ${fmtKm(x.long10 / 10)} < ${fmtKm(x.want10 / 10)} km`).join('; ')}.`,
      shortened[0]!.w
    );

  // --- H8 trkačka nedelja (pouka 5).
  const rw = weeks[N - 1]!;
  const taperW = weeks.find((w) => w.phase === 'taper');
  // Segment 04: mešovita trkačka nedelja — samo dan trke; mešovit taper — provere zavisne od tapera se
  // preskaču; dani odmora (A4) otpadaju; pouka 30 (raceWeekRest, isti podatak kao konstrukcija).
  const taperOk = !taperW || checked(taperW);
  const pr = pw(rw);
  const midR = midEasy(pr);
  if (rw.phase === 'race' && !checked(rw)) {
    const rd = rw.days.find((d) => d.role === 'race');
    if (!rd || rd.date !== input.raceDate || rd.countsToWeek)
      err('RACE_DAY', 'Trka je jednom, na dan trke, van obima (H8).', rw.index);
  } else if (rw.phase === 'race') {
    const q = P.raceWeek;
    const race = input.raceDate;
    const races = weeks.flatMap((w) => w.days.filter((d) => d.role === 'race'));
    const rd = rw.days.find((d) => d.role === 'race');
    if (races.length !== 1 || !rd || rd.date !== race)
      err('RACE_DAY', 'Trka je jednom, na dan trke.', rw.index);
    if (rd) {
      const k = rd.workout.segments;
      const raceSeg = k.find((x) => x.kind === 'race');
      if (
        rd.countsToWeek ||
        !raceSeg ||
        raceSeg.km !== q.raceKm ||
        raceSeg.sec !== raceTimeForVdot(pr.vdot, P.paces.raceDistanceM) ||
        k[0]?.kind !== 'warmup' ||
        k[0].sec !== q.raceWarmupSec ||
        k[k.length - 1]?.kind !== 'cooldown' ||
        k[k.length - 1]!.sec !== q.raceCooldownSec
      )
        err(
          'RACE_DAY',
          `Trka: ${q.raceKm} km + WU ${q.raceWarmupSec / 60} + CD ${q.raceCooldownSec / 60} min, van obima (H8).`,
          rw.index,
          rd.date
        );
    }
    // Dani: min(broj dana, 5) sa trkom; otpada prvo dan dugog, pa najraniji lagan (ista funkcija).
    const restR = restOf(rw);
    const runsR = raceWeekRuns(input.runDays, pat, rw, race).filter((d) => !restR.has(d));
    const others = rw.days.filter((d) => d.role !== 'race');
    const taperEasy0 = (taperW?.days ?? [])
      .filter((d) => d.role === 'easy')
      .map((d) => to10(d.workout.km));
    // Pouka 29/30: taper kakav je upisan (i mešovit) — isto što čita konstruktor.
    const restP30 =
      steps.length > 0 && taperW && !others.some((d) => d.role === 'sharpener')
        ? raceWeekRest(
            runsR,
            race,
            painOf(rw),
            taperEasy0.length > 0 ? Math.min(...taperEasy0) : Infinity,
            pr,
            to100(taperW.plannedKm)
          )
        : [];
    const wantDays = runsR.filter((d) => !restP30.includes(d));
    if (JSON.stringify(others.map((d) => d.date).sort()) !== JSON.stringify(wantDays))
      err(
        'RACE_WEEK',
        `Trkačka nedelja: dani ${others.map((d) => d.weekday).join(', ')} ≠ H8 (${wantDays.map(weekdayOf).join(', ')}).`,
        rw.index
      );
    const sharp = others.filter((d) => d.role === 'sharpener');
    const taperRpM =
      taperW?.days.map((d) => d.workout.dose).find((x) => x?.zone === 'RP')?.doseM ?? 0;
    const prevHard = N > 1 ? (weeks[N - 2]!.days.filter((d) => d.hard).pop()?.date ?? null) : null;
    const bannedR = new Set(rw.limits?.noQuality ?? []);
    const sd = sharpenerAllowed(taperRpM) ? sharpenerDate(wantDays, race, prevHard, bannedR) : null;
    const s0 = sharp[0];
    const st = s0?.workout.dose?.structure;
    const a9 = rw.notes.some((n) => n.includes('(A9, pouka 5)'));
    if (s0 && bannedR.has(s0.date))
      err('LIMITS', 'Oštrenje na dan zabrane kvaliteta (A3/A4).', rw.index, s0.date);
    if (!taperOk) {
      // Mešovit taper: oštrenje i lagani trkačke nedelje zavise od konstruisanog tapera.
    } else if (sd === null || (a9 && sharp.length === 0)) {
      if (sharp.length > 0)
        err(
          'RACE_SHARPENER',
          'Oštrenje bez dana ≥ 3 dana pre trke ili bez RP u taperu (H8).',
          rw.index
        );
    } else if (
      sharp.length !== 1 ||
      !s0 ||
      s0.date !== sd ||
      !st ||
      st.form !== 'reps' ||
      st.reps !== q.sharpener.reps ||
      st.repM !== q.sharpener.repM ||
      daysBetween(s0.date, race) < q.sharpenerMinGapDays ||
      s0.workout.segments.some((x) => x.kind === 'recovery' && x.sec !== q.sharpener.recoverySec)
    )
      err(
        'RACE_SHARPENER',
        `Oštrenje: ${q.sharpener.reps} × ${q.sharpener.repM} m RP (2:00, ≤ RP doza tapera ${taperRpM} m) na najkasnijem danu ≥ ${q.sharpenerMinGapDays} dana pre trke (H8).`,
        rw.index
      );
    if (s0 && s0.workout.dose && s0.workout.dose.doseM > taperRpM)
      err('RACE_SHARPENER', 'Oštrenje > RP doza tapera (H8, pouka 5).', rw.index);
    // Ostali dani: dan pred trku 20 min E + 4 × 20 s (≤ 30 min); ostali min(35 min E, najkraći lagan tapera).
    const taperEasy = (taperW?.days ?? [])
      .filter((d) => d.role === 'easy')
      .map((d) => to10(d.workout.km));
    const easyCap10 = taperEasy.length > 0 ? Math.min(...taperEasy) : Infinity;
    const easyByKm = easyCap10 * 10 < Math.round((q.otherEasySec * 100) / midR);
    const painR = painOf(rw);
    for (const d of others) {
      if (d.role === 'sharpener') continue;
      const gap = daysBetween(d.date, race);
      const segs = d.workout.segments;
      const hurt = painR.has(d.date);
      if (gap === 1) {
        const strides = segs.filter((x) => x.kind === 'stride');
        const easy = segs.filter((x) => x.kind === 'easy');
        if (
          d.role !== 'eve' ||
          d.workout.sec > q.eveMaxSec ||
          easy.length !== 1 ||
          easy[0]!.sec !== q.eveEasySec ||
          strides.length !== (hurt ? 0 : q.eveStrides.reps) ||
          strides.some((x) => x.sec !== q.eveStrides.sec)
        )
          err('RACE_EVE', 'Dan pred trku: 20 min E + 4 × 20 s, ≤ 30 min (H8).', rw.index, d.date);
      } else if (
        d.role !== 'easy' ||
        segs.length !== 1 ||
        segs[0]!.zone !== 'E' ||
        (!hurt &&
          taperOk &&
          (easyByKm ? to100(segs[0]!.km) !== easyCap10 * 10 : segs[0]!.sec !== q.otherEasySec))
      )
        err(
          'RACE_WEEK_EASY',
          easyByKm
            ? `Ostali dani trkačke nedelje: ${easyCap10 / 10} km E = najkraći lagan tapera (H8).`
            : 'Ostali dani trkačke nedelje: 35 min E (H8).',
          rw.index,
          d.date
        );
    }
    // Pouka 5: trkačka nedelja (bez trke) ≤ taper.
    if (taperW && taperOk && to100(rw.plannedKm) > to100(taperW.plannedKm))
      err(
        'RACE_WEEK_OVER_TAPER',
        `Trkačka nedelja ${rw.plannedKm} km > taper ${taperW.plannedKm} km (H8, pouka 5).`,
        rw.index
      );
    if (to10(rw.targetKm) !== Math.round(to100(rw.plannedKm) / 10))
      err('RACE_WEEK', 'Cilj trkačke nedelje = planirano (H8).', rw.index);
  }

  // --- H6 obim: cilj po pravilu (ista funkcija kao konstruktor), izvodljiv cilj samo uz oznaku i napomenu.
  const start10 = startKm10(input.currentWeeklyKm);
  const cap10 = peakCap10(start10, rule);
  if (to10(plan.startKm) !== start10) err('VOLUME_START', 'Start ≠ trenutni obim (H6).');
  if (to10(plan.peakCapKm) !== cap10)
    err(
      'VOLUME_PEAK',
      B
        ? 'Granica izgradnje početnika ≠ min(1,4×, +15, max nedelje H15) (H17).'
        : 'Granica izgradnje ≠ min(1,4×, +20, max nedelje H15) (H6).'
    );
  // Segment 04: isti rekurent kao konstruktor (volume.adaptNominal10: cilj koraka, povratni rast, vrh od
  // novog starta, taper od vrha posle poslednjeg smanjenja, donja granica); izvodljiv cilj adaptacije samo
  // naniže. Posle mešovite nedelje čiji cilj nije po pravilu provera čeka sledeći cilj koraka.
  const av = steps.length > 0 ? adaptVolume(steps) : null;
  let h = initialAdaptHistory(cap10, initialState(steps).lastBuild10);
  let capacityCut = false;
  let known = true;
  /** Faza 4a N11: nedelje na izvodljivom cilju — upozorenje WEEK_FITTED jednom po planu (zbir). */
  const fittedW: { w: number; dir: 'down' | 'up'; gap10: number }[] = [];
  for (const w of weeks) {
    if (w.phase === 'race') continue;
    if (av) {
      h = enterWeek(h, w, av, rule);
      if (av.reset.has(w.index) && isBuildPhase(w.phase)) known = true;
    }
    const { nominal, downOnly } = av
      ? adaptNominal10(w, h, start10, rule, av)
      : { nominal: nominal10(w, h, start10, cap10, rule), downOnly: false };
    const t10 = to10(w.targetKm);
    if (checked(w) && known) {
      if (to10(w.nominalKm) !== nominal)
        err(
          'VOLUME_RULE',
          `Nominalni cilj ${w.nominalKm} km ≠ ${nominal / 10} km po pravilu (H6, A8).`,
          w.index
        );
      if (t10 === nominal) {
        if (w.fitted !== null)
          err('VOLUME_RULE', 'Oznaka izvodljivog cilja bez promene cilja.', w.index);
      } else if (
        w.fitted === null ||
        (w.fitted === 'down' && t10 > nominal) ||
        (w.fitted === 'up' && t10 < nominal) ||
        (w.fitted === 'up' && (w.deload || w.phase === 'taper' || downOnly)) ||
        !w.notes.some((n) => n.includes('najbliži izvodljiv'))
      )
        err(
          'VOLUME_RULE',
          `Cilj ${w.targetKm} km ≠ ${nominal / 10} km po pravilu, bez oznake (H6).`,
          w.index
        );
      else fittedW.push({ w: w.index, dir: w.fitted, gap10: Math.abs(t10 - nominal) });
    }
    // A3/A8: granica izgradnje od novog starta; povratak sme do nivoa pre smanjenja.
    const capW = av ? h.cap10 : cap10;
    const levelW = av ? av.levelAt(w.index) : null;
    if (checked(w) && isBuildPhase(w.phase) && t10 > capW && !(levelW !== null && t10 <= levelW))
      err(
        'VOLUME_PEAK',
        `Cilj ${w.targetKm} km > granica izgradnje ${capW / 10} km (H6; nov start: A3).`,
        w.index
      );
    if (t10 < weekMin10(rule) && checked(w))
      err(
        'TARGET_FLOOR',
        `Cilj ${w.targetKm} km < minimum nedelje ${rule.weekMinKm} km (A9).`,
        w.index
      );
    if (isSteady(w) && w.fitted === 'down') capacityCut = true;
    h = av ? leaveAdaptWeek(h, w, t10, av) : { ...h, ...leaveWeek(h, w, t10) };
    if (!checked(w) && to10(w.nominalKm) !== nominal) known = false;
  }
  if (to10(plan.peakKm) !== h.peak10) err('VOLUME_PEAK', 'Vrh plana ≠ najveći cilj izgradnje.');
  if (fittedW.length > 0) {
    const part = (dir: 'down' | 'up', what: string): string[] => {
      const xs = fittedW.filter((x) => x.dir === dir);
      return xs.length === 0
        ? []
        : [
            `${xs.length} ned. ${what} za najviše ${fmtKm(Math.max(...xs.map((x) => x.gap10)) / 10)} km`
          ];
    };
    warn(
      'WEEK_FITTED',
      `Izvodljiv cilj umesto cilja po pravilu (H6): ${[...part('down', 'spušteno'), ...part('up', 'podignuto')].join(', ')} (nedelje ${fittedW.map((x) => x.w).join(', ')}).`,
      fittedW[0]!.w
    );
  }
  // Pouka 9 (HI8): nedelja 1 ispod trenutnog obima samo kad je dugi nedelje 1 na apsolutnom plafonu
  // (150 min, 24 km, granica skorašnjeg najdužeg).
  const w1 = weeks[0]!;
  const long1 = w1.days.find((d) => d.role === 'long');
  const abs1 = week1LongCap10(pw(w1), input.recentLongRunKm, rule.longMaxSec);
  if (
    firstAdapted > 1 &&
    to10(w1.targetKm) < start10 &&
    (!long1 || to10(long1.workout.km) !== abs1)
  )
    err(
      'WEEK1_BELOW_START',
      `Nedelja 1 ${w1.targetKm} km < trenutni obim ${plan.startKm} km, a dugi nije na ${abs1 / 10} km (150 min, 24 km, skorašnji najduži; H6, pouka 9, HI8).`,
      1
    );
  if (capacityCut)
    warn(
      'CAPACITY_LIMITED',
      `${capacityMessage(
        input.runDays.length,
        rule,
        capacityLimits(weeks, rule, p, input.recentLongRunKm ?? null)
      )} Vrh ${fmtKm(plan.peakKm)} km umesto do ${fmtKm(plan.peakCapKm)} km (H6).`
    );

  // --- H2 tempo, H3 cilj; H16 plan po osećaju (osnova tempa iz ulaza, bez prognoze i ocene cilja). Segment 04
  // (A1, pouka 16/17): tempo plana = tempo poslednje nedelje; osnova po osećaju do nedelje rezultata, posle
  // 'result'; ocena cilja za nedelje od rezultata do trke; nov start sa < 10 nedelja → „orijentir" (H18).
  if (pace) {
    const pN = pacesAt(pace, steps, N);
    const basisN = basisAt(pace, steps, N);
    if (JSON.stringify(pN) !== JSON.stringify(p) || plan.vdot !== pN.vdot)
      err('PACES', 'Tempo plana ≠ tempo poslednje nedelje iz koraka (A1).');
    const wantBasis = basisN === 'feel' ? 'feel' : pace.kind === 'feel' ? 'result' : undefined;
    if (plan.paceBasis !== wantBasis)
      err('PACE_BASIS', `Osnova tempa ${plan.paceBasis} ≠ ${wantBasis} (H16, A1).`);
    const last = [...steps].reverse().find((x) => x.vdot !== null);
    if (basisN === 'feel') {
      if (plan.predictedHmSec !== null || plan.goal !== null)
        err('PACES', 'Plan po osećaju nema prognozu ni ocenu cilja do rezultata (H16).');
    } else {
      if (plan.predictedHmSec !== raceTimeForVdot(pN.vdot, P.paces.raceDistanceM))
        err('PACES', 'Prognoza polumaratona ≠ VDOT plana (H2, A1).');
      if (input.goalTimeSec) {
        const g = assessGoal(pN.vdot, input.goalTimeSec, last ? N - last.fromWeek + 1 : N);
        const orientation = steps.some((x) => x.orientation);
        if (
          !plan.goal ||
          plan.goal.status !== (orientation ? 'orientation' : g.status) ||
          plan.goal.vdotGap !== g.vdotGap
        )
          err('GOAL', 'Ocena cilja ne odgovara pravilu H3 (A1, A3).');
        else if (plan.goal.status === 'unrealistic') warn('GOAL_UNREALISTIC', g.message);
      } else if (plan.goal) err('GOAL', 'Bez cilja nema ocene (H3).');
    }
  } else {
    if (feel) {
      const easy = input.easyPaceSecPerKm;
      if (plan.paceBasis !== 'feel')
        err('PACE_BASIS', 'Bez pouzdanog rezultata plan je po osećaju (H16).');
      if (easy == null || JSON.stringify(feelPaces(easy)) !== JSON.stringify(p))
        err('PACES', 'Tempo ne odgovara laganom tempu ± 15 s i proceni VDOT-a (H16).');
      if (plan.predictedHmSec !== null || plan.goal !== null)
        err('PACES', 'Plan po osećaju nema prognozu ni ocenu cilja do testa (H16).');
    } else {
      if (plan.paceBasis !== undefined)
        err('PACE_BASIS', 'Plan sa rezultatom nema oznaku osnove tempa (osnova = rezultat, H2).');
      if (
        !res ||
        JSON.stringify(pacesFromVdot(vdotFromResult(res.distanceM, res.timeSec))) !==
          JSON.stringify(p)
      )
        err('PACES', 'Tempo ne odgovara VDOT-u iz rezultata (H2).');
      if (plan.predictedHmSec !== raceTimeForVdot(p.vdot, P.paces.raceDistanceM))
        err('PACES', 'Prognoza polumaratona ≠ VDOT plana (H2).');
    }
    if (plan.vdot !== p.vdot) err('PACES', 'VDOT plana ≠ VDOT tempa (H2).');
    if (feel) {
      // Ocena cilja posle testa (H16).
    } else if (input.goalTimeSec) {
      const g = assessGoal(plan.vdot, input.goalTimeSec, N);
      if (!plan.goal || plan.goal.status !== g.status || plan.goal.vdotGap !== g.vdotGap)
        err('GOAL', 'Ocena cilja ne odgovara pravilu H3.');
      else if (g.status === 'unrealistic') warn('GOAL_UNREALISTIC', g.message);
    } else if (plan.goal) err('GOAL', 'Bez cilja nema ocene (H3).');
  }

  // --- Segment 04 (A3, A4): ograničenja koraka po datumima (i u mešovitim nedeljama; zaključan dan i trka
  // izuzeti) — dan odmora bez treninga; zabrana kvaliteta / bol / odmor → bez kvaliteta, testa i oštrenja;
  // bol → bez ubrzanja.
  const locked = new Set(ad?.lockedDayIds ?? []);
  for (const w of weeks)
    for (const d of w.days) {
      if (steps.length === 0 || locked.has(d.date) || d.role === 'race') continue;
      const inAny = (pick: (x: (typeof steps)[number]) => readonly (DateRange | null)[]): boolean =>
        steps.some((x) => pick(x).some((r) => inRange(d.date, r)));
      if (inAny((x) => [x.rest])) err('LIMITS', 'Trening na dan odmora (A4).', w.index, d.date);
      const hard = d.workout.kind === 'quality' || d.workout.kind === 'test';
      if (hard && inAny((x) => [...x.noQuality, x.pain, x.rest]))
        err('LIMITS', 'Kvalitet ili test na dan zabrane kvaliteta (A3/A4).', w.index, d.date);
      if (inAny((x) => [x.pain]) && d.workout.segments.some((x) => x.kind === 'stride'))
        err('LIMITS', 'Ubrzanja u periodu bola (A4).', w.index, d.date);
    }
  return out;
}

/** Doze nivoa lestvice rastuće [m] (`beginner`: lestvica početnika, HI10). */
const structuresOfLadder = (ladder: LadderId, beginner = false): number[] =>
  ladderLevels(ladder, beginner).map(doseOf);
