/* 10K v2 — generisanje. generateTenKV2(input) = construct(input, []): potpis je spreman za korake
   adaptacije (segment 04), a do tada koraka nema. Redosled: ulaz (D1) → tempo (D2) → raspored (D9) →
   faze i rasterećenja (D4/D5) → po nedelji cilj (D6) i konstrukcija → validator (samo prijavljuje). */

import { checkInput } from './input.ts';
import { assessGoal, pacesFromVdot, predicted10k } from './paces.ts';
import { periodize, isBuildPhase } from './periodize.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import { advance, INITIAL_QUALITY, type QualityState } from './quality.ts';
import type { GenerateResult, PlanWeek, TenKV2AdaptStep, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import {
  CAPACITY_MESSAGE,
  fit10,
  nominal10,
  peakCap10,
  raceWeekTarget10,
  startKm10,
  type VolumeHistory
} from './volume.ts';
import { buildWeek, raceWeek, type WeekContext } from './week.ts';
import { fmtKm, warmupCooldown } from './workouts.ts';

export function generateTenKV2(input: unknown): GenerateResult {
  return construct(input, []);
}

export function construct(raw: unknown, steps: readonly TenKV2AdaptStep[]): GenerateResult {
  if (steps.length > 0)
    return {
      ok: false,
      reasons: [{ code: 'ADAPT_NOT_SUPPORTED', message: 'Adaptacija 10K v2 dolazi u segmentu 04.' }]
    };
  const chk = checkInput(raw);
  if (!chk.ok) return chk;
  const { input, weeks, vdotRaw, pattern } = chk;
  const paces = pacesFromVdot(vdotRaw);
  const raceSec = predicted10k(paces);
  const frames = periodize(input.startDate, weeks);
  if (!frames)
    return {
      ok: false,
      reasons: [
        { code: 'WEEK_INFEASIBLE', message: 'Nema rasporeda rasterećenja po pravilima D5.' }
      ]
    };
  const ctx: WeekContext = {
    input,
    paces,
    pattern,
    raceSec,
    wc: warmupCooldown(input.currentWeeklyKm)
  };
  const start10 = startKm10(input.currentWeeklyKm);
  const cap10 = peakCap10(start10);

  let quality: QualityState = INITIAL_QUALITY;
  const vol: VolumeHistory = { lastBuild10: null, peak10: 0 };
  let lastLong10: number | null = null;
  let longest10 = 0;
  let taperRpM = 0;
  const out: PlanWeek[] = [];
  for (const frame of frames) {
    if (frame.phase === 'race') {
      const w = raceWeek(ctx, frame, taperRpM);
      const t10 = raceWeekTarget10(w.planned100);
      out.push({
        ...frame,
        targetKm: t10 / 10,
        plannedKm: w.planned100 / 100,
        nominalKm: t10 / 10,
        fitted: null,
        days: w.days,
        notes: w.notes
      });
      continue;
    }
    const nominal = nominal10(frame, vol, start10, cap10);
    const make = (t10: number, allowDrop = false) =>
      buildWeek(ctx, frame, t10, quality, lastLong10, longest10, allowDrop);
    // D11 ispred D12: samo kad nijedan cilj nije izvodljiv uz „doza ne pada", doza koja ne staje u
    // plafon sme da se spusti — ista pretraga cilja, drugi put.
    let drop = false;
    let fit = fit10(nominal, frame, cap10, (t10) => make(t10) !== null);
    if (!fit) {
      drop = true;
      fit = fit10(nominal, frame, cap10, (t10) => make(t10, true) !== null);
    }
    if (!fit)
      return {
        ok: false,
        reasons: [
          {
            code: 'WEEK_INFEASIBLE',
            message: `Nedelja ${frame.index}: nijedan cilj od ${P.week.minKm} km naviše ne može da se sastavi po pravilima.`,
            week: frame.index
          }
        ]
      };
    const w = make(fit.target10, drop)!;
    const notes = [...w.notes];
    if (fit.fitted)
      notes.unshift(
        `Cilj po pravilu ${fmtKm(nominal / 10)} km nije izvodljiv u konstrukciji nedelje; nedelja ide na najbliži izvodljiv cilj ${fmtKm(fit.target10 / 10)} km (D6).`
      );
    out.push({
      ...frame,
      targetKm: fit.target10 / 10,
      plannedKm: w.planned100 / 100,
      nominalKm: nominal / 10,
      fitted: fit.fitted,
      days: w.days,
      notes
    });
    if (w.long10 !== null) longest10 = Math.max(longest10, w.long10);
    if (frame.phase === 'taper')
      taperRpM = w.days.find((d) => d.role === 'q1')?.workout.dose?.doseM ?? 0;
    if (isBuildPhase(frame.phase) && !frame.deload) {
      vol.lastBuild10 = fit.target10;
      vol.peak10 = Math.max(vol.peak10, fit.target10);
      lastLong10 = w.long10;
      quality = advance(w.picks!);
    }
  }

  const plan: TenKV2Plan = {
    policyId: P.id,
    policyVersion: P.version,
    input,
    vdot: paces.vdot,
    paces,
    predicted10kSec: raceSec,
    goal: input.goalTimeSec ? assessGoal(paces.vdot, input.goalTimeSec, weeks) : null,
    pattern,
    startKm: start10 / 10,
    peakCapKm: cap10 / 10,
    peakKm: vol.peak10 / 10,
    notes: [],
    weeks: out,
    warnings: []
  };
  if (out.some((w) => isBuildPhase(w.phase) && !w.deload && w.fitted === 'down'))
    plan.notes.push(
      `${CAPACITY_MESSAGE} Vrh ${fmtKm(plan.peakKm)} km umesto do ${fmtKm(plan.peakCapKm)} km (D6).`
    );
  const violations = validatePlan(plan);
  const errors = violations.filter((v) => v.severity === 'error');
  if (errors.length > 0)
    return {
      ok: false,
      reasons: errors.map((v) => ({
        code: 'PLAN_VIOLATES_POLICY',
        message: `${v.rule}: ${v.message}`,
        ...(v.week !== undefined ? { week: v.week } : {})
      }))
    };
  plan.warnings = violations;
  return { ok: true, plan };
}
