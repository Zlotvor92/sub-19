/* HM v3 — MOTOR: nedelje-namere iz šablona → nedelje plana. Raspored po rastojanju od trke (kk): trka, taper,
   specifična faza (kk 2–6, vrh kk 3), kraj razvoja (kk 7), rasterećenje svake 4. nedelje unazad (kk 4, 8, …),
   provera forme u kk 8. Svaki broj ovde je jedna odluka: obim, dugi i doza nedelje iz skaliranja (scale.ts); lagani
   dani dele ostatak; manjak obima se ne nadoknađuje produžavanjem WU/CD ni kvaliteta. */

import { addDays, weekdayIndex, weekdayOf } from './fromV2/dates.ts';
import { daySr } from './fromV2/input.ts';
import { midEasy, raceTimeForVdot, round1 } from './fromV2/paces.ts';
import { HM_V2_POLICY as P, type PlanRule } from './fromV2/policy.ts';
import type {
  HmV2Input,
  Paces,
  Pattern,
  Phase,
  PlanDay,
  PlanWeek,
  Weekday,
  Workout
} from './fromV2/types.ts';
import { capSec, f1, type Scale } from './scale.ts';
import { COACH, FUEL, type QIntent, type Template, type WeekIntent } from './templates.ts';
import * as W from './workouts.ts';

export interface Frame {
  index: number;
  startDate: string;
  endDate: string;
  phase: Phase;
  deload: boolean;
  /** Rastojanje od trke (0 = trkačka nedelja); plan ≤ 8 nedelja preskače nedelju posle vrha (vrh 2 nedelje pred trku). */
  kk: number;
  prep: boolean;
  /** null = trkačka nedelja. */
  intent: WeekIntent | null;
  /** Mesto na lestvici obima/dugog (0 … rampSteps) ili null. */
  ramp: number | null;
}

/** Raspored nedelja (jedno mesto): faza, rasterećenje, namera iz šablona, mesto na lestvici. */
export function framesOf(t: Template, input: HmV2Input, weeks: number, feel: boolean): Frame[] {
  const shift = weeks <= 8 ? 1 : 0;
  const prepWeeks = Math.max(0, weeks - P.input.weeksMax);
  const kkOf = (w: number): number => (weeks - w < 2 ? weeks - w : weeks - w + shift);
  const isDeload = (w: number): boolean => {
    const kk = kkOf(w);
    return kk >= 4 && kk % 4 === 0 && w >= P.deload.firstAllowedWeek;
  };
  const pre = Array.from({ length: weeks }, (_, i) => i + 1).filter(
    (w) => w > prepWeeks && kkOf(w) >= 8
  );
  const baseN = Math.round(t.baseShare * pre.length);
  const baseWeeks = new Set(pre.slice(0, baseN));
  const devBuild = pre.slice(baseN).filter((w) => !isDeload(w));
  let feelTestDone = !feel;
  let baseI = 0;
  let prepI = 0;
  const frames: Frame[] = [];
  for (let w = 1; w <= weeks; w++) {
    const kk = kkOf(w);
    const k = weeks - w;
    const deload = k >= 2 && isDeload(w);
    const prep = w <= prepWeeks;
    const phase: Phase =
      k === 0
        ? 'race'
        : k === 1
          ? 'taper'
          : kk <= 6
            ? 'specific'
            : kk === 7
              ? 'development'
              : prep || baseWeeks.has(w)
                ? 'base'
                : 'development';
    let intent: WeekIntent | null;
    if (k === 0) intent = null;
    else if (deload) {
      if (kk === 8 && w >= P.test.minWeek) intent = t.check;
      else if (!feelTestDone && w >= P.test.minWeek) {
        intent = t.feelTest;
        feelTestDone = true;
      } else intent = t.deload;
      if (intent === t.check) feelTestDone = true;
    } else if (k === 1 || kk <= 7) intent = t.tail[kk as 1 | 2 | 3 | 5 | 6 | 7];
    else if (prep) intent = t.prep[prepI++ % 2]!;
    else if (phase === 'base') intent = t.base[Math.min(baseI++, t.base.length - 1)]!;
    else {
      const j = devBuild.indexOf(w);
      intent = t.dev[Math.max(0, t.dev.length - devBuild.length + j)]!;
    }
    frames.push({
      index: w,
      startDate: addDays(input.startDate, 7 * (w - 1)),
      endDate: addDays(input.startDate, 7 * w - 1),
      phase,
      deload,
      kk,
      prep,
      intent,
      ramp: null
    });
  }
  // Lestvica: izgradnje posle osnovne pripreme do nedelje kraja lestvice (kk = rampEndKk), uključujući nju.
  let r = 0;
  for (const f of frames) if (!f.prep && !f.deload && f.intent && f.kk >= t.rampEndKk) f.ramp = r++;
  return frames;
}

export const rampSteps = (frames: readonly Frame[]): number =>
  Math.max(0, frames.filter((f) => f.ramp !== null).length - 1);

export interface BuildCtx {
  t: Template;
  input: HmV2Input;
  rule: PlanRule;
  pattern: Pattern;
  p: Paces;
  feel: boolean;
  scale: Scale;
  /** VDOT za prognozu provere forme (cilj ako je zadat, inače trenutni); null u planu po osećaju. */
  checkVdot: number | null;
  goalSec: number | null;
  predictedSec: number | null;
}

const longStep = (l: number): number => Math.max(P.recentLong.factor * l, l + P.recentLong.addKm);

/** Nedelje plana redom; svaka odluka nedelje se donosi jednom. */
export function buildWeeks(frames: readonly Frame[], b: BuildCtx): PlanWeek[] {
  const { t, scale: s, p } = b;
  const beginner = t.id === 'beginner';
  const R = rampSteps(frames);
  const at = (r: number): number => (R === 0 ? 1 : r / R);
  const wu = P.workout.warmupCooldown.filter((x) => x.fromKm <= b.input.currentWeeklyKm).pop()!;
  const c: W.Ctx = { p, wuSec: wu.warmupSec, cdSec: wu.cooldownSec, feel: b.feel };
  const longs: number[] = [];
  const out: PlanWeek[] = [];
  let prevBuildKm = s.startKm;
  // Početak lestvice dugog: udeo najdužeg, ali ne ispod udela sadašnjeg obima.
  const s0 = Math.min(1, Math.max(t.longS0, (t.longStartShare * s.startKm) / s.longestKm));
  let prevLong = s.longestKm * s0;
  let maxDoseSec = 0;
  let peakWorkSec = 0;
  let buildOrdinal = 0;

  for (const f of frames) {
    if (!f.intent) {
      out.push(raceWeek(f, b, c));
      continue;
    }
    const it = f.intent;
    // Obim nedelje.
    const target = round1(
      f.prep
        ? s.startKm
        : it.vol === 'ramp'
          ? s.startKm + (s.peakKm - s.startKm) * at(f.ramp ?? R)
          : it.vol === 'deload'
            ? t.deloadVol * prevBuildKm
            : it.vol * s.peakKm
    );
    // Dugi: namera → jedna granica (udeo nedelje, kotrljajuća granica pouke 28, najduži).
    const ls = it.long.s;
    const want = f.prep
      ? s.longestKm * s0
      : ls === 'ramp'
        ? s.longestKm * (s0 + (1 - s0) * at(f.ramp ?? R))
        : ls === 'deload'
          ? t.deloadLong * prevLong
          : ls * s.longestKm;
    const prev4 = longs.slice(-P.recentLong.windowWeeks);
    if (b.input.recentLongRunKm != null && f.index <= P.recentLong.windowWeeks)
      prev4.push(b.input.recentLongRunKm);
    const roll = prev4.length ? longStep(Math.max(...prev4)) : Infinity;
    const longKm = Math.floor(Math.min(want, s.longShare * target, roll, s.longestKm) * 10) / 10;
    const blockWant = it.long.block === 'top' ? s.blockTopKm : (it.long.block ?? 0);
    const blockKm =
      it.long.role === 'block'
        ? Math.min(blockWant, Math.floor(P.specific.blockMaxLongShare * longKm))
        : 0;

    // Kvalitet: 3 dana i početnik imaju jedan slot.
    const one = b.pattern.q2 === null;
    const real = (q: QIntent | null): q is Exclude<QIntent, { z: 'S' }> =>
      q !== null && q.z !== 'S';
    let q1 = it.q1;
    let q2 = it.q2;
    if (one) {
      const pickQ2 =
        !real(q1) ||
        (real(q2) && f.phase !== 'specific' && f.phase !== 'taper' && buildOrdinal % 2 === 1);
      q1 = pickQ2 ? q2 : q1;
      q2 = null;
    }
    // Nedelja posle vrha i taper: minuti rada ≤ udeo najteže nedelje (GAP § 2 st. 2) — jedno mesto, ovde.
    const blockSec = blockKm * p.RP;
    const share =
      f.kk === 2 ? COACH.afterPeakShare : f.phase === 'taper' ? COACH.taperShare : Infinity;
    const qualityOf = (q: QIntent | null, scaleBy: number): Workout | null => {
      if (!real(q)) return null;
      if (q.z === 'H') {
        const reps = Math.min(q.reps, Math.floor(capSec('R', target, p, beginner) / q.sec));
        return reps >= 4 ? W.hills(reps, q.sec, c) : null;
      }
      const sec = Math.min(q.s * s.peakDoseSec[q.z], capSec(q.z, target, p, beginner)) * scaleBy;
      if (sec < COACH.minWorkSec) return null;
      const wo = W.quality(q.z, sec, q.f, c);
      return W.workSec(wo) >= COACH.minWorkSec ? wo : null;
    };
    let w1 = qualityOf(q1, 1);
    let w2 = qualityOf(q2, 1);
    if (share !== Infinity && peakWorkSec > 0) {
      const allowed = share * peakWorkSec - blockSec;
      const have = (w1 ? W.workSec(w1) : 0) + (w2 ? W.workSec(w2) : 0);
      if (have > allowed) {
        const k = Math.max(0, allowed) / have;
        w1 = qualityOf(q1, k);
        w2 = qualityOf(q2, k);
      }
    }

    // Provera forme.
    let testWo: Workout | null = null;
    let testNote: string | null = null;
    if (it.test) {
      const r = checkTest(it.test, b, maxDoseSec, c);
      testWo = r.wo;
      testNote = r.note;
    }

    // Dani.
    const days = dayDates(f.startDate, b.input.runDays);
    const roleOf = (d: Weekday): PlanDay['role'] =>
      d === b.pattern.long
        ? 'long'
        : d === b.pattern.q1
          ? 'q1'
          : d === b.pattern.q2
            ? 'q2'
            : 'easy';
    const longDate = days.find((d) => d.wd === b.pattern.long)!.date;
    let testDay: Weekday | null = null;
    if (testWo) {
      const before = days.filter((d) => roleOf(d.wd) === 'easy' && d.date < longDate).pop();
      testDay = it.test === 'race10' && before ? before.wd : (b.pattern.q2 ?? b.pattern.q1);
      if (testDay === b.pattern.q1 && it.test === 'race10') w1 = null;
      if (testDay === b.pattern.q2) w2 = null;
    }
    const fixed: Record<string, Workout> = {};
    fixed[b.pattern.long] = W.long(longKm, it.long.role, blockKm, c);
    if (w1) fixed[b.pattern.q1] = w1;
    if (w2 && b.pattern.q2) fixed[b.pattern.q2] = w2;
    if (testWo && testDay) fixed[testDay] = testWo;
    const easyDays = days.filter((d) => !fixed[d.wd]);
    const used = Object.values(fixed).reduce((a, w) => a + w.km, 0);
    const easyMin = Math.max(P.lengths.easyMinKm, P.lengths.easyMinSec / midEasy(p));
    const easyMax = Math.max(
      easyMin,
      longKm * (beginner || one ? P.lengths.easyLongMaxShare : P.lengths.easyLongMaxShare4)
    );
    const each = easyDays.length ? (target - used) / easyDays.length : 0;
    const easyKm = Math.min(longKm, Math.max(easyMin, Math.min(easyMax, each)));
    const strides =
      f.deload && it.q1?.z !== 'S'
        ? 0
        : beginner || f.phase === 'base'
          ? P.strides.baseReps
          : P.strides.laterReps;
    let stridesGiven = strides === 0;
    const planDays: PlanDay[] = days.map((d) => {
      const role = d.wd === testDay ? 'test' : roleOf(d.wd);
      let wo = fixed[d.wd];
      if (!wo) {
        wo = W.easy(round1(easyKm), c, stridesGiven ? 0 : strides);
        stridesGiven = true;
      }
      const hard =
        wo.kind === 'quality' || wo.kind === 'test' || (wo.kind === 'long' && blockKm > 0);
      return {
        date: d.date,
        weekday: d.wd,
        role: wo.kind === 'easy' && role !== 'long' ? 'easy' : role,
        hard,
        countsToWeek: true,
        workout: wo
      };
    });
    const planned = round1(planDays.reduce((a, d) => a + d.workout.km, 0));
    const notes: string[] = [];
    if (testNote) notes.push(testNote);
    if (it.note && (it.note !== FUEL || longKm * midEasy(p) >= 5400)) notes.push(it.note);
    if (planned < target - 0.5)
      notes.push(
        `Planirano ${f1(planned)} km je ispod cilja ${f1(target)} km: lagani dani ne smeju biti duži od dugog.`
      );

    const work = planDays.reduce((a, d) => a + W.workSec(d.workout), 0);
    if (f.kk === 3) peakWorkSec = work;
    for (const d of planDays)
      if (d.workout.kind === 'quality') maxDoseSec = Math.max(maxDoseSec, W.workSec(d.workout));
    if (!f.deload && f.phase !== 'taper') {
      prevBuildKm = target;
      buildOrdinal++;
    }
    prevLong = longKm;
    longs.push(longKm);
    out.push({
      index: f.index,
      startDate: f.startDate,
      endDate: f.endDate,
      phase: f.phase,
      deload: f.deload,
      ...(testWo ? { test: true as const } : {}),
      ...(f.prep ? { prep: true as const } : {}),
      targetKm: target,
      plannedKm: planned,
      nominalKm: target,
      fitted: null,
      days: planDays,
      notes
    });
  }
  return out;
}

function dayDates(start: string, runDays: readonly Weekday[]): { wd: Weekday; date: string }[] {
  const w0 = weekdayIndex(weekdayOf(start));
  return runDays
    .map((wd) => ({ wd, date: addDays(start, (weekdayIndex(wd) - w0 + 7) % 7) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

const hmmss = (s: number): string =>
  `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Provera forme: pripremna trka 10 km (≤ 2 × najveća doza, inače 5 km) ili test 3 km; rečenica šta rezultat znači. */
function checkTest(
  kind: 'race10' | 'test3',
  b: BuildCtx,
  maxDoseSec: number,
  c: W.Ctx
): { wo: Workout; note: string } {
  const v = b.checkVdot ?? b.p.vdot;
  if (kind === 'test3') {
    const pace = raceTimeForVdot(v, 3000) / 3;
    return {
      wo: W.test(3, pace, 'test 3 km jako, ravnomerno', c),
      note: 'Test 3 km: iz rezultata se računaju tempo trke i prag za ostatak pripreme (unesi rezultat); do tada tempa po osećaju.'
    };
  }
  const km = raceTimeForVdot(v, 10000) <= COACH.testMaxDoseFactor * maxDoseSec ? 10 : 5;
  const sec = raceTimeForVdot(v, km * 1000);
  const label =
    km === 10 ? 'pripremna trka 10 km (ili test 5 km)' : 'test 5 km jako (pripremna trka)';
  const wo = W.test(km, sec / km, label, c);
  const t = W.mmss(sec);
  const slow = W.mmss(sec * 1.02);
  const note =
    b.checkVdot === null
      ? `Pripremna trka ${km} km: iz rezultata se računaju prognoza polumaratona i tempo trke (unesi rezultat).`
      : `Pripremna trka ${km} km: ≤ ${t} potvrđuje ${b.goalSec ? `cilj ${hmmss(b.goalSec)}` : `prognozu ${hmmss(b.predictedSec ?? 0)}`}; sporije od ${slow} — trku planiraj po prognozi iz ove trke.`;
  return { wo, note };
}

/** H8: trkačka nedelja — oštrenje ≥ 3 dana pred trku, dan pred trku 20 min + ubrzanja, ostali lagano 35 min. */
function raceWeek(f: Frame, b: BuildCtx, c: W.Ctx): PlanWeek {
  const rw = P.raceWeek;
  const race = b.input.raceDate;
  const days = dayDates(f.startDate, b.input.runDays).filter((d) => d.date < race);
  const eve = days.find((d) => d.date === addDays(race, -1));
  const sharp = days.filter((d) => d.date <= addDays(race, -rw.sharpenerMinGapDays)).pop();
  let others = days.filter((d) => d !== eve && d !== sharp);
  const room = rw.maxRunDays - 1 - (eve ? 1 : 0) - (sharp ? 1 : 0);
  others = others.slice(Math.max(0, others.length - room));
  const planDays: PlanDay[] = [];
  for (const d of days) {
    let wo: Workout | null = null;
    let role: PlanDay['role'] = 'easy';
    if (d === sharp) {
      wo = W.sharpener(c);
      role = 'sharpener';
    } else if (d === eve) {
      wo = W.easyTime(rw.eveEasySec, c, rw.eveStrides.reps);
      role = 'eve';
    } else if (others.includes(d)) wo = W.easyTime(rw.otherEasySec, c);
    if (wo)
      planDays.push({
        date: d.date,
        weekday: d.wd,
        role,
        hard: role === 'sharpener',
        countsToWeek: true,
        workout: wo
      });
  }
  planDays.push({
    date: race,
    weekday: weekdayOf(race),
    role: 'race',
    hard: true,
    countsToWeek: false,
    workout: W.race(c)
  });
  const planned = round1(
    planDays.filter((d) => d.countsToWeek).reduce((a, d) => a + d.workout.km, 0)
  );
  const fuel = (b.predictedSec ?? 7200) >= 6300 ? 'unos na 40. i 80. min' : 'gel na 45. min';
  const pace = b.feel
    ? 'prvih 5 km 5–10 s/km sporije od tempa trke iz pripremne trke, zatim ravnomerno'
    : `prvih 5 km ${W.mmss(c.p.RP + 5)}/km, km 6–16 ${W.mmss(c.p.RP)}/km, od 17. km po osećaju`;
  return {
    index: f.index,
    startDate: f.startDate,
    endDate: f.endDate,
    phase: 'race',
    deload: false,
    targetKm: planned,
    plannedKm: planned,
    nominalKm: planned,
    fitted: null,
    days: planDays,
    notes: [
      `TRKA (${daySr(weekdayOf(race))}): ${pace}; ${fuel}; zagrevanje ${Math.round(rw.raceWarmupSec / 60)} min lagano + 3 ubrzanja.`
    ]
  };
}
