/* generateFiveKV2(input) → plan ili strukturisano odbijanje.
   Bez čitanja sata: svi datumi dolaze iz ulaza. Ista vrednost ulaza → isti JSON. */

import { addDays, daysBetween, weekdayIndex, weekdayOf } from './dates.ts';
import { checkInput } from './input.ts';
import {
  assessGoal,
  beginnerGoal,
  feelPaces,
  goalWithoutData,
  pacesFromVdot,
  raceTimeForVdot
} from './paces.ts';
import { isShortPrep, periodize, phaseCounts } from './periodize.ts';
import { FIVE_K_V2_POLICY as P, rulesOf, type Athlete } from './policy.ts';
import { buildRunWalkPlan } from './runWalk.ts';
import { choosePattern } from './schedule.ts';
import { athleteAt, baseAthlete, baseVdot, doseResetAt, framesFor, pacesAt } from './steps.ts';
import type {
  AdaptStep,
  FiveKV2Input,
  FiveKV2Plan,
  GenerateResult,
  GoalAssessment,
  PaceModel,
  Pattern,
  Phase,
  PlanWeek,
  Reason,
  WeekFrame,
  Weekday
} from './types.ts';
import { validatePlan } from './validate.ts';
import { adaptVolume, planVolume, type VolumePlan } from './volume.ts';
import { buildRaceWeek, buildTrainingWeek } from './week.ts';
import type { WeekDose } from './workouts.ts';

const fmt = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** 2.5.0: rezultat zajedničkog konstruktora (generate i adapt). */
export interface Constructed {
  athlete: Athlete;
  pattern: Pattern;
  frames: WeekFrame[];
  weeks: PlanWeek[];
  vol: VolumePlan;
  /** Vrh za taper/trkačku nedelju i start za vrh posle koraka (bez koraka = vol.peakKm / vol.startKm). */
  peakRefKm: number;
  startRefKm: number;
  /** 2.7.0 (Odluka 9): rasterećenja ukinuta posle nedelje smanjenja (steps.framesFor) — nedelja → indeks
      koraka; prazno bez koraka. */
  dropped: Map<number, number>;
}

/**
 * Konstruktor plana — JEDAN za generate i adapt (2.5.0): periodize → volume → week. `steps` = koraci
 * adaptacije (assess.ts), redom; bez njih je ovo tačno generator 2.4.1. Ograničenja ulaze u okvire
 * (steps.framesFor), ciljeve (volume.adaptVolume) i tempo nedelje (steps.pacesAt); nema koraka koji
 * posle konstrukcije menja nedelju.
 */
export function construct(
  input: FiveKV2Input,
  steps: readonly AdaptStep[] = []
): { ok: true; c: Constructed } | { ok: false; reasons: Reason[] } {
  // 2.4.0: ko trči (jedino mesto): broj dana, početnik, plan po osećaju (bez pouzdanog rezultata).
  const a = baseAthlete(input);
  const rules = rulesOf(a);
  const pat = choosePattern(input.runDays, rules.qualityDays);
  if (!pat.ok) return { ok: false, reasons: [pat.reason] };

  const vdot = baseVdot(input);
  const paces: PaceModel =
    vdot === null ? feelPaces(input.typicalEasyPaceSecPerKm!) : pacesFromVdot(vdot);
  const totalWeeks = (daysBetween(input.startDate, input.raceDate) + 1) / 7;
  const frames0 = periodize(input.startDate, totalWeeks, rules.deloadEvery, a.feel);
  const vol = planVolume(frames0, input.currentWeeklyKm, paces, a);
  const dropped = new Map<number, number>();
  const frames =
    steps.length > 0 ? framesFor(input, steps, pat.pattern, totalWeeks, dropped) : frames0;
  const ctx = (w: number): { p: PaceModel; a: Athlete } =>
    steps.length > 0
      ? { p: pacesAt(input, steps, w), a: athleteAt(input, steps, w) }
      : { p: paces, a };
  const adapted =
    steps.length > 0
      ? adaptVolume(frames, vol, steps, ctx)
      : { targets: vol.targets, peakKm: vol.peakKm, startRefKm: vol.startKm };

  const weeks: PlanWeek[] = [];
  const reasons: Reason[] = [];
  // Progresija doze: doza glavnog kvaliteta poslednje ne-rasteretne nedelje, po fazi. 2.5.0: korak sa
  // novim ciljem obima (pauza, izvršenje; nov start) i promena načina tempa (po osećaju → VDOT) počinju
  // progresiju iznova (manji obim → doza sme da padne; isti segment kao u validate.ts). 2.6.1: i korak bola
  // sa povratkom, od nedelje posle sidra (steps.doseResetAt).
  let lastDose: Partial<Record<Phase, WeekDose>> = {};
  frames.forEach((f, i) => {
    const target = adapted.targets[i]!;
    const { p, a: aw } = ctx(f.index);
    if (
      steps.some((s) => doseResetAt(s, frames) === f.index) ||
      (i > 0 && ctx(f.index - 1).a.feel !== aw.feel)
    )
      lastDose = {};
    // 2.5.0: u adaptiranoj nedelji kvalitet koji ne staje u (smanjen) obim → jedan kvalitet doze
    // rasterećenja → bez kvaliteta (trkačka nedelja: bez oštrenja); odluka konstruktora, ne naknadna.
    const adaptive = steps.length > 0 && f.index >= steps[0]!.firstWeek;
    if (f.phase === 'race') {
      const prevLong =
        weeks[weeks.length - 1]?.days.find((d) => d.role === 'long')?.workout.km ?? 0;
      let r = buildRaceWeek(f, target, pat.pattern, input.runDays, input.raceDate, p, prevLong);
      // 2.6.0: i kad oštrenje ostavlja nedelju ispod minimuma trkačke nedelje (mala granica posle
      // smanjenja) — oštrenje otpada (pravilo f), lagani dani nose granicu.
      const short = r.ok && r.week.plannedKm + 1e-9 < P.week.minRaceWeekKm;
      if ((!r.ok || short) && adaptive) {
        const all = input.runDays.map((w) => dateIn(f, w));
        r = buildRaceWeek(
          { ...f, limits: { ...f.limits, noQuality: all } },
          target,
          pat.pattern,
          input.runDays,
          input.raceDate,
          p,
          prevLong
        );
        if (short && r.ok)
          r.week.notes.push(
            `Adaptacija: oštrenje ne staje u granicu ${target} km (nedelja bi bila < ${P.week.minRaceWeekKm} km).`
          );
      }
      if (r.ok) weeks.push(r.week);
      else reasons.push(r.reason);
      return;
    }
    const build = (g: WeekFrame) =>
      buildTrainingWeek(
        g,
        target,
        pat.pattern,
        p,
        lastDose[f.phase] ?? null,
        aw,
        phaseCounts(totalWeeks).taper
      );
    let r = build(f);
    for (const q of ['one', 'none'] as const) {
      if (r.ok || !adaptive || (q === 'one' && f.limits?.quality !== undefined)) continue;
      const { swap: _swap, ...rest } = f.limits ?? {};
      // 2.6.0: kontrolno trčanje je glavni kvalitet nedelje — kad ne staje, otpada sa njim.
      r = build({ ...f, test: false, limits: { ...(q === 'one' ? f.limits : rest), quality: q } });
      if (r.ok)
        r.week.notes.push(
          `Adaptacija: kvalitet ne staje u obim ${target} km — ${q === 'one' ? 'jedan kvalitet doze rasterećenja' : 'nedelja bez kvaliteta'}${f.test ? ' (bez kontrolnog trčanja)' : ''}.`
        );
    }
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
  if (reasons.length > 0) return { ok: false, reasons };
  return {
    ok: true,
    c: {
      athlete: a,
      pattern: pat.pattern,
      frames,
      weeks,
      vol,
      peakRefKm: adapted.peakKm,
      startRefKm: adapted.startRefKm,
      dropped
    }
  };
}

function dateIn(f: WeekFrame, w: Weekday): string {
  const offset = (((weekdayIndex(w) - weekdayIndex(weekdayOf(f.startDate))) % 7) + 7) % 7;
  return addDays(f.startDate, offset);
}

export function generateFiveKV2(raw: unknown): GenerateResult {
  const checked = checkInput(raw);
  if (!checked.ok) return { ok: false, reasons: checked.reasons, violations: [] };
  const input: FiveKV2Input = checked.input;
  // 2.6.0: ne može 30 min kontinuirano → plan trčanje/hodanje (runWalk.ts).
  if (input.canRun30Min === false) {
    const rw = buildRunWalkPlan(input);
    const violations = validatePlan(rw);
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
    rw.warnings = violations;
    return { ok: true, plan: rw };
  }
  const built = construct(input);
  if (!built.ok) return { ok: false, reasons: built.reasons, violations: [] };
  const { athlete: a, frames, weeks, vol, pattern } = built.c;
  const rules = rulesOf(a);
  const vdot = baseVdot(input);
  const paces: PaceModel =
    vdot === null ? feelPaces(input.typicalEasyPaceSecPerKm!) : pacesFromVdot(vdot);
  const totalWeeks = weeks.length;

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
    pattern,
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
