/* 2.4.0: konstrukcija nedelje (izdvojeno iz generate.ts): nedelja treninga i trkačka nedelja. Dužine
   dugog/laganih su u lengths.ts, kvalitet u quality.ts — iste funkcije koristi kapacitet (volume.ts). */

import { weekLabel } from './input.ts';
import { addDays, daysBetween, weekdayIndex, weekdayOf } from './dates.ts';
import {
  easyCapKm,
  easyMinKm,
  limitedEasyKm,
  painLongKm,
  splitEasy,
  weekLengths
} from './lengths.ts';
import { FIVE_K_V2_POLICY as P, type Athlete } from './policy.ts';
import { raceWeekSharpener, weekQuality } from './quality.ts';
import { belowTargetShown, kmText } from './text.ts';
import type {
  DayRole,
  PaceModel,
  Pattern,
  PlanDay,
  PlanWeek,
  Reason,
  WeekFrame,
  Weekday,
  Workout
} from './types.ts';
import {
  buildWorkout,
  easyRun,
  longRun,
  qualityBudgets,
  raceDay,
  type WeekDose
} from './workouts.ts';

const r2 = (x: number): number => Math.round(x * 100) / 100;
const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;

function dateOfWeekday(f: WeekFrame, w: Weekday): string {
  const offset = (((weekdayIndex(w) - weekdayIndex(weekdayOf(f.startDate))) % 7) + 7) % 7;
  return addDays(f.startDate, offset);
}

/** Razmak [dana] od dana `w` u nedelji koja počinje `startDate` do trke (isti račun kao konstruktor). */
export function gapOfWeekday(startDate: string, w: Weekday, raceDate: string): number {
  return daysBetween(dateOfWeekday({ startDate } as WeekFrame, w), raceDate);
}

function day(f: WeekFrame, w: Weekday, role: DayRole, workout: Workout): PlanDay {
  return {
    date: dateOfWeekday(f, w),
    weekday: w,
    role,
    hard: role === 'q1' || role === 'q2' || role === 'long' || role === 'race',
    countsToWeek: role !== 'race',
    workout
  };
}

export type WeekResult = { ok: true; week: PlanWeek } | { ok: false; reason: Reason };

/** Rezultat nedelje + doza (ulaz za progresiju sledeće ne-rasteretne nedelje iste faze). */
export type TrainingWeekResult =
  { ok: true; week: PlanWeek; dose: WeekDose | null } | { ok: false; reason: Reason };

/**
 * Nedelja treninga: kvalitet i doza iz weekQuality (quality.ts; `prev` = doza prethodne ne-rasteretne
 * nedelje ISTE faze), dužine dugog i laganih iz weekLengths. 2.2.0: cilj je već ograničen kapacitetom
 * (volume.ts), pa je lagan > dugi samo zaštita: tada lagan = dugi i plannedKm < targetKm (napomena +
 * PLANNED_BELOW_TARGET).
 * 2.5.0: ograničenja adaptacije (f.limits) ulaze u istu konstrukciju: kvalitet (quality.ts), zamena
 * q1 ↔ q2 kad je dan q1 u zabrani, dani odmora se ne prave, na danima bola dugi ≤ 60 min i lagani −30%
 * bez ubrzanja (lengths.ts); cilj nedelje ostaje cilj obima, planirano je zbir dana (napomena).
 */
export function buildTrainingWeek(
  f: WeekFrame,
  target: number,
  pattern0: Pattern,
  p: PaceModel,
  prev: WeekDose | null,
  a: Athlete,
  taperWeeks: number
): TrainingWeekResult {
  const budgets = qualityBudgets(target);
  const L = f.limits;
  const pattern =
    L?.swap && pattern0.q2 ? { ...pattern0, q1: pattern0.q2, q2: pattern0.q1 } : pattern0;
  const s = weekQuality(f, target, p, prev, a, taperWeeks);
  if (!s.ok)
    return {
      ok: false,
      reason: {
        code: 'QUALITY_INFEASIBLE',
        week: f.index,
        message: `Nedelja ${weekLabel(f.index, a.weekOffset)}: ${s.message}`
      }
    };
  const q1 = s.q1;
  // 2.8.1 (MASTER pouka 35): drugi dan kvaliteta postaje lagan kad bi sa dva dana kvaliteta dugi bio kraći od nekog
  // dana kvaliteta (secondQualityEasy — jedino mesto, validator je čita); doza drugog kvaliteta se ne beleži.
  // 5k-v2.12.0 (C11): pouka 35 važi u svim nedeljama osim trkačke (kao HM) — i u taperu i u nedelji sa danima odmora.
  const easySecond =
    q1 !== null &&
    s.q2 !== null &&
    secondQualityEasy(target, q1, s.q2, pattern.easy.length, f.phase, p, a, f.deload) !== null;
  const q2a = easySecond ? null : s.q2;

  const easyDays0: { w: Weekday; stridesOnly: boolean }[] = pattern.easy.map((w) => ({
    w,
    stridesOnly: false
  }));
  if (!q1) easyDays0.push({ w: pattern.q1, stridesOnly: s.stridesOnly });
  if (!q2a && pattern.q2) easyDays0.push({ w: pattern.q2, stridesOnly: false });
  const t1Off = easyVsLongOff(f, a.beginner);
  const lengthsOf = (qs: readonly (Workout | null)[]) =>
    weekLengths(
      target,
      qs.reduce((x, w) => x + (w ? w.km : 0), 0),
      easyDays0.length,
      f.phase,
      p,
      a,
      t1Off
    );
  // 5k-v2.12.0 (T2): dan kvaliteta duži od dugog → zagrevanje/hlađenje na najnižem pojasu (qualityWarmupMin), dužine
  // jednom ponovo (oslobođeni km idu u lagane dane); i dalje duži → upozorenje LONG_SHORTER_THAN_QUALITY (validator).
  const wuMin = qualityWarmupMin(f.phase, [q1, q2a], longRun(lengthsOf([q1, q2a]).longKm, p).sec);
  const q2 = wuMin && q2a ? withMinWarmup(q2a, p) : q2a;
  const q1m = wuMin && q1 ? withMinWarmup(q1, p) : q1;
  const qualityKm = (q1m ? q1m.km : 0) + (q2 ? q2.km : 0);
  const { longKm, shares, capped: easyCappedAtLong, easyMin } = lengthsOf([q1m, q2]);
  // 5k-v2.12.0 (T1): lagan dan manje (weekLengths) — odmor je prvo dan odmora adaptacije (ionako bez treninga), pa
  // lagan dan uz dugi (dan pre/posle), pa poslednji lagan dan šablona; dan samo sa ubrzanjima poslednji. `easyRest` =
  // broj dana koji su odmor samo zbog ovoga (validator: broj treninga).
  const restSet = new Set(L?.rest ?? []);
  const isRest = (w: Weekday): boolean => restSet.has(dateOfWeekday(f, w));
  const nearLong = (w: Weekday): boolean =>
    Math.abs(daysBetween(dateOfWeekday(f, w), dateOfWeekday(f, pattern.long))) === 1;
  const restOrder = easyDays0
    .map((e, i) => ({ e, i }))
    .sort(
      (x, y) =>
        Number(isRest(y.e.w)) - Number(isRest(x.e.w)) ||
        Number(x.e.stridesOnly) - Number(y.e.stridesOnly) ||
        Number(nearLong(y.e.w)) - Number(nearLong(x.e.w)) ||
        y.i - x.i
    )
    .slice(0, easyDays0.length - shares.length)
    .map(({ e }) => e);
  const easyRest = restOrder.filter((e) => !isRest(e.w)).length;
  const easyDays = easyDays0.filter((e) => !restOrder.includes(e));
  const fixed = qualityKm + longKm;
  if (shares.some((x) => x < easyMin))
    return {
      ok: false,
      reason: {
        code: 'WEEK_INFEASIBLE',
        week: f.index,
        message: `Nedelja ${weekLabel(f.index, a.weekOffset)}: posle kvaliteta (${r2(fixed - longKm)} km) i dugog (${longKm} km) za lagan trk ostaje ${shares.join(' / ')} km < ${easyMin} km.`
      }
    };

  const rest = new Set(L?.rest ?? []);
  const pain = new Set(L?.pain ?? []);
  const on = (w: Weekday, set: Set<string>): boolean => set.has(dateOfWeekday(f, w));
  const longFinal = on(pattern.long, rest)
    ? null
    : on(pattern.long, pain)
      ? painLongKm(longKm, p)
      : longKm;
  const planDays: PlanDay[] = [];
  if (longFinal !== null) planDays.push(day(f, pattern.long, 'long', longRun(longFinal, p)));
  if (q1m) planDays.push(day(f, pattern.q1, 'q1', q1m));
  if (q2 && pattern.q2) planDays.push(day(f, pattern.q2, 'q2', q2));
  const so = P.quality.deloadSubstitute.stridesOnly;
  let stridesOnly = false;
  easyDays.forEach((e, i) => {
    if (on(e.w, rest)) return;
    const hurt = on(e.w, pain);
    const km = L ? limitedEasyKm(shares[i]!, hurt, longFinal, easyMin) : shares[i]!;
    if (e.stridesOnly && !hurt) stridesOnly = true;
    planDays.push(
      day(
        f,
        e.w,
        'easy',
        e.stridesOnly && !hurt
          ? easyRun(km, p, true, so)
          : easyRun(km, p, s.easyStrides && !s.stridesOnly && !hurt)
      )
    );
  });
  planDays.sort((a, b) => a.date.localeCompare(b.date));
  const plannedKm = r2(planDays.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0));
  const notes = [...s.notes];
  if (easySecond) notes.push(`Dugi ostaje najduži trening nedelje: ${SECOND_EASY_NOTE}.`);
  if (wuMin)
    notes.push(
      'Zagrevanje i hlađenje kvaliteta skraćeni na najmanje: dan kvaliteta bi trajao duže od dugog trčanja.'
    );
  if (easyRest > 0)
    notes.push(
      `Lagan dan manje (${easyRest}): lagan trening od bar ${kmText(easyMin)} km ne staje uz dugi ${kmText(longKm)} km.`
    );
  if (easyCappedAtLong && belowTargetShown(plannedKm, target))
    notes.push(
      `Lagan trk najviše ${kmText(easyCapKm(longKm, f.phase, t1Off))} km uz dugi ${kmText(longKm)} km, pa nedelja ima ${kmText(plannedKm)} km umesto ${kmText(target)} km; za pun obim treba više dana trčanja.`
    );
  if (rest.size > 0 || pain.size > 0)
    notes.push(
      `Adaptacija: ${rest.size > 0 ? `${rest.size} dan(a) odmora, ` : ''}${pain.size > 0 ? 'period bola (dugi ≤ 60 min, lagani −30%, bez ubrzanja), ' : ''}planirano najviše ${kmText(target)} km.`
    );
  return {
    ok: true,
    week: {
      ...f,
      targetKm: target,
      plannedKm,
      budgets,
      easyCappedAtLong,
      stridesOnly: L ? stridesOnly : s.stridesOnly && easyDays.some((e) => e.stridesOnly),
      days: planDays,
      notes,
      ...(easyRest > 0 ? { easyRest } : {}),
      ...(wuMin ? { wuMin } : {})
    },
    dose: easySecond && s.dose ? secondEasyDose(s.dose, prev) : s.dose
  };
}

/**
 * 5k-v2.12.0 (T2, kao 10K D25 / HM pouka 32) — JEDINO mesto odluke: u nedelji izgradnje (baza, vrhunac, oštrenje, i
 * rasterećenje) dan kvaliteta sa zagrevanjem/hlađenjem ne traje duže od dugog iste nedelje (`longSec`); kad bi trajao,
 * zagrevanje i hlađenje svih dana kvaliteta idu na najniži pojas (warmup.bands[0]). false i kad su već na najnižem
 * (tada ostaje upozorenje LONG_SHORTER_THAN_QUALITY). Validator čita istu funkciju.
 */
export function qualityWarmupMin(
  phase: WeekFrame['phase'],
  qualities: readonly (Workout | null)[],
  longSec: number
): boolean {
  if (phase !== 'base' && phase !== 'peak' && phase !== 'sharpen') return false;
  const qs = qualities.filter((q): q is Workout => q !== null);
  const min = P.warmup.bands[0];
  return (
    qs.some((q) => q.sec > longSec) &&
    qs.some((q) =>
      q.blocks.some(
        (b) =>
          (b.kind === 'warmup' && b.km > min.warmupKm + 1e-9) ||
          (b.kind === 'cooldown' && b.km > min.cooldownKm + 1e-9)
      )
    )
  );
}

/** 5k-v2.12.0 (T2): isti trening sa zagrevanjem/hlađenjem najnižeg pojasa. */
export function withMinWarmup(w: Workout, p: PaceModel): Workout {
  const min = P.warmup.bands[0];
  return buildWorkout(
    w.kind,
    w.qualityType,
    w.title,
    w.blocks.map((b) =>
      b.kind === 'warmup'
        ? { ...b, km: min.warmupKm }
        : b.kind === 'cooldown'
          ? { ...b, km: min.cooldownKm }
          : b
    ),
    p
  );
}

/**
 * 5k-v2.12.0 (T1) — JEDINO mesto izuzetka pravila „lagan prema dugom" (konstruktor i validator), osim rasterećenja:
 * nedelja sa danima bola/odmora adaptacije (svoje dužine, lengths.limitedEasyKm: dugi ≤ 60 min, lagani −30 %) i uvodne
 * nedelje početnika (samo lagano + ubrzanja; bez izuzetka brz početnik sa malim obimom ostaje na samo dugom).
 */
export function easyVsLongOff(
  f: Pick<WeekFrame, 'deload' | 'index' | 'phase' | 'limits'>,
  beginner: boolean
): boolean {
  return (
    f.deload ||
    (f.limits?.rest?.length ?? 0) > 0 ||
    (f.limits?.pain?.length ?? 0) > 0 ||
    (beginner && f.phase === 'base' && f.index <= P.beginner.introWeeks)
  );
}

/** Pouka 35: oznaka (napomena) nedelje u kojoj je drugi dan kvaliteta lagan — validator je čita. */
/** 5k-v2.11.0 (Z2): bez interne oznake; stari tekst „… lagan (pouka 35)" sadrži ovaj, pa ga validator i dalje prepoznaje. */
export const SECOND_EASY_NOTE = 'drugi dan kvaliteta je lagan';

/**
 * 2.8.1 (MASTER pouka 35) — JEDINO mesto odluke o broju dana kvaliteta nedelje izgradnje: nedelja sa dva dana
 * kvaliteta (`q1`, `q2`) čiji bi neki dan trajao duže od dugog iste nedelje → drugi dan je lagan, prvi ostaje;
 * vraća dužine nedelje sa jednim danom kvaliteta (oslobođen obim: dugi raste, weekLengths). null = dva dana ostaju
 * (dugi je najduži, ili nedelja sa jednim danom nije izvodljiva — lagan < minimuma ili lagan = dugi; validator:
 * upozorenje LONG_SHORTER_THAN_QUALITY, 5k-v2.12.0). Validator čita istu funkciju.
 */
export function secondQualityEasy(
  target: number,
  q1: Workout,
  q2: Workout,
  nEasy: number,
  phase: WeekFrame['phase'],
  p: PaceModel,
  a: Athlete,
  deload = false
): ReturnType<typeof weekLengths> | null {
  const two = weekLengths(target, q1.km + q2.km, nEasy, phase, p, a, deload);
  const long = longRun(two.longKm, p).sec;
  if (q1.sec <= long && q2.sec <= long) return null;
  const one = weekLengths(target, q1.km, nEasy + 1, phase, p, a, deload);
  return one.capped || one.shares.some((x) => x < one.easyMin) ? null : one;
}

/** 2.10.1 (pouka 37): zbir zaštićenih dana — po činjenicama (`factKm`, assess.factKmOf), inače planirani km. JEDINO
    mesto zbira (konstruktor; validator čita rezultat u PlanWeek.protectedKm). */
export function protectedKm(
  kept: readonly PlanDay[],
  factKm?: (d: PlanDay) => number | null
): number {
  return r2(kept.reduce((a, d) => a + (factKm?.(d) ?? (d.countsToWeek ? d.workout.km : 0)), 0));
}

/** Pouka 37: oznaka (napomena) mešovite nedelje čiji su preostali dani sastavljeni na ostatak do cilja. */
/** 5k-v2.11.0 (Z2): oznaka bez interne oznake (ranije „pouka 37" u zagradi). */
export const MIXED_NOTE = 'Mešovita nedelja:';

/** Najkraći lagan dan faze (taper i trkačka: taperMinKm). 5k-v2.12.0 (T1): lengths.easyMinKm (izgradnja bez
    rasterećenja i 20 min). */
export const easyMinOf = (phase: WeekFrame['phase'], p: PaceModel, deload = false): number =>
  easyMinKm(phase, p, deload);

/**
 * 2.10.0 (MASTER pouka 37): najmanji obim preostalih (slobodnih) dana mešovite nedelje — bez kvaliteta, lagan =
 * minimum faze, dugi kakav je sastavljen (ne skraćuje se radi ostatka); nijedan dan iznad sastavljenog (`free` = dani
 * kakvi su sastavljeni bez zaštićenih, ili upisani kod validatora). Konstruktor (mixedRemainder) i validator
 * (MIXED_OVER_TARGET) čitaju istu funkciju: ostatak < ovog → planirano > cilj uz upozorenje. 2.10.1 (dopuna MAR-08):
 * tada kvalitet OSTAJE — preostali dani su `withQuality` minimum (kvalitet kakav je, lagani na minimumu).
 */
export function mixedFloorKm(
  free: readonly PlanDay[],
  easyMin: number,
  withQuality = false
): number {
  return r2(
    free
      .filter((d) => d.countsToWeek)
      .reduce(
        (s, d) =>
          s +
          (d.role === 'long' || isTestDay(d) || (withQuality && d.workout.kind === 'quality')
            ? d.workout.km
            : Math.min(d.workout.km, easyMin)),
        0
      )
  );
}

/**
 * 5k-v2.11.0 (Z1, pouka 37 dopuna) — JEDINO mesto odluke „kvalitet ostaje, lagani na minimumu, planirano > cilj" u
 * mešovitoj nedelji (konstruktor mixedRemainder i validator MIXED_OVER_TARGET). Ostatak R = cilj − zaštićeni po
 * činjenicama. Važi kad (a) ni preostali dani bez kvaliteta na minimumu ne staju u R (2.10.1), ili (b) sa kvalitetom
 * ne staju, ali je jedini uzrok upisani višak (zaštićeni po činjenicama > planirani zaštićeni, a sa planiranim
 * zaštićenim kvalitet bi stao) i planirano sa zadržanim kvalitetom ≤ policy.mixed.keepQualityMaxShare × cilj.
 * Minimumi su isti za sastavljene i upisane preostale dane (lagan na minimumu ostaje na minimumu).
 */
export function mixedOver(
  free: readonly PlanDay[],
  keptKm: number,
  keptPlanKm: number,
  targetKm: number,
  easyMin: number
): boolean {
  const R = targetKm - keptKm;
  if (R + 1e-9 < mixedFloorKm(free, easyMin)) return true;
  const withQ = mixedFloorKm(free, easyMin, true);
  return (
    R + 1e-9 < withQ &&
    keptKm > keptPlanKm + 1e-9 &&
    keptPlanKm + withQ <= targetKm + 1e-9 &&
    keptKm + withQ <= P.mixed.keepQualityMaxShare * targetKm + 1e-9
  );
}

/** 5k-v2.12.0 (C3, kao HM/MAR): kontrolno trčanje mešovite nedelje se ne odbacuje radi ostatka — kao dugi, ostaje
    kakvo je (mixedFloorKm, mixedRemainder). */
const isTestDay = (d: PlanDay): boolean => d.workout.qualityType === 'TEST_3K';

/** Lagan dan iste vrste ubrzanja (bez, redovna, samo ubrzanja) sa novom dužinom. */
function resizedEasy(d: PlanDay, km: number, p: PaceModel): Workout {
  const st = d.workout.segments.filter((x) => x.kind === 'stride');
  const so = P.quality.deloadSubstitute.stridesOnly;
  if (st.length === 0) return easyRun(km, p, false);
  return st.length === so.reps && st.every((x) => x.sec === so.sec)
    ? easyRun(km, p, true, so)
    : easyRun(km, p, true);
}

/**
 * 2.10.0 (MASTER pouka 37, dopuna organizatora iz HM-08) — JEDINO mesto odluke o obimu preostalih dana mešovite
 * nedelje izgradnje/tapera (deo dana zaštićen: ≤ asOf ili zaključan; `kept` = zaštićeni dani prethodnog plana te
 * nedelje; trkačka nedelja izuzeta — pouka 30). Cilj važi za CELU nedelju: preostali dani (sastavljeni bez zaštićenih,
 * `week`) dobijaju ostatak = cilj − zbir zaštićenih (`keptKm`, po činjenicama — protectedKm), SAMO NANIŽE (nijedan
 * dan duži od sastavljenog; manjak se ne nadoknađuje). Dugi se ne skraćuje (referenca poslednjeg dugog); prvo lagani do minimuma (lagan ≤ dugi samo među
 * preostalim danima — zaštićeni su činjenice), pa otpada kvalitet (prvo drugi, pa svi; dan postaje lagan, doza se ne
 * beleži) — samo kad time ostatak staje. Kad ni minimum preostalih dana bez kvaliteta (mixedFloorKm) ne staje:
 * kvalitet ostaje, lagani na minimumu, `over` (planirano > cilj, validator: upozorenje MIXED_OVER_TARGET, pouka 14).
 * null = staje bez izmene.
 */
export function mixedRemainder(
  week: PlanWeek,
  kept: readonly PlanDay[],
  keptKm: number,
  p: PaceModel,
  keptPlanKm: number = keptKm
): { days: PlanDay[]; over: boolean; droppedQuality: boolean; remainderKm: number } | null {
  const keptDates = new Set(kept.map((d) => d.date));
  const free = week.days.filter((d) => !keptDates.has(d.date));
  const km = (ds: readonly PlanDay[]): number =>
    r2(ds.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0));
  const R = r2(week.targetKm - keptKm);
  if (kept.length === 0 || free.length === 0 || km(free) <= R + 1e-9) return null;
  const easyMin = easyMinOf(week.phase, p, week.deload);
  const long = free.find((d) => d.role === 'long');
  const top = long ? easyCapKm(long.workout.km, week.phase, week.deload) : Infinity;
  // Prvi kvalitet (q1) ostaje najduže: otpada drugi, pa svi.
  const qs = free
    .filter((d) => d.workout.kind === 'quality' && !isTestDay(d))
    .sort((x, y) => (x.role === 'q1' ? 0 : 1) - (y.role === 'q1' ? 0 : 1));
  const testKm = r2(free.filter(isTestDay).reduce((a, d) => a + d.workout.km, 0));
  const over = mixedOver(free, keptKm, keptPlanKm, week.targetKm, easyMin);
  // 2.10.1 (dopuna MAR-08): kvalitet otpada samo kad time ostatak staje; ni bez kvaliteta ne staje → kvalitet ostaje.
  const attempts: PlanDay[][] = over
    ? [qs]
    : [qs, ...(qs.length === 2 ? [qs.slice(0, 1)] : []), ...(qs.length > 0 ? [[]] : [])];
  for (const keep of attempts) {
    const easies = free.filter(
      (d) =>
        d.role === 'easy' || (d.workout.kind === 'quality' && !isTestDay(d) && !keep.includes(d))
    );
    const lo = easies.map((d) => Math.min(d.workout.km, easyMin));
    const avail = r2(R - km(keep) - (long ? long.workout.km : 0) - testKm);
    if (!over && avail + 1e-9 < r2(lo.reduce((a, x) => a + x, 0))) continue;
    const shares = over
      ? lo
      : splitEasy(avail, easies.length, top).map((x, i) =>
          Math.max(lo[i]!, Math.min(x, easies[i]!.workout.km, top))
        );
    if (!over && r2(shares.reduce((a, x) => a + x, 0)) > avail + 1e-9) continue;
    const days = week.days.map((d): PlanDay => {
      const i = easies.indexOf(d);
      if (i < 0) return d;
      if (d.role !== 'easy')
        return { ...d, role: 'easy', hard: false, workout: easyRun(shares[i]!, p, false) };
      return Math.abs(shares[i]! - d.workout.km) < 1e-9
        ? d
        : { ...d, workout: resizedEasy(d, shares[i]!, p) };
    });
    return { days, over, droppedQuality: keep.length < qs.length, remainderKm: R };
  }
  return null;
}

/** Pouka 37: nedelja sa preostalim danima na ostatku do cilja (mixedRemainder) i napomenom; kontrolno trčanje koje
    otpada skida oznaku testa. null = staje bez izmene. */
export function mixedWeek(
  week: PlanWeek,
  kept: readonly PlanDay[],
  keptKm: number,
  p: PaceModel,
  keptPlanKm: number = keptKm
): { week: PlanWeek; droppedQuality: boolean } | null {
  const m = mixedRemainder(week, kept, keptKm, p, keptPlanKm);
  if (!m) return null;
  const keptDates = new Set(kept.map((d) => d.date));
  const floor = mixedFloorKm(
    week.days.filter((d) => !keptDates.has(d.date)),
    easyMinOf(week.phase, p, week.deload)
  );
  const lost = week.test && !m.days.some((d) => d.workout.qualityType === 'TEST_3K');
  return {
    week: {
      ...week,
      days: m.days,
      plannedKm: r2(m.days.reduce((x, d) => x + (d.countsToWeek ? d.workout.km : 0), 0)),
      ...(lost ? { test: false } : {}),
      notes: [
        ...week.notes,
        m.over
          ? `${MIXED_NOTE} zaštićeni dani ${keptKm} km, ostatak do cilja ${m.remainderKm} km < najmanji preostali dani ${
              m.remainderKm + 1e-9 < floor
                ? `bez kvaliteta ${floor}`
                : `sa kvalitetom ${mixedFloorKm(
                    m.days.filter((d) => !keptDates.has(d.date)),
                    easyMinOf(week.phase, p, week.deload),
                    true
                  )}`
            } km — ${m.days.some((d) => !keptDates.has(d.date) && d.workout.kind === 'quality') ? 'kvalitet ostaje, ' : ''}lagani na minimumu, planirano > cilj ${week.targetKm} km.`
          : `${MIXED_NOTE} zaštićeni dani ${keptKm} km, preostali dani skraćeni na ostatak do cilja ${m.remainderKm} km${m.droppedQuality ? ' (kvalitet koji ne staje otpada)' : ''}.`
      ]
    },
    droppedQuality: m.droppedQuality
  };
}

/** Doza nedelje bez drugog kvaliteta: drugi kvalitet (T, druga vrsta po osećaju) ostaje na prethodnoj dozi.
    2.10.1: i mešovita nedelja kojoj je otpao samo drugi kvalitet (pouka 37). */
export function secondEasyDose(d: WeekDose, prev: WeekDose | null): WeekDose {
  const kind = d.kind;
  return {
    ...d,
    t: prev?.t ?? null,
    same: 1,
    ...(d.feel
      ? {
          feel: {
            ...(prev?.feel ?? {}),
            ...(kind && kind in d.feel ? { [kind]: d.feel[kind as keyof typeof d.feel] } : {})
          }
        }
      : {})
  };
}

/**
 * 2.8.0 (pouka 30, JEDINO mesto): datumi laganih dana trkačke nedelje koji postaju odmor kad trkačka nedelja
 * (bez trke) ne bi bila ≤ planirano tapera `capKm` (taper skraćen danima odmora/bola) — 5k-v2.12.0 (C5): prvo
 * oštrenje, pa dani bola, pa najraniji lagani, najmanje koliko treba; dan pred trku i trka nikad. `fixed(date)` = dan prethodnog
 * plana na zaštićenom datumu (undefined = nije zaštićen, null = zaštićen bez treninga): ulazi u zbir i ne
 * postaje odmor (prošlost = upisani dani). Prazno kad staje. 5k-v2.11.1 (C5): kad ni bez svih laganih ne staje, svi
 * lagani koji smeju postaju odmor (višak su oštrenje i dan pred trku — validator: upozorenje RACE_WEEK_TAPER).
 */
export function raceWeekRest(
  days: readonly PlanDay[],
  raceDate: string,
  pain: ReadonlySet<string>,
  capKm: number,
  fixed: (date: string) => PlanDay | null | undefined = () => undefined,
  weekDates: readonly string[] = []
): string[] {
  // 5k-v2.11.1 (C5): zbir ide po svim datumima nedelje (`weekDates`) — zaštićen dan na datumu koji sastavljena
  // nedelja nema (izostavljen lagan dan) ulazi u zbir kao i ostali zaštićeni.
  const dates = [...new Set([...days.map((d) => d.date), ...weekDates])];
  const kmOf = (date: string): number => {
    const f = fixed(date);
    const d = f === undefined ? days.find((x) => x.date === date) : f;
    return d && d.countsToWeek ? d.workout.km : 0;
  };
  let total = r2(dates.reduce((a, d) => a + kmOf(d), 0));
  const free = days.filter(
    (d) => d.role === 'easy' && daysBetween(d.date, raceDate) > 1 && fixed(d.date) === undefined
  );
  // 5k-v2.12.0 (C5, pouka 30 kao 10K/HM/MAR): prvo otpada oštrenje (nezaštićeno), pa lagani dani u odmor.
  const sharp = days.filter((d) => d.workout.kind === 'quality' && fixed(d.date) === undefined);
  const order = [
    ...sharp,
    ...free.filter((d) => pain.has(d.date)),
    ...free.filter((d) => !pain.has(d.date))
  ];
  const out: string[] = [];
  for (const d of order) {
    if (total <= capKm + 1e-9) break;
    out.push(d.date);
    total = r2(total - d.workout.km);
  }
  return out.sort();
}

/**
 * 5k-v2.11.0 (F1): JEDAN vlasnik izbora dana oštrenja trkačke nedelje (konstruktor i validator).
 * Prvo zahtevni dan šablona (q1/q2/dugi) ≥ sharpenerMinGapDays pre trke, najbliži trci. Ako takvog nema
 * (npr. dugi na danu trke, q1 2 dana pre nje), trenerska odluka: oštrenje na danu trčanja koji je u trkačkoj
 * nedelji lagan, ≥ sharpenerEasyMinGapDays pre trke (prvo dani ≥ sharpenerMinGapDays, najbliži trci). `minGap` = najmanji dozvoljen razmak kvaliteta od trke.
 */
export function sharpenerCandidates(
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceWd: Weekday,
  gapToRace: (w: Weekday) => number
): { days: Weekday[]; onEasyDay: boolean; minGap: number } {
  const pref: Weekday[] = [pattern.q1, ...(pattern.q2 ? [pattern.q2] : []), pattern.long];
  const byGap = (list: Weekday[], min: number): Weekday[] =>
    list
      .filter((w) => w !== raceWd && gapToRace(w) >= min)
      .sort((a, b) => gapToRace(a) - gapToRace(b) || list.indexOf(a) - list.indexOf(b));
  const hard = byGap(pref, P.schedule.sharpenerMinGapDays);
  if (hard.length > 0)
    return { days: hard, onEasyDay: false, minGap: P.schedule.sharpenerMinGapDays };
  // U trkačkoj nedelji je svaki dan osim oštrenja lagan; prvo dani ≥ sharpenerMinGapDays (najbliži trci),
  // pa tek onda dan sharpenerEasyMinGapDays pre trke.
  // Razmak od zahtevnih dana šablona prethodne nedelje (datum h − 7) ≥ minHardGapDays.
  const spaced = runDays.filter((w) =>
    pref.every((h) => 7 + gapToRace(h) - gapToRace(w) >= P.schedule.minHardGapDays)
  );
  const easy = byGap(spaced, P.schedule.sharpenerEasyMinGapDays).sort(
    (a, b) =>
      Number(gapToRace(a) < P.schedule.sharpenerMinGapDays) -
        Number(gapToRace(b) < P.schedule.sharpenerMinGapDays) || gapToRace(a) - gapToRace(b)
  );
  return { days: easy, onEasyDay: true, minGap: P.schedule.sharpenerEasyMinGapDays };
}

/** 5k-v2.11.0 (owner K): JEDAN plafon laganog dana trkačke nedelje (konstruktor i validator RACE_WEEK_EASY):
 *  max(taperMinKm, ⌊min(50 min sporijim E, 50% dugog prethodne nedelje)⌋ na 0,1 km). */
export function raceWeekEasyCap(p: PaceModel, prevLongKm: number): number {
  return Math.max(
    P.easy.taperMinKm,
    floor1(
      Math.min(P.easy.raceWeekMaxSec / p.E.slow, prevLongKm * P.easy.raceWeekMaxShareOfPrevLong)
    )
  );
}

/**
 * Trkačka nedelja. 2.3.0 (Odluka 4): `bound` = udeo vrha je GORNJA GRANICA; cilj nedelje = zbir
 * planiranih dana (budžet oštrenja se računa od granice).
 */
export function buildRaceWeek(
  f: WeekFrame,
  bound: number,
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: string,
  p: PaceModel,
  prevLongKm: number,
  cap: { km: number; fixed?: (date: string) => PlanDay | null | undefined } | null = null,
  off = 0
): WeekResult {
  const budgets = qualityBudgets(bound);
  const gapToRace = (w: Weekday): number => daysBetween(dateOfWeekday(f, w), raceDate);
  const raceWd = weekdayOf(raceDate);
  const { days: cands, onEasyDay } = sharpenerCandidates(pattern, runDays, raceWd, gapToRace);
  // 2.5.0: oštrenje se ne pravi na danu zabrane kvaliteta (adaptacija); dani odmora se ne prave.
  const L = f.limits;
  const banned = new Set(L?.noQuality ?? []);
  const rest = new Set(L?.rest ?? []);
  const pain = new Set(L?.pain ?? []);
  const sharpDay = cands.find((w) => !banned.has(dateOfWeekday(f, w)));
  if (cands.length === 0)
    return {
      ok: false,
      reason: {
        code: 'WEEK_INFEASIBLE',
        week: f.index,
        message: `Trkačka nedelja: nema dana trčanja ≥ ${P.schedule.sharpenerEasyMinGapDays} dana pre trke za oštrenje.`
      }
    };
  const sharp = sharpDay ? raceWeekSharpener(budgets.I, bound, p) : null;
  if (sharp && !sharp.ok)
    return {
      ok: false,
      reason: {
        code: 'QUALITY_INFEASIBLE',
        week: f.index,
        message: `Nedelja ${weekLabel(f.index, off)}: ${sharp.message}`
      }
    };

  // Lagani dani: ostali dani trčanja pre trke. 2.2.0: svaki lagan dan ≤ easyCap = min(50 min sporijim E,
  // 50% dugog iz prethodne nedelje); ostatak cilja preko toga se ne raspoređuje (planirano < cilj,
  // samo u trkačkoj nedelji, uz napomenu). Broj laganih dana n = min(broj, ⌊ostatak / minimum⌋), 0 ako
  // je easyCap < minimum. Dan pred trku (ako je dan trčanja) ostaje prvi: min(raceEveMaxKm, jednak deo,
  // easyCap) sa ubrzanjima; ostatak se deli jednako na ostale izabrane dane, svaki ≤ easyCap.
  // 2.4.0: ne ispod taperMinKm (mali obim, npr. početnik 12 km: 50% dugog < 2 km ostavljalo je samo
  // oštrenje, nedelja < 4 km — Uslov 8).
  const easyCap = raceWeekEasyCap(p, prevLongKm);
  const others = runDays
    .filter(
      (w) => w !== sharpDay && w !== raceWd && gapToRace(w) > 0 && !rest.has(dateOfWeekday(f, w))
    )
    .sort((a, b) => gapToRace(b) - gapToRace(a));
  const eve = others.find((w) => gapToRace(w) === 1);
  const restDays = others.filter((w) => w !== eve);
  const remainder = r2(bound - (sharp ? sharp.workout.km : 0));
  const n =
    easyCap + 1e-9 < P.easy.taperMinKm
      ? 0
      : Math.min(others.length, Math.max(0, Math.floor(remainder / P.easy.taperMinKm + 1e-9)));
  const withEve = eve !== undefined && n > 0;
  const eveKm = withEve ? Math.min(P.easy.raceEveMaxKm, floor1(remainder / n), easyCap) : 0;
  const restN = withEve ? n - 1 : n;
  const shares = splitEasy(r2(remainder - eveKm), restN).map((x) => Math.min(x, easyCap));
  const days: PlanDay[] = sharp && sharpDay ? [day(f, sharpDay, 'q1', sharp.workout)] : [];
  const hurt = (w: Weekday): boolean => pain.has(dateOfWeekday(f, w));
  const ek = (km: number, w: Weekday): number =>
    L ? limitedEasyKm(km, hurt(w), null, P.easy.taperMinKm) : km;
  restDays
    .slice(0, restN)
    .forEach((w, i) => days.push(day(f, w, 'easy', easyRun(ek(shares[i]!, w), p, false))));
  if (eve && withEve) days.push(day(f, eve, 'easy', easyRun(ek(eveKm, eve), p, !hurt(eve))));
  days.push({
    date: raceDate,
    weekday: raceWd,
    role: 'race',
    hard: true,
    countsToWeek: false,
    workout: raceDay(p)
  });
  days.sort((a, b) => a.date.localeCompare(b.date));
  // 2.8.0 (pouka 30): trkačka nedelja ≤ planirano tapera — višak laganih dana postaje odmor (raceWeekRest).
  const weekDates = Array.from(
    { length: Math.max(0, daysBetween(f.startDate, raceDate)) },
    (_, k) => addDays(f.startDate, k)
  );
  const raceRest = cap ? raceWeekRest(days, raceDate, pain, cap.km, cap.fixed, weekDates) : [];
  if (raceRest.length > 0)
    days.splice(0, days.length, ...days.filter((d) => !raceRest.includes(d.date)));
  const notes = ['Trkačka nedelja: trka se ne računa u nedeljni obim.'];
  const sharpRest = sharp && sharpDay ? raceRest.includes(dateOfWeekday(f, sharpDay)) : false;
  if (!sharp) notes.push('Adaptacija: bez oštrenja (dan oštrenja u zabrani kvaliteta).');
  else if (sharpRest)
    notes.push('Bez oštrenja: sa njim bi trkačka nedelja bila veća od nedelje pred njom.');
  else if (onEasyDay)
    notes.push(
      `Oštrenje je na laganom danu: nijedan zahtevan dan nije ${P.schedule.sharpenerMinGapDays} ili više dana pre trke.`
    );
  const dropped = others.length - n;
  if (dropped > 0)
    notes.push(
      `Izostavljeno laganih dana: ${dropped} (ostalo bi manje od ${P.easy.taperMinKm} km po trčanju).`
    );
  if (withEve) notes.push(`Dan pred trku: lagano ${eveKm} km sa ubrzanjima.`);
  if (raceRest.length > 0)
    notes.push(
      `Trkačka nedelja skraćena: nedelja pred njom je imala dane odmora/bola, pa trkačka nedelja ima najviše ${cap!.km} km (odmor: ${raceRest.join(', ')}).`
    );
  const plannedKm = r2(days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0));
  notes.push(
    `Trkačka nedelja: ${plannedKm} km (najviše ${bound} km, ${P.volume.raceWeekFactor * 100} % najvećeg nedeljnog obima; lagan dan najviše ${easyCap} km).`
  );
  return {
    ok: true,
    week: {
      ...f,
      targetKm: plannedKm,
      plannedKm,
      budgets,
      easyCappedAtLong: false,
      stridesOnly: false,
      days,
      notes,
      ...(raceRest.length > 0 ? { raceRest } : {})
    }
  };
}
