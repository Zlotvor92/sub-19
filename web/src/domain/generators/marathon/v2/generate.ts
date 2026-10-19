/* Maraton v2 — generisanje. generateMarathonV2(input) = construct(input). Redosled: ulaz (M1) → tempo (M2) →
   raspored (M9) → faze i rasterećenja (M4/M5) → po nedelji cilj (M6/M5/M7) i konstrukcija → trkačka nedelja
   (M8) → validator (samo prijavljuje). Adaptacija (segment 04) koristiće isti konstruktor; ovde nema koraka
   koji posle konstrukcije menja nedelju. */

import { checkInput } from './input.ts';
import { jumpBase10, longJumpCap10, longJumpNote, recentLongNote } from './lengths.ts';
import { assessGoal, pacesFromVdot, predictedMarathon } from './paces.ts';
import { isBuildPhase, periodize, taperStep } from './periodize.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import { advance, INITIAL_QUALITY, type QualityState } from './quality.ts';
import type { GenerateResult, MarathonV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import {
  capacityLimits,
  capacityMessage,
  capacityWeeks,
  fit10,
  nominal10,
  peakCap10,
  raceWeekTarget10,
  startKm10,
  type VolumeHistory
} from './volume.ts';
import { buildWeek, type QualityMode, raceWeek, type WeekContext } from './week.ts';
import { fmtKm, warmupCooldown } from './workouts.ts';

const infeasible = (message: string, week?: number): GenerateResult => ({
  ok: false,
  reasons: [{ code: 'WEEK_INFEASIBLE', message, ...(week !== undefined ? { week } : {}) }]
});

/** M13a (pouka 6): sa skorašnjim najdužim trkom nedelja ne može da se sastavi → odbijanje sa preporukom. */
const recentTooShort = (
  r: number,
  km: number,
  days: number,
  weeks: number,
  week: number
): GenerateResult => ({
  ok: false,
  reasons: [
    {
      code: 'RECENT_LONG_TOO_SHORT',
      message: `Skorašnji najduži trk (${fmtKm(r)} km) je prekratak za ${fmtKm(km)} km nedeljno sa ${days} dana i ${weeks} nedelja do trke (nedelja ${week} ne može da se sastavi uz skok dugog ≤ 10 %, M13a); preporuka: duža priprema, manji početni obim ili više dana, ili polumaraton.`,
      week
    }
  ]
});

/** Konstruktor plana (jedan; adaptacija u segmentu 04 dodaje korake kao ulaz, ne posle konstrukcije). */
export function generateMarathonV2(raw: unknown): GenerateResult {
  const chk = checkInput(raw);
  if (!chk.ok) return chk;
  const { input, weeks, vdotRaw, pattern, rule, shortResult } = chk;
  const paces = pacesFromVdot(vdotRaw, input.currentWeeklyKm);
  const frames = periodize(input.startDate, weeks);
  if (!frames) return infeasible('Nema rasporeda rasterećenja po pravilima M5.');
  const phases = frames.map((f) => f.phase);
  const ctx: WeekContext = {
    input,
    paces,
    pattern,
    raceSec: predictedMarathon(paces),
    wc: warmupCooldown(input.currentWeeklyKm),
    rule
  };
  const recent = input.recentLongRunKm ?? null;
  const start10 = startKm10(input.currentWeeklyKm);
  const cap10 = peakCap10(start10, rule);

  let quality: QualityState = INITIAL_QUALITY;
  const h: VolumeHistory = { lastBuild10: null, peak10: 0 };
  let lastLong10: number | null = null;
  let longest10 = 0;
  /** M8: MP doza i najkraći lagan poslednje nedelje tapera (N−1). */
  let taperMpM = 0;
  let taperEasy10 = Infinity;
  /** M13a: dugi svake nedelje [0,1 km] (null u trkačkoj). */
  const longs10: (number | null)[] = [];
  const out: PlanWeek[] = [];
  for (const frame of frames) {
    if (frame.phase === 'race') {
      const prev = out[out.length - 1];
      const prevHard = prev ? (prev.days.filter((d) => d.hard).pop()?.date ?? null) : null;
      const w = raceWeek(ctx, frame, taperMpM, prevHard, taperEasy10);
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
      longs10.push(null);
      continue;
    }
    const taper = taperStep(phases, frame.index);
    const nominal = nominal10(frame, h, start10, cap10, taper);
    const jump10 = longJumpCap10(longs10, frame.index, recent);
    const make = (t10: number, mode: QualityMode) =>
      buildWeek(ctx, frame, t10, quality, lastLong10, longest10, taper, mode, jump10);
    // Samo kad nijedan cilj nije izvodljiv po pravilu — ista pretraga cilja, drugi put, sa popuštanjem
    // (week.ts 'relax'): M11 ispred M12 u izgradnji, zona tapera koja ne staje u plafon otpada.
    let fit: ReturnType<typeof fit10> = null;
    let mode: QualityMode = 'rule';
    for (const m of ['rule', 'relax'] as const) {
      fit = fit10(nominal, frame, cap10, rule, (t10) => make(t10, m) !== null);
      if (fit) {
        mode = m;
        break;
      }
    }
    if (!fit && recent !== null)
      return recentTooShort(
        recent,
        input.currentWeeklyKm,
        input.runDays.length,
        weeks,
        frame.index
      );
    if (!fit)
      return infeasible(
        `Nedelja ${frame.index}: nijedan cilj od ${rule.weekMinKm} km naviše ne može da se sastavi po pravilima.`,
        frame.index
      );
    const w = make(fit.target10, mode)!;
    const notes = [...w.notes];
    if (fit.fitted)
      notes.unshift(
        `Cilj po pravilu ${fmtKm(nominal / 10)} km nije izvodljiv u konstrukciji nedelje; nedelja ide na najbliži izvodljiv cilj ${fmtKm(fit.target10 / 10)} km (M6).`
      );
    // M13a: dugi na plafonu skoka; bez skorašnjeg najdužeg trka — napomena nedelje 1 sa pragom.
    if (w.jumpBound && w.long10 !== null)
      notes.push(longJumpNote(w.long10, jumpBase10(longs10, frame.index, recent)!));
    if (frame.index === 1 && recent === null && w.long10 !== null)
      notes.push(recentLongNote(w.long10));
    longs10.push(w.long10);
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
    if (taper === P.taper.weeks.length - 1) {
      taperMpM = w.days.map((d) => d.workout.dose).find((d) => d?.zone === 'MP')?.doseM ?? 0;
      for (const d of w.days)
        if (d.role === 'easy') taperEasy10 = Math.min(taperEasy10, Math.round(d.workout.km * 10));
    }
    if (isBuildPhase(frame.phase) && !frame.deload) {
      h.lastBuild10 = fit.target10;
      h.peak10 = Math.max(h.peak10, fit.target10);
      if (w.long10 !== null) lastLong10 = w.long10;
      if (w.picks) quality = advance(w.picks, quality);
    }
  }

  const plan: MarathonV2Plan = {
    policyId: P.id,
    policyVersion: P.version,
    input,
    vdot: paces.vdot,
    paces,
    predictedMarathonSec: predictedMarathon(paces),
    goal: input.goalTimeSec ? assessGoal(paces.mpVdot, input.goalTimeSec, weeks) : null,
    pattern,
    startKm: start10 / 10,
    peakCapKm: cap10 / 10,
    peakKm: h.peak10 / 10,
    notes: [],
    weeks: out,
    warnings: []
  };
  if (shortResult)
    plan.notes.push(
      `Rezultat 5 km: maratonska prognoza iz kratke trke je nesigurnija; MP iz VDOT ${fmtKm(paces.mpVdot)} (M1, M2).`
    );
  if (capacityWeeks(out, rule, paces, recent).length > 0)
    plan.notes.push(
      `${capacityMessage(input.runDays.length, rule, capacityLimits(out, rule, paces, recent))} Vrh ${fmtKm(plan.peakKm)} km umesto do ${fmtKm(plan.peakCapKm)} km (M6).`
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
