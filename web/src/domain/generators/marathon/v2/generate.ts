/* Maraton v2 — generisanje. generateMarathonV2(input) = construct(input, []). Isti konstruktor gradi i adaptiran
   plan (segment 04, M18): koraci (assess.ts) ulaze u okvire (steps.framesFor), cilj obima (volume.adaptNominal10)
   i tempo nedelje (steps.pacesAt) PRE izbora; nema koraka koji posle konstrukcije menja nedelju. Redosled: ulaz
   (M1, M16, M17) → tempo (M2 iz rezultata ili M16 po osećaju) → raspored (M9) → faze, rasterećenja i nedelja testa
   (M4/M5/M16; početnik bez testa, M17) → po nedelji cilj (M6/M5/M7) i konstrukcija → trkačka nedelja (M8) →
   validator (samo prijavljuje). */

import { mustDay } from './dates.ts';
import { checkInput } from './input.ts';
import {
  jumpBase10,
  jumpLongs10,
  longestLong10,
  longJumpCap10,
  longJumpNote,
  longShortOf,
  longTimeCapNote,
  recentLongNote
} from './lengths.ts';
import { assessGoal, predictedMarathon } from './paces.ts';
import { isBuildPhase, periodize, taperStep } from './periodize.ts';
import { keptKm100, mixedNote, mixedRest, pauseOwned } from './mixed.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import { advance, INITIAL_QUALITY, type Picks, type QualityState } from './quality.ts';
import {
  basePaces,
  basisAt,
  framesFor,
  jumpRecentKm,
  pacesAt,
  preStartOf,
  restartWeeks,
  stateRefOf,
  stepVdotAt
} from './steps.ts';
import type {
  GenerateResult,
  MarathonV2AdaptStep,
  MarathonV2Plan,
  Paces,
  PlanDay,
  PlanWeek
} from './types.ts';
import { validatePlan } from './validate.ts';
import {
  adaptNominal10,
  adaptVolume,
  capacityLimits,
  capacityMessage,
  capacityWeeks,
  enterWeek,
  fit10,
  fittedNote,
  initialAdaptHistory,
  leaveWeek,
  nominal10,
  peakCap10,
  raceWeekTarget10,
  startKm10
} from './volume.ts';
import { type BuiltWeek, buildWeek, type QualityMode, raceWeek, type WeekContext } from './week.ts';
import { fmtKm, fmtSec, warmupCooldown } from './workouts.ts';
import { type Written, writtenDays, writtenWeeks } from './written.ts';

const infeasible = (message: string, week?: number): GenerateResult => ({
  ok: false,
  reasons: [{ code: 'WEEK_INFEASIBLE', message, ...(week !== undefined ? { week } : {}) }]
});

/** M13a (pouka 6; MAR-09 t. 6 tekst kao HM): sa skorašnjim najdužim trkom nedelja ne može da se sastavi → odbijanje
    sa pravilom skoka max(10 %, 1 km), pragom (najmanji skorašnji najduži trk u koraku 0,5 km za koji je plan
    izvodljiv — `threshold`, računa se samo za poruku) i preporukom. */
const recentTooShort = (
  r: number,
  km: number,
  days: number,
  weeks: number,
  week: number,
  threshold: number | null
): GenerateResult => ({
  ok: false,
  reasons: [
    {
      code: 'RECENT_LONG_TOO_SHORT',
      message: `Skorašnji najduži trk ${fmtKm(r)} km je prekratak za ${fmtKm(km)} km nedeljno sa ${days} dana i ${weeks} nedelja do trke: dugi raste najviše max(10 %, 1 km) iznad najdužeg u prethodne 4 nedelje, pa nedelja ${week} ne može da se sastavi po pravilima (M13a).${threshold !== null ? ` Plan je izvodljiv od ${fmtKm(threshold)} km.` : ''} Preporuka: produži dugi trk, duža priprema, manji početni obim ili više dana, ili polumaraton.`,
      week
    }
  ]
});

/** Prag poruke RECENT_LONG_TOO_SHORT: najmanji skorašnji najduži trk (korak 0,5 km, do maksimuma ulaza) sa kojim
    je konstrukcija izvodljiva; null kad ga nema. */
const RECENT_STEP_KM = 0.5;
function recentThreshold(
  input: Record<string, unknown>,
  r: number,
  steps: readonly MarathonV2AdaptStep[],
  prior: Written | undefined
): number | null {
  for (
    let k = Math.floor(r / RECENT_STEP_KM + 1e-9) + 1;
    k * RECENT_STEP_KM <= P.input.recentLongMaxKm;
    k++
  )
    if (construct({ ...input, recentLongRunKm: k * RECENT_STEP_KM }, steps, prior, false).ok)
      return k * RECENT_STEP_KM;
  return null;
}

/** Planirano nedelje iz dana [0,01 km] (dani koji se računaju u obim). */
const planned100Of = (days: readonly PlanDay[]): number =>
  days.reduce((a, d) => a + (d.countsToWeek ? Math.round(d.workout.km * 100) : 0), 0);

/** Prošlost = upisani dani (pouka 29): izbor doze nedelje (stanje M12) iz upisanih dana kvaliteta. */
const writtenPicks = (days: readonly PlanDay[]): Picks => ({
  q1: days.find((d) => d.role === 'q1')?.workout.dose ?? null,
  q2: days.find((d) => d.role === 'q2')?.workout.dose ?? null
});

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function generateMarathonV2(raw: unknown): GenerateResult {
  return construct(raw, []);
}

/**
 * Konstruktor plana — JEDAN za generate i adapt (Uslov 4). `steps` = koraci adaptacije redom (A14); bez njih je ovo
 * tačno generator marathon-v2.2.0. Sa koracima: okviri iz steps.framesFor (nov start, prinudno rasterećenje, A17,
 * test, ograničenja po datumima), tempo nedelje iz steps.pacesAt (A1), cilj iz volume.adaptNominal10 (A2/A3/A4/
 * A8/A9), nov start → nova progresija doze (A3); od prve nedelje pod koracima pretraga cilja ima još dva prolaza
 * (A9: jedan kvalitet doze rasterećenja, pa bez kvaliteta), a ograničenje kvaliteta nedelje (A3/A4) određuje prvi
 * prolaz. Trkačka nedelja: oštrenje otpada kad bi nedelja bila veća od poslednje nedelje tapera (A9), pa višak
 * laganih postaje odmor (pouka 30). `prior` (adaptacija): prethodni plan i zaštita dana (A11) — stanje zavisno od
 * prošlosti (najduži dugi, dugi prethodnih nedelja M13a, poslednji dugi, stanje doze, N−1 za trkačku) iz dana
 * kakvi se upisuju (written.ts, pouka 29).
 */
export function construct(
  raw: unknown,
  steps: readonly MarathonV2AdaptStep[],
  prior?: Written,
  /** RECENT_LONG_TOO_SHORT: računaj prag poruke (false u samoj pretrazi praga). */
  threshold = true
): GenerateResult {
  const chk = checkInput(raw);
  if (!chk.ok) return chk;
  const { input, weeks, pace, pattern, rule, shortResult } = chk;
  const feel = pace.kind === 'feel';
  const km = input.currentWeeklyKm;
  // M16: po osećaju E = lagan tempo ± 15 s, brze zone i MP iz procene VDOT-a (orijentir).
  const paces = basePaces(pace, km);
  // M16/M17: test 5 km samo u planu po osećaju koji nije početnik.
  const base = periodize(input.startDate, weeks, feel && rule.feelTest);
  if (!base) return infeasible('Nema rasporeda rasterećenja po pravilima M5.');
  const adapted = steps.length > 0;
  const frames = adapted
    ? framesFor(
        base,
        pattern,
        input.runDays,
        input.raceDate,
        pace,
        steps,
        null,
        new Set([...(prior?.lockedDayIds ?? []), ...(prior?.doneDayIds ?? [])])
      )
    : base;
  const phases = frames.map((f) => f.phase);
  const ctx0: WeekContext = {
    input,
    paces,
    pattern,
    raceSec: predictedMarathon(paces),
    wc: warmupCooldown(km, rule),
    rule,
    feel
  };
  const recent = input.recentLongRunKm ?? null;
  // Pouka 34: posle umora pre starta dugi reference (ned 1 generatora) je i „nedelja 0" plafona skoka M13a.
  const recentJ = jumpRecentKm(recent, steps);
  const pre = preStartOf(steps);
  const start10 = startKm10(km);
  const cap10 = peakCap10(start10, rule);
  const av = adapted ? adaptVolume(steps) : null;
  // A1: tempo nedelje (rezultat iz adaptacije važi od svoje sledeće nedelje); A9/pouka 33: odstupanja za mali
  // obim samo posle smanjenja obima.
  const ctxAt = (w: number): WeekContext => {
    if (!av) return ctx0;
    const reduced = w >= av.reducedFrom ? { adapted: true } : {};
    if (stepVdotAt(steps, w) === null) return { ...ctx0, ...reduced };
    const p = pacesAt(pace, steps, w, km);
    return { ...ctx0, paces: p, raceSec: predictedMarathon(p), feel: false, ...reduced };
  };
  const restarts = restartWeeks(steps);

  // Pouka 34: umor pre starta — prinudno rasterećenje nedelje 1 iz reference (ned 1 generatora bez činjenica):
  // poslednji dugi i poslednja T doza (M5); progresija doze od ned 2 kreće od početnog nivoa (kao planirana ned 1).
  const ref = stateRefOf(steps);
  let quality: QualityState = ref ? { ...INITIAL_QUALITY, t: ref.tM } : INITIAL_QUALITY;
  let h = initialAdaptHistory(cap10);
  let lastLong10: number | null = ref ? Math.round(ref.longKm * 10) : null;
  /** Prošlost = upisani dani (pouka 29): dani nedelja kakvi se upisuju — iz njih najduži dugi (M7), dugi
      prethodnih nedelja (M13a), poslednji dugi (M5), stanje doze i N−1 za trkačku nedelju (M8). */
  const written: { days: readonly PlanDay[] }[] = [];
  /** M8: MP doza i najkraći lagan poslednje nedelje tapera (N−1). */
  let taperMpM = 0;
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
      let w = raceWeek(ctx, frame, taperMpM, prevHard, taperEasy10);
      let noSharpener = false;
      // A9: oštrenje otpada kad bi trkačka nedelja bila veća od poslednje nedelje tapera (M8).
      if (
        av &&
        prev?.phase === 'taper' &&
        w.days.some((d) => d.role === 'sharpener') &&
        w.planned100 > prev100
      )
        [w, noSharpener] = [raceWeek(ctx, frame, taperMpM, prevHard, taperEasy10, true), true];
      // Pouka 30: i bez oštrenja veća od tapera (taper skraćen danima odmora/bola) — višak laganih dana postaje
      // odmor (week.raceWeekRest).
      if (av && prev?.phase === 'taper' && w.planned100 > prev100)
        w = raceWeek(ctx, frame, taperMpM, prevHard, taperEasy10, noSharpener, prev100);
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
    const taper = taperStep(phases, frame.index);
    if (av) h = enterWeek(h, frame, av, rule);
    const { nominal, downOnly } = av
      ? adaptNominal10(frame, h, start10, taper, rule, av)
      : { nominal: nominal10(frame, h, start10, cap10, taper, rule), downOnly: false };
    const longest10 = longestLong10(written);
    const longs10 = jumpLongs10(written, steps, frame.index);
    const jump10 = longJumpCap10(longs10, frame.index, recentJ);
    const make = (t10: number, mode: QualityMode): BuiltWeek | null =>
      buildWeek(ctx, frame, t10, quality, lastLong10, longest10, taper, mode, jump10);
    // Samo kad nijedan cilj nije izvodljiv po pravilu — ista pretraga cilja, drugi put, sa popuštanjem
    // (week.ts 'relax'): M11 ispred M12 u izgradnji, zona tapera koja ne staje u plafon otpada. Segment 04
    // (A9): pa jedan kvalitet doze rasterećenja, pa bez kvaliteta; ograničenje kvaliteta nedelje (A3/A4)
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
    let fit: ReturnType<typeof fit10> = null;
    let mode: QualityMode = 'rule';
    // A9: cilj adaptacije (cilj koraka, povratak, donja granica) se zadržava — najpre svi prolazi kvaliteta na
    // tom cilju, tek onda (ista pretraga M6) niži izvodljiv cilj.
    if (downOnly)
      for (const m of modes)
        if (make(nominal, m)) {
          [fit, mode] = [{ target10: nominal, fitted: null }, m];
          break;
        }
    for (const m of fit ? [] : modes) {
      fit = fit10(
        nominal,
        frame,
        av ? h.cap10 : cap10,
        rule,
        (t10) => make(t10, m) !== null,
        downOnly
      );
      if (fit) {
        mode = m;
        break;
      }
    }
    // M13a (pouka 6): RECENT_LONG_TOO_SHORT samo kad je uzrok zaista skok dugog iz ulaza — isti plan bez
    // skorašnjeg najdužeg trka ne zastaje na ovoj ni ranijoj nedelji; inače WEEK_INFEASIBLE (MAR-04b: umor pre
    // starta je odbijan sa ovom porukom, a uzrok je bio nedostatak reference rasterećenja).
    if (!fit && recent !== null) {
      const { recentLongRunKm: _r, ...noRecent } = input;
      const alt = construct(noRecent, steps, prior);
      const stuck =
        !alt.ok &&
        alt.reasons.some((x) => x.code === 'WEEK_INFEASIBLE' && (x.week ?? 0) <= frame.index);
      if (!stuck)
        return recentTooShort(
          recent,
          km,
          input.runDays.length,
          weeks,
          frame.index,
          threshold
            ? recentThreshold(input as unknown as Record<string, unknown>, recent, steps, prior)
            : null
        );
    }
    if (!fit)
      return infeasible(
        `Nedelja ${frame.index}: nijedan cilj od ${rule.weekMinKm} km naviše ne može da se sastavi po pravilima.`,
        frame.index
      );
    let w = make(fit.target10, mode)!;
    // Pouka 37: mešovita nedelja — cilj važi za celu nedelju; preostali dani na ostatak = cilj − zaštićeni dani,
    // samo naniže (mixed.ts, jedino mesto odluke; validator MIXED_WEEK_OVER čita istu funkciju). Zaštićeni dani
    // ≤ asOf po činjenicama (prior.factKm); nedelja ostatka pauze ima svog vlasnika (mixed.pauseOwned).
    let mixNote: string | null = null;
    const s0 = prior?.weeks[frame.index - 1];
    const kept =
      prior && s0 && mustDay(s0.endDate) > prior.asOf && !pauseOwned(steps, frame.index)
        ? s0.days.filter(prior.keep)
        : [];
    if (kept.length > 0) {
      const keptAt = (d: PlanDay): boolean => kept.some((x) => x.date === d.date);
      const m = mixedRest(
        kept,
        w.days.filter((d) => !keptAt(d)),
        fit.target10,
        ctx.paces,
        prior!.factKm
      );
      if (m.cut) {
        const days = [...w.days.filter(keptAt), ...m.days].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        // Stanje doze iz dana kakvi se upisuju (pouka 29): kvalitet koji otpada ne napreduje.
        w = {
          ...w,
          days,
          planned100: planned100Of(days),
          picks: w.picks && m.dropped ? writtenPicks(days) : w.picks
        };
        mixNote = mixedNote(m, keptKm100(kept, prior!.factKm) / 100, fit.target10);
      }
    }
    const notes = [...w.notes, ...(mixNote ? [mixNote] : [])];
    if (fit.fitted) notes.unshift(fittedNote(nominal, fit.target10));
    // M13a: dugi na plafonu skoka; bez skorašnjeg najdužeg trka — napomena nedelje 1 sa pragom.
    if (w.jumpBound && w.long10 !== null)
      notes.push(longJumpNote(w.long10, jumpBase10(longs10, frame.index, recentJ)!));
    // Pouka 34: posle umora pre starta prag čita dugi reference (planirana ned 1), ne dugi rasterećenja.
    if (frame.index === 1 && recent === null && w.long10 !== null)
      notes.push(recentLongNote(Math.max(w.long10, pre ? Math.round(pre.longKm * 10) : 0)));
    // A9/A13: test koji ne staje otpada sa kvalitetom (oznaka nedelje ⇔ dan testa).
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
    if (taper === P.taper.weeks.length - 1) {
      taperMpM = wd.map((d) => d.workout.dose).find((d) => d?.zone === 'MP')?.doseM ?? 0;
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
      if (w.picks) quality = advance(same(wd, w.days) ? w.picks : writtenPicks(wd), quality);
    }
    if (av) h = leaveWeek(h, frame, fit.target10, av);
  }

  // A1: nivo plana iz tempa poslednje nedelje (budućnost); ocena cilja za nedelje od rezultata do trke.
  const N = out.length;
  const pN = adapted ? pacesAt(pace, steps, N, km) : paces;
  const feelN = adapted ? basisAt(pace, steps, N) === 'feel' : feel;
  const lastResult = [...steps].reverse().find((s) => s.vdot !== null);
  const goalWeeks = lastResult ? N - lastResult.fromWeek + 1 : weeks;
  const orientation = steps.some((s) => s.orientation);
  // M16: po osećaju bez prognoze i ocene cilja (posle testa).
  const goal =
    input.goalTimeSec && !feelN ? assessGoal(pN.mpVdot, input.goalTimeSec, goalWeeks) : null;
  const plan: MarathonV2Plan = {
    policyId: P.id,
    policyVersion: P.version,
    input,
    vdot: pN.vdot,
    paceBasis: feelN ? 'feel' : 'result',
    paces: pN,
    predictedMarathonSec: feelN ? null : predictedMarathon(pN),
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
  // Prošlost = upisani dani (pouka 29): napomene i validacija adaptiranog plana vide plan kakav se upisuje (isto
  // spajanje kao adapt.ts, written.ts), ne sastavljenu prošlost.
  const merged = prior && adapted ? writtenWeeks(out, prior) : null;
  const seen = merged ? merged.weeks : out;
  if (pace.kind === 'feel') {
    const t = seen.find((w) => w.test);
    const td = t?.days.find((d) => d.role === 'test');
    plan.notes.push(
      `Plan po osećaju (M16): ${pace.why}. E = lagan tempo ${fmtSec(pace.easySecPerKm)}/km ± ${P.feel.eRangeSec} s; tempo T/I/R i MP je orijentir (procena) iz procene VDOT ${fmtKm(paces.vdot)} — trening vodi RPE (MP ${P.feel.rpe.MP.min}–${P.feel.rpe.MP.max} „${P.feel.rpe.MP.cue}").`,
      t && td
        ? `Test ${P.test.km} km: nedelja ${t.index}, ${td.date} (M16). Ocena cilja, prognoza maratona i MP tempo: posle testa (adaptacija, segment 04).`
        : rule.feelTest
          ? `Test ${P.test.km} km: nema ga u planu posle adaptacije (A13: primljen rezultat, ili nema nedelje izgradnje bez ograničenja).`
          : `Početnik bez testa ${P.test.km} km (M17): kvalitet po RPE; ocena cilja i prognoza maratona posle rezultata trke (adaptacija, segment 04).`
    );
  }
  if (rule.beginner)
    plan.notes.push(
      `Početnik (M17): uvod ${rule.introWeeks} nedelje bez kvaliteta, zatim jedan kvalitet nedeljno (T kontinuirano → T cruise → MP), bez I i R; WU/CD ${ctx0.wc.warmupSec / 60}/${ctx0.wc.cooldownSec / 60} min.`
    );
  if (shortResult)
    plan.notes.push(
      `Rezultat 5 km: maratonska prognoza iz kratke trke je nesigurnija; MP iz VDOT ${fmtKm(paces.mpVdot)} (M1, M2).`
    );
  // MAR-09 t. 4: plafon 150 min tempom nedelje (isti kojim je nedelja građena, ctxAt = pacesAt).
  const pW = (w: number): Paces => pacesAt(pace, steps, w, km);
  if (capacityWeeks(seen, rule, pW, recentJ, steps).length > 0)
    plan.notes.push(
      `${capacityMessage(input.runDays.length, rule, capacityLimits(seen, rule, pW, recentJ, steps))} Vrh ${fmtKm(plan.peakKm)} km umesto do ${fmtKm(plan.peakCapKm)} km (M6).`
    );
  // N11: najduži dugi ograničen trajanjem (M13, namerna granica) — rečenica u opisu plana, ne upozorenje.
  const ls = longShortOf(seen, rule.longShortKm, pW);
  if (ls?.timeCapped)
    plan.notes.push(longTimeCapNote(ls.longestKm, rule.longShortKm, rule.beginner));
  if (orientation) plan.notes.push(P.adapt.orientationMessage);
  if (adapted)
    plan.adaptation = {
      asOf: steps[steps.length - 1]!.asOf,
      steps: [...steps],
      mixedWeeks: [],
      lockedDayIds: []
    };
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
