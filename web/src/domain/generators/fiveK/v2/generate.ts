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

function buildTrainingWeek(f: WeekFrame, target: number, pattern: Pattern, p: Paces): WeekResult {
  const budgets = qualityBudgets(target);
  const s = sessionsFor(f);
  if (s.q2 === 'T_cruise') s.q2 = peakSecond(budgets.T);
  const fail = (r: SessionResult & { ok: false }): WeekResult => ({
    ok: false,
    reason: {
      code: 'QUALITY_INFEASIBLE',
      week: f.index,
      message: `Nedelja ${f.index}: ${r.message}`
    }
  });
  const q1 = qualitySession(s.q1, r2(budgetFor(s.q1, budgets) * s.scale), target, p);
  if (!q1.ok) return fail(q1);
  const q2 = s.q2 ? qualitySession(s.q2, budgetFor(s.q2, budgets), target, p) : null;
  if (q2 && !q2.ok) return fail(q2);

  const longKm = Math.min(floorHalf(target * P.long.maxShare), floorHalf(P.long.maxSec / p.E.slow));
  const easyDays: { w: Weekday; role: DayRole }[] = [{ w: pattern.easy, role: 'easy' }];
  if (!q2) easyDays.push({ w: pattern.q2, role: 'easy' });
  const fixed = q1.workout.km + (q2 && q2.ok ? q2.workout.km : 0) + longKm;
  const shares = splitEasy(r2(target - fixed), easyDays.length);
  const easyMin = f.phase === 'taper' ? P.easy.taperMinKm : P.easy.minKm;
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
  return {
    ok: true,
    week: {
      ...f,
      targetKm: target,
      plannedKm: r2(days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0)),
      budgets,
      days,
      notes: s.note ? [s.note] : []
    }
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
  // Oštrenje: zahtevni dan šablona ≥ min dana pre trke; poželjno ≥ preferred, što bliže trci.
  const pref: Weekday[] = [pattern.q1, pattern.q2, pattern.long];
  const cands = pref
    .filter((w) => w !== raceWd && gapToRace(w) >= P.schedule.sharpenerMinGapDays)
    .sort((a, b) => {
      const ga = gapToRace(a);
      const gb = gapToRace(b);
      const pa = ga >= P.schedule.sharpenerPreferredGapDays ? 0 : 1;
      const pb = gb >= P.schedule.sharpenerPreferredGapDays ? 0 : 1;
      return pa - pb || ga - gb || pref.indexOf(a) - pref.indexOf(b);
    });
  const sharpDay = cands[0];
  if (!sharpDay)
    return {
      ok: false,
      reason: {
        code: 'WEEK_INFEASIBLE',
        week: f.index,
        message: 'Trkačka nedelja: nema dana za oštrenje ≥ 2 dana pre trke.'
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

  // Lagani dani: ostali dani trčanja pre trke. Ako ostatak ne pokriva minimum, broj laganih dana je
  // ⌊ostatak / minimum⌋ (jedan izračun); prvo otpada dan pred trku, pa najkasniji.
  const others = runDays
    .filter((w) => w !== sharpDay && w !== raceWd && gapToRace(w) > 0)
    .sort((a, b) => {
      const da = gapToRace(a) === 1 ? 1 : 0;
      const db = gapToRace(b) === 1 ? 1 : 0;
      return da - db || gapToRace(b) - gapToRace(a);
    });
  const remainder = r2(target - sharp.workout.km);
  const n = Math.min(others.length, Math.max(0, Math.floor(remainder / P.easy.taperMinKm + 1e-9)));
  const shares = splitEasy(remainder, n);
  const days: PlanDay[] = [day(f, sharpDay, 'q1', sharp.workout)];
  others.slice(0, n).forEach((w, i) => days.push(day(f, w, 'easy', easyRun(shares[i]!, p, false))));
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
  if (n < others.length)
    notes.push(
      `Izostavljeno laganih dana: ${others.length - n} (ostatak < ${P.easy.taperMinKm} km po trku).`
    );
  return {
    ok: true,
    week: {
      ...f,
      targetKm: target,
      plannedKm: r2(days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0)),
      budgets,
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
  frames.forEach((f, i) => {
    const target = vol.targets[i]!;
    const r =
      f.phase === 'race'
        ? buildRaceWeek(f, target, pat.pattern, input.runDays, input.raceDate, paces)
        : buildTrainingWeek(f, target, pat.pattern, paces);
    if (r.ok) weeks.push(r.week);
    else reasons.push(r.reason);
  });
  if (reasons.length > 0) return { ok: false, reasons, violations: [] };

  const plan: FiveKV2Plan = {
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
