/* HM v2 — generisanje. generateHmV2(input) = construct(input, []). Isti konstruktor gradi i adaptiran plan
   (segment 04, H18): koraci (assess.ts) ulaze u okvire (steps.framesFor), cilj obima (volume.adaptNominal10)
   i tempo nedelje (steps.pacesAt) PRE izbora; nema koraka koji posle konstrukcije menja nedelju. Redosled:
   ulaz (H1, H15, H16, H17) → tempo (H2; po osećaju H16) → raspored (H9) → faze, rasterećenja i test (H4/H5/
   H16; početnik bez testa) → po nedelji cilj (H6, volume.ts) i konstrukcija (week.ts) → validator (samo
   prijavljuje; greška = odbijanje PLAN_VIOLATES_POLICY, nikad degenerisan plan). */

import { mustDay } from './dates.ts';
import { checkInput } from './input.ts';
import {
  longestLong10,
  type LongWave,
  longWave,
  longsOf10,
  recentLongCap10,
  recentLongNeeded10,
  ranCapFloor10,
  rollingCapRan10,
  OPT_NOTE,
  shortEasyPlan,
  WAVE_NOTE,
  waveCap10,
  week1LongCap10
} from './lengths.ts';
import { assessGoal, predictedHm } from './paces.ts';
import { isBuildPhase, periodize, testKindOf } from './periodize.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import { advance, INITIAL_QUALITY, type QualityState, weekPicksOf } from './quality.ts';
import { scheduledType } from './specific.ts';
import {
  basePaces,
  basisAt,
  longRef10,
  ranLongFor,
  framesFor,
  initialState,
  jumpRecentKm,
  pacesAt,
  holdAt,
  newStartAt,
  restartWeeks,
  stepVdotAt
} from './steps.ts';
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
  enterWeek,
  fit10,
  fittedNote,
  growLeft,
  holdCap10,
  initialAdaptHistory,
  leaveAdaptWeek,
  leaveWeek,
  nominal10,
  peakCap10,
  raceWeekTarget10,
  specHold10,
  startKm10
} from './volume.ts';
import {
  type BuiltWeek,
  buildWeek,
  type QualityMode,
  raceWeek,
  remainderWeek,
  type WeekContext,
  withStrides
} from './week.ts';
import { weekLabel } from './weekLabel.ts';
import { fmtKm, fmtSec, warmupCooldown } from './workouts.ts';
import { type Written, writtenDays, writtenWeeks } from './written.ts';

/** HI7 (pouka 28): napomena nedelje 1 — bez ulaza prag skorašnjeg najdužeg trka; sa ulazom granica (i da li
    je dugi na njoj). Počinje sa „Dugi nedelje 1" (testInputs.RECENT_LONG_NOTE). */
function recentLongNote(long10: number, ctx: WeekContext): string {
  const r = ctx.input.recentLongRunKm;
  const km = fmtKm(long10 / 10);
  if (r == null)
    return `Dugi nedelje ${weekLabel(ctx.input, 1)} ${km} km pretpostavlja skorašnje najduže trčanje od bar ${fmtKm(recentLongNeeded10(long10) / 10)} km; ako je bio kraći, unesi ga (dugi ≤ max(1,1 × najduži, najduži + 1 km), pouka 28).`;
  const cap10 = recentLongCap10(r);
  const at = long10 === cap10 && long10 === week1LongCap10(ctx.paces, r, ctx.rule.longMaxSec);
  return `Dugi nedelje ${weekLabel(ctx.input, 1)} ${km} km ≤ ${fmtKm(cap10 / 10)} km (skorašnji najduži ${fmtKm(r)} km, pouka 28)${at ? ' — na granici' : ''}.`;
}

/** Pouka 38 / K1: zaključani i urađeni datumi (zaštićeni posle asOf) — isti skup kao validator
    (adaptation.lockedDayIds ∪ doneDayIds). */
const guardedOf = (prior: Written | undefined): ReadonlySet<string> =>
  new Set([...(prior?.lockedDayIds ?? []), ...(prior?.doneDayIds ?? [])]);

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
        message: `Skorašnje najduže trčanje ${fmtKm(r)} km je prekratko za plan od ${days} dana, ${fmtKm(input.currentWeeklyKm)} km nedeljno: dugi raste najviše max(10 %, 1 km) iznad najdužeg u prethodne 4 nedelje, pa nedelja ${weekLabel(input, week)} ne može da se sastavi po pravilima (pouka 28).${threshold !== null ? ` Plan je izvodljiv od ${fmtKm(threshold)} km.` : ''} Preporuka: produži dugi trk, dužu pripremu, manji obim, više dana ili 10K plan.`,
        week
      }
    ]
  };
}

/** Planirano nedelje iz dana [0,01 km] (dani koji se računaju u obim). */
const planned100Of = (days: readonly PlanDay[]): number =>
  days.reduce((a, d) => a + (d.countsToWeek ? Math.round(d.workout.km * 100) : 0), 0);

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
  // K4-A2: adaptacija — talas je činjenica plana (nedelje sa napomenom talasa u prethodnom planu, plafon iz njega).
  // K4-B: adaptacija — plan sa kratkim laganim danima ostaje takav (napomena u prethodnom planu je činjenica).
  if (steps.length > 0)
    return constructWith(
      raw,
      steps,
      prior,
      searchThreshold,
      priorWave(prior),
      !!prior?.weeks.some((w) => w.notes.some((n) => n.startsWith(OPT_NOTE)))
    );
  const g = constructWith(raw, steps, prior, searchThreshold, null, false);
  if (!g.ok) return g;
  // K4-A2: talas dugog (3 dana, lengths.longWave — jedno mesto) iz plana bez talasa; plan sa talasom važi samo kad
  // zadrži isti plafon dugog — inače plan bez talasa (prethodno ponašanje).
  const frames = g.plan.weeks;
  const wave = longWave(
    frames.map((w, i) => {
      const l = w.days.find((d) => d.role === 'long');
      return {
        index: w.index,
        phase: w.phase,
        deload: w.deload,
        long10: l ? Math.round(l.workout.km * 10) : null,
        b: scheduledType(frames, i) === 'B'
      };
    }),
    g.plan.input.experience === 'beginner'
      ? { quality: 1, beginner: true }
      : { quality: g.plan.pattern.q2 === null ? 1 : 2, beginner: false }
  );
  // K4-B: kratki lagani dani (lengths.shortEasyPlan) iz plana bez talasa i bez dana „po želji".
  const opt = shortEasyPlan(g.plan.weeks);
  if (!wave && !opt) return g;
  const top = (p: HmV2Plan): number =>
    Math.max(
      ...p.weeks.map((w) =>
        Math.round((w.days.find((d) => d.role === 'long')?.workout.km ?? 0) * 10)
      )
    );
  // Sudar sa lancem doza (K4, način rada 4): talas koji spušta dozu kvaliteta (korak 'drop' kog plan bez talasa nema)
  // → plan bez talasa.
  const drops = (p: HmV2Plan): number =>
    p.weeks.reduce((a, w) => a + w.days.filter((d) => d.workout.dose?.step === 'drop').length, 0);
  if (wave) {
    const w2 = constructWith(raw, steps, prior, searchThreshold, wave, opt);
    if (w2.ok && top(w2.plan) === top(g.plan) && drops(w2.plan) <= drops(g.plan)) return w2;
  }
  const o2 = opt ? constructWith(raw, steps, prior, searchThreshold, null, true) : null;
  return o2?.ok ? o2 : g;
}

/** K4-B: napomena plana sa danima „po želji". */
export const OPT_PLAN_NOTE =
  'Mali obim: u nedeljama u kojima bi lagan trening bio kraći od 30 minuta, jedan lagan dan je „odmor ili 20 min lagano po želji" i ne računa se u obim nedelje — planirano je tada nešto manje od cilja.';

/** K4-A2: talas dugog prethodnog plana kao činjenica — započete nedelje sa napomenom WAVE_NOTE, plafon = najduži dugi
    tog plana. */
function priorWave(prior: Written | undefined): LongWave | null {
  if (!prior) return null;
  // Samo nedelje koje su prošle (≤ asOf) — budućnost se gradi bez talasa (povratni rast A8, novi okviri).
  const weeks = new Set(
    prior.weeks
      .filter((w) => w.notes.includes(WAVE_NOTE) && mustDay(w.startDate) <= prior.asOf)
      .map((w) => w.index)
  );
  if (weeks.size === 0) return null;
  const top10 = Math.max(
    ...prior.weeks.map((w) =>
      Math.round((w.days.find((d) => d.role === 'long')?.workout.km ?? 0) * 10)
    )
  );
  return { cap10: waveCap10(top10), weeks };
}

function constructWith(
  raw: unknown,
  steps: readonly HmV2AdaptStep[],
  prior: Written | undefined,
  searchThreshold: boolean,
  wave: LongWave | null,
  optEasy: boolean
): GenerateResult {
  const chk = checkInput(raw);
  if (!chk.ok) return chk;
  const { input, weeks, pace, pattern, rule } = chk;
  const feel = pace.kind === 'feel';
  const paces = basePaces(pace);
  // H16: test 5 km u planu po osećaju koji nije početnik; P5-F1: i u planu sa rezultatom ≥ 12 nedelja.
  const base = periodize(input.startDate, weeks, testKindOf(pace.kind, rule, weeks));
  if (!base) return infeasible('Nema rasporeda rasterećenja po pravilima H5.');
  const adapted = steps.length > 0;
  const frames = adapted
    ? framesFor(base, pattern, input.runDays, input.raceDate, pace, steps, null, guardedOf(prior))
    : base;
  const ctx0: WeekContext = {
    input,
    paces,
    pattern,
    // HI11 c: u planu po osećaju prognoza služi samo za trajanje segmenta trke (procena); plan je nema.
    raceSec: predictedHm(paces),
    wc: warmupCooldown(input.currentWeeklyKm, rule.beginner),
    rule,
    feel,
    ...(optEasy ? { optEasy: true } : {})
  };
  const start10 = startKm10(input.currentWeeklyKm);
  // G1 (P8): plafon vrha — dužina pripreme i tempo plana na startu.
  const prep = { weeks, p: paces };
  const cap10 = peakCap10(start10, rule, prep);
  const av = adapted ? adaptVolume(steps) : null;
  // A1 (pouka 16): tempo i osnova nedelje (rezultat iz adaptacije važi od svoje sledeće nedelje); A9: test
  // koji ne staje otpada samo posle smanjenja obima.
  const ctxAt = (w: number): WeekContext => {
    if (!av) return ctx0;
    const reduced = {
      ...(w >= av.reducedFrom ? { adapted: true } : {}),
      ...(newStartAt(steps, w) ? { newStart: true } : {}),
      ...(holdAt(steps, w) ? { hold: true } : {})
    };
    if (stepVdotAt(steps, w) === null) return { ...ctx0, ...reduced };
    const p = pacesAt(pace, steps, w);
    return { ...ctx0, paces: p, raceSec: predictedHm(p), feel: false, ...reduced };
  };
  const restarts = restartWeeks(steps);

  // Pouka 34: umor pre starta — početno stanje iz reference (nedelja 1 generatora), inače prazno.
  const init = initialState(steps);
  let quality: QualityState = init.quality;
  let h = initialAdaptHistory(cap10, init.lastBuild10);
  let lastLong10: number | null = init.lastLong10;
  let taperRpM = 0;
  /** H8: najkraći lagan dan tapera [0,1 km] (gornja granica laganog dana trkačke nedelje). */
  let taperEasy10 = Infinity;
  const out: PlanWeek[] = [];
  /** Pouka 29: dani nedelja kakvi se upisuju — iz njih stanje koje zavisi od prošlosti. */
  const written: { days: readonly PlanDay[] }[] = [];
  // Pouka 28/34: „nedelja 0" kotrljajuće granice — skorašnji najduži, posle umora pre starta i dugi reference.
  const recentJ = jumpRecentKm(input.recentLongRunKm, steps);
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
    if (av) h = enterWeek(h, frame, av, rule, prep);
    const left = growLeft(frames, frame.index);
    const byRule = av
      ? adaptNominal10(frame, h, start10, rule, av, left)
      : { nominal: nominal10(frame, h, start10, cap10, rule, left), downOnly: false };
    // G1 (P8) × pouka 29: korak rasta zavisi od preostalih nedelja do kraja razvoja, a adaptacija menja okvire budućih
    // nedelja — cilj po pravilu nedelje koja je cela prošla je činjenica iz upisanog plana, ne računa se ponovo.
    const pastW = prior?.weeks[frame.index - 1];
    const { nominal, downOnly } =
      prior && pastW && mustDay(pastW.endDate) <= prior.asOf
        ? { nominal: Math.round(pastW.nominalKm * 10), downOnly: byRule.downOnly }
        : byRule;
    const longest10 = longestLong10(written);
    // K4-A2: nedelja talasa — dugi ≤ 0,85 × plafon (granica dugog kao pouka 28; vlasnik dužina lengths.ts).
    const inWave =
      wave !== null &&
      wave.weeks.has(frame.index) &&
      !frame.deload &&
      isBuildPhase(frame.phase) &&
      scheduledType(frames, frame.index - 1) !== 'B';
    const roll10 = Math.min(
      rollingCapRan10(
        frame.index,
        written,
        ranLongFor(steps, frame.index),
        recentJ,
        ranCapFloor10(rule.weekMinKm, input.runDays.length)
      ),
      inWave ? wave.cap10 : Infinity
    );
    // P1-S1/S3: raspored A/B iz okvira (jedno mesto: specific.scheduledType); povratak i nov start (cilj samo
    // naniže, A8/A3) — dugi lagan.
    const spec = scheduledType(frames, frame.index - 1) === 'B' ? { regular: !downOnly } : null;
    const make = (t10: number, mode: QualityMode): BuiltWeek | null =>
      buildWeek(
        ctx,
        frame,
        t10,
        quality,
        longRef10(lastLong10, steps, frame),
        longest10,
        mode,
        roll10,
        spec
      );
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
    // K3-A: početnik u specifičnoj fazi — najpre cilj na kome dugi ostaje ≥ najdužeg iz baze i razvoja (naviše do
    // holdCap10); ne staje → kao pre.
    const hold10 = downOnly ? null : specHold10(frame, rule, frames, longsOf10(written));
    if (hold10 !== null)
      for (const m of modes.slice(0, 1)) {
        fit = fit10(
          nominal,
          frame,
          holdCap10(av ? h.cap10 : cap10),
          rule,
          (t10) => (make(t10, m)?.long10 ?? 0) >= hold10
        );
        if (fit) {
          mode = m;
          break;
        }
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
        `Nedelja ${weekLabel(input, frame.index)}: nijedan cilj od ${rule.weekMinKm} km naviše ne može da se sastavi po pravilima.`,
        frame.index
      );
    // Pouka 37: mešovita nedelja — preostali dani na ostatak cilja (samo naniže; week.remainderWeek).
    const w0 = make(fit.target10, mode)!;
    const s0 = prior?.weeks[frame.index - 1];
    const w1 =
      prior && s0 && mustDay(s0.endDate) > prior.asOf
        ? (remainderWeek(ctx, frame, w0, s0.days.filter(prior.keep), fit.target10, prior.factKm) ??
          w0)
        : w0;
    // P5-F3: ubrzanja na jednom laganom danu (dužina dana ostaje; zaštićeni dani prethodnog plana se ne menjaju).
    const prevHardB =
      (written[written.length - 1]?.days ?? []).filter((d) => d.hard).pop()?.date ?? null;
    const w = {
      ...w1,
      days: withStrides(
        w1.days,
        frame,
        rule,
        ctx.paces,
        prevHardB,
        s0 && prior ? s0.days.filter(prior.keep) : []
      )
    };
    const notes = [...w.notes];
    if (frame.index === 1 && w.long10 !== null) notes.push(recentLongNote(w.long10, ctx));
    if (fit.fitted) notes.unshift(fittedNote(nominal, fit.target10));
    if (inWave) notes.push(WAVE_NOTE);
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
          JSON.stringify(wd) === JSON.stringify(w.days) ? w.picks : weekPicksOf(wd),
          quality
        );
    }
    h = av
      ? leaveAdaptWeek(h, frame, fit.target10, av, inWave)
      : { ...h, ...leaveWeek(h, frame, fit.target10, inWave) };
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
        ? `Test ${P.test.km} km: nedelja ${weekLabel(input, t.index)}, ${td.date} (H16). Prognoza polumaratona i ocena cilja: posle testa; do tada RP po RPE.${goalNote}`
        : rule.feelTest
          ? base.some((f) => f.test)
            ? `Test ${P.test.km} km: nema ga u planu posle adaptacije (A13: primljen rezultat, ili nema nedelje izgradnje bez ograničenja).`
            : `Plan je prekratak za test ${P.test.km} km (ne radi se u prve tri nedelje): kvalitet vodi osećaj napora; unesi rezultat trke ili testa kad ga budeš imao — tempo se tada računa iz njega.`
          : `Početnik bez testa ${P.test.km} km (H17): kvalitet po RPE; prognoza polumaratona i ocena cilja posle rezultata trke (adaptacija, segment 04).${goalNote}`
    );
  }
  if (rule.beginner)
    plan.notes.push(
      `Početnik (H17): nedelje ${weekLabel(input, 1)}–${weekLabel(input, rule.introWeeks)} uvod bez kvaliteta, zatim jedan kvalitet nedeljno (T → T cruise → RP, bez I i R), rast ${Math.round(rule.growth * 100)} % (${fmtKm(rule.growthMinKm)}–${fmtKm(rule.growthMaxKm)} km), dugi ≤ ${Math.round(rule.longMaxSec / 60)} min, bez testa.`
    );
  // Faza 4a N11: kapacitet (H6/HI8) ide korisniku jednom — upozorenje CAPACITY_LIMITED (validator, sa vrhom).
  if (orientation) plan.notes.push(P.adapt.orientationMessage);
  // K4-B: jedna rečenica u napomeni plana.
  if (out.some((w) => w.notes.some((n) => n.startsWith(OPT_NOTE)))) plan.notes.push(OPT_PLAN_NOTE);
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
            lockedDayIds: [...prior!.lockedDayIds],
            ...(prior!.doneDayIds.length > 0 ? { doneDayIds: [...prior!.doneDayIds] } : {}),
            ...(Object.keys(prior!.factKm).length > 0 ? { factKm: { ...prior!.factKm } } : {})
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
