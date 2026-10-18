/* 10K v2 — generisanje. generateTenKV2(input) = construct(input, []): potpis je spreman za korake
   adaptacije (segment 04), a do tada koraka nema. Redosled: ulaz (D1, D26, D28, D29) → tempo (D2 iz
   rezultata ili D26 po osećaju) → raspored (D9) → faze, rasterećenja i test (D4/D5/D27) → po nedelji cilj
   (D6) i konstrukcija → validator (samo prijavljuje). */

import { checkInput } from './input.ts';
import { assessGoal, feelPaces, pacesFromVdot, predicted10k } from './paces.ts';
import { periodize, isBuildPhase } from './periodize.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import { advance, INITIAL_QUALITY, type QualityState } from './quality.ts';
import type { GenerateResult, PlanWeek, TenKV2AdaptStep, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import {
  capacityLimits,
  capacityMessage,
  fit10,
  nominal10,
  peakCap10,
  raceWeekTarget10,
  startKm10,
  type VolumeHistory
} from './volume.ts';
import { buildWeek, raceWeek, type WeekContext } from './week.ts';
import { fmtKm, fmtSec as fmtPace, warmupCooldown } from './workouts.ts';

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
  const { input, weeks, pace, pattern, rule } = chk;
  const feel = pace.kind === 'feel';
  const paces =
    pace.kind === 'feel' ? feelPaces(pace.easySecPerKm).paces : pacesFromVdot(pace.vdotRaw);
  // D26: u planu po osećaju prognoza služi samo za trajanje segmenta trke (procena), plan je nema.
  const raceSec = predicted10k(paces);
  const frames = periodize(input.startDate, weeks, feel);
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
    wc: warmupCooldown(input.currentWeeklyKm, rule.beginner),
    rule,
    feel
  };
  const start10 = startKm10(input.currentWeeklyKm);
  const cap10 = peakCap10(start10, rule);

  let quality: QualityState = INITIAL_QUALITY;
  const vol: VolumeHistory = { lastBuild10: null, peak10: 0 };
  let lastLong10: number | null = null;
  let longest10 = 0;
  let taperRpM = 0;
  /** D23: najkraći lagan dan tapera [0,1 km] (gornja granica laganog dana trkačke nedelje). */
  let taperEasy10 = Infinity;
  const out: PlanWeek[] = [];
  for (const frame of frames) {
    if (frame.phase === 'race') {
      const prev = out[out.length - 1];
      const prevHard = prev ? (prev.days.filter((d) => d.hard).pop()?.date ?? null) : null;
      const w = raceWeek(ctx, frame, taperRpM, prevHard, taperEasy10);
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
    const nominal = nominal10(frame, vol, start10, cap10, rule);
    const make = (t10: number, relax = false) =>
      buildWeek(ctx, frame, t10, quality, lastLong10, longest10, relax);
    // Samo kad nijedan cilj nije izvodljiv po pravilu — ista pretraga cilja, drugi put, sa popuštanjem
    // (week.ts buildWeek `relax`): D11 ispred D12 u izgradnji, rasterećenje bez kvaliteta, taper samo RP.
    let relax = false;
    const last = vol.lastBuild10;
    let fit = fit10(nominal, frame, cap10, rule, (t10) => make(t10) !== null, last);
    if (!fit) {
      relax = true;
      fit = fit10(nominal, frame, cap10, rule, (t10) => make(t10, true) !== null, last);
    }
    if (!fit)
      return {
        ok: false,
        reasons: [
          {
            code: 'WEEK_INFEASIBLE',
            message: `Nedelja ${frame.index}: nijedan cilj od ${rule.weekMinKm} km naviše ne može da se sastavi po pravilima.`,
            week: frame.index
          }
        ]
      };
    const w = make(fit.target10, relax)!;
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
    if (frame.phase === 'taper') {
      taperRpM = w.days.find((d) => d.role === 'q1')?.workout.dose?.doseM ?? 0;
      for (const d of w.days)
        if (d.role === 'easy') taperEasy10 = Math.min(taperEasy10, Math.round(d.workout.km * 10));
    }
    if (isBuildPhase(frame.phase) && !frame.deload) {
      vol.lastBuild10 = fit.target10;
      vol.peak10 = Math.max(vol.peak10, fit.target10);
      lastLong10 = w.long10;
      quality = advance(w.picks!, quality);
    }
  }

  const plan: TenKV2Plan = {
    policyId: P.id,
    policyVersion: P.version,
    input,
    vdot: paces.vdot,
    paceBasis: feel ? 'feel' : 'result',
    paces,
    predicted10kSec: feel ? null : raceSec,
    goal: input.goalTimeSec && !feel ? assessGoal(paces.vdot, input.goalTimeSec, weeks) : null,
    pattern,
    startKm: start10 / 10,
    peakCapKm: cap10 / 10,
    peakKm: vol.peak10 / 10,
    notes: [],
    weeks: out,
    warnings: []
  };
  if (pace.kind === 'feel') {
    const t = out.find((w) => w.test)!;
    const td = t.days.find((d) => d.workout.kind === 'test')!;
    plan.notes.push(
      `Plan po osećaju (D26): ${pace.why}. E = lagan tempo ${fmtPace(pace.easySecPerKm)}/km ± ${P.feel.eRangeSec} s; tempo T/I/R/RP je orijentir (procena) iz procene VDOT ${fmtKm(paces.vdot)} — trening vodi RPE.`,
      `Test ${P.test.km} km: nedelja ${t.index}, ${td.date} (D27). Ocena cilja i prognoza 10K: posle testa.`
    );
  }
  if (out.some((w) => isBuildPhase(w.phase) && !w.deload && w.fitted === 'down'))
    plan.notes.push(
      `${capacityMessage(input.runDays.length, rule, capacityLimits(out, rule, paces))} Vrh ${fmtKm(plan.peakKm)} km umesto do ${fmtKm(plan.peakCapKm)} km (D6).`
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
