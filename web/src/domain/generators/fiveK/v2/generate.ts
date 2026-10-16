/* generateFiveKV2(input) → plan ili strukturisano odbijanje.
   Bez čitanja sata: svi datumi dolaze iz ulaza. Ista vrednost ulaza → isti JSON. */

import { addDays, daysBetween, weekdayIndex, weekdayOf } from './dates.ts';
import { checkInput } from './input.ts';
import { assessGoal, pacesFromVdot, raceTimeForVdot, vdotFromResult } from './paces.ts';
import { isShortPrep, periodize, phaseCounts } from './periodize.ts';
import { FIVE_K_V2_POLICY as P, type RunDaysCount } from './policy.ts';
import { choosePattern } from './schedule.ts';
import type {
  DayRole,
  FiveKV2Input,
  FiveKV2Plan,
  GenerateResult,
  Paces,
  Pattern,
  Phase,
  PlanDay,
  PlanWeek,
  Reason,
  WeekFrame,
  Weekday,
  Workout
} from './types.ts';
import { validatePlan } from './validate.ts';
import { longCapKm, planVolume } from './volume.ts';
import {
  easyRun,
  longRun,
  qualityBudgets,
  qualitySession,
  raceDay,
  weekQuality,
  type WeekDose
} from './workouts.ts';

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

/** Raspodela ostatka na lagane dane (jednako, poslednji uzima zaokruživanje). */
function splitEasy(remainder: number, n: number): number[] {
  if (n <= 0) return [];
  const share = floor1(remainder / n);
  return [...Array<number>(n - 1).fill(share), r2(remainder - share * (n - 1))];
}

type WeekResult = { ok: true; week: PlanWeek } | { ok: false; reason: Reason };

/** Rezultat nedelje + doza (ulaz za progresiju sledeće ne-rasteretne nedelje iste faze). */
type TrainingWeekResult =
  { ok: true; week: PlanWeek; dose: WeekDose | null } | { ok: false; reason: Reason };

/**
 * Nedelja treninga. JEDINO mesto koje određuje dužinu dugog i laganih trkova (jedan prolaz):
 * dugi = min(longCapKm(cilj) [udeo dana, 90 min], cilj − kvalitet − n × min. lagan); lagan = (cilj − kvalitet − dugi) / broj laganih dana.
 * 2.2.0: cilj je već ograničen kapacitetom (volume.ts), pa je lagan > dugi samo zaštita: tada
 * lagan = dugi i plannedKm < targetKm (napomena + PLANNED_BELOW_TARGET).
 * Kvalitet i doza: weekQuality (workouts.ts); `prev` = doza prethodne ne-rasteretne nedelje ISTE faze.
 * 2.3.0: lagani dani = lagani dani šablona + kvalitetni dan bez kvaliteta (q2 u rasterećenju/taperu 2;
 * q1 u nedelji samo sa ubrzanjima, sa ubrzanjima stridesOnly).
 */
function buildTrainingWeek(
  f: WeekFrame,
  target: number,
  pattern: Pattern,
  p: Paces,
  prev: WeekDose | null,
  days: RunDaysCount,
  taperWeeks: number
): TrainingWeekResult {
  const budgets = qualityBudgets(target);
  const s = weekQuality(f, target, p, prev, days, taperWeeks);
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
  const easyMin = f.phase === 'taper' ? P.easy.taperMinKm : P.easy.minKm;
  const qualityKm = (q1 ? q1.km : 0) + (q2 ? q2.km : 0);
  // Dugi = min(udeo dana × cilj, 90 min, prostor koji laganim danima ostavlja minimum) — jedna formula.
  // 2.2.0: treći član na 0,1 km (ne 0,5): sa 0,5 km mala rasteretna nedelja (13 km) dobija dugi 3 km i
  // lagane 3,2 km, tj. lagan > dugi.
  const longKm = Math.min(
    longCapKm(target, p, days),
    floor1(target - qualityKm - easyDays.length * easyMin)
  );
  const fixed = qualityKm + longKm;
  const split = splitEasy(r2(target - fixed), easyDays.length);
  const easyCappedAtLong = split.some((x) => x > longKm + 1e-9);
  const shares = easyCappedAtLong ? split.map(() => longKm) : split;
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
function buildRaceWeek(
  f: WeekFrame,
  bound: number,
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: string,
  p: Paces,
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
  const sharp = qualitySession('RP_sharpener', budgets.I, bound, p, 'race');
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
  const easyCap = floor1(
    Math.min(P.easy.raceWeekMaxSec / p.E.slow, prevLongKm * P.easy.raceWeekMaxShareOfPrevLong)
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

export function generateFiveKV2(raw: unknown): GenerateResult {
  const checked = checkInput(raw);
  if (!checked.ok) return { ok: false, reasons: checked.reasons, violations: [] };
  const input: FiveKV2Input = checked.input;

  const pat = choosePattern(input.runDays);
  if (!pat.ok) return { ok: false, reasons: [pat.reason], violations: [] };

  const vdot =
    Math.round(vdotFromResult(input.recentResult.distanceM, input.recentResult.timeSec) * 10) / 10;
  const paces = pacesFromVdot(vdot);
  const totalWeeks = (daysBetween(input.startDate, input.raceDate) + 1) / 7;
  const frames = periodize(input.startDate, totalWeeks);
  const nDays = input.runDays.length as RunDaysCount;
  const vol = planVolume(frames, input.currentWeeklyKm, paces, nDays);

  const weeks: PlanWeek[] = [];
  const reasons: Reason[] = [];
  // Progresija doze: doza glavnog kvaliteta poslednje ne-rasteretne nedelje, po fazi.
  const lastDose: Partial<Record<Phase, WeekDose>> = {};
  frames.forEach((f, i) => {
    const target = vol.targets[i]!;
    if (f.phase === 'race') {
      const prevLong =
        weeks[weeks.length - 1]?.days.find((d) => d.role === 'long')?.workout.km ?? 0;
      const r = buildRaceWeek(
        f,
        target,
        pat.pattern,
        input.runDays,
        input.raceDate,
        paces,
        prevLong
      );
      if (r.ok) weeks.push(r.week);
      else reasons.push(r.reason);
      return;
    }
    const r = buildTrainingWeek(
      f,
      target,
      pat.pattern,
      paces,
      lastDose[f.phase] ?? null,
      nDays,
      phaseCounts(totalWeeks).taper
    );
    if (!r.ok) {
      reasons.push(r.reason);
      return;
    }
    if (i === 0 && vol.startCapped)
      r.week.notes.push(
        `Trenutni obim (${input.currentWeeklyKm} km) je veći od onoga što ${nDays} dana nose (${vol.capacityKm} km); plan kreće od ${vol.capacityKm} km.${nDays < 5 ? ' Za veći obim izaberi više dana trčanja.' : ''}`
      );
    weeks.push(r.week);
    if (r.dose) lastDose[f.phase] = r.dose;
  });
  if (reasons.length > 0) return { ok: false, reasons, violations: [] };

  const plan: FiveKV2Plan = {
    policyId: P.id,
    policyVersion: P.version,
    input,
    vdot,
    paces,
    predicted5kSec: raceTimeForVdot(vdot, P.paces.raceDistanceM),
    goal: input.goalTimeSec ? assessGoal(vdot, input.goalTimeSec) : null,
    pattern: pat.pattern,
    startKm: vol.startKm,
    peakKm: vol.peakKm,
    capacityKm: vol.capacityKm,
    notes: isShortPrep(totalWeeks) ? [P.phases.shortNote] : [],
    weeks,
    warnings: []
  };
  const violations = validatePlan(plan);
  const errors = violations.filter((v) => v.severity === 'error');
  if (errors.length > 0)
    return {
      ok: false,
      reasons: [
        {
          code: 'PLAN_VIOLATES_POLICY',
          message: `Konstruisan plan krši ${errors.length} pravila; plan se ne vraća.`
        }
      ],
      violations
    };
  plan.warnings = violations;
  if (plan.goal && plan.goal.status !== 'feasible')
    plan.warnings.push({ rule: 'GOAL_STATUS', severity: 'warning', message: plan.goal.message });
  return { ok: true, plan };
}
