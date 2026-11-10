/* generateFiveKV2(input) → plan ili strukturisano odbijanje.
   Bez čitanja sata: svi datumi dolaze iz ulaza. Ista vrednost ulaza → isti JSON. */

import { addDays, daysBetween, mustDay, weekdayIndex, weekdayOf } from './dates.ts';
import { checkInput, vdotBelowRange, weekLabel } from './input.ts';
import { userResult, userText } from './text.ts';
import {
  assessGoal,
  beginnerGoal,
  feelPaces,
  goalWithoutData,
  pacesFromVdot,
  raceTimeForVdot
} from './paces.ts';
import { firstPeakIWeek, isShortPrep, periodize, phaseCounts, testKindOf } from './periodize.ts';
import { FIVE_K_V2_POLICY as P, rulesOf, type Athlete } from './policy.ts';
import { buildRunWalkPlan } from './runWalk.ts';
import { choosePattern } from './schedule.ts';
import {
  athleteAt,
  baseAthlete,
  beginnerAboveTable,
  baseVdot,
  doseResetAt,
  framesFor,
  pacesAt,
  writtenTest
} from './steps.ts';
import type {
  AdaptStep,
  FiveKV2Input,
  FiveKV2Plan,
  GenerateResult,
  GoalAssessment,
  PaceModel,
  Pattern,
  Phase,
  PlanDay,
  PlanWeek,
  QualityCap,
  Reason,
  WeekFrame,
  Weekday
} from './types.ts';
import { validatePlan } from './validate.ts';
import { adaptVolume, pauseRemainderKm, planVolume, type VolumePlan } from './volume.ts';
import {
  buildRaceWeek,
  buildTrainingWeek,
  mixedWeek,
  protectedKm,
  secondEasyDose
} from './week.ts';
import { raceWarmup, type WeekDose } from './workouts.ts';
import { type Written, writtenWeek } from './written.ts';

const kmPlain = (x: number): string => String(x).replace('.', ',');

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
  steps: readonly AdaptStep[] = [],
  prior: Written | null = null
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
  const frames0 = periodize(
    input.startDate,
    totalWeeks,
    rules.deloadEvery,
    testKindOf(a, totalWeeks),
    a.beginner
  );
  const vol = planVolume(frames0, input.currentWeeklyKm, paces, a);
  const dropped = new Map<number, number>();
  /** 2.10.1: nedelja → dan testa koji je zaštićen (test otpada, steps.framesFor). */
  const testLost = new Map<number, string>();
  const frames =
    steps.length > 0
      ? framesFor(input, steps, pat.pattern, totalWeeks, dropped, prior, testLost)
      : frames0;
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
  /** 2.8.0 (pouka 29): nedelje kakve se upisuju (written.ts) — iz njih stanje koje zavisi od prošlosti. */
  const written: PlanWeek[] = [];
  const wt = prior && steps.length > 0 ? writtenTest(prior) : null;
  const testDone = wt?.done ? wt.week : null;
  const push = (w0: PlanWeek): void => {
    // 5k-v2.11.0 (Z2): napomene nedelje u formatu teksta korisniku pre spajanja (prethodni plan je u istom formatu).
    const w = { ...w0, notes: w0.notes.map(userText) };
    weeks.push(w);
    written.push(prior ? writtenWeek(prior.weeks[w.index - 1]!, w, prior).week : w);
  };
  // Progresija doze: doza glavnog kvaliteta poslednje ne-rasteretne nedelje, po fazi. 2.5.0: korak sa
  // novim ciljem obima (pauza, izvršenje; nov start) i promena načina tempa (po osećaju → VDOT) počinju
  // progresiju iznova (manji obim → doza sme da padne; isti segment kao u validate.ts). 2.6.1: i korak bola
  // sa povratkom, od nedelje posle sidra (steps.doseResetAt).
  let lastDose: Partial<Record<Phase, WeekDose>> = {};
  // 2.10.0 (pouka 37): mešovita nedelja izgradnje/tapera (deo dana zaštićen, nedelja nije cela prošlost) — cilj važi
  // za celu nedelju; trkačka nedelja izuzeta (pouka 30: ≤ planirano tapera, week.raceWeekRest). 2.10.1: zbir zaštićenih
  // po činjenicama (week.protectedKm ← Written.factKm), upisan u nedelju kad se razlikuje od planiranih km i validator ga
  // treba (nedelja je tada mešovita — written.writtenWeek);
  // nedelja ostatka pauze (volume.pauseRemainderKm) ima vlasnika — pravilo pauze, pouka 37 je ne menja.
  const mixedOf = (
    w: PlanWeek,
    f: WeekFrame,
    p: PaceModel
  ): { week: PlanWeek; droppedQuality: boolean } | null => {
    const pw = prior?.weeks[f.index - 1];
    if (!prior || !pw || mustDay(pw.endDate) <= prior.asOf) return null;
    const kept = pw.days.filter(prior.keep);
    const keptKm = protectedKm(kept, prior.factKm);
    const owner = steps.some(
      (s) => s.firstWeek === f.index && pauseRemainderKm(s, f, w.targetKm) !== null
    );
    const planKm = protectedKm(kept);
    const m = owner ? null : mixedWeek(w, kept, keptKm, p, planKm);
    const out = m?.week ?? w;
    const keptDates = new Set(kept.map((d) => d.date));
    const freeKm = out.days
      .filter((d) => !keptDates.has(d.date) && d.countsToWeek)
      .reduce((a, d) => a + d.workout.km, 0);
    // Validator treba zbir po činjenicama samo kad bi sa planiranim km nedelja bila iznad cilja, ili kad su zaštićeni
    // dani po činjenicama veći (skraćivanje i u nedelji čiji su dani isti kao sastavljeni).
    const need =
      keptKm > planKm || planKm + freeKm > out.targetKm + P.tolerance.arithmeticKm + 1e-9;
    if (keptKm === planKm || !need) return m;
    return { week: { ...out, protectedKm: keptKm }, droppedQuality: m?.droppedQuality ?? false };
  };
  const firstIWeek = firstPeakIWeek(frames);
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
        written[written.length - 1]?.days.find((d) => d.role === 'long')?.workout.km ?? 0;
      // 2.8.0 (pouka 30): trkačka nedelja ≤ planirano UPISANOG tapera (pouka 29); zaštićeni dani trkačke nedelje
      // ulaze u zbir (week.raceWeekRest).
      const taper = written[written.length - 1];
      // 5k-v2.15.0 (P8 d): WU/CD trke po vrhu obima; trkački dan ne sme biti najduži dan plana (workouts.raceWarmup).
      const raceBand = raceWarmup(adapted.peakKm, longestDayKm(written));
      const priorRace = prior?.weeks[f.index - 1];
      const cap = taper
        ? {
            km: taper.plannedKm,
            ...(prior && priorRace
              ? {
                  fixed: (date: string): PlanDay | null | undefined => {
                    const pd = priorRace.days.find((x) => x.date === date);
                    if (pd) return prior.keep(pd) ? pd : undefined;
                    return mustDay(date) <= prior.asOf ? null : undefined;
                  }
                }
              : {})
          }
        : null;
      let r = buildRaceWeek(
        f,
        target,
        pat.pattern,
        input.runDays,
        input.raceDate,
        p,
        prevLong,
        cap,
        input.weekOffset,
        raceBand
      );
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
          prevLong,
          cap,
          input.weekOffset,
          raceBand
        );
        if (short && r.ok)
          r.week.notes.push(
            `Adaptacija: oštrenje ne staje u granicu ${target} km (nedelja bi imala manje od ${P.week.minRaceWeekKm} km).`
          );
      }
      if (r.ok) push(r.week);
      else reasons.push(r.reason);
      return;
    }
    // 5k-v2.15.0 (P8 b): granica kvaliteta i dugog rasterećenja/tapera iz upisanih nedelja (qualityCapOf).
    const fc0 = qualityCapOf(f, written);
    // 5k-v2.15.0 (P8 c): prvi I trening posle R faze (periodize.firstPeakIWeek).
    const fc: WeekFrame = f.index === firstIWeek && !f.hold ? { ...fc0, firstI: true } : fc0;
    const build = (g: WeekFrame) =>
      buildTrainingWeek(
        g,
        target,
        pat.pattern,
        p,
        lastDose[f.phase] ?? null,
        aw,
        phaseCounts(totalWeeks, a.beginner).taper
      );
    let r = build(fc);
    // 2.10.2 (K9): kontrolno trčanje koje ne staje otpada PRVO samo (ista ograničenja, isti obim); tek onda manje
    // kvaliteta — inače ponovljena adaptacija (bez testa u prethodnom planu) gradi drugu dozu.
    if (!r.ok && adaptive && f.test) {
      const t = build({ ...fc, test: false });
      if (t.ok) {
        t.week.notes.push(`Adaptacija: kontrolno trčanje ne staje u obim ${target} km — otpada.`);
        r = t;
      }
    }
    // 5k-v2.11.0 (F2): isti lanac i u generatoru (bez adaptacije) — kvalitet koji ne staje u obim (npr. 3 dana / 12 km)
    // → jedan kvalitet doze rasterećenja → bez kvaliteta, uz napomenu i upozorenje QUALITY_REDUCED, umesto odbijanja
    // plana (QUALITY_INFEASIBLE). Jedan vlasnik: ovaj lanac; validator čita ograničenje nedelje (limits.quality).
    for (const q of ['one', 'none'] as const) {
      if (r.ok || (q === 'one' && f.limits?.quality !== undefined)) continue;
      const { swap: _swap, ...rest } = f.limits ?? {};
      // 2.6.0: kontrolno trčanje je glavni kvalitet nedelje — kad ne staje, otpada sa njim.
      r = build({ ...fc, test: false, limits: { ...(q === 'one' ? f.limits : rest), quality: q } });
      if (r.ok)
        r.week.notes.push(
          `${adaptive ? 'Adaptacija: k' : 'K'}valitet ne staje u obim ${target} km — ${q === 'one' ? 'jedan kvalitet doze rasterećenja' : 'nedelja bez kvaliteta'}${f.test && testDone !== f.index ? ' (bez kontrolnog trčanja)' : ''}${adaptive ? '' : '; više obima ili 4 dana trčanja daju puni kvalitet'}.`
        );
    }
    if (!r.ok) {
      reasons.push(r.reason);
      return;
    }
    // 2.10.0 (pouka 37): mešovita nedelja — preostali dani na ostatak do cilja (week.mixedWeek); kvalitet koji
    // otpada ne menja stanje svoje doze.
    const m = mixedOf(r.week, f, p);
    // 2.10.1: otpao samo drugi kvalitet (q1 ostaje) → doza kao pouka 35 (week.secondEasyDose); svi → bez doze.
    if (m) {
      const q1Left = m.week.days.some((d) => d.role === 'q1' && d.workout.kind === 'quality');
      const dose = !m.droppedQuality
        ? r.dose
        : q1Left && r.dose
          ? secondEasyDose(r.dose, lastDose[f.phase] ?? null)
          : null;
      r = { ok: true, week: m.week, dose };
    }
    const lost = testLost.get(f.index);
    if (lost)
      r.week.notes.push(
        `Adaptacija: kontrolno trčanje otpada — dan testa ${lost} je zaključan (test se ne stavlja na zaštićen dan).`
      );
    // 2.8.0 (pouka 29, N2a): kontrolno trčanje u zaštićenom (upisanom) danu je urađeno — nedelja ga nosi i kad
    // sastavljeni ostatak nedelje nema test (ne staje u smanjen obim).
    if (testDone === f.index && f.test && !r.week.test) r.week = { ...r.week, test: true };
    if (i === 0 && vol.startCapped)
      r.week.notes.push(
        `Trenutni obim (${input.currentWeeklyKm} km) je veći od onoga što ${a.days} dana nose (${vol.capacityKm} km); plan kreće od ${vol.capacityKm} km.${a.days < (a.beginner ? P.beginner.maxRunDays : 5) ? ' Za veći obim izaberi više dana trčanja.' : ''}`
      );
    push(r.week);
    // 2.8.0 (pouka 29, N4): stanje doze iz UPISANIH dana — doza sastavljene nedelje važi samo kad su upisani dani
    // kvaliteta isti kao sastavljeni; inače (zaštićen dan prethodnog plana: pre novog segmenta doze ili
    // zaključan) nedelja ne menja stanje (validator: steps.doseResetDate, granica/zaključan dan van lanca).
    const qOf = (w: PlanWeek): string =>
      JSON.stringify(w.days.filter((d) => d.workout.kind === 'quality'));
    const wr = written[written.length - 1]!;
    // 2.10.1 (pouka 37): upisana nedelja bez drugog kvaliteta (otpao u mešovitoj nedelji ranije adaptacije), prvi isti
    // kao sastavljen → doza kao pouka 35 (week.secondEasyDose).
    const q1Of = (w: PlanWeek): string =>
      JSON.stringify(w.days.filter((d) => d.workout.kind === 'quality' && d.role === 'q1'));
    const q2Gone =
      !wr.days.some((d) => d.workout.kind === 'quality' && d.role === 'q2') &&
      r.week.days.some((d) => d.workout.kind === 'quality' && d.role === 'q2') &&
      q1Of(wr) === q1Of(r.week) &&
      wr.days.some((d) => d.workout.kind === 'quality');
    if (r.dose && qOf(wr) === qOf(r.week)) lastDose[f.phase] = r.dose;
    else if (r.dose && q2Gone)
      lastDose[f.phase] = secondEasyDose(r.dose, lastDose[f.phase] ?? null);
    // 5k-v2.11.1 (C4): upisani (zaštićeni) dani kvaliteta nisu sastavljeni — doza nedelje je činjenica, nedelja je van
    // lanca doze; oznaka za validator (jedan vlasnik: ova odluka).
    else if (r.dose) weeks[weeks.length - 1] = { ...weeks[weeks.length - 1]!, doseFact: true };
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

/** 5k-v2.15.0 (P8 G3): rasterećenja kako ih plan stvarno ima (ne „svake N. nedelje"). */
function deloadText(frames: readonly WeekFrame[], off = 0): string {
  const ws = frames.filter((f) => f.deload).map((f) => String(weekLabel(f.index, off)));
  if (ws.length === 0) return '';
  return ws.length === 1
    ? `, rasterećenje u nedelji ${ws[0]!}`
    : `, rasterećenje u nedeljama ${ws.slice(0, -1).join(', ')} i ${ws[ws.length - 1]!}`;
}

/** 5k-v2.15.0 (P8 d): najduži trening upisanih nedelja [km] (konstruktor i validator, workouts.raceWarmup). */
export const longestDayKm = (weeks: readonly PlanWeek[]): number =>
  Math.max(0, ...weeks.flatMap((w) => w.days.filter((d) => d.role !== 'race').map((d) => d.workout.km)));

const isBuildPhase = (ph: Phase): boolean => ph === 'base' || ph === 'peak' || ph === 'sharpen';

/**
 * 5k-v2.15.0 (P8 b, heuristika, odluka organizatora P8, nalaz slepe ocene) — JEDINO mesto granice: nedelja rasterećenja
 * (izgradnja) i tapera dobija granicu rada svake zone = udeo (quality.deloadQualityShare 0,6 / taperQualityShare 0,7) ×
 * rad te zone u poslednjoj UPISANOJ ne-rasteretnoj nedelji izgradnje sa tom zonom; rasterećenje i dugi ≤
 * deloadLongShare × dugi poslednje ne-rasteretne nedelje izgradnje. Zone bez ranije doze nemaju granicu. Najniži nivo
 * lestvice uvek staje (workouts.cappedBudget, feel.cappedFeel).
 */
export function qualityCapOf(f: WeekFrame, written: readonly PlanWeek[]): WeekFrame {
  const deload = f.deload && isBuildPhase(f.phase);
  if (!deload && f.phase !== 'taper') return f;
  const share = deload ? P.quality.deloadQualityShare : P.quality.taperQualityShare;
  const build = written.filter((w) => !w.deload && isBuildPhase(w.phase));
  const cap: QualityCap = {};
  for (const z of ['I', 'RP', 'T', 'R'] as const)
    for (let i = build.length - 1; i >= 0; i--) {
      const work = build[i]!.days
        .filter((d) => d.workout.kind === 'quality')
        .reduce((x, d) => x + d.workout.workKm[z], 0);
      if (work > 1e-9) {
        cap[z] = Math.round(share * work * 100) / 100;
        break;
      }
    }
  const lastLong = build[build.length - 1]?.days.find((d) => d.role === 'long')?.workout.km;
  if (deload && lastLong !== undefined)
    cap.longKm = Math.floor(lastLong * P.quality.deloadLongShare * 10 + 1e-9) / 10;
  return Object.keys(cap).length > 0 ? { ...f, qcap: cap } : f;
}

function dateIn(f: WeekFrame, w: Weekday): string {
  const offset = (((weekdayIndex(w) - weekdayIndex(weekdayOf(f.startDate))) % 7) + 7) % 7;
  return addDays(f.startDate, offset);
}

/** 5k-v2.11.0 (Z2): tekst korisniku rezultata kroz text.userResult (jedini format). */
export function generateFiveKV2(raw: unknown): GenerateResult {
  return userResult(generateRaw(raw));
}

function generateRaw(raw: unknown): GenerateResult {
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
    if (test)
      notes.push(
        P.feel.testNote.replace('{week}', String(weekLabel(test.index, input.weekOffset)))
      );
    notes.push(P.feel.forecastNote);
    const old = input.recentResult;
    if (
      old &&
      daysBetween(old.date, input.startDate) <= P.input.resultMaxAgeDays &&
      vdotBelowRange(old)
    )
      notes.push(
        P.feel.slowResultNote
          .replace('{result}', `${old.distanceM / 1000}K ${fmt(old.timeSec)}`)
          .replace('{date}', old.date)
      );
    else if (old)
      notes.push(
        P.feel.oldResultNote
          .replace('{result}', `${old.distanceM / 1000}K ${fmt(old.timeSec)}`)
          .replace('{date}', old.date)
      );
  }
  // 5k-v2.14.0 (P5 F1): plan sa rezultatom ≥ 10 nedelja — kontrolno trčanje pred oštrenje.
  const rTest = a.feel ? undefined : frames.find((f) => f.test);
  if (rTest)
    notes.push(
      P.feel.resultTestNote.replace('{week}', String(weekLabel(rTest.index, input.weekOffset)))
    );
  const lifted = beginnerAboveTable(input);
  if (lifted !== null)
    notes.push(
      `Trenutni obim ${kmPlain(input.currentWeeklyKm)} km je veći od onoga što plan za početnika nosi (${kmPlain(lifted)} km uz ${a.days} dana), pa plan kreće od tvog stvarnog obima, kao za redovnog trkača (sa dva kvaliteta nedeljno kad dani to dopuštaju). Ako ti je napor prevelik, unesi manji trenutni obim.`
    );
  if (a.beginner)
    notes.push(
      `Početnik: ${rules.qualityDays} kvalitet nedeljno od nedelje ${weekLabel(P.beginner.introWeeks + 1, input.weekOffset)}, bez intervala (I); obim raste najviše ${Math.round(rules.maxBuildGrowth * 100)} % nedeljno, dugi trk najviše ${rules.longMaxSec / 60} min, najveći nedeljni obim najviše ${Math.round((rules.peakCapFactor - 1) * 100)} % iznad početnog${deloadText(frames, input.weekOffset)}.`
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
