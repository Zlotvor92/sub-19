/* Zajednički ulazi za testove maratona v2 (nije testni fajl, da bi ga izolacioni test video kao deo v2).
   Mreža 02 (MASTER § 3): svaki broj dana 3–6 × 12–24 ned × obim po redu M15 (korak 5) × VDOT {30..70} × 3
   rasporeda po broju dana × trka sub/ned = 3120 + 4368 + 6240 + 8112 = 21 840 ulaza. Red 4 dana = mreža 01
   (isti ulazi, id bez prefiksa `d4-` = id mreže 01). */

import { addDays, mustDay, weekdayOf } from './dates.ts';
import { raceTimeForVdot, round1, vdotFromResult } from './paces.ts';
import { MARATHON_V2_POLICY as P, RUN_DAYS_COUNTS, type RunDaysCount } from './policy.ts';
import type { Experience, MarathonV2Plan, Weekday } from './types.ts';

/** Ponedeljak; trka nedelja = START + 7N − 1. Trka subota: start nedelja (dan ranije). */
export const START = '2026-11-02';

type Schedule = { days: Weekday[]; long: Weekday };
/** Rasporedi mreže 01 (4 dana). */
export const SCHEDULES: Record<'A' | 'B' | 'C', Schedule> = {
  A: { days: ['tue', 'thu', 'sat', 'sun'], long: 'sun' },
  B: { days: ['mon', 'wed', 'fri', 'sun'], long: 'sun' },
  C: { days: ['mon', 'tue', 'thu', 'sat'], long: 'sat' }
};

/** Mreža 02: 3 rasporeda po broju dana (A/B dugi nedelja, C dugi subota). */
export const SCHEDULES_BY_DAYS: Record<RunDaysCount, Record<'A' | 'B' | 'C', Schedule>> = {
  3: {
    A: { days: ['tue', 'thu', 'sun'], long: 'sun' },
    B: { days: ['wed', 'sat', 'sun'], long: 'sun' },
    C: { days: ['mon', 'wed', 'sat'], long: 'sat' }
  },
  4: SCHEDULES,
  5: {
    A: { days: ['mon', 'tue', 'thu', 'sat', 'sun'], long: 'sun' },
    B: { days: ['tue', 'wed', 'thu', 'sat', 'sun'], long: 'sun' },
    C: { days: ['mon', 'wed', 'thu', 'fri', 'sat'], long: 'sat' }
  },
  6: {
    A: { days: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'], long: 'sun' },
    B: { days: ['mon', 'tue', 'thu', 'fri', 'sat', 'sun'], long: 'sun' },
    C: { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], long: 'sat' }
  }
};

/** Vreme [s] za distancu čiji je VDOT (zaokružen na 0,1) tačno `vdot`: najsporije celo vreme sa tim VDOT-om. */
export function timeForVdot(vdot: number, distanceM = 21097.5): number {
  let t = raceTimeForVdot(vdot, distanceM);
  while (round1(vdotFromResult(distanceM, t)) < vdot) t--;
  while (round1(vdotFromResult(distanceM, t + 1)) >= vdot) t++;
  return t;
}

export interface Profile {
  weeks: number;
  km: number;
  vdot?: number;
  result?: { distanceM: number; timeSec: number };
  days: Weekday[];
  long?: Weekday | null;
  race?: 'sat' | 'sun';
  resultDaysBefore?: number;
  goalTimeSec?: number | null;
  recentLongRunKm?: number | null;
  /** M16: plan po osećaju — lagan tempo [s/km], bez rezultata. */
  easyPace?: number;
  /** M17. */
  experience?: Experience;
}

/** Ulaz iz profila; podrazumevani rezultat je polumaraton sa tačnim VDOT-om; `easyPace` = po osećaju (bez
    rezultata). */
export function inputOf(p: Profile): Record<string, unknown> {
  const start = p.race === 'sat' ? addDays(START, -1) : START;
  const res = p.result ?? { distanceM: 21097.5, timeSec: timeForVdot(p.vdot ?? 45) };
  return {
    startDate: start,
    raceDate: addDays(start, p.weeks * 7 - 1),
    runDays: p.days,
    longRunDay: p.long ?? null,
    currentWeeklyKm: p.km,
    recentResult:
      p.easyPace !== undefined
        ? null
        : { ...res, date: addDays(start, -(p.resultDaysBefore ?? 14)) },
    goalTimeSec: p.goalTimeSec ?? null,
    ...(p.recentLongRunKm != null ? { recentLongRunKm: p.recentLongRunKm } : {}),
    ...(p.easyPace !== undefined ? { easyPaceSecPerKm: p.easyPace } : {}),
    ...(p.experience ? { experience: p.experience } : {})
  };
}

export const GRID = {
  weeks: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  vdot: [30, 35, 40, 45, 50, 55, 60, 70],
  schedule: ['A', 'B', 'C'] as const,
  race: ['sat', 'sun'] as const
};

/** Obim reda M15 korak 5 km (kmMin…kmMax). */
export function gridKm(days: RunDaysCount): number[] {
  const r = P.days[days];
  const out: number[] = [];
  for (let km = r.kmMin; km <= r.kmMax; km += 5) out.push(km);
  return out;
}

export interface GridInput {
  id: string;
  days: RunDaysCount;
  weeks: number;
  km: number;
  vdot: number;
  schedule: 'A' | 'B' | 'C';
  race: 'sat' | 'sun';
  input: Record<string, unknown>;
}

/** Mreža 02 za `days` dana (bez argumenta: svi brojevi dana redom); red 4 dana = mreža 01 (4368). */
export function gridInputs(days?: RunDaysCount): GridInput[] {
  if (days === undefined) return RUN_DAYS_COUNTS.flatMap((d) => gridInputs(d));
  const out: GridInput[] = [];
  const S = SCHEDULES_BY_DAYS[days];
  for (const weeks of GRID.weeks)
    for (const km of gridKm(days))
      for (const vdot of GRID.vdot)
        for (const schedule of GRID.schedule)
          for (const race of GRID.race)
            out.push({
              id: `d${days}-${weeks}w-${km}km-v${vdot}-${schedule}-${race}`,
              days,
              weeks,
              km,
              vdot,
              schedule,
              race,
              input: inputOf({
                weeks,
                km,
                vdot,
                days: S[schedule].days,
                long: S[schedule].long,
                race
              })
            });
  return out;
}

/** Mreža 03 po osećaju (M16): lagan tempo {270,315,360,405,450,510} × 3–6 dana × obim po redu M15 (korak 5) ×
    12–24 ned × rasporedi A/B/C, trka nedelja = 6 × 35 × 13 × 3 = 8190 ulaza. */
export const FEEL_PACES = [270, 315, 360, 405, 450, 510];
export function feelInputs(): GridInput[] {
  const out: GridInput[] = [];
  for (const days of RUN_DAYS_COUNTS)
    for (const weeks of GRID.weeks)
      for (const km of gridKm(days))
        for (const pace of FEEL_PACES)
          for (const schedule of GRID.schedule) {
            const S = SCHEDULES_BY_DAYS[days][schedule];
            out.push({
              id: `feel-d${days}-${weeks}w-${km}km-e${pace}-${schedule}`,
              days,
              weeks,
              km,
              vdot: 0,
              schedule,
              race: 'sun',
              input: inputOf({ weeks, km, easyPace: pace, days: S.days, long: S.long })
            });
          }
  return out;
}

/** Mreža 03 početnika (M17): po osećaju {330,390,450,510} i VDOT {30,35,40} × 4–5 dana × obim početnika
    (korak 5) × 16–24 ned × rasporedi A/B/C, trka nedelja = 7 × 10 × 9 × 3 = 1890 ulaza. */
export const BEGINNER_PACES = [330, 390, 450, 510];
export const BEGINNER_VDOTS = [30, 35, 40];
export function beginnerInputs(): GridInput[] {
  const out: GridInput[] = [];
  const b = P.beginner;
  for (const days of [4, 5] as const)
    for (const weeks of GRID.weeks.filter((w) => w >= b.weeksMin))
      for (let km = b.days[days].kmMin; km <= b.days[days].kmMax; km += 5)
        for (const basis of [
          ...BEGINNER_PACES.map((e) => ({ id: `e${e}`, easyPace: e })),
          ...BEGINNER_VDOTS.map((v) => ({ id: `v${v}`, vdot: v }))
        ])
          for (const schedule of GRID.schedule) {
            const S = SCHEDULES_BY_DAYS[days][schedule];
            out.push({
              id: `beg-d${days}-${weeks}w-${km}km-${basis.id}-${schedule}`,
              days,
              weeks,
              km,
              vdot: 'vdot' in basis ? basis.vdot : 0,
              schedule,
              race: 'sun',
              input: inputOf({
                weeks,
                km,
                ...basis,
                days: S.days,
                long: S.long,
                experience: 'beginner'
              })
            });
          }
  return out;
}

/* ---------- Heševi za regresiju (mreže i artifacts/segment-02/regression-01.ts) ---------- */

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** FNV-1a (32 bit) nad JSON-om plana bez oznake verzije — heš za regresiju sledećih segmenata. */
export function planHash(p: MarathonV2Plan): string {
  return fnv(JSON.stringify({ ...p, policyVersion: '' }));
}

/** Heš plana u obliku marathon-v2.1.0 (MAR-02): bez oznake verzije i bez polja MAR-03 sa podrazumevanom
    vrednošću (`paceBasis: 'result'`) — za plan sa rezultatom jednak `planHash` iz segment02.baseline.json kad
    se plan nije promenio. */
export function planHash02(p: MarathonV2Plan): string {
  const { paceBasis, ...rest } = p;
  return fnv(
    JSON.stringify(
      paceBasis === 'result' ? { ...rest, policyVersion: '' } : { ...p, policyVersion: '' }
    )
  );
}

/** Pravila upozorenja čiji se TEKST menja sa tabelom 3–6 dana (preporuka broja dana), ne sadržaj plana. */
const TEXT_RULES = ['MARATHON_LONG_SHORT', 'CAPACITY_LIMITED'];

/** Heš normalizovanog plana za regresiju prema MAR-01: bez oznake verzije, napomene ned 1 M13a (pouka 28),
    teksta TEXT_RULES i napomene kapaciteta. Isti kod normalizuje i plan MAR-01 (regression-01.ts). */
export function normalizedHash(p: MarathonV2Plan): string {
  const q = JSON.parse(JSON.stringify(p)) as Omit<MarathonV2Plan, 'paceBasis'> & {
    paceBasis?: MarathonV2Plan['paceBasis'];
  };
  q.policyVersion = '';
  if (q.paceBasis === 'result') delete q.paceBasis;
  q.weeks[0]!.notes = q.weeks[0]!.notes.filter((n) => !n.includes('(M13a)'));
  for (const w of q.warnings) if (TEXT_RULES.includes(w.rule)) w.message = '';
  q.notes = q.notes.map((n) => (n.includes('ne nose ovaj obim') ? 'CAP' : n));
  return fnv(JSON.stringify(q));
}

/** Plan sadrži piramidu M10a (I 5000 m). */
export const hasPyramid = (p: MarathonV2Plan): boolean =>
  p.weeks.some((w) =>
    w.days.some(
      (d) => d.workout.dose?.structure.form === 'pyramid' && d.workout.dose.doseM === 5000
    )
  );

/** Gusta mreža nedelje 1 (MAR-02): za svaki broj dana obim kmMin…kmMax korak 0,1 × VDOT 30–80 korak 0,5;
    12 ned (najkraća priprema), raspored A, trka nedelja = 20 301 + 30 401 + 45 551 + 60 701 = 157 954 ulaza. */
export function denseInputs(): GridInput[] {
  const out: GridInput[] = [];
  for (const days of RUN_DAYS_COUNTS) {
    const r = P.days[days];
    const S = SCHEDULES_BY_DAYS[days].A;
    for (let k10 = r.kmMin * 10; k10 <= r.kmMax * 10; k10++)
      for (let v2 = 2 * P.input.vdotMin; v2 <= 2 * P.input.vdotMax; v2++) {
        const km = k10 / 10;
        const vdot = v2 / 2;
        out.push({
          id: `dense-d${days}-${km}km-v${vdot}`,
          days,
          weeks: 12,
          km,
          vdot,
          schedule: 'A',
          race: 'sun',
          input: inputOf({ weeks: 12, km, vdot, days: S.days, long: S.long })
        });
      }
  }
  return out;
}

/** Mreža skorašnjeg najdužeg trka (M13a, MAR-02): svaki broj dana × obim po redu (korak 5) × VDOT {30,45,70} ×
    12/16/24 ned × rasporedi A/B/C × r 5–42 km (korak 1), trka nedelja = 35 910 ulaza. */
export function recentInputs(): GridInput[] {
  const out: GridInput[] = [];
  for (const days of RUN_DAYS_COUNTS)
    for (const km of gridKm(days))
      for (const vdot of [30, 45, 70])
        for (const weeks of [12, 16, 24])
          for (const schedule of GRID.schedule)
            for (let r = 5; r <= 42; r++) {
              const S = SCHEDULES_BY_DAYS[days][schedule];
              out.push({
                id: `recent-d${days}-${weeks}w-${km}km-v${vdot}-${schedule}-r${r}`,
                days,
                weeks,
                km,
                vdot,
                schedule,
                race: 'sun',
                input: inputOf({ weeks, km, vdot, days: S.days, long: S.long, recentLongRunKm: r })
              });
            }
  return out;
}

/* ---------- Segment 04 (M18): mreže adaptacije ---------- */

export interface AdaptBase {
  id: string;
  family: 'R' | 'F' | 'B';
  input: Record<string, unknown>;
}

/** Bazni planovi mreže 04 (MASTER § 3): 3/4/5/6 dana × rezultat (VDOT 45, cilj 3:30:00) i po osećaju (lagan
    6:00) × 12/16/20 ned + početnik 4 dana po osećaju (7:30, 30 km) i 5 dana sa rezultatom (VDOT 35, 35 km) ×
    16/20/24 ned = 30 planova. Obim po broju dana 35 / 45 / 55 / 70 km. */
export function adaptBases(): AdaptBase[] {
  const km: Record<RunDaysCount, number> = { 3: 35, 4: 45, 5: 55, 6: 70 };
  const out: AdaptBase[] = [];
  for (const weeks of [12, 16, 20])
    for (const days of RUN_DAYS_COUNTS) {
      const sc = SCHEDULES_BY_DAYS[days].A;
      const base = inputOf({ weeks, km: km[days], vdot: 45, days: sc.days, long: sc.long });
      out.push({ id: `d${days}-r-${weeks}w`, family: 'R', input: { ...base, goalTimeSec: 12600 } });
      out.push({
        id: `d${days}-f-${weeks}w`,
        family: 'F',
        input: inputOf({ weeks, km: km[days], easyPace: 360, days: sc.days, long: sc.long })
      });
    }
  for (const weeks of [16, 20, 24]) {
    const b4 = SCHEDULES_BY_DAYS[4].A;
    const b5 = SCHEDULES_BY_DAYS[5].A;
    out.push({
      id: `beg-d4-f-${weeks}w`,
      family: 'B',
      input: inputOf({
        weeks,
        km: 30,
        easyPace: 450,
        days: b4.days,
        long: b4.long,
        experience: 'beginner'
      })
    });
    out.push({
      id: `beg-d5-r-${weeks}w`,
      family: 'B',
      input: inputOf({
        weeks,
        km: 35,
        vdot: 35,
        days: b5.days,
        long: b5.long,
        experience: 'beginner'
      })
    });
  }
  return out;
}

/** Deo plana koji testovi čitaju (bez uvoza tipova plana u ulaze). */
export interface PlanLike {
  input: { startDate: string; runDays: readonly string[]; currentWeeklyKm: number };
  vdot: number;
  weeks: readonly {
    index: number;
    phase: string;
    deload: boolean;
    test?: boolean;
    startDate: string;
    endDate: string;
    days: readonly {
      date: string;
      countsToWeek: boolean;
      role: string;
      workout: { km: number; sec: number; kind: string };
    }[];
  }[];
}

const wedOf = (p: PlanLike, i: number): string => {
  let d = p.weeks[i - 1]!.startDate;
  while (weekdayOf(d) !== 'wed') d = addDays(d, 1);
  return d;
};

/** asOf mreže 04 (MASTER § 3): ned 1 sreda i kraj, kraj ned 2, sredina plana (kraj ned ⌊N/2⌋), kraj nedelje pre
    nedelje testa (po osećaju), pre prvog rasterećenja, pre N−2 i pre N−1 (obe nedelje tapera), sreda N−2. */
export function adaptAsOfs(p: PlanLike): { tag: string; asOf: string }[] {
  const N = p.weeks.length;
  const end = (i: number) => p.weeks[i - 1]!.endDate;
  const tw = p.weeks.find((w) => w.test)?.index;
  const dw = p.weeks.find((w) => w.deload)!.index;
  const out = [
    { tag: 'w1wed', asOf: wedOf(p, 1) },
    { tag: 'w1end', asOf: end(1) },
    { tag: 'w2end', asOf: end(2) },
    { tag: 'mid', asOf: end(Math.floor(N / 2)) },
    ...(tw !== undefined && tw > 1 ? [{ tag: 'preTest', asOf: end(tw - 1) }] : []),
    { tag: 'preDeload', asOf: end(dw - 1) },
    { tag: 'preTaper2', asOf: end(N - 3) },
    { tag: 'preTaper1', asOf: end(N - 2) },
    { tag: 'taperWed', asOf: wedOf(p, N - 2) }
  ];
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.asOf) ? false : (seen.add(x.asOf), true)));
}

export const SCENARIOS = [
  'none',
  'done100',
  'under50',
  'over120',
  'pause10',
  'pause20',
  'pause35',
  'pain5',
  'pain8',
  'fatigue',
  'faster',
  'slower',
  'test5k',
  'incomplete',
  'locked',
  'chain',
  'painPause'
] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** Odrađeni treninzi u [from, to]: dan plana (sa dayId, planirani km × `share`) ili, pre starta plana, trčanje van
    plana na dan trčanja (obim ulaza / broj dana). */
export function runsIn(
  plan: PlanLike,
  from: string,
  to: string,
  share = 1,
  extra: Record<string, unknown> = {}
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const byDate = new Map(plan.weeks.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
  for (let d = from; mustDay(d) <= mustDay(to); d = addDays(d, 1)) {
    const pd = byDate.get(d);
    if (pd && pd.countsToWeek)
      out.push({
        date: d,
        dayId: d,
        km: Math.round(pd.workout.km * share * 100) / 100,
        durationSec: Math.round(pd.workout.sec * share),
        completed: true,
        rpe: 5,
        ...extra
      });
    else if (
      !pd &&
      mustDay(d) < mustDay(plan.input.startDate) &&
      plan.input.runDays.includes(weekdayOf(d))
    )
      out.push({
        date: d,
        km: Math.round((plan.input.currentWeeklyKm / plan.input.runDays.length) * share * 10) / 10,
        durationSec: 3000,
        completed: true,
        rpe: 5,
        ...extra
      });
  }
  return out;
}

/** Činjenica bola: bol `level` na dan asOf (zapis bez trčanja). */
export const painFacts = (asOf: string, level: number): Record<string, unknown> => ({
  workouts: [{ date: asOf, km: 0, durationSec: 0, completed: false, pain: level }]
});

/** Činjenice scenarija mreže 04 (asOf = dan adaptacije). 'chain' = prvi korak (pauza 10); drugi korak: manjak 50 %
    nedelju kasnije (chainFacts). Rezultat ±2 VDOT: trka 10 km. */
export function factsOf(plan: PlanLike, s: Scenario, asOf: string): Record<string, unknown> {
  const back = (n: number): string => addDays(asOf, -n);
  const cov = (from: string, complete = true) => ({ from, to: asOf, complete });
  const race10 = (vdot: number) => ({
    distM: 10000,
    sec: timeForVdot(vdot, 10000),
    date: asOf,
    kind: 'race'
  });
  switch (s) {
    case 'none':
      return {};
    case 'done100':
      return { workouts: runsIn(plan, back(13), asOf), coverage: cov(back(13)) };
    case 'under50':
      return {
        workouts: [...runsIn(plan, back(13), back(7)), ...runsIn(plan, back(6), asOf, 0.5)],
        coverage: cov(back(13))
      };
    case 'over120':
      return { workouts: runsIn(plan, back(13), asOf, 1.2), coverage: cov(back(13)) };
    case 'pause10':
    case 'chain':
      return { workouts: runsIn(plan, back(23), back(10)), coverage: cov(back(23)) };
    case 'pause20':
      return { breaks: [{ kind: 'break', from: back(19), to: asOf }] };
    case 'pause35':
      return { workouts: runsIn(plan, back(48), back(35)), coverage: cov(back(48)) };
    case 'pain5':
      return painFacts(asOf, 5);
    case 'pain8':
      return painFacts(asOf, 8);
    case 'fatigue':
      return {
        workouts: [
          { date: back(1), km: 8, durationSec: 3000, completed: true, rpe: 8 },
          { date: back(3), km: 8, durationSec: 3000, completed: true, rpe: 7 }
        ]
      };
    case 'faster':
      return { results: [race10(Math.min(80, Math.round((plan.vdot + 2) * 10) / 10))] };
    case 'slower':
      return { results: [race10(Math.max(30, Math.round((plan.vdot - 2) * 10) / 10))] };
    case 'test5k':
      return { results: [{ distM: 5000, sec: 1470, date: asOf, kind: 'test' }] };
    case 'incomplete':
      return { coverage: cov(back(13), false) };
    case 'locked': {
      const future = plan.weeks
        .flatMap((w) => w.days)
        .filter((d) => mustDay(d.date) > mustDay(asOf) && d.role !== 'race')
        .slice(0, 3)
        .map((d) => d.date);
      return { workouts: runsIn(plan, back(1), asOf), lockedDayIds: future };
    }
    case 'painPause':
      return {
        workouts: [
          ...runsIn(plan, back(33), back(20)),
          { date: asOf, km: 0, durationSec: 0, completed: false, pain: 6 }
        ],
        coverage: cov(back(33))
      };
  }
}

/** Drugi korak lanca: manjak 50 % u 7 dana do `a2` (posle pauze 10). */
export const chainFacts = (p: PlanLike, a2: string): Record<string, unknown> => ({
  workouts: [
    ...runsIn(p, addDays(a2, -13), addDays(a2, -7)),
    ...runsIn(p, addDays(a2, -6), a2, 0.5)
  ],
  coverage: { from: addDays(a2, -13), to: a2, complete: true }
});

export interface AdaptCase {
  key: string;
  id: string;
  tag: string;
  asOf: string;
  s: Scenario;
}

/** Tokovi mreže 04 za plan: svaki asOf × scenariji; bol 5 i bol 8 u SVAKOM danu nedelje koja sadrži asOf (asOf =
    taj dan, pouka 18). Ključ `<id>/<tag>/<scenario>[/d<i>]`; duplikati (isti asOf) jednom. */
export function adaptCases(id: string, p: PlanLike): AdaptCase[] {
  const out: AdaptCase[] = [];
  const seen = new Set<string>();
  const add = (tag: string, asOf: string, s: Scenario, key: string): void => {
    const k = `${s}@${asOf}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ key, id, tag, asOf, s });
  };
  for (const a of adaptAsOfs(p))
    for (const s of SCENARIOS) {
      if (s === 'pain5' || s === 'pain8') {
        const w = p.weeks.find((x) => x.startDate <= a.asOf && a.asOf <= x.endDate)!;
        for (let i = 0; i < 7; i++)
          add(a.tag, addDays(w.startDate, i), s, `${id}/${a.tag}/${s}/d${i}`);
      } else add(a.tag, a.asOf, s, `${id}/${a.tag}/${s}`);
    }
  return out;
}

/* ---------- Trajna mreža rane i srednje adaptacije (pouka 23, kao 10K E/N7) ---------- */

export const EARLY_SCENARIOS = [
  'pause10',
  'pause20',
  'pain5',
  'pain8',
  'pause10pain5',
  'under',
  'fatigue'
] as const;
export type EarlyScenario = (typeof EARLY_SCENARIOS)[number];

/** Činjenice mreže E (asOf = dan adaptacije): pauza 10/20 (breaks do asOf), bol 5/8 na dan asOf, pauza 10 + bol 5,
    manjak (odrađen samo dan asOf − 6 po planu, pokrivenost asOf − 6 … asOf), umor (2 lagana van plana, RPE 8). */
export function earlyFacts(
  plan: PlanLike,
  s: EarlyScenario,
  asOf: string
): Record<string, unknown> {
  const back = (n: number): string => addDays(asOf, -n);
  const pause = (days: number) => [{ kind: 'break', from: back(days - 1), to: asOf }];
  switch (s) {
    case 'pause10':
      return { breaks: pause(10) };
    case 'pause20':
      return { breaks: pause(20) };
    case 'pain5':
      return painFacts(asOf, 5);
    case 'pain8':
      return painFacts(asOf, 8);
    case 'pause10pain5':
      return { breaks: pause(10), ...painFacts(asOf, 5) };
    case 'under':
      return {
        workouts: runsIn(plan, back(6), back(6)),
        coverage: { from: back(6), to: asOf, complete: true }
      };
    case 'fatigue':
      return {
        workouts: [
          { date: back(1), km: 8, durationSec: 3000, completed: true, rpe: 8 },
          { date: back(3), km: 8, durationSec: 3000, completed: true, rpe: 8 }
        ]
      };
  }
}

/** asOf mreže E po planu: sreda i kraj nedelje 1, sreda svake nedelje 2 … N − 1 i kraj nedelje pre svake posebne
    nedelje (test, rasterećenje, N−2, N−1). Oznaka `w<i>wed` / `w<i>end`. */
export function earlyAsOfs(p: PlanLike): { tag: string; asOf: string }[] {
  const N = p.weeks.length;
  const special = p.weeks
    .filter((w) => w.test || w.deload || w.index === N - 2 || w.index === N - 1)
    .map((w) => w.index - 1)
    .filter((i) => i >= 1);
  const out = [{ tag: 'w1end', asOf: p.weeks[0]!.endDate }];
  for (let i = 1; i <= N - 1; i++) out.push({ tag: `w${i}wed`, asOf: wedOf(p, i) });
  for (const i of special) out.push({ tag: `w${i}end`, asOf: p.weeks[i - 1]!.endDate });
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.tag) ? false : (seen.add(x.tag), true)));
}

/** Planovi mreže E (redosled R, F, B): svaki `rk`-ti ulaz mreže 02, svaki `fk`-ti po osećaju, svaki `bk`-ti
    početnika. */
export function earlyGridBases(rk = 91, fk = 39, bk = 21): AdaptBase[] {
  const every = <X>(xs: readonly X[], n: number): X[] => xs.filter((_, i) => i % n === 0);
  return [
    ...every(gridInputs(), rk).map((c) => ({ id: c.id, family: 'R' as const, input: c.input })),
    ...every(feelInputs(), fk).map((c) => ({ id: c.id, family: 'F' as const, input: c.input })),
    ...every(beginnerInputs(), bk).map((c) => ({ id: c.id, family: 'B' as const, input: c.input }))
  ];
}
