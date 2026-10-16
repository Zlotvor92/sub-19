/* generateFiveKV2(input) → plan ili strukturisano odbijanje.
   Bez čitanja sata: svi datumi dolaze iz ulaza. Ista vrednost ulaza → isti JSON. */

import { daysBetween } from './dates.ts';
import { checkInput, hasFreshResult } from './input.ts';
import {
  assessGoal,
  beginnerGoal,
  feelPaces,
  goalWithoutData,
  pacesFromVdot,
  raceTimeForVdot,
  vdotFromResult
} from './paces.ts';
import { isShortPrep, periodize, phaseCounts } from './periodize.ts';
import { FIVE_K_V2_POLICY as P, rulesOf, type Athlete, type RunDaysCount } from './policy.ts';
import { choosePattern } from './schedule.ts';
import type {
  FiveKV2Input,
  FiveKV2Plan,
  GenerateResult,
  GoalAssessment,
  PaceModel,
  Phase,
  PlanWeek,
  Reason
} from './types.ts';
import { validatePlan } from './validate.ts';
import { planVolume } from './volume.ts';
import { buildRaceWeek, buildTrainingWeek } from './week.ts';
import type { WeekDose } from './workouts.ts';

const fmt = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

export function generateFiveKV2(raw: unknown): GenerateResult {
  const checked = checkInput(raw);
  if (!checked.ok) return { ok: false, reasons: checked.reasons, violations: [] };
  const input: FiveKV2Input = checked.input;

  // 2.4.0: ko trči (jedino mesto): broj dana, početnik, plan po osećaju (bez pouzdanog rezultata).
  const fresh = hasFreshResult(input);
  const a: Athlete = {
    days: input.runDays.length as RunDaysCount,
    beginner: input.experience === 'beginner',
    feel: !fresh
  };
  const rules = rulesOf(a);
  const pat = choosePattern(input.runDays, rules.qualityDays);
  if (!pat.ok) return { ok: false, reasons: [pat.reason], violations: [] };

  const vdot = fresh
    ? Math.round(vdotFromResult(input.recentResult.distanceM, input.recentResult.timeSec) * 10) / 10
    : null;
  const paces: PaceModel =
    vdot === null ? feelPaces(input.typicalEasyPaceSecPerKm!) : pacesFromVdot(vdot);
  const totalWeeks = (daysBetween(input.startDate, input.raceDate) + 1) / 7;
  const frames = periodize(input.startDate, totalWeeks, rules.deloadEvery, a.feel);
  const vol = planVolume(frames, input.currentWeeklyKm, paces, a);

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
      a,
      phaseCounts(totalWeeks).taper
    );
    if (!r.ok) {
      reasons.push(r.reason);
      return;
    }
    if (i === 0 && vol.startCapped)
      r.week.notes.push(
        `Trenutni obim (${input.currentWeeklyKm} km) je veći od onoga što ${a.days} dana nose (${vol.capacityKm} km); plan kreće od ${vol.capacityKm} km.${a.days < (a.beginner ? P.beginner.maxRunDays : 5) ? ' Za veći obim izaberi više dana trčanja.' : ''}`
      );
    weeks.push(r.week);
    if (r.dose) lastDose[f.phase] = r.dose;
  });
  if (reasons.length > 0) return { ok: false, reasons, violations: [] };

  // 2.4.0: cilj — bez pouzdanog rezultata „nedovoljno podataka"; početnik najviše „orijentir".
  let goal: GoalAssessment | null = null;
  if (input.goalTimeSec)
    goal =
      vdot === null
        ? goalWithoutData(input.goalTimeSec)
        : a.beginner
          ? beginnerGoal(assessGoal(vdot, input.goalTimeSec))
          : assessGoal(vdot, input.goalTimeSec);
  const notes: string[] = isShortPrep(totalWeeks) ? [P.phases.shortNote] : [];
  if (a.feel) {
    const test = frames.find((f) => f.test);
    notes.push(P.feel.note);
    if (test) notes.push(P.feel.testNote.replace('{week}', String(test.index)));
    notes.push(P.feel.forecastNote);
    const old = input.recentResult;
    if (old)
      notes.push(
        P.feel.oldResultNote
          .replace('{result}', `${old.distanceM / 1000}K ${fmt(old.timeSec)}`)
          .replace('{date}', old.date)
      );
  }
  if (a.beginner)
    notes.push(
      `Početnik: ${rules.qualityDays} kvalitet nedeljno od nedelje ${P.beginner.introWeeks + 1}, bez I; rast obima ≤ ${rules.maxBuildGrowth * 100}%, dugi ≤ ${rules.longMaxSec / 60} min, vrh ≤ ${rules.peakCapFactor} × start, rasterećenje svake ${rules.deloadEvery}. nedelje.`
    );

  const plan: FiveKV2Plan = {
    policyId: P.id,
    policyVersion: P.version,
    input,
    paceMode: a.feel ? 'feel' : 'vdot',
    experience: a.beginner ? 'beginner' : 'regular',
    vdot,
    paces,
    predicted5kSec: vdot === null ? null : raceTimeForVdot(vdot, P.paces.raceDistanceM),
    goal,
    pattern: pat.pattern,
    startKm: vol.startKm,
    peakKm: vol.peakKm,
    capacityKm: vol.capacityKm,
    notes,
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
