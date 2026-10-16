/* generateFiveKV2(input) → plan ili strukturisano odbijanje.
   Bez čitanja sata: svi datumi dolaze iz ulaza. Ista vrednost ulaza → isti JSON. */

import { addDays, daysBetween, weekdayIndex, weekdayOf } from './dates.ts';
import { checkInput } from './input.ts';
import { assessGoal, pacesFromVdot, raceTimeForVdot, vdotFromResult } from './paces.ts';
import { periodize } from './periodize.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
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
  QualityType,
  Reason,
  WeekFrame,
  Weekday,
  Workout
} from './types.ts';
import { validatePlan } from './validate.ts';
import { planVolume } from './volume.ts';
import {
  easyRun,
  longRun,
  qualityBudgets,
  qualitySession,
  raceDay,
  type PrevDose,
  type SessionResult
} from './workouts.ts';

const r2 = (x: number): number => Math.round(x * 100) / 100;
const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;
const floorHalf = (x: number): number => Math.floor(x * 2 + 1e-9) / 2;

interface WeekSessions {
  q1: QualityType;
  q2: QualityType | null;
  easyStrides: boolean;
  scale: number;
  note: string | null;
}

/** Koji kvalitet ide u koju nedelju (podatak faze, ne naknadna računica). */
function sessionsFor(f: WeekFrame): WeekSessions {
  const main: Record<'base' | 'peak' | 'sharpen', QualityType> = {
    base: 'R',
    peak: 'I',
    sharpen: 'RP'
  };
  if (f.phase === 'base' || f.phase === 'peak' || f.phase === 'sharpen') {
    if (f.deload)
      return {
        q1: main[f.phase],
        q2: null,
        easyStrides: false,
        scale: P.quality.deloadBudgetScale,
        note: 'Rasterećenje: jedan kratak kvalitet.'
      };
    if (f.phase === 'base')
      return { q1: 'R', q2: 'T_short', easyStrides: true, scale: 1, note: null };
    if (f.phase === 'peak')
      return { q1: 'I', q2: 'T_cruise', easyStrides: false, scale: 1, note: null };
    return { q1: 'RP', q2: 'R_sharpen', easyStrides: false, scale: 1, note: null };
  }
  if (f.taperStep === 1)
    return { q1: 'RP', q2: 'T_short', easyStrides: false, scale: 1, note: 'Taper 1/2.' };
  return { q1: 'RP', q2: null, easyStrides: true, scale: 1, note: 'Taper 2/2: jedan kvalitet.' };
}

function budgetFor(type: QualityType, b: { I: number; T: number; R: number }): number {
  if (type === 'R' || type === 'R_sharpen') return b.R;
  if (type === 'T_short' || type === 'T_cruise') return b.T;
  return b.I;
}

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

/** T cruise traži ≥ minReps × najkraća cruise opcija; inače je drugi kvalitet kontinuirani T. */
function peakSecond(tBudget: number): QualityType {
  const shortest = Math.min(...P.quality.repOptionsKm.Tcruise);
  return tBudget + 1e-9 >= P.quality.minReps.T * shortest ? 'T_cruise' : 'T_short';
}

/** Rezultat nedelje + doza glavnog kvaliteta (ulaz za progresiju sledeće nedelje iste faze). */
type TrainingWeekResult =
  { ok: true; week: PlanWeek; mainDose: PrevDose | null } | { ok: false; reason: Reason };

/**
 * Nedelja treninga. JEDINO mesto koje određuje dužinu dugog i laganih trkova (2.1.0, jedan prolaz):
 * dugi = min(35% cilja, 90 min sporijim E, cilj − kvalitet − n × min. lagan); lagan = (cilj − kvalitet − dugi) / broj laganih dana;
 * ako je to > dugi, lagan = dugi i plannedKm < targetKm (napomena), bez podizanja ičega drugog.
 * `prev` = doza glavnog kvaliteta prethodne ne-rasteretne nedelje ISTE faze (progresija doze).
 */
function buildTrainingWeek(
  f: WeekFrame,
  target: number,
  pattern: Pattern,
  p: Paces,
  prev: PrevDose | null
): TrainingWeekResult {
  const budgets = qualityBudgets(target);
  const s = sessionsFor(f);
  if (s.q2 === 'T_cruise') s.q2 = peakSecond(budgets.T);
  const fail = (r: SessionResult & { ok: false }): TrainingWeekResult => ({
    ok: false,
    reason: {
      code: 'QUALITY_INFEASIBLE',
      week: f.index,
      message: `Nedelja ${f.index}: ${r.message}`
    }
  });
  const progressive =
    !f.deload && (f.phase === 'base' || f.phase === 'peak' || f.phase === 'sharpen');
  const q1 = qualitySession(
    s.q1,
    r2(budgetFor(s.q1, budgets) * s.scale),
    target,
    p,
    progressive ? { prev } : undefined
  );
  if (!q1.ok) return fail(q1);
  const q2 = s.q2 ? qualitySession(s.q2, budgetFor(s.q2, budgets), target, p) : null;
  if (q2 && !q2.ok) return fail(q2);

  const easyDays: { w: Weekday; role: DayRole }[] = [{ w: pattern.easy, role: 'easy' }];
  if (!q2) easyDays.push({ w: pattern.q2, role: 'easy' });
  const easyMin = f.phase === 'taper' ? P.easy.taperMinKm : P.easy.minKm;
  const qualityKm = q1.workout.km + (q2 && q2.ok ? q2.workout.km : 0);
  // Dugi = min(35% cilja, 90 min, prostor koji laganim danima ostavlja minimum) — jedna formula.
  const longKm = Math.min(
    floorHalf(target * P.long.maxShare),
    floorHalf(P.long.maxSec / p.E.slow),
    floorHalf(target - qualityKm - easyDays.length * easyMin)
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

  const days: PlanDay[] = [
    day(f, pattern.q1, 'q1', q1.workout),
    day(f, pattern.long, 'long', longRun(longKm, p))
  ];
  if (q2 && q2.ok) days.push(day(f, pattern.q2, 'q2', q2.workout));
  easyDays.forEach((e, i) => days.push(day(f, e.w, e.role, easyRun(shares[i]!, p, s.easyStrides))));
  days.sort((a, b) => a.date.localeCompare(b.date));
  const plannedKm = r2(days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0));
  const notes = s.note ? [s.note] : [];
  if (easyCappedAtLong)
    notes.push(
      `Lagan trk ograničen na dužinu dugog (${longKm} km): planirano ${plannedKm} km < cilj ${target} km.`
    );
  return {
    ok: true,
    week: { ...f, targetKm: target, plannedKm, budgets, easyCappedAtLong, days, notes },
    mainDose: progressive ? q1.choice : null
  };
}

function buildRaceWeek(
  f: WeekFrame,
  target: number,
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: string,
  p: Paces
): WeekResult {
  const budgets = qualityBudgets(target);
  const gapToRace = (w: Weekday): number => daysBetween(dateOfWeekday(f, w), raceDate);
  const raceWd = weekdayOf(raceDate);
  // Oštrenje: zahtevni dan šablona ≥ sharpenerMinGapDays pre trke, najbliži trci.
  const pref: Weekday[] = [pattern.q1, pattern.q2, pattern.long];
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
  const sharp = qualitySession('RP_sharpener', budgets.I, target, p);
  if (!sharp.ok)
    return {
      ok: false,
      reason: {
        code: 'QUALITY_INFEASIBLE',
        week: f.index,
        message: `Nedelja ${f.index}: ${sharp.message}`
      }
    };

  // Lagani dani: ostali dani trčanja pre trke. Broj laganih dana n = min(broj, ⌊ostatak / minimum⌋)
  // (jedan izračun). Dan pred trku (ako je dan trčanja) ostaje prvi: kratko istrčavanje
  // min(raceEveMaxKm, jednak deo) sa ubrzanjima; ostatak se deli jednako na ostale izabrane dane
  // (otpadaju najkasniji). Sve u jednom prolazu.
  const others = runDays
    .filter((w) => w !== sharpDay && w !== raceWd && gapToRace(w) > 0)
    .sort((a, b) => gapToRace(b) - gapToRace(a));
  const eve = others.find((w) => gapToRace(w) === 1);
  const rest = others.filter((w) => w !== eve);
  const remainder = r2(target - sharp.workout.km);
  const n = Math.min(others.length, Math.max(0, Math.floor(remainder / P.easy.taperMinKm + 1e-9)));
  const withEve = eve !== undefined && n > 0;
  const eveKm = withEve ? Math.min(P.easy.raceEveMaxKm, floor1(remainder / n)) : 0;
  const restN = withEve ? n - 1 : n;
  const shares = splitEasy(r2(remainder - eveKm), restN);
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
  return {
    ok: true,
    week: {
      ...f,
      targetKm: target,
      plannedKm: r2(days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0)),
      budgets,
      easyCappedAtLong: false,
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
  const vol = planVolume(frames, input.currentWeeklyKm);

  const weeks: PlanWeek[] = [];
  const reasons: Reason[] = [];
  // Progresija doze: doza glavnog kvaliteta poslednje ne-rasteretne nedelje, po fazi.
  const lastDose: Partial<Record<Phase, PrevDose>> = {};
  frames.forEach((f, i) => {
    const target = vol.targets[i]!;
    if (f.phase === 'race') {
      const r = buildRaceWeek(f, target, pat.pattern, input.runDays, input.raceDate, paces);
      if (r.ok) weeks.push(r.week);
      else reasons.push(r.reason);
      return;
    }
    const r = buildTrainingWeek(f, target, pat.pattern, paces, lastDose[f.phase] ?? null);
    if (!r.ok) {
      reasons.push(r.reason);
      return;
    }
    weeks.push(r.week);
    if (r.mainDose) lastDose[f.phase] = r.mainDose;
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
