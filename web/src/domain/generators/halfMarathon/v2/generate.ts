/* HM v2 — generisanje. Redosled: ulaz (H1, H15, H16, H17) → tempo (H2; po osećaju H16) → raspored (H9) →
   faze, rasterećenja i test (H4/H5/H16; početnik bez testa) → po nedelji cilj (H6, volume.ts) i konstrukcija
   (week.ts) → validator (samo prijavljuje; greška = odbijanje PLAN_VIOLATES_POLICY, nikad degenerisan
   plan). Nema koraka koji posle konstrukcije menja nedelju. Adaptacija (segment 04) dodaje korake u isti
   konstruktor. */

import { checkInput } from './input.ts';
import {
  recentLongCap10,
  recentLongNeeded10,
  rollingLongCap10,
  week1LongCap10
} from './lengths.ts';
import { assessGoal, feelPaces, pacesFromVdot, predictedHm } from './paces.ts';
import { isBuildPhase, periodize } from './periodize.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import { advance, INITIAL_QUALITY, type QualityState } from './quality.ts';
import type { GenerateResult, HmV2Input, HmV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import {
  capacityLimits,
  capacityMessage,
  fit10,
  INITIAL_VOLUME,
  leaveWeek,
  nominal10,
  peakCap10,
  raceWeekTarget10,
  startKm10
} from './volume.ts';
import { buildWeek, type QualityMode, raceWeek, type WeekContext } from './week.ts';
import { fmtKm, fmtSec, warmupCooldown } from './workouts.ts';

/** HI7 (pouka 28): napomena nedelje 1 — bez ulaza prag skorašnjeg najdužeg trka; sa ulazom granica (i da li
    je dugi na njoj). Počinje sa „Dugi nedelje 1" (testInputs.RECENT_LONG_NOTE). */
function recentLongNote(long10: number, ctx: WeekContext): string {
  const r = ctx.input.recentLongRunKm;
  const km = fmtKm(long10 / 10);
  if (r == null)
    return `Dugi nedelje 1 ${km} km pretpostavlja skorašnji najduži trk od bar ${fmtKm(recentLongNeeded10(long10) / 10)} km; ako je bio kraći, unesi ga (dugi ≤ max(1,1 × najduži, najduži + 1 km), pouka 28).`;
  const cap10 = recentLongCap10(r);
  const at = long10 === cap10 && long10 === week1LongCap10(ctx.paces, r, ctx.rule.longMaxSec);
  return `Dugi nedelje 1 ${km} km ≤ ${fmtKm(cap10 / 10)} km (skorašnji najduži ${fmtKm(r)} km, pouka 28)${at ? ' — na granici' : ''}.`;
}

const infeasible = (message: string, week?: number): GenerateResult => ({
  ok: false,
  reasons: [{ code: 'WEEK_INFEASIBLE', message, ...(week !== undefined ? { week } : {}) }]
});

/** HM v2: plan ili strukturisano odbijanje. */
export function generateHmV2(raw: unknown): GenerateResult {
  return generate(raw, true);
}

/** HI7 (pouka 28, P1): nedelja neizvodljiva uz dati skorašnji najduži trk → RECENT_LONG_TOO_SHORT sa pragom
    (najmanji r u koraku 0,5 km za koji je plan izvodljiv; računa se samo za poruku). */
function recentTooShort(
  raw: Record<string, unknown>,
  input: HmV2Input,
  week: number
): GenerateResult {
  const q = P.recentLong;
  const r = input.recentLongRunKm!;
  let threshold: number | null = null;
  for (let k = Math.floor(r / q.thresholdStepKm) + 1; k * q.thresholdStepKm <= q.maxKm; k++)
    if (generate({ ...raw, recentLongRunKm: k * q.thresholdStepKm }, false).ok) {
      threshold = k * q.thresholdStepKm;
      break;
    }
  const days = input.runDays.length;
  return {
    ok: false,
    reasons: [
      {
        code: 'RECENT_LONG_TOO_SHORT',
        message: `Skorašnji najduži trk ${fmtKm(r)} km je prekratak za plan od ${days} dana, ${fmtKm(input.currentWeeklyKm)} km nedeljno: dugi raste najviše max(10 %, 1 km) iznad najdužeg u prethodne 4 nedelje, pa nedelja ${week} ne može da se sastavi po pravilima (pouka 28).${threshold !== null ? ` Plan je izvodljiv od ${fmtKm(threshold)} km.` : ''} Preporuka: produži dugi trk, dužu pripremu, manji obim, više dana ili 10K plan.`,
        week
      }
    ]
  };
}

function generate(raw: unknown, searchThreshold: boolean): GenerateResult {
  const chk = checkInput(raw);
  if (!chk.ok) return chk;
  const { input, weeks, pace, pattern, rule } = chk;
  const feel = pace.kind === 'feel';
  const paces = feel ? feelPaces(pace.easySecPerKm) : pacesFromVdot(pace.vdotRaw);
  // H16: test 5 km samo u planu po osećaju koji nije početnik (H17).
  const frames = periodize(input.startDate, weeks, feel && rule.feelTest);
  if (!frames) return infeasible('Nema rasporeda rasterećenja po pravilima H5.');
  const ctx: WeekContext = {
    input,
    paces,
    pattern,
    // HI11 c: u planu po osećaju prognoza služi samo za trajanje segmenta trke (procena); plan je nema.
    raceSec: predictedHm(paces),
    wc: warmupCooldown(input.currentWeeklyKm, rule.beginner),
    rule,
    feel
  };
  const start10 = startKm10(input.currentWeeklyKm);
  const cap10 = peakCap10(start10, rule);

  let quality: QualityState = INITIAL_QUALITY;
  let h = INITIAL_VOLUME;
  let lastLong10: number | null = null;
  let longest10 = 0;
  let taperRpM = 0;
  /** H8: najkraći lagan dan tapera [0,1 km] (gornja granica laganog dana trkačke nedelje). */
  let taperEasy10 = Infinity;
  const out: PlanWeek[] = [];
  /** Pouka 28: dugi svake nedelje (null bez dugog) — osnov kotrljajuće granice. */
  const longs10: (number | null)[] = [];
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
      longs10.push(null);
      continue;
    }
    const roll10 = rollingLongCap10(frame.index, longs10, input.recentLongRunKm);
    const nominal = nominal10(frame, h, start10, cap10, rule);
    const make = (t10: number, mode: QualityMode) =>
      buildWeek(ctx, frame, t10, quality, lastLong10, longest10, mode, roll10);
    // HI2: druga pretraga ('relax') samo kad nijedan cilj nije izvodljiv po pravilu — ista pretraga cilja.
    let fit: ReturnType<typeof fit10> = null;
    let mode: QualityMode = 'rule';
    for (const m of ['rule', 'relax'] as const) {
      fit = fit10(nominal, frame, cap10, rule, (t10) => make(t10, m) !== null);
      if (fit) {
        mode = m;
        break;
      }
    }
    if (!fit && input.recentLongRunKm != null && searchThreshold)
      return recentTooShort(raw as Record<string, unknown>, input, frame.index);
    if (!fit)
      return infeasible(
        `Nedelja ${frame.index}: nijedan cilj od ${rule.weekMinKm} km naviše ne može da se sastavi po pravilima.`,
        frame.index
      );
    const w = make(fit.target10, mode)!;
    const notes = [...w.notes];
    if (frame.index === 1 && w.long10 !== null) notes.push(recentLongNote(w.long10, ctx));
    if (fit.fitted)
      notes.unshift(
        `Cilj po pravilu ${fmtKm(nominal / 10)} km nije izvodljiv u konstrukciji nedelje; nedelja ide na najbliži izvodljiv cilj ${fmtKm(fit.target10 / 10)} km (H6).`
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
    longs10.push(w.long10);
    if (frame.phase === 'taper') {
      const q = w.days.map((d) => d.workout.dose).find((d) => d?.zone === 'RP');
      taperRpM = q ? q.doseM : 0;
      for (const d of w.days)
        if (d.role === 'easy') taperEasy10 = Math.min(taperEasy10, Math.round(d.workout.km * 10));
    }
    if (isBuildPhase(frame.phase) && !frame.deload) {
      if (w.long10 !== null) lastLong10 = w.long10;
      if (w.picks) quality = advance(w.picks, quality);
    }
    h = leaveWeek(h, frame, fit.target10);
  }

  const plan: HmV2Plan = {
    policyId: P.id,
    policyVersion: P.version,
    input,
    vdot: paces.vdot,
    // Plan sa rezultatom je bajt-isti kao u hm-v2.1.0 (bez polja paceBasis).
    ...(feel ? { paceBasis: 'feel' as const } : {}),
    paces,
    predictedHmSec: feel ? null : predictedHm(paces),
    goal: !feel && input.goalTimeSec ? assessGoal(paces.vdot, input.goalTimeSec, weeks) : null,
    pattern,
    startKm: start10 / 10,
    peakCapKm: cap10 / 10,
    peakKm: h.peak10 / 10,
    notes: [],
    weeks: out,
    warnings: []
  };
  if (pace.kind === 'feel') {
    const t = out.find((w) => w.test);
    const td = t?.days.find((d) => d.workout.kind === 'test');
    const goal = input.goalTimeSec ? ' Ciljno vreme se ocenjuje posle rezultata (H3).' : '';
    plan.notes.push(
      `Plan po osećaju (H16): ${pace.why}. E = lagan tempo ${fmtSec(pace.easySecPerKm)}/km ± ${P.feel.eRangeSec} s; tempo T/I/R/RP je orijentir (procena) iz procene VDOT ${fmtKm(paces.vdot)} — trening vodi RPE.`,
      t && td
        ? `Test ${P.test.km} km: nedelja ${t.index}, ${td.date} (H16). Prognoza polumaratona i ocena cilja: posle testa; do tada RP po RPE.${goal}`
        : `Početnik bez testa ${P.test.km} km (H17): kvalitet po RPE; prognoza polumaratona i ocena cilja posle rezultata trke (adaptacija, segment 04).${goal}`
    );
  }
  if (rule.beginner)
    plan.notes.push(
      `Početnik (H17): nedelje 1–${rule.introWeeks} uvod bez kvaliteta, zatim jedan kvalitet nedeljno (T → T cruise → RP, bez I i R), rast ${Math.round(rule.growth * 100)} % (${fmtKm(rule.growthMinKm)}–${fmtKm(rule.growthMaxKm)} km), dugi ≤ ${Math.round(rule.longMaxSec / 60)} min, bez testa.`
    );
  if (out.some((w) => isBuildPhase(w.phase) && !w.deload && w.fitted === 'down'))
    plan.notes.push(
      `${capacityMessage(input.runDays.length, rule, capacityLimits(out, rule, paces, input.recentLongRunKm))} Vrh ${fmtKm(plan.peakKm)} km umesto do ${fmtKm(plan.peakCapKm)} km (H6).`
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
