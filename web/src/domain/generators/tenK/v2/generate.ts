/* 10K v2 — generisanje. generateTenKV2(input) = construct(input, []). Isti konstruktor gradi i adaptiran
   plan (segment 04): koraci (assess.ts) ulaze u okvire (steps.framesFor), cilj obima (volume.adaptNominal10)
   i tempo nedelje (steps.pacesAt) PRE izbora; nema koraka koji posle konstrukcije menja nedelju. Redosled:
   ulaz (D1, D26, D28, D29) → tempo (D2 iz rezultata ili D26 po osećaju) → raspored (D9) → faze,
   rasterećenja i test (D4/D5/D27; početnik bez testa, D32) → po nedelji cilj (D6) i konstrukcija →
   validator (samo prijavljuje). */

import { checkInput } from './input.ts';
import { assessGoal, predicted10k } from './paces.ts';
import { periodize, isBuildPhase } from './periodize.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import {
  advance,
  deloadLastM,
  INITIAL_QUALITY,
  type QualityState,
  type WeekPicks
} from './quality.ts';
import { longestLong10 } from './lengths.ts';
import {
  basePaces,
  basisAt,
  deloadWeekOf,
  framesFor,
  pacesAt,
  restartWeeks,
  stepVdotAt
} from './steps.ts';
import type {
  GenerateResult,
  PlanDay,
  PlanWeek,
  PreStartRef,
  TenKV2AdaptStep,
  TenKV2Plan
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
  leaveWeek,
  nominal10,
  peakCap10,
  raceWeekTarget10,
  startKm10
} from './volume.ts';
import { type BuiltWeek, buildWeek, type QualityMode, raceWeek, type WeekContext } from './week.ts';
import { fmtKm, fmtSec as fmtPace, warmupCooldown } from './workouts.ts';
import { type Written, writtenDays, writtenWeeks } from './written.ts';

export function generateTenKV2(input: unknown): GenerateResult {
  return construct(input, []);
}

/** Planirano nedelje iz dana [0,01 km] (dani koji se računaju u obim). */
const planned100Of = (days: readonly PlanDay[]): number =>
  days.reduce((a, d) => a + (d.countsToWeek ? Math.round(d.workout.km * 100) : 0), 0);

/** Prošlost = upisani dani: izbor doze nedelje (stanje D12/D31) iz upisanih dana kvaliteta. */
const writtenPicks = (days: readonly PlanDay[]): WeekPicks => ({
  q1: days.find((d) => d.role === 'q1')?.workout.dose ?? null,
  q2: days.find((d) => d.role === 'q2')?.workout.dose ?? null
});

/**
 * A5 (10k-v2.5.2, pouka 34): referenca prinudnog rasterećenja pri umoru sa asOf pre starta — nedelja 1
 * generatora bez činjenica (cilj, dugi, doza slota rasterećenja posle nje: quality.deloadLastM). Jedino mesto;
 * assess je upisuje u korak (preStart), konstruktor i validator je čitaju iz koraka. null = ulaz nije ispravan.
 */
export function preStartRef(input: unknown): PreStartRef | null {
  const chk = checkInput(input);
  const g = chk.ok ? construct(input, []) : null;
  if (!chk.ok || !g?.ok) return null;
  const w = g.plan.weeks[0]!;
  const long = w.days.find((d) => d.role === 'long');
  return {
    buildKm: w.targetKm,
    longKm: long ? long.workout.km : 0,
    tDoseM: deloadLastM(advance(writtenPicks(w.days), INITIAL_QUALITY), chk.rule)
  };
}

const infeasible = (message: string, week?: number): GenerateResult => ({
  ok: false,
  reasons: [{ code: 'WEEK_INFEASIBLE', message, ...(week !== undefined ? { week } : {}) }]
});

/**
 * Konstruktor plana — JEDAN za generate i adapt. `steps` = koraci adaptacije redom (A14); bez njih je ovo
 * tačno generator 10k-v2.3.1. Sa koracima: okviri iz steps.framesFor (nov start, prinudno rasterećenje,
 * test, ograničenja po datumima), tempo nedelje iz steps.pacesAt (A1), cilj iz volume.adaptNominal10
 * (A2/A3/A4/A8/A9), nov start → nova progresija doze (A3, D16); od prve nedelje pod koracima pretraga
 * cilja ima još dva prolaza (A9: jedan kvalitet doze rasterećenja, pa bez kvaliteta), a ograničenje
 * kvaliteta nedelje (A3/A4) određuje prvi prolaz. Trkačka nedelja: oštrenje otpada kad bi nedelja bila
 * veća od tapera (A9, D23). `prior` (adaptacija): prethodni plan i zaštita dana (A11) — najduži dugi D7 se
 * računa iz dana kakvi se upisuju (written.ts, lengths.longestLong10; 10k-v2.5.1).
 */
export function construct(
  raw: unknown,
  steps: readonly TenKV2AdaptStep[],
  prior?: Written
): GenerateResult {
  const chk = checkInput(raw);
  if (!chk.ok) return chk;
  const { input, weeks, pace, pattern, rule } = chk;
  const feel = pace.kind === 'feel';
  const paces = basePaces(pace);
  // D26: u planu po osećaju prognoza služi samo za trajanje segmenta trke (procena), plan je nema.
  const raceSec = predicted10k(paces);
  // D27/D32: test 5 km samo u planu po osećaju koji nije početnik.
  const base = periodize(input.startDate, weeks, feel && rule.feelTest);
  if (!base) return infeasible('Nema rasporeda rasterećenja po pravilima D5.');
  const adapted = steps.length > 0;
  const frames = adapted
    ? framesFor(base, pattern, input.runDays, input.raceDate, pace, steps)
    : base;
  const ctx0: WeekContext = {
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
  const av = adapted ? adaptVolume(steps) : null;
  // A1: tempo nedelje (rezultat iz adaptacije važi od svoje sledeće nedelje); A9: odstupanja za mali obim
  // samo posle smanjenja obima.
  const ctxAt = (w: number): WeekContext => {
    if (!av) return ctx0;
    // A5 (10k-v2.5.2): umor pre starta — referenca prinudnog rasterećenja iz koraka (assess, preStartRef).
    // 10k-v2.6.2: nedelja rasterećenja koraka (steps.deloadWeekOf), ne fromWeek — asOf = start: ned 1.
    const ps = steps.find((s) => s.preStart && deloadWeekOf(s) === w)?.preStart;
    const extra = {
      ...(w >= av.reducedFrom ? { adapted: true } : {}),
      ...(ps ? { preStart: ps } : {})
    };
    if (stepVdotAt(steps, w) === null) return { ...ctx0, ...extra };
    const p = pacesAt(pace, steps, w);
    return { ...ctx0, paces: p, raceSec: predicted10k(p), feel: false, ...extra };
  };
  const restarts = restartWeeks(steps);

  let quality: QualityState = INITIAL_QUALITY;
  let h = initialAdaptHistory(cap10);
  let lastLong10: number | null = null;
  /** Prošlost = upisani dani (10k-v2.5.1, written.ts): dani nedelja kakvi se upisuju — iz njih stanje koje
      zavisi od prošlosti (najduži dugi D7, poslednji dugi D5, stanje doze, taper za trkačku nedelju). */
  const written: { days: readonly PlanDay[] }[] = [];
  let taperRpM = 0;
  /** D23: najkraći lagan dan tapera [0,1 km] (gornja granica laganog dana trkačke nedelje). */
  let taperEasy10 = Infinity;
  const out: PlanWeek[] = [];
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
      // A9: oštrenje otpada kad bi trkačka nedelja bila veća od tapera (D23).
      if (
        av &&
        prev?.phase === 'taper' &&
        w.days.some((d) => d.role === 'sharpener') &&
        w.planned100 > prev100
      )
        [w, noSharpener] = [raceWeek(ctx, frame, taperRpM, prevHard, taperEasy10, true), true];
      // D23 (10k-v2.5.1): i bez oštrenja veća od tapera (taper skraćen danima odmora/bola) — višak laganih dana
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
      continue;
    }
    if (av) h = enterWeek(h, frame, av, rule);
    const { nominal, downOnly } = av
      ? adaptNominal10(frame, h, start10, rule, av)
      : { nominal: nominal10(frame, h, start10, cap10, rule), downOnly: false };
    const longest10 = longestLong10(written);
    const make = (t10: number, mode: QualityMode): BuiltWeek | null =>
      buildWeek(ctx, frame, t10, quality, lastLong10, longest10, mode);
    // Samo kad nijedan cilj nije izvodljiv po pravilu — ista pretraga cilja, drugi put, sa popuštanjem
    // (week.ts buildWeek 'relax'): D11 ispred D12 u izgradnji, rasterećenje bez kvaliteta, taper samo RP.
    // Segment 04 (A9): pa jedan kvalitet doze rasterećenja, pa bez kvaliteta; ograničenje kvaliteta
    // nedelje (A3/A4) preskače prolaze koje ne dozvoljava.
    const lq = frame.limits?.quality;
    const modes: QualityMode[] =
      !av || frame.index < av.first
        ? ['rule', 'relax']
        : lq === 'none'
          ? ['none']
          : lq === 'one'
            ? ['one', 'none']
            : ['rule', 'relax', 'one', 'none'];
    // D27 (10k-v2.5.1): u rasterećenju sa testom cilj iznad pravila (odstupanje D27, naviše do ispod
    // poslednje izgradnje) samo kad sastavljena nedelja ima test; inače cilj ≤ pravilu (samo naniže), a test
    // otpada (A9) kad ga sastavljena nedelja nema.
    const testDeload = frame.deload && frame.test === true;
    const can = (t10: number, m: QualityMode): boolean => {
      const b = make(t10, m);
      return b !== null && (!testDeload || t10 <= nominal || b.days.some((d) => d.role === 'test'));
    };
    let fit: ReturnType<typeof fit10> = null;
    let mode: QualityMode = 'rule';
    // A9: cilj adaptacije (cilj koraka, povratak, donja granica) se zadržava — najpre svi prolazi kvaliteta
    // na tom cilju, tek onda (ista pretraga D6) niži izvodljiv cilj.
    if (downOnly)
      for (const m of modes)
        if (can(nominal, m)) {
          [fit, mode] = [{ target10: nominal, fitted: null }, m];
          break;
        }
    for (const m of fit ? [] : modes) {
      fit = fit10(
        nominal,
        frame,
        av ? h.cap10 : cap10,
        rule,
        (t10) => can(t10, m),
        h.lastBuild10,
        downOnly
      );
      if (fit) {
        mode = m;
        break;
      }
    }
    if (!fit)
      return infeasible(
        `Nedelja ${frame.index}: nijedan cilj od ${rule.weekMinKm} km naviše ne može da se sastavi po pravilima.`,
        frame.index
      );
    const w = make(fit.target10, mode)!;
    const notes = [...w.notes];
    if (fit.fitted)
      notes.unshift(
        `Cilj po pravilu ${fmtKm(nominal / 10)} km nije izvodljiv u konstrukciji nedelje; nedelja ide na najbliži izvodljiv cilj ${fmtKm(fit.target10 / 10)} km (D6).`
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
      // D8: oštrenje ≤ RP doza tapera (T tapera početnika, D31, nije RP).
      const q = wd.map((d) => d.workout.dose).find((d) => d?.zone === 'RP');
      taperRpM = q ? q.doseM : 0;
      for (const d of wd)
        if (d.role === 'easy') taperEasy10 = Math.min(taperEasy10, Math.round(d.workout.km * 10));
    }
    if (isBuildPhase(frame.phase) && !frame.deload) {
      if (!av) {
        h.lastBuild10 = fit.target10;
        h.peak10 = Math.max(h.peak10, fit.target10);
      }
      const long = wd.find((d) => d.role === 'long');
      if (long) lastLong10 = Math.round(long.workout.km * 10);
      if (w.picks)
        quality = advance(
          JSON.stringify(wd) === JSON.stringify(w.days) ? w.picks : writtenPicks(wd),
          quality
        );
    }
    if (av) h = leaveWeek(h, frame, fit.target10, av);
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
  const plan: TenKV2Plan = {
    policyId: P.id,
    policyVersion: P.version,
    input,
    vdot: pN.vdot,
    paceBasis: feelN ? 'feel' : 'result',
    paces: pN,
    predicted10kSec: feelN ? null : predicted10k(pN),
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
    plan.notes.push(
      `Plan po osećaju (D26): ${pace.why}. E = lagan tempo ${fmtPace(pace.easySecPerKm)}/km ± ${P.feel.eRangeSec} s; tempo T/I/R/RP je orijentir (procena) iz procene VDOT ${fmtKm(paces.vdot)} — trening vodi RPE.`,
      t && td
        ? `Test ${P.test.km} km: nedelja ${t.index}, ${td.date} (D27). Ocena cilja i prognoza 10K: posle testa.`
        : rule.feelTest
          ? `Test ${P.test.km} km: nema ga u planu posle adaptacije (A13: primljen rezultat, ili nema nedelje izgradnje bez ograničenja).`
          : `Početnik bez testa ${P.test.km} km (D32): kvalitet po RPE; ocena cilja i prognoza 10K posle rezultata trke ili parkruna (adaptacija, segment 04).`
    );
  }
  if (out.some((w) => isBuildPhase(w.phase) && !w.deload && w.fitted === 'down'))
    plan.notes.push(
      `${capacityMessage(input.runDays.length, rule, capacityLimits(out, rule, pN))} Vrh ${fmtKm(plan.peakKm)} km umesto do ${fmtKm(plan.peakCapKm)} km (D6).`
    );
  if (orientation) plan.notes.push(P.adapt.orientationMessage);
  if (adapted)
    plan.adaptation = {
      asOf: steps[steps.length - 1]!.asOf,
      steps: [...steps],
      mixedWeeks: [],
      lockedDayIds: []
    };
  // Prošlost = upisani dani (10k-v2.5.1): validacija adaptiranog plana vidi plan kakav se upisuje (isto
  // spajanje kao adapt.ts, written.ts), ne sastavljenu prošlost.
  const merged = prior && plan.adaptation ? writtenWeeks(out, prior) : null;
  const violations = validatePlan(
    merged
      ? {
          ...plan,
          weeks: merged.weeks,
          adaptation: {
            ...plan.adaptation!,
            mixedWeeks: merged.mixed,
            lockedDayIds: [...prior!.lockedDayIds],
            ...(prior!.doneDayIds.length > 0 ? { doneDayIds: [...prior!.doneDayIds] } : {})
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
