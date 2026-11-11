/* GENERISANJE: ulaz → raspored uloga → skaliranje → lestvice (obim, dugi, kvalitet) → dani → PlanDoc.
   Svaka veličina ima jednog vlasnika: obim nedelje (volumes), dužina dugog (longs), doza kvaliteta (qualityPlan),
   raspodela na dane (fillWeek). Čuvar (guard.ts) samo prijavljuje. */
import { mondayOf, parseIso, toIso, weekdayOf } from './dates.ts';
import { guard } from './guard.ts';
import { layout, type Role, type Slot } from './layout.ts';
import { allowedGain, computePaces, fmtPace, fmtTime, HM_M, raceTime, vdotOf } from './paces.ts';
import { computeScale, type Scale } from './scale.ts';
import * as S from './sessions.ts';
import {
  BASE_Q1,
  BEGINNER_INTRO,
  BEGINNER_ROLES,
  BEGINNER_T_SHAPES,
  CAPS,
  DEV_Q1,
  LONG,
  REGULAR_ROLES,
  T_SHAPES,
  VOL,
  type QSpec
} from './templates.ts';
import {
  V3InputError,
  WEEKDAYS,
  type Day,
  type PlanDoc,
  type Session,
  type V3Input,
  type Week,
  type Weekday
} from './types.ts';

export const POLICY_VERSION = '3.0.0';

const r1 = (x: number): number => Math.round(x * 10) / 10;
const r05 = (x: number): number => Math.round(x * 2) / 2;
const SPEC: Role[] = ['block1', 'wave', 'block2', 'peak', 'post', 'taper', 'race'];
const isRest = (r: Role): boolean => r === 'rest' || r === 'check' || r === 'test';

function validate(i: V3Input): { start: number; race: number; N: number } {
  const start = parseIso(i.startDate);
  const race = parseIso(i.raceDate);
  if (start === null || race === null)
    throw new V3InputError('Neispravan datum (očekuje se GGGG-MM-DD).');
  if (race <= start) throw new V3InputError('Trka mora biti posle početka plana.');
  const N = (mondayOf(race) - mondayOf(start)) / 7 + 1;
  if (N < 4 || N > 30) throw new V3InputError('Plan za polumaraton se pravi za 4–30 nedelja.');
  const days = new Set(i.runDays);
  if (days.size !== i.runDays.length || i.runDays.some((d) => !WEEKDAYS.includes(d)))
    throw new V3InputError('Neispravni dani trčanja.');
  if (days.size < 3 || days.size > 6)
    throw new V3InputError('Plan se pravi za 3–6 dana trčanja nedeljno.');
  if (!days.has(i.longRunDay))
    throw new V3InputError('Dan dugog trka mora biti među danima trčanja.');
  if (!(i.weeklyKm >= 5 && i.weeklyKm <= 200))
    throw new V3InputError('Nedeljni obim mora biti 5–200 km.');
  const r = i.recentResult;
  if (
    r &&
    !(r.distanceM >= 1000 && r.distanceM <= 42195 && r.timeSec > 0 && r.distanceM / r.timeSec < 7)
  )
    throw new V3InputError('Neispravan skorašnji rezultat.');
  if (!r && !(i.easyPaceSecPerKm && i.easyPaceSecPerKm >= 210 && i.easyPaceSecPerKm <= 600))
    throw new V3InputError('Potreban je skorašnji rezultat ili lagan tempo (3:30–10:00/km).');
  if (i.recentLongRunKm != null && !(i.recentLongRunKm > 0 && i.recentLongRunKm <= 45))
    throw new V3InputError('Neispravno skorašnje najduže trčanje.');
  if (i.goalTimeSec != null && !(i.goalTimeSec >= 3480 && i.goalTimeSec <= 6 * 3600))
    throw new V3InputError('Neispravno ciljno vreme.');
  return { start, race, N };
}

/* ---------- raspored dana ---------- */
interface DayRoles {
  long: Weekday;
  q1: Weekday | null; // glavni kvalitet (3 dana: jedini)
  q2: Weekday | null; // drugi kvalitet (3 dana: lagan dan sa malim podražajem)
  easy: Weekday[];
  beforeLong: Weekday | null;
}

function assignDays(i: V3Input): DayRoles {
  const idx = (d: Weekday): number => WEEKDAYS.indexOf(d);
  const dist = (a: Weekday, b: Weekday): number => {
    const x = Math.abs(idx(a) - idx(b));
    return Math.min(x, 7 - x);
  };
  const L = i.longRunDay;
  const sorted = [...i.runDays].sort((a, b) => idx(a) - idx(b));
  const others = sorted.filter((d) => d !== L);
  const before = WEEKDAYS[(idx(L) + 6) % 7]!;
  let best: [Weekday, Weekday] = [others[0]!, others[1]!];
  let score = -1;
  for (const a of others)
    for (const b of others) {
      if (idx(a) >= idx(b)) continue;
      const sc =
        Math.min(dist(a, b), dist(a, L), dist(b, L)) * 10 - (a === before || b === before ? 5 : 0);
      if (sc > score) [best, score] = [[a, b], sc];
    }
  const [qa, qb] = best;
  const q1 = qa;
  const q2 = qb;
  const easy = others.filter((d) => d !== q1 && d !== q2);
  return { long: L, q1, q2, easy, beforeLong: sorted.includes(before) ? before : null };
}

/* ---------- obim po nedelji (jedan vlasnik) ---------- */
function volumes(slots: Slot[], s: Scale, current: number, beginner: boolean): number[] {
  const start = Math.min(current, s.peakKm); // dani ne nose sadašnji obim: plan kreće od onoga što nose
  const end =
    slots.find((x) => x.role === (beginner ? 'peak' : 'block1'))?.index ??
    slots.find((x) => x.role === 'peak')!.index;
  const ramp = slots.filter((x) => x.index <= end && !isRest(x.role)).map((x) => x.index);
  const vol: number[] = Array.from({ length: slots.length + 1 }, () => 0);
  let prev = start;
  ramp.forEach((w, j) => {
    const target = ramp.length > 1 ? start + ((s.peakKm - start) * j) / (ramp.length - 1) : start;
    prev = j === 0 ? start : Math.min(target, prev + s.stepCap(prev));
    vol[w] = prev;
  });
  const top = prev;
  let last = start;
  let peakVol = top;
  for (const x of slots) {
    const w = x.index;
    if (vol[w]) last = vol[w]!;
    else if (isRest(x.role))
      vol[w] = (x.role === 'check' ? VOL.check : VOL.rest) * last; // trka puni nedelju provere
    else if (x.role === 'wave' || x.role === 'block2' || x.role === 'peak') vol[w] = top;
    if (x.role === 'peak') peakVol = vol[w]!;
    if (x.role === 'post') vol[w] = VOL.post * peakVol;
    if (x.role === 'taper') vol[w] = VOL.taper * peakVol;
    if (x.role === 'race') vol[w] = VOL.race * peakVol;
  }
  return vol.map(r1);
}

/* ---------- dugi po nedelji (jedan vlasnik) ---------- */
interface LongPlan {
  km: number;
  block: number;
  prog: number;
}

function longs(
  slots: Slot[],
  s: Scale,
  vol: number[],
  beginner: boolean,
  days: number,
  checkOnLong: boolean,
  pace: { easy: number; RP: number }
): (LongPlan | null)[] {
  const L = s.longMaxKm;
  const roles = beginner ? BEGINNER_ROLES : REGULAR_ROLES;
  const firstSpec = slots.find((x) => SPEC.includes(x.role))!.index;
  const build = slots.filter((x) => x.role === 'build' && x.index < firstSpec).map((x) => x.index);
  const top = Math.min(0.95 * s.longNoTimeKm, L);
  const share = s.longShare;
  const out: (LongPlan | null)[] = Array.from({ length: slots.length + 1 }, () => null);
  const floor = (1.3 * CAPS.minEasyMin * 60) / pace.easy; // dugi je uvek duži od najkraćeg laganog dana
  const rise = build.length > 1 ? (top - s.longStartKm) / (build.length - 1) : 0;
  let prev = s.longStartKm;
  build.forEach((w, j) => {
    // korak dugog +1–2 km (≈ 12 % dugog, početnik do 1 km)
    const step = Math.min(s.longStepKm, Math.max(1, 0.12 * prev));
    let km = j === 0 ? s.longStartKm : Math.min(s.longStartKm + rise * j, prev + step);
    km = Math.max(floor, Math.min(km, share * vol[w]!));
    prev = km;
    out[w] = { km: r05(km) > L ? Math.floor(km * 2) / 2 : r05(km), block: 0, prog: 0 };
  });
  // progresivna završnica: nedelja pred rasterećenje od 5. nedelje (3 dana: svaka druga nedelja gradnje od 2.)
  for (const w of build) {
    const next = slots[w]?.role;
    const before = next !== undefined && isRest(next) && w >= 4;
    const alt = days === 3 && w >= 2 && build.indexOf(w) % 2 === 1;
    if ((before || alt) && slots[w - 1]!.phase !== 'uvod')
      out[w]!.prog = beginner ? 1 : days === 3 ? 3 : 2.5;
  }
  let last = s.longStartKm;
  for (const x of slots) {
    const w = x.index;
    const o = out[w];
    if (o) {
      last = o.km;
      continue;
    }
    if (x.role === 'race') continue;
    if (x.role === 'rest' || x.role === 'test')
      out[w] = { km: r05(Math.max(floor, LONG.rest * last)), block: 0, prog: 0 };
    else if (x.role === 'check')
      out[w] = checkOnLong
        ? null
        : { km: r05(Math.max(floor, LONG.checkSameWeek * last)), block: 0, prog: 0 };
    else {
      const spec = roles[x.role];
      if (!spec?.long) continue;
      const block = r05((spec.long.block ?? 0) * s.blockMaxKm);
      // vremenski plafon dugog važi za ceo trening: blok RP je brži, pa dugi sa blokom sme biti duži u km
      const byTime = block + ((s.longTimeCapMin - (block * pace.RP) / 60) * 60) / pace.easy;
      const most = Math.max(...out.filter((o2): o2 is LongPlan => !!o2).map((o2) => o2.km));
      const km = Math.min(
        block ? Math.min(spec.long.len * s.longNoTimeKm, byTime) : spec.long.len * L,
        most + (beginner ? 1.5 : 2)
      );
      const km2 = Math.max(r05(floor + block), Math.floor(km * 2) / 2);
      // 3 dana: blok najviše 35 % dugog
      out[w] = {
        km: km2,
        block: days === 3 ? Math.min(block, Math.floor(0.35 * km2 * 2) / 2) : block,
        prog: 0
      };
      last = out[w].km;
    }
  }
  return out;
}

/* ---------- kvalitet po nedelji (jedan vlasnik) ---------- */
interface WeekQ {
  q1: QSpec;
  q2: QSpec;
}

function qualityPlan(slots: Slot[], s: Scale, beginner: boolean, noI: boolean): WeekQ[] {
  const out: WeekQ[] = Array.from({ length: slots.length + 1 }, () => ({
    q1: { t: 'easy' },
    q2: { t: 'easy' }
  }));
  const firstSpec = slots.find((x) => SPEC.includes(x.role))!.index;
  const build = slots.filter((x) => x.role === 'build' && x.index < firstSpec);
  const roles = beginner ? BEGINNER_ROLES : REGULAR_ROLES;
  // T lestvica: kroz gradnju od početne doze do plafona (početnik: posle uvoda i prvih brda)
  const tWeeks = beginner
    ? build
        .filter((x) => x.phase !== 'uvod')
        .slice(1)
        .concat(slots.filter((x) => x.role === 'build' && x.index >= firstSpec))
    : build;
  const reachAt = Math.max(1, tWeeks.length - 1);
  // lestvica skoro bez rasta (mali plafon): talas 80 / 90 / 100 % plafona, da ista doza ne ide 3 nedelje
  const flat = (s.caps.T - s.tStartMin) / Math.max(1, tWeeks.length - 1) < 1.5;
  const tDose = (j: number): number =>
    flat
      ? s.caps.T * [0.8, 0.9, 1][j % 3]!
      : j > reachAt
        ? s.caps.T * (j % 2 ? 0.9 : 1)
        : Math.min(s.tStartMin + ((s.caps.T - s.tStartMin) * j) / reachAt, s.tStartMin * 1.25 ** j); // T raste najviše 25 % nedeljno
  const shapes = beginner ? BEGINNER_T_SHAPES : T_SHAPES;
  let lastT = s.tStartMin / s.caps.T;
  let iBase = 0;
  let iDev = 0;
  let iIntro = 0;
  let restAlt = 0;
  for (const x of slots) {
    const w = x.index;
    const tj = tWeeks.findIndex((y) => y.index === w);
    const tq: QSpec | null =
      tj >= 0 ? { t: 'T', dose: tDose(tj) / s.caps.T, shape: shapes[tj % shapes.length]! } : null;
    if (tq && tq.t === 'T') lastT = tq.dose;
    if (x.role === 'build') {
      if (beginner)
        out[w] = {
          q1: { t: 'easy' },
          q2: tq ?? BEGINNER_INTRO[Math.min(iIntro++, BEGINNER_INTRO.length - 1)]!
        };
      else if (x.phase === 'razvoj')
        out[w] = {
          // plan po osećaju i 3 dana ispod 35 km: brda umesto I intervala
          q1: noI
            ? { t: 'H', reps: iDev++ % 2 ? 10 : 8, sec: 45 }
            : DEV_Q1[iDev++ % DEV_Q1.length]!,
          q2: tq!
        };
      else {
        const i = iBase++;
        out[w] = {
          q1: BASE_Q1[i < BASE_Q1.length ? i : 2 + ((i - 2) % (BASE_Q1.length - 2))]!,
          q2: tq!
        };
      }
    } else if (x.role === 'rest') {
      const t: QSpec = { t: 'T', dose: 0.6 * lastT, shape: 'x2' };
      const alt: QSpec[] = beginner ? [{ t: 'H', reps: 6, sec: 20 }, t] : [t];
      out[w] = { q1: { t: 'easy', strides: 4 }, q2: alt[restAlt++ % alt.length]! };
    } else if (x.role === 'check')
      out[w] = {
        q1: { t: 'easy', strides: 4 },
        q2: beginner ? { t: 'easy', strides: 4 } : { t: 'R', reps: 6, m: 200 }
      };
    else if (x.role === 'test') out[w] = { q1: { t: 'easy', strides: 4 }, q2: { t: 'easy' } };
    else {
      const r = roles[x.role]!;
      out[w] = { q1: r.q1, q2: r.q2 };
    }
  }
  return out;
}

/** 3 dana: jedan glavni kvalitet; drugi dan je lagan sa malim podražajem (naizmenično brda / kratak T), u nedelji
    bloka u dugom čisto lagan. */
function threeDay(
  q: WeekQ,
  phase: string,
  w: number,
  hasBlock: boolean,
  beginner: boolean,
  s: Scale,
  role: Role
): WeekQ {
  const rest = isRest(role);
  if (role === 'check') return { q1: { t: 'easy', strides: 4 }, q2: { t: 'easy' } };
  const isQ = (x: QSpec): boolean => x.t !== 'easy';
  let main: QSpec;
  let other: QSpec;
  if (beginner) [main, other] = [q.q2, q.q1];
  else if (phase === 'osnova' || phase === 'uvod') [main, other] = [q.q2, q.q1];
  else if (phase === 'razvoj')
    [main, other] = w % 2 && q.q1.t !== 'H' ? [q.q1, q.q2] : [q.q2, q.q1];
  else [main, other] = isQ(q.q1) ? [q.q1, q.q2] : [q.q2, q.q1];
  if (!isQ(main) && isQ(other)) [main, other] = [other, main];
  let minor: QSpec = { t: 'easy' };
  if (
    !hasBlock &&
    !rest &&
    main.t !== 'sharpen' &&
    phase !== 'taper' &&
    phase !== 'trka' &&
    isQ(main)
  )
    minor =
      w % 2 === 0 || other.t === 'R' || other.t === 'I' || other.t === 'H' || other.t === 'easy'
        ? { t: 'easy', hills: w % 4 === 0 ? 8 : 6 }
        : {
            t: 'easy',
            tMin: Math.round(Math.min(14, s.caps.T * (other.t === 'T' ? other.dose : 0.4)))
          };
  if (main.t === 'sharpen') minor = { t: 'easy', strides: 4 };
  // nedelja sa blokom u dugom: prvi dan lagan, kvalitet bliže dugom sa najviše 60 % doze
  if (hasBlock && (main.t === 'RP' || main.t === 'T' || main.t === 'I'))
    return { q1: { t: 'easy' }, q2: main }; // doza ≤ 60 % određuje nedeljni budžet (nedelja sa blokom)
  return { q1: main, q2: minor };
}

/** procena minuta rada namere (za nedeljni budžet brzog rada) */
function estWork(q: QSpec, s: Scale, p: { R: number }): number {
  switch (q.t) {
    case 'T':
      return q.dose * s.caps.T;
    case 'I':
      return q.dose * s.caps.I;
    case 'RP':
      return q.dose * s.caps.RP;
    case 'R':
      return (q.reps * q.m * p.R) / 60000;
    case 'H':
      return (q.reps * q.sec) / 60;
    case 'easy':
      return q.tMin ?? 0;
    case 'sharpen':
      return 10;
  }
}

/** udeo plafona zone na koji se doza spušta (T/I/RP); ostale namere se ne menjaju */
const scaled = (q: QSpec, f: number): QSpec =>
  q.t === 'T' || q.t === 'I' || q.t === 'RP' ? { ...q, dose: q.dose * f } : q;

/* ---------- raspodela laganih km (jedan vlasnik) ---------- */
function fill(total: number, mins: number[], maxs: number[]): number[] {
  const n = mins.length;
  const out = mins.slice();
  let left = total - mins.reduce((a, x) => a + x, 0);
  if (left <= 0) return out;
  const order = [...Array(n).keys()].sort((a, b) => maxs[a]! - maxs[b]!);
  let k = n;
  for (const i of order) {
    const add = Math.min(maxs[i]! - out[i]!, left / k);
    if (add > 0) {
      out[i] = out[i]! + add;
      left -= add;
    }
    k--;
  }
  return out;
}

/* ---------- glavni ulaz ---------- */
export function generate(input: V3Input): PlanDoc {
  const { start, race, N } = validate(input);
  const beginner = input.beginner;
  const paces = computePaces(input, N);
  const family: PlanDoc['family'] = beginner ? 'beginner' : paces.estimated ? 'feel' : 'result';
  const slots = layout(N, beginner, paces.estimated);
  const d = assignDays(input);
  const days = input.runDays.length;
  const rampEnd =
    slots.find((x) => x.role === (beginner ? 'peak' : 'block1'))?.index ??
    slots.find((x) => x.role === 'peak')!.index;
  const rampWeeks = slots.filter((x) => x.index <= rampEnd && !isRest(x.role)).length;
  const s = computeScale(
    input,
    paces,
    N,
    rampWeeks,
    d.beforeLong !== null && d.beforeLong !== d.q1 && d.beforeLong !== d.q2
  );
  let checkDay: Weekday = d.beforeLong && d.easy.includes(d.beforeLong) ? d.beforeLong : d.long;
  const checkSlot = slots.find((x) => x.role === 'check');
  // trka umesto dugog, a sledeća nedelja je vrh (blok mora ostati): trka ide na dan drugog kvaliteta
  if (checkDay === d.long && checkSlot && slots[checkSlot.index]?.role === 'peak' && d.q2)
    checkDay = d.q2;
  const vol = volumes(slots, s, input.weeklyKm, beginner);
  const lng = longs(slots, s, vol, beginner, days, checkDay === d.long, paces);
  const qp = qualityPlan(
    slots,
    s,
    beginner,
    // bez I: 3 dana ispod 35 km; plan po osećaju sa 3 dana ili ispod 40 km (4+ dana i ≥ 40 km: I posle testa ostaje)
    (days === 3 && input.weeklyKm < 35) || (paces.estimated && (days === 3 || input.weeklyKm < 40))
  );
  const testWeek = slots.find((x) => x.role === 'test')?.index ?? null;
  const checkWeek = slots.find((x) => x.role === 'check')?.index ?? null;
  const ctx: S.Ctx = {
    p: paces,
    s,
    beginner,
    testWeek: paces.estimated ? testWeek : null,
    checkWeek: paces.estimated ? checkWeek : null,
    testKm: 3,
    checkKm: 10
  };
  const easyMinKm = (CAPS.minEasyMin * 60) / paces.easy;
  const weekMonday0 = mondayOf(start);
  const goalOk = paces.racePace < paces.RP - 0.5;

  const weeks: Week[] = [];
  let maxDoseSoFar = 0;
  let dropped = 0;
  let droppedLast = 0;
  for (const x of slots) {
    const w = x.index;
    const mon = weekMonday0 + (w - 1) * 7;
    const sessions = new Map<Weekday, Session>();
    const notes: string[] = [];
    const lp = lng[w] ?? null;
    let q = qp[w]!;
    if (days === 3 || s.singleQuality)
      q = threeDay(q, x.phase, w, !!lp?.block, beginner, s, x.role);
    // kratki usponi (≤ 20 s) nisu poseban trening: idu usred laganog dana pune dužine
    const hillsEasy = (x2: QSpec): QSpec =>
      x2.t === 'H' && x2.sec <= 20 ? { t: 'easy', hills: x2.reps } : x2;
    q = { q1: hillsEasy(q.q1), q2: hillsEasy(q.q2) };

    // posle pripremne trke: kvalitet najranije 4 dana kasnije; dugi posle trke koja je zamenila dugi je bez bloka
    if (checkSlot && w === checkSlot.index + 1) {
      const raceDay = mon - 7 + WEEKDAYS.indexOf(checkDay);
      const gap = (day: Weekday | null): number =>
        day ? mon + WEEKDAYS.indexOf(day) - raceDay : 99;
      if (q.q1.t !== 'easy' && gap(d.q1) < 4)
        q =
          q.q2.t === 'easy' && gap(d.q2) >= 4
            ? { q1: { t: 'easy' }, q2: q.q1 }
            : { ...q, q1: { t: 'easy' } };
      if (q.q2.t !== 'easy' && gap(d.q2) < 4) q = { ...q, q2: { t: 'easy' } };
      if (checkDay === d.long && lp && x.role !== 'peak') lp.block = 0;
    }

    // NEDELJNI BUDŽET BRZOG RADA (jedini vlasnik doze nedelje): T + I + R + RP + blok ≤ 22 % vremena nedelje
    // (najteža ≤ 25 %; kratka priprema: van dve ključne nedelje ≤ 20 %); u nedelji sa blokom RP usred nedelje ≤ 60 %.
    if (x.role !== 'race' && x.role !== 'check' && x.role !== 'test') {
      const short = N <= 11 && !beginner;
      const key = x.role === 'peak' || x.role === 'block2' || (N < 10 && x.role === 'block1');
      const limit = x.role === 'peak' ? 0.235 : short && !key ? 0.185 : 0.205;
      // vreme nedelje unapred: obim koji dani stvarno nose (dugi + kvaliteti + lagani do plafona) × lagan tempo
      const longKm0 = lp?.km ?? 0;
      const qKm = (x2: QSpec): number =>
        x2.t === 'easy'
          ? 0
          : ((s.wu + s.cd) * 60) / paces.easy + (estWork(x2, s, paces) * 60) / paces.RP;
      const qDays = [d.q1, d.q2].filter((day, i) => day && [q.q1, q.q2][i]!.t !== 'easy');
      const caps = input.runDays
        .filter((day) => day !== d.long && !qDays.includes(day))
        .map(
          (day) =>
            (day === d.beforeLong
              ? CAPS.dayBeforeLong
              : days === 3
                ? CAPS.easyShareOfLong3
                : CAPS.easyShareOfLong) * longKm0
        )
        .sort((a, b) => b - a);
      const easyCap = caps
        .slice(0, Math.max(1, caps.length - droppedLast))
        .reduce((a, b) => a + b, 0); // bez dana koji su otpali
      const weekKm = Math.min(vol[w]!, longKm0 + qKm(q.q1) + qKm(q.q2) + easyCap);
      // posle vrha: ≤ 85 % (taper ≤ 60 %) stvarno planiranog rada najteže nedelje
      const peakWork = weeks.find((y) => y.kind === 'peak')?.workMin ?? Infinity;
      const after =
        x.role === 'post' ? 0.8 * peakWork : x.role === 'taper' ? 0.56 * peakWork : Infinity;
      // pre vrha: ≤ 85 % procenjenog budžeta najteže nedelje (vrh ostaje najteži i kad plafon izjednači doze)
      const pv = vol[slots.find((y) => y.role === 'peak')!.index]!;
      const peakBudget =
        (days >= 4 ? 0.2 : 0.235 * (pv < 30 ? 0.8 : 0.95)) * ((pv * paces.easy) / 60);
      const peakTemplate = (days === 3 ? 0.6 : 1) * s.caps.RP + (s.blockMaxKm * paces.RP) / 60; // vrh: RP + najduži blok
      const before =
        x.role === 'peak' || after !== Infinity
          ? Infinity
          : 0.85 * Math.min(peakBudget, peakTemplate);
      const weekMin = (weekKm * paces.easy) / 60;
      // nedelja sa blokom (4+ dana): RP usred nedelje se puni do 19 % vremena nedelje (najteža 20 %), ne fiksno 60 %
      const fillTo = lp?.block && days >= 4 ? (x.role === 'peak' ? 0.2 : 0.19) * weekMin : Infinity;
      const budget = Math.min(after, before, fillTo, limit * weekMin * (weekKm < 30 ? 0.8 : 0.95));
      if (lp?.block) {
        const maxBlock = Math.floor(((0.55 * budget * 60) / paces.RP) * 2 + 1e-6) / 2;
        lp.block = Math.max(0, Math.min(lp.block, maxBlock));
        // 3 dana, nedelja sa blokom: kvalitet usred nedelje 60 % doze šablona (4+ dana: puni ga budžet od 19–20 %)
        const cap60 = (x2: QSpec): QSpec =>
          days === 3 && (x2.t === 'RP' || x2.t === 'T' || x2.t === 'I')
            ? { ...x2, dose: 0.6 * Math.min(1, x2.dose) }
            : x2;
        q = { q1: cap60(q.q1), q2: cap60(q.q2) };
      }
      const isScal0 = (x2: QSpec): boolean => x2.t === 'T' || x2.t === 'I' || x2.t === 'RP';
      const fix0 = [q.q1, q.q2]
        .filter((x2) => !isScal0(x2))
        .reduce((a, x2) => a + estWork(x2, s, paces), 0);
      // kvalitet usred nedelje ima prednost nad delom bloka: bar 8 min ostaje za njega (blok najmanje 1,5 km)
      const blockLeft = ((budget - fix0 - 8) * 60) / paces.RP;
      if (
        lp?.block &&
        [q.q1, q.q2].some(isScal0) &&
        budget - fix0 - (lp.block * paces.RP) / 60 < 8 &&
        blockLeft >= 1.5
      )
        lp.block = Math.max(1.5, Math.floor((((budget - fix0 - 8) * 60) / paces.RP) * 2) / 2);
      if (lp) lp.block = Math.round(lp.block * 2) / 2;
      const longWork = lp ? ((lp.block + lp.prog / 2) * paces.RP) / 60 : 0;
      const isScal = (x2: QSpec): boolean => x2.t === 'T' || x2.t === 'I' || x2.t === 'RP';
      const scal = [q.q1, q.q2].filter(isScal).reduce((a, x2) => a + estWork(x2, s, paces), 0);
      const fix = [q.q1, q.q2]
        .filter((x2) => !isScal(x2))
        .reduce((a, x2) => a + estWork(x2, s, paces), 0);
      const room = budget - longWork - fix;
      if (scal > 0 && scal > room) {
        // spuštena doza malo varira po nedelji (da ista doza ne ide tri nedelje zaredom), ali ne ispod 8 min;
        // doza kojoj ni bez variranja ne ostaje 8 min nije trening: taj dan postaje lagan sa ubrzanjima
        const f = Math.max(0, room / scal);
        const keep = (x2: QSpec): QSpec => {
          if (!isScal(x2)) return x2;
          const est = estWork(x2, s, paces);
          if (est * f < 8) return { t: 'easy', strides: 4 };
          return scaled(x2, Math.max(8 / est, f * [1, 0.85, 0.93][w % 3]!));
        };
        q = { q1: keep(q.q1), q2: keep(q.q2) };
      }
    }

    // pravilo rasta obima važi prema stvarno planiranom (ne samo prema lestvici): najviše korak iznad poslednje 3 nedelje
    if (!isRest(x.role) && x.role !== 'post' && x.role !== 'taper' && x.role !== 'race') {
      const recent = weeks.slice(-3).map((y) => y.plannedKm);
      if (w <= 3) recent.push(input.weeklyKm);
      const ref = Math.max(...recent);
      vol[w] = Math.min(vol[w]!, r1(ref + s.stepCap(ref)));
    }
    if (x.role === 'race') {
      raceWeek(ctx, d, input, race, mon, vol[w]!, sessions, notes, goalOk);
    } else {
      if (lp)
        sessions.set(
          d.long,
          S.long(
            ctx,
            lp.km,
            { blockKm: lp.block, progressiveKm: lp.prog, goalFinish: x.role === 'peak' && goalOk },
            w
          )
        );
      if (x.role === 'check') {
        // 10 km samo kad prosečna nedelja nosi ≥ 35 km i trka traje ≤ 60 min; inače 5 km
        const before = weeks.map((y) => y.plannedKm);
        const avg = before.length
          ? before.reduce((a, b) => a + b, 0) / before.length
          : input.weeklyKm;
        const km = avg >= 35 && raceTime(paces.vdot, 10000) <= 3600 ? 10 : 5;
        sessions.set(checkDay, S.check(ctx, km, w));
        ctx.checkKm = km;
        notes.push(checkRule(ctx, km, input, goalOk));
      }
      const q1 = d.q1 ? S.quality(ctx, q.q1, w) : null;
      const q2s = q.q2;
      let q2: Session | null = d.q2 ? S.quality(ctx, q2s, w) : null;
      if (x.role === 'test' && d.q2) {
        const km = maxDoseSoFar * 2 >= raceTime(paces.vdot, 3000) / 60 ? 3 : 2;
        q2 = S.test(ctx, km);
        ctx.testKm = km;
        notes.push(testRule(ctx, km));
      }
      if (q1 && d.q1 && !sessions.has(d.q1)) sessions.set(d.q1, q1);
      if (q2 && d.q2 && !sessions.has(d.q2)) sessions.set(d.q2, q2);
      // lagani dani: q-dani bez kvaliteta postaju lagani
      const easyDays = input.runDays.filter((day) => !sessions.has(day));
      const longKm = lp?.km ?? LONG.rest * (lng[w - 1]?.km ?? s.longStartKm);
      const fixed = [...sessions.values()].reduce((a, x2) => a + x2.km, 0);
      // 3 dana: lagan dan ≤ 75 % dugog, u nedelji sa blokom ≤ 60 %
      const share = days === 3 ? (lp?.block ? 0.6 : CAPS.easyShareOfLong3) : CAPS.easyShareOfLong;
      // lagan dan ≥ 30 min, inače manje dana: višak dana otpada (prvo onaj koji nije dan pred dugi)
      const avail = vol[w]! - fixed;
      // odluka je trajna: dan koji je otpao vraća se tek kad stane bez prekoračenja obima (bez skoka od dana do dana)
      const tol = x.role === 'rest' || x.role === 'test' ? 0.15 : 0.05;
      const canDrop = (): boolean => easyDays.length > 1 && sessions.size + easyDays.length > 3;
      const dropOne = (): void => {
        const drop =
          easyDays.find((day) => day !== d.beforeLong && day !== d.q1 && day !== d.q2) ??
          easyDays[0]!;
        easyDays.splice(easyDays.indexOf(drop), 1);
      };
      const all = easyDays.length;
      for (let k = 0; k < droppedLast && canDrop(); k++) dropOne();
      while (easyDays.length < all && (easyDays.length + 1) * easyMinKm <= avail - 0.5)
        easyDays.splice(
          0,
          easyDays.length,
          ...input.runDays.filter((day) => !sessions.has(day)).slice(0, easyDays.length + 1)
        );
      while (canDrop() && easyDays.length * easyMinKm > avail + tol * vol[w]! + 0.5) dropOne();
      if (!isRest(x.role)) droppedLast = all - easyDays.length;
      if (all > easyDays.length) dropped++;
      let maxs = easyDays.map((day) =>
        Math.max(easyMinKm, (day === d.beforeLong ? CAPS.dayBeforeLong : share) * longKm)
      );
      const normal = maxs;
      if (beginner) maxs = maxs.map(() => Math.min(...maxs)); // početnik: ujednačeni lagani dani
      // 4 dana: lagan dan bar 35 % dugog (ne „kratak dan uz dug dugi")
      const minKm = days === 4 && lp ? Math.max(easyMinKm, 0.35 * longKm) : easyMinKm;
      const mins = easyDays.map((_, i) => Math.min(minKm, maxs[i]!));
      let km = fill(vol[w]! - fixed, mins, maxs);
      // ujednačavanje ne sme da obori obim: kad nedostaje > 3 %, važe obični plafoni dana
      if (beginner && fixed + km.reduce((a, b) => a + b, 0) < 0.97 * vol[w]!)
        km = fill(vol[w]! - fixed, mins, normal);
      // nedelja 1 ≥ 95 % sadašnjeg obima: lagani nose razliku (do 80 % dugog, 3 dana 90 %)
      if (w === 1 && fixed + km.reduce((a, b) => a + b, 0) < 0.95 * vol[w]!)
        km = fill(
          0.96 * vol[w]! - fixed,
          km,
          easyDays.map(() => (days === 3 ? 0.75 : 0.8) * longKm)
        );
      const strideDay =
        easyDays.find((day) => day !== d.beforeLong && day !== checkDay) ??
        easyDays.find((day) => day !== checkDay) ??
        null;
      easyDays.forEach((day, i) => {
        const qSpec = day === d.q1 ? q.q1 : day === d.q2 ? q.q2 : null;
        const e: { strides?: number; hills?: number; tMin?: number } =
          qSpec?.t === 'easy' ? qSpec : {};
        const strides = e.strides ?? 0;
        const minor = !!(e.hills || e.tMin);
        const building = x.role === 'build' && x.phase !== 'uvod';
        const extra =
          building && day === strideDay && !strides && !minor ? (beginner && w % 2 ? 0 : 4) : 0;
        const hills =
          e.hills ?? (building && day === strideDay && beginner && w % 2 && days >= 5 ? 6 : 0);
        const recovery =
          checkWeek !== null && w === checkWeek + 1 && qSpec?.t === 'easy' && day === d.q1;
        sessions.set(
          day,
          S.easy(
            ctx,
            r1(km[i]!),
            { strides: strides || extra, hills, tMin: e.tMin ?? 0, recovery },
            w
          )
        );
      });
    }
    for (const s2 of sessions.values())
      if (s2.kind === 'quality') maxDoseSoFar = Math.max(maxDoseSoFar, s2.workMin);
    weekNotes(x, notes, lp, beginner);

    const dayList: Day[] = [...sessions.entries()]
      .map(([wd, session]) => ({ date: toIso(mon + WEEKDAYS.indexOf(wd)), weekday: wd, session }))
      .filter((dd) => {
        const t = parseIso(dd.date)!;
        return t >= start && t <= race;
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const train = dayList.filter((dd) => dd.session.kind !== 'race');
    weeks.push({
      index: w,
      phase: x.phase,
      kind:
        x.role === 'peak'
          ? 'peak'
          : x.role === 'post'
            ? 'post-peak'
            : x.role === 'taper'
              ? 'taper'
              : x.role === 'race'
                ? 'race'
                : isRest(x.role)
                  ? 'rest'
                  : 'build',
      label: x.label,
      startDate: toIso(mon),
      endDate: toIso(mon + 6),
      targetKm: vol[w]!,
      plannedKm: r1(train.reduce((a, dd) => a + dd.session.km, 0)),
      totalMin: Math.round(train.reduce((a, dd) => a + dd.session.min, 0)),
      workMin: Math.round(
        train
          .filter((dd) => dd.session.kind !== 'check')
          .reduce((a, dd) => a + dd.session.workMin, 0)
      ),
      days: dayList,
      notes
    });
  }

  const doc: PlanDoc = {
    schema: 'plan-doc',
    policyId: 'hm-v3',
    policyVersion: POLICY_VERSION,
    input,
    paces,
    family,
    peakKm: Math.max(...weeks.map((x) => x.plannedKm)),
    longMaxKm: Math.max(
      ...weeks.flatMap((x) =>
        x.days.filter((dd) => dd.session.kind === 'long').map((dd) => dd.session.km)
      )
    ),
    recommendations: recommendations(
      input,
      paces,
      s,
      N,
      slots,
      goalOk,
      dropped,
      Math.max(
        0,
        ...weeks.flatMap((x) =>
          x.days.filter((dd) => dd.session.kind === 'long').map((dd) => dd.session.km)
        )
      )
    ),
    notes: s.reasons,
    weeks,
    guard: []
  };
  // najveći obim i najteži treninzi nisu uvek ista nedelja (npr. 3 dana): plan to kaže jednom rečenicom
  const maxVol = weeks.reduce((a, y) => (y.plannedKm > a.plannedKm + 0.5 ? y : a), weeks[0]!);
  const hardest = weeks.find((y) => y.kind === 'peak');
  if (hardest && maxVol.index !== hardest.index)
    doc.notes = [
      ...doc.notes,
      `Najveći obim je u nedelji ${maxVol.index} (${maxVol.plannedKm.toString().replace('.', ',')} km), najteži treninzi u nedelji ${hardest.index}.`
    ];
  doc.guard = guard(doc, s);
  return doc;
}

function raceWeek(
  c: S.Ctx,
  d: DayRoles,
  input: V3Input,
  race: number,
  mon: number,
  target: number,
  out: Map<Weekday, Session>,
  notes: string[],
  goalOk: boolean
): void {
  const p = c.p;
  const before = input.runDays
    .map((wd) => ({ wd, t: mon + WEEKDAYS.indexOf(wd) }))
    .filter((x) => x.t < race)
    .sort((a, b) => a.t - b.t);
  const sharpDay =
    [...before].reverse().find((x) => race - x.t >= 3 && (x.wd === d.q2 || x.wd === d.q1)) ??
    [...before].reverse().find((x) => race - x.t >= 2);
  out.set(weekdayOf(race), S.race(c, goalOk ? 'cilj' : 'prognoza'));
  if (sharpDay) out.set(sharpDay.wd, S.sharpen(c, 99));
  const rest = before.filter((x) => x.wd !== sharpDay?.wd);
  const used = sharpDay ? out.get(sharpDay.wd)!.km : 0;
  const per = Math.max(0, (target - used) / Math.max(1, rest.length));
  for (const x of rest) {
    if (race - x.t === 1) out.set(x.wd, S.shortEasy(c, 20, 4));
    else {
      const min = Math.min(45, Math.max(25, Math.round((per * p.easy) / 60 / 5) * 5));
      out.set(x.wd, S.shortEasy(c, min, x === rest[0] && rest.length > 1 ? 4 : 0));
    }
  }
  const rp = p.racePace;
  if (p.estimated)
    notes.push(
      'TRKA: prvih 5 km 5–10 s/km sporije od RP iz pripremne trke, zatim RP, od 17. km po osećaju; unos na 40. i 80. min.'
    );
  else {
    const first = fmtPace(rp + (c.beginner ? 7 : 4));
    const fuel = rp * 21.1 > 6000 ? 'unos na 40. i 80. min' : 'gel na 45. min';
    notes.push(
      `TRKA: prvih 5 km ${first}, km 6–16 ${fmtPace(rp)}, od 17. km po osećaju; ${fuel}. Zagrevanje ${c.beginner ? '8–10 min lagano' : '10 min lagano + 4 ubrzanja'}; doručak 3 h pre starta, isti kao pred najduži dugi.`
    );
  }
}

function checkRule(c: S.Ctx, km: 10 | 5, input: V3Input, goalOk: boolean): string {
  const p = c.p;
  const d = km * 1000;
  if (p.estimated)
    return `Pripremna trka ${km} km: iz vremena se računa prognoza polumaratona i RP (VDOT); od sledeće nedelje RP = tempo trke ${km} km + ${Math.round(p.RP - raceTime(p.vdot, d) / km)} s/km.`;
  const goalV = goalOk && input.goalTimeSec ? vdotOf(HM_M, input.goalTimeSec) : p.vdot;
  const ok = raceTime(goalV, d);
  const slow = raceTime(p.vdot - 1, d);
  const what =
    goalOk && input.goalTimeSec
      ? `cilj ${fmtTime(input.goalTimeSec)}`
      : `prognozu ${fmtTime(p.predictionSec)} (RP ${fmtPace(p.RP)})`;
  return `Pripremna trka ${km} km: ≤ ${fmtTime(ok)} potvrđuje ${what}; sporije od ${fmtTime(slow)} → RP do trke ${fmtPace(raceTime(p.vdot - 1, HM_M) / 21.0975)}.`;
}

function testRule(c: S.Ctx, km: 3 | 2): string {
  const p = c.p;
  const t3 = raceTime(p.vdot, km * 1000) / km;
  const off = (x: number): string => `+${Math.round(x - t3)} s/km`;
  return `Test ${km} km: do sada tempa po osećaju; od sledeće nedelje T = tempo testa ${off(p.T)}, RP = tempo testa ${off(p.RP)}, lagano = tempo testa ${off(p.easy)}.`;
}

function weekNotes(x: Slot, notes: string[], lp: LongPlan | null, beginner: boolean): void {
  if (x.role === 'rest')
    notes.push('Rasterećenje: obim ≈ 80 %, kvalitet ≤ 60 % poslednje doze, dugi 80 %.');
  if (x.role === 'peak')
    notes.push(
      'Najteža nedelja plana (3 nedelje pred trku): u dugom proba opreme, doručka i gelova.'
    );
  if (x.role === 'post') notes.push('Rad ≤ 85 % najteže nedelje.');
  if (x.role === 'taper')
    notes.push('Taper: obim ≈ 65 % vrha, intenzitet ostaje, minuti rada ≤ 60 % najteže nedelje.');
  if (lp?.block && !beginner && x.role !== 'post')
    notes.push('Nedelja sa blokom RP u dugom: usred nedelje jedan kvalitet.');
}

function recommendations(
  i: V3Input,
  p: ReturnType<typeof computePaces>,
  s: Scale,
  N: number,
  slots: Slot[],
  goalOk: boolean,
  dropped: number,
  longest: number
): string[] {
  const out: string[] = [];
  const days = i.runDays.length;
  // rečenice za ulaze koji ni sa najboljim planom ne daju pun plan (ROUND-V3-HM-02 § e), uslovljene ulazom
  const fastLow = !p.estimated && p.vdot >= 50 && i.weeklyKm < 40;
  const slow3 = days === 3 && p.easy >= 420;
  if (fastLow)
    out.push(
      `Tvoj rezultat traži više trčanja nego što sada radiš: sa ${i.weeklyKm} km nedeljno i ${N} nedelja plan čuva formu, ali je ne podiže mnogo. Za bolji plan: 14+ nedelja ili obim od 45 km pre početka. Ako se vraćaš posle pauze, ovo je dobar povratni plan.`
    );
  if (slow3) {
    const longMin = Math.round((longest * p.easy) / 60);
    const fourth = Math.floor(((s.longTimeCapMin * 60) / p.easy) * 2) / 2;
    out.push(
      `Plan te dovodi do dugog od ${longest.toString().replace('.', ',')} km (oko ${Math.floor(longMin / 60)} h ${String(longMin % 60).padStart(2, '0')}); trka će trajati oko ${fmtTime(p.predictionSec).slice(0, -3)}, pa poslednjih 5 km računaj na hod-trk. Sa četvrtim danom dugi bi stigao do ${fourth.toString().replace('.', ',')} km.`
    );
  } else if (days === 3)
    out.push(
      'Sa 3 dana svaki trening je ili dug ili težak, pa nema pravog oporavka između. Četvrti dan od 30–40 min laganog trčanja napravio bi veću razliku od bilo koje izmene treninga.'
    );
  if (N <= 11 && !fastLow)
    out.push(
      `Priprema od ${N} nedelja je kratka za polumaraton: obim raste brže nego što bismo želeli. Ako možeš da pomeriš trku za 4–6 nedelja, plan postaje znatno bolji.`
    );
  if (!i.beginner && i.weeklyKm < 25)
    out.push(
      `Obim ${i.weeklyKm} km nedeljno je mali za polumaraton: plan raste do ${Math.round(s.peakKm)} km; više nedelja pripreme daje veći vrh.`
    );
  if (dropped)
    out.push(
      `Obim ne nosi ${days} dana sa laganim danom od bar 30 min: u ${dropped} nedelja jedan lagan dan otpada (odmor). ${days - 1} dana bi dala duže lagane i dugi.`
    );
  if (s.longMaxKm < 14)
    out.push(
      `Najduži dugi je ${s.longMaxKm} km (ispod 14 km): hod-trk je dozvoljen; duža priprema bi ga produžila.`
    );
  if (i.goalTimeSec && !p.estimated && !goalOk && i.goalTimeSec < p.predictionSec)
    out.push(
      `Cilj ${fmtTime(i.goalTimeSec)} traži +${(vdotOf(HM_M, i.goalTimeSec) - p.vdot).toFixed(1)} VDOT za ${N} nedelja (realno ≤ ${allowedGain(N).toFixed(1)}): trka se planira na prognozu ${fmtTime(p.predictionSec)}.`
    );
  if (p.estimated) {
    const t = slots.find((x) => x.role === 'test')?.index;
    const c = slots.find((x) => x.role === 'check')?.index;
    out.push(
      `Bez skorašnjeg rezultata: T, I i RP po osećaju${t ? ` do testa u nedelji ${t}` : ''}${c ? `; pripremna trka u nedelji ${c} daje RP za trku` : ''}.`
    );
  }
  if (i.beginner && p.easy >= 420)
    out.push(
      'Lagan tempo 7:00/km ili sporiji: dugi je zadat vremenom, a hod od 1 min na 10 min je deo plana.'
    );
  return out;
}
