/* 2.4.0: konstrukcija nedelje (izdvojeno iz generate.ts): nedelja treninga i trkačka nedelja. Dužine
   dugog/laganih su u lengths.ts, kvalitet u quality.ts — iste funkcije koristi kapacitet (volume.ts). */

import { addDays, daysBetween, weekdayIndex, weekdayOf } from './dates.ts';
import { splitEasy, weekLengths } from './lengths.ts';
import { FIVE_K_V2_POLICY as P, type Athlete } from './policy.ts';
import { raceWeekSharpener, weekQuality } from './quality.ts';
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
import { easyRun, longRun, qualityBudgets, raceDay, type WeekDose } from './workouts.ts';

const r2 = (x: number): number => Math.round(x * 100) / 100;
const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;

function dateOfWeekday(f: WeekFrame, w: Weekday): string {
  const offset = (((weekdayIndex(w) - weekdayIndex(weekdayOf(f.startDate))) % 7) + 7) % 7;
  return addDays(f.startDate, offset);
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
 */
export function buildTrainingWeek(
  f: WeekFrame,
  target: number,
  pattern: Pattern,
  p: PaceModel,
  prev: WeekDose | null,
  a: Athlete,
  taperWeeks: number
): TrainingWeekResult {
  const budgets = qualityBudgets(target);
  const s = weekQuality(f, target, p, prev, a, taperWeeks);
  if (!s.ok)
    return {
      ok: false,
      reason: {
        code: 'QUALITY_INFEASIBLE',
        week: f.index,
        message: `Nedelja ${f.index}: ${s.message}`
      }
    };
  const q1 = s.q1;
  const q2 = s.q2;

  const easyDays: { w: Weekday; stridesOnly: boolean }[] = pattern.easy.map((w) => ({
    w,
    stridesOnly: false
  }));
  if (!q1) easyDays.push({ w: pattern.q1, stridesOnly: true });
  if (!q2 && pattern.q2) easyDays.push({ w: pattern.q2, stridesOnly: false });
  const qualityKm = (q1 ? q1.km : 0) + (q2 ? q2.km : 0);
  const {
    longKm,
    shares,
    capped: easyCappedAtLong,
    easyMin
  } = weekLengths(target, qualityKm, easyDays.length, f.phase, p, a);
  const fixed = qualityKm + longKm;
  if (shares.some((x) => x < easyMin))
    return {
      ok: false,
      reason: {
        code: 'WEEK_INFEASIBLE',
        week: f.index,
        message: `Nedelja ${f.index}: posle kvaliteta (${r2(fixed - longKm)} km) i dugog (${longKm} km) za lagan trk ostaje ${shares.join(' / ')} km < ${easyMin} km.`
      }
    };

  const planDays: PlanDay[] = [day(f, pattern.long, 'long', longRun(longKm, p))];
  if (q1) planDays.push(day(f, pattern.q1, 'q1', q1));
  if (q2 && pattern.q2) planDays.push(day(f, pattern.q2, 'q2', q2));
  const so = P.quality.deloadSubstitute.stridesOnly;
  easyDays.forEach((e, i) =>
    planDays.push(
      day(
        f,
        e.w,
        'easy',
        e.stridesOnly
          ? easyRun(shares[i]!, p, true, so)
          : easyRun(shares[i]!, p, s.easyStrides && !s.stridesOnly)
      )
    )
  );
  planDays.sort((a, b) => a.date.localeCompare(b.date));
  const plannedKm = r2(planDays.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0));
  const notes = [...s.notes];
  if (easyCappedAtLong)
    notes.push(
      `Lagan trk ograničen na dužinu dugog (${longKm} km): planirano ${plannedKm} km < cilj ${target} km.`
    );
  return {
    ok: true,
    week: {
      ...f,
      targetKm: target,
      plannedKm,
      budgets,
      easyCappedAtLong,
      stridesOnly: s.stridesOnly,
      days: planDays,
      notes
    },
    dose: s.dose
  };
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
  prevLongKm: number
): WeekResult {
  const budgets = qualityBudgets(bound);
  const gapToRace = (w: Weekday): number => daysBetween(dateOfWeekday(f, w), raceDate);
  const raceWd = weekdayOf(raceDate);
  // Oštrenje: zahtevni dan šablona ≥ sharpenerMinGapDays pre trke, najbliži trci.
  const pref: Weekday[] = [pattern.q1, ...(pattern.q2 ? [pattern.q2] : []), pattern.long];
  const cands = pref
    .filter((w) => w !== raceWd && gapToRace(w) >= P.schedule.sharpenerMinGapDays)
    .sort((a, b) => gapToRace(a) - gapToRace(b) || pref.indexOf(a) - pref.indexOf(b));
  const sharpDay = cands[0];
  if (!sharpDay)
    return {
      ok: false,
      reason: {
        code: 'WEEK_INFEASIBLE',
        week: f.index,
        message: `Trkačka nedelja: nema zahtevnog dana šablona ≥ ${P.schedule.sharpenerMinGapDays} dana pre trke za oštrenje.`
      }
    };
  const sharp = raceWeekSharpener(budgets.I, bound, p);
  if (!sharp.ok)
    return {
      ok: false,
      reason: {
        code: 'QUALITY_INFEASIBLE',
        week: f.index,
        message: `Nedelja ${f.index}: ${sharp.message}`
      }
    };

  // Lagani dani: ostali dani trčanja pre trke. 2.2.0: svaki lagan dan ≤ easyCap = min(50 min sporijim E,
  // 50% dugog iz prethodne nedelje); ostatak cilja preko toga se ne raspoređuje (planirano < cilj,
  // samo u trkačkoj nedelji, uz napomenu). Broj laganih dana n = min(broj, ⌊ostatak / minimum⌋), 0 ako
  // je easyCap < minimum. Dan pred trku (ako je dan trčanja) ostaje prvi: min(raceEveMaxKm, jednak deo,
  // easyCap) sa ubrzanjima; ostatak se deli jednako na ostale izabrane dane, svaki ≤ easyCap.
  // 2.4.0: ne ispod taperMinKm (mali obim, npr. početnik 12 km: 50% dugog < 2 km ostavljalo je samo
  // oštrenje, nedelja < 4 km — Uslov 8).
  const easyCap = Math.max(
    P.easy.taperMinKm,
    floor1(
      Math.min(P.easy.raceWeekMaxSec / p.E.slow, prevLongKm * P.easy.raceWeekMaxShareOfPrevLong)
    )
  );
  const others = runDays
    .filter((w) => w !== sharpDay && w !== raceWd && gapToRace(w) > 0)
    .sort((a, b) => gapToRace(b) - gapToRace(a));
  const eve = others.find((w) => gapToRace(w) === 1);
  const rest = others.filter((w) => w !== eve);
  const remainder = r2(bound - sharp.workout.km);
  const n =
    easyCap + 1e-9 < P.easy.taperMinKm
      ? 0
      : Math.min(others.length, Math.max(0, Math.floor(remainder / P.easy.taperMinKm + 1e-9)));
  const withEve = eve !== undefined && n > 0;
  const eveKm = withEve ? Math.min(P.easy.raceEveMaxKm, floor1(remainder / n), easyCap) : 0;
  const restN = withEve ? n - 1 : n;
  const shares = splitEasy(r2(remainder - eveKm), restN).map((x) => Math.min(x, easyCap));
  const days: PlanDay[] = [day(f, sharpDay, 'q1', sharp.workout)];
  rest
    .slice(0, restN)
    .forEach((w, i) => days.push(day(f, w, 'easy', easyRun(shares[i]!, p, false))));
  if (eve && withEve) days.push(day(f, eve, 'easy', easyRun(eveKm, p, true)));
  days.push({
    date: raceDate,
    weekday: raceWd,
    role: 'race',
    hard: true,
    countsToWeek: false,
    workout: raceDay(p)
  });
  days.sort((a, b) => a.date.localeCompare(b.date));
  const notes = ['Trkačka nedelja: trka se ne računa u nedeljni obim.'];
  const dropped = others.length - n;
  if (dropped > 0)
    notes.push(
      `Izostavljeno laganih dana: ${dropped} (ostatak < ${P.easy.taperMinKm} km po trku).`
    );
  if (withEve) notes.push(`Dan pred trku: lagano ${eveKm} km sa ubrzanjima.`);
  const plannedKm = r2(days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0));
  notes.push(
    `Cilj trkačke nedelje = planirano ${plannedKm} km (gornja granica ${bound} km = ${P.volume.raceWeekFactor * 100}% vrha; lagan dan ≤ ${easyCap} km).`
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
      notes
    }
  };
}
