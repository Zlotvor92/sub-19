/* HM v2 — generisanje. generateHmV2(input) = construct(input, []). Isti konstruktor gradi i adaptiran plan
   (segment 04, H18): koraci (assess.ts) ulaze u okvire (steps.framesFor), cilj obima (volume.adaptNominal10)
   i tempo nedelje (steps.pacesAt) PRE izbora; nema koraka koji posle konstrukcije menja nedelju. Redosled:
   ulaz (H1, H15, H16, H17) → tempo (H2; po osećaju H16) → raspored (H9) → faze, rasterećenja i test (H4/H5/
   H16; početnik bez testa) → po nedelji cilj (H6, volume.ts) i konstrukcija (week.ts) → validator (samo
   prijavljuje; greška = odbijanje PLAN_VIOLATES_POLICY, nikad degenerisan plan). */

import { checkInput } from './input.ts';
import {
  longestLong10,
  recentLongCap10,
  recentLongNeeded10,
  rollingLongCap10,
  week1LongCap10
} from './lengths.ts';
import { assessGoal, predictedHm } from './paces.ts';
import { isBuildPhase, periodize } from './periodize.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import { advance, INITIAL_QUALITY, type QualityState, type WeekPicks } from './quality.ts';
import { basePaces, basisAt, framesFor, pacesAt, restartWeeks, stepVdotAt } from './steps.ts';
import type {
  GenerateResult,
  HmV2AdaptStep,
  HmV2Input,
  HmV2Plan,
  PlanDay,
  PlanWeek
} from './types.ts';
import { validatePlan } from './validate.ts';
import {
  adaptNominal10,
  adaptVolume,
  capacityLimits,
  capacityMessage,
  enterWeek,
  fit10,
  initialAdaptHistory,
  leaveAdaptWeek,
  leaveWeek,
  nominal10,
  peakCap10,
  raceWeekTarget10,
  startKm10
} from './volume.ts';
import { type BuiltWeek, buildWeek, type QualityMode, raceWeek, type WeekContext } from './week.ts';
import { fmtKm, fmtSec, warmupCooldown } from './workouts.ts';
import { type Written, writtenDays, writtenWeeks } from './written.ts';

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

/** HM v2: plan ili strukturisano odbijanje. generateHmV2(input) = construct(input, []) (pouka 16: bez koraka
    adaptacije bajt-isto kao generator). */
export function generateHmV2(raw: unknown): GenerateResult {
  return construct(raw, [], undefined, true);
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
    if (construct({ ...raw, recentLongRunKm: k * q.thresholdStepKm }, []).ok) {
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

/** Planirano nedelje iz dana [0,01 km] (dani koji se računaju u obim). */
const planned100Of = (days: readonly PlanDay[]): number =>
  days.reduce((a, d) => a + (d.countsToWeek ? Math.round(d.workout.km * 100) : 0), 0);

/** Pouka 29: izbor doze nedelje (stanje H12/HI10) iz upisanih dana kvaliteta. */
const writtenPicks = (days: readonly PlanDay[]): WeekPicks => ({
  q1: days.find((d) => d.role === 'q1')?.workout.dose ?? null,
  q2: days.find((d) => d.role === 'q2')?.workout.dose ?? null
});

/**
 * Konstruktor plana — JEDAN za generate i adapt. `steps` = koraci adaptacije redom (A14); bez njih je ovo
 * tačno generator hm-v2.2.1 (pouka 16). Sa koracima: okviri iz steps.framesFor, tempo nedelje iz
 * steps.pacesAt (A1), cilj iz volume.adaptNominal10 (A2/A3/A4/A8/A9), nov start → nova progresija doze;
 * od prve nedelje pod koracima pretraga cilja ima još dva prolaza (A9: jedan kvalitet doze rasterećenja, pa
 * bez kvaliteta), a ograničenje kvaliteta nedelje određuje prvi prolaz. Trkačka nedelja: oštrenje otpada
 * kad bi nedelja bila veća od tapera (A9), pa višak laganih dana postaje odmor (pouka 30). `prior`
 * (adaptacija, pouka 29): prethodni plan i zaštita dana — stanje koje zavisi od prošlosti (najduži dugi,
 * kotrljajuća granica pouke 28, poslednji dugi, stanje doze, taper) iz upisanih dana (written.ts).
 */
export function construct(
  raw: unknown,
  steps: readonly HmV2AdaptStep[],
  prior?: Written,
  searchThreshold = false
): GenerateResult {
  const chk = checkInput(raw);
  if (!chk.ok) return chk;
  const { input, weeks, pace, pattern, rule } = chk;
  const feel = pace.kind === 'feel';
  const paces = basePaces(pace);
  // H16: test 5 km samo u planu po osećaju koji nije početnik.
  const base = periodize(input.startDate, weeks, feel && rule.feelTest);
  if (!base) return infeasible('Nema rasporeda rasterećenja po pravilima H5.');
  const adapted = steps.length > 0;
  const frames = adapted
    ? framesFor(base, pattern, input.runDays, input.raceDate, pace, steps)
    : base;
  const ctx0: WeekContext = {
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
  const av = adapted ? adaptVolume(steps) : null;
  // A1 (pouka 16): tempo i osnova nedelje (rezultat iz adaptacije važi od svoje sledeće nedelje); A9: test
  // koji ne staje otpada samo posle smanjenja obima.
  const ctxAt = (w: number): WeekContext => {
    if (!av) return ctx0;
    const reduced = w >= av.reducedFrom ? { adapted: true } : {};
    if (stepVdotAt(steps, w) === null) return { ...ctx0, ...reduced };
    const p = pacesAt(pace, steps, w);
    return { ...ctx0, paces: p, raceSec: predictedHm(p), feel: false, ...reduced };
  };
  const restarts = restartWeeks(steps);

  let quality: QualityState = INITIAL_QUALITY;
  let h = initialAdaptHistory(cap10);
  let lastLong10: number | null = null;
  let taperRpM = 0;
  /** H8: najkraći lagan dan tapera [0,1 km] (gornja granica laganog dana trkačke nedelje). */
  let taperEasy10 = Infinity;
  const out: PlanWeek[] = [];
  /** Pouka 29: dani nedelja kakvi se upisuju — iz njih stanje koje zavisi od prošlosti. */
  const written: { days: readonly PlanDay[] }[] = [];
  /** Pouka 28: dugi svake nedelje (null bez dugog) iz upisanih dana — osnov kotrljajuće granice. */
  const longs10 = (): (number | null)[] =>
    written.map((w) => {
      const l = w.days.find((d) => d.role === 'long');
      return l ? Math.round(l.workout.km * 10) : null;
    });
  for (const frame of frames) {
    const ctx = ctxAt(frame.index);
    if (restarts.has(frame.index)) quality = INITIAL_QUALITY;
    if (frame.phase === 'race') {
      const prev = out[out.length - 1];
      const prevDays = written[written.length - 1]?.days ?? [];
      const prevHard = prevDays.filter((d) => d.hard).pop()?.date ?? null;
      const prev100 = planned100Of(prevDays);
      let w = raceWeek(ctx, frame, taperRpM, prevHard, taperEasy10);
      let noSharpener = false;
      // A9: oštrenje otpada kad bi trkačka nedelja bila veća od tapera (pouka 5).
      if (
        av &&
        prev?.phase === 'taper' &&
        w.days.some((d) => d.role === 'sharpener') &&
        w.planned100 > prev100
      )
        [w, noSharpener] = [raceWeek(ctx, frame, taperRpM, prevHard, taperEasy10, true), true];
      // Pouka 30: i bez oštrenja veća od tapera (taper skraćen danima odmora/bola) — višak laganih dana
      // postaje odmor (week.raceWeekRest).
      if (av && prev?.phase === 'taper' && w.planned100 > prev100)
        w = raceWeek(ctx, frame, taperRpM, prevHard, taperEasy10, noSharpener, prev100);
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
      written.push({ days: w.days });
      continue;
    }
    if (av) h = enterWeek(h, frame, av, rule);
    const { nominal, downOnly } = av
      ? adaptNominal10(frame, h, start10, rule, av)
      : { nominal: nominal10(frame, h, start10, cap10, rule), downOnly: false };
    const longest10 = longestLong10(written);
    const roll10 = rollingLongCap10(frame.index, longs10(), input.recentLongRunKm);
    const make = (t10: number, mode: QualityMode): BuiltWeek | null =>
      buildWeek(ctx, frame, t10, quality, lastLong10, longest10, mode, roll10);
    // HI2: druga pretraga ('relax') samo kad nijedan cilj nije izvodljiv po pravilu — ista pretraga cilja.
    // A9: pa jedan kvalitet doze rasterećenja, pa bez kvaliteta; ograničenje kvaliteta nedelje (A3/A4)
    // preskače prolaze koje ne dozvoljava.
    const lq = frame.limits?.quality;
    const modes: QualityMode[] =
      !av || frame.index < av.first
        ? ['rule', 'relax']
        : lq === 'none'
          ? ['none']
          : lq === 'one'
            ? ['one', 'none']
            : ['rule', 'relax', 'one', 'none'];
    // Pouka 23: rasterećenje sa testom cilj iznad pravila nema (fit10 samo naniže); sastavljena nedelja bez
    // testa (A9) nosi cilj ≤ pravilu.
    const can = (t10: number, m: QualityMode): boolean => make(t10, m) !== null;
    let fit: ReturnType<typeof fit10> = null;
    let mode: QualityMode = 'rule';
    // A9: cilj adaptacije se zadržava — najpre svi prolazi kvaliteta na tom cilju, tek onda niži cilj.
    if (downOnly)
      for (const m of modes)
        if (can(nominal, m)) {
          [fit, mode] = [{ target10: nominal, fitted: null }, m];
          break;
        }
    for (const m of fit ? [] : modes) {
      fit = fit10(nominal, frame, av ? h.cap10 : cap10, rule, (t10) => can(t10, m), downOnly);
      if (fit) {
        mode = m;
        break;
      }
    }
    if (!fit && input.recentLongRunKm != null && searchThreshold && !adapted)
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
    // A9: test koji ne staje otpada sa kvalitetom (oznaka nedelje ⇔ dan testa).
    const { test: _test, ...noTest } = frame;
    out.push({
      ...(frame.test && !w.days.some((d) => d.role === 'test') ? noTest : frame),
      targetKm: fit.target10 / 10,
      plannedKm: w.planned100 / 100,
      nominalKm: nominal / 10,
      fitted: fit.fitted,
      days: w.days,
      notes
    });
    const wd = prior ? writtenDays(prior.weeks[frame.index - 1]!, w.days, prior) : w.days;
    written.push({ days: wd });
    if (frame.phase === 'taper') {
      const q = wd.map((d) => d.workout.dose).find((d) => d?.zone === 'RP');
      taperRpM = q ? q.doseM : 0;
      for (const d of wd)
        if (d.role === 'easy') taperEasy10 = Math.min(taperEasy10, Math.round(d.workout.km * 10));
    }
    if (isBuildPhase(frame.phase) && !frame.deload) {
      const long = wd.find((d) => d.role === 'long');
      if (long) lastLong10 = Math.round(long.workout.km * 10);
      if (w.picks)
        quality = advance(
          JSON.stringify(wd) === JSON.stringify(w.days) ? w.picks : writtenPicks(wd),
          quality
        );
    }
    h = av
      ? leaveAdaptWeek(h, frame, fit.target10, av)
      : { ...h, ...leaveWeek(h, frame, fit.target10) };
  }

  // A1: nivo plana iz tempa poslednje nedelje (budućnost); ocena cilja za nedelje od rezultata do trke.
  const N = out.length;
  const pN = adapted ? pacesAt(pace, steps, N) : paces;
  const feelN = adapted ? basisAt(pace, steps, N) === 'feel' : feel;
  const lastResult = [...steps].reverse().find((s) => s.vdot !== null);
  const goalWeeks = lastResult ? N - lastResult.fromWeek + 1 : weeks;
  const orientation = steps.some((s) => s.orientation);
  const goal =
    input.goalTimeSec && !feelN ? assessGoal(pN.vdot, input.goalTimeSec, goalWeeks) : null;
  const plan: HmV2Plan = {
    policyId: P.id,
    policyVersion: P.version,
    input,
    vdot: pN.vdot,
    // Plan sa rezultatom je bajt-isti kao u hm-v2.1.0 (bez polja paceBasis); po osećaju 'feel', posle
    // rezultata iz adaptacije 'result' (A1).
    ...(feelN ? { paceBasis: 'feel' as const } : feel ? { paceBasis: 'result' as const } : {}),
    paces: pN,
    predictedHmSec: feelN ? null : predictedHm(pN),
    goal:
      goal && orientation
        ? { ...goal, status: 'orientation', message: P.adapt.orientationMessage }
        : goal,
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
    const goalNote = input.goalTimeSec ? ' Ciljno vreme se ocenjuje posle rezultata (H3).' : '';
    plan.notes.push(
      `Plan po osećaju (H16): ${pace.why}. E = lagan tempo ${fmtSec(pace.easySecPerKm)}/km ± ${P.feel.eRangeSec} s; tempo T/I/R/RP je orijentir (procena) iz procene VDOT ${fmtKm(paces.vdot)} — trening vodi RPE.`,
      t && td
        ? `Test ${P.test.km} km: nedelja ${t.index}, ${td.date} (H16). Prognoza polumaratona i ocena cilja: posle testa; do tada RP po RPE.${goalNote}`
        : rule.feelTest
          ? `Test ${P.test.km} km: nema ga u planu posle adaptacije (A13: primljen rezultat, ili nema nedelje izgradnje bez ograničenja).`
          : `Početnik bez testa ${P.test.km} km (H17): kvalitet po RPE; prognoza polumaratona i ocena cilja posle rezultata trke (adaptacija, segment 04).${goalNote}`
    );
  }
  if (rule.beginner)
    plan.notes.push(
      `Početnik (H17): nedelje 1–${rule.introWeeks} uvod bez kvaliteta, zatim jedan kvalitet nedeljno (T → T cruise → RP, bez I i R), rast ${Math.round(rule.growth * 100)} % (${fmtKm(rule.growthMinKm)}–${fmtKm(rule.growthMaxKm)} km), dugi ≤ ${Math.round(rule.longMaxSec / 60)} min, bez testa.`
    );
  if (out.some((w) => isBuildPhase(w.phase) && !w.deload && w.fitted === 'down'))
    plan.notes.push(
      `${capacityMessage(input.runDays.length, rule, capacityLimits(out, rule, pN, input.recentLongRunKm))} Vrh ${fmtKm(plan.peakKm)} km umesto do ${fmtKm(plan.peakCapKm)} km (H6).`
    );
  if (orientation) plan.notes.push(P.adapt.orientationMessage);
  if (adapted)
    plan.adaptation = {
      asOf: steps[steps.length - 1]!.asOf,
      steps: [...steps],
      mixedWeeks: [],
      lockedDayIds: []
    };
  // Pouka 29: validacija adaptiranog plana vidi plan kakav se upisuje (isto spajanje kao adapt.ts).
  const merged = prior && plan.adaptation ? writtenWeeks(out, prior) : null;
  const violations = validatePlan(
    merged
      ? {
          ...plan,
          weeks: merged.weeks,
          adaptation: {
            ...plan.adaptation!,
            mixedWeeks: merged.mixed,
            lockedDayIds: [...prior!.lockedDayIds]
          }
        }
      : plan
  );
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
