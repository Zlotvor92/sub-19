/* Zajednički ulazi za testove 10K v2 (nije testni fajl, da bi ga izolacioni test video kao deo v2).
   Mreža 01 (4 dana, 10–18 ned), mreža 02 (3/4/5/6 dana, 8–18 ned, sa rezultatom), mreža po osećaju i mreža
   početnika (segment 03). */

import { addDays, mustDay, weekdayOf } from './dates.ts';
import { raceTimeForVdot, round1, vdotFromResult } from './paces.ts';
import type { Structure, Weekday } from './types.ts';
import { checkInput } from './input.ts';
import { basisAt, pacesAt } from './steps.ts';
import { qualityWorkout, repsOf, warmupCooldown } from './workouts.ts';

/** Ponedeljak; trka nedelja = START + 7N − 1. Trka subota: start nedelja (dan ranije). */
export const START = '2026-11-02';

export const SCHEDULES: Record<'A' | 'B' | 'C', { days: Weekday[]; long: Weekday }> = {
  A: { days: ['tue', 'thu', 'sat', 'sun'], long: 'sun' },
  B: { days: ['mon', 'wed', 'fri', 'sun'], long: 'sun' },
  C: { days: ['mon', 'tue', 'thu', 'sat'], long: 'sat' }
};

/** Vreme 10K [s] čiji je VDOT (zaokružen na 0,1) tačno `vdot`: najsporije celo vreme sa tim VDOT-om. */
export function timeForVdot(vdot: number, distanceM = 10000): number {
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
}

export function inputOf(p: Profile): Record<string, unknown> {
  const start = p.race === 'sat' ? addDays(START, -1) : START;
  const res = p.result ?? { distanceM: 10000, timeSec: timeForVdot(p.vdot ?? 45) };
  return {
    startDate: start,
    raceDate: addDays(start, p.weeks * 7 - 1),
    runDays: p.days,
    longRunDay: p.long ?? null,
    currentWeeklyKm: p.km,
    recentResult: { ...res, date: addDays(start, -(p.resultDaysBefore ?? 14)) },
    goalTimeSec: p.goalTimeSec ?? null
  };
}

export const GRID = {
  weeks: [10, 11, 12, 13, 14, 15, 16, 17, 18],
  km: [25, 30, 35, 40, 45, 50, 55],
  vdot: [30, 35, 40, 45, 50, 55, 60, 70],
  schedule: ['A', 'B', 'C'] as const,
  race: ['sat', 'sun'] as const
};

/** Mreža segmenta 01: 9 × 7 × 8 × 3 × 2 = 3024 ulaza. */
export function gridInputs(): { id: string; input: Record<string, unknown> }[] {
  const out: { id: string; input: Record<string, unknown> }[] = [];
  for (const weeks of GRID.weeks)
    for (const km of GRID.km)
      for (const vdot of GRID.vdot)
        for (const s of GRID.schedule)
          for (const race of GRID.race)
            out.push({
              id: `${weeks}w-${km}km-v${vdot}-${s}-${race}`,
              input: inputOf({
                weeks,
                km,
                vdot,
                days: SCHEDULES[s].days,
                long: SCHEDULES[s].long,
                race
              })
            });
  return out;
}

/** Segment 02: 3 rasporeda po broju dana (4 dana = SCHEDULES). Dugi je uvek dan iz ulaza. */
export const SCHEDULES_BY_DAYS: Record<
  3 | 4 | 5 | 6,
  Record<'A' | 'B' | 'C', { days: Weekday[]; long: Weekday }>
> = {
  3: {
    A: { days: ['tue', 'thu', 'sun'], long: 'sun' },
    B: { days: ['mon', 'wed', 'sat'], long: 'sat' },
    C: { days: ['mon', 'wed', 'fri'], long: 'fri' }
  },
  4: SCHEDULES,
  5: {
    A: { days: ['mon', 'tue', 'thu', 'sat', 'sun'], long: 'sun' },
    B: { days: ['tue', 'wed', 'thu', 'sat', 'sun'], long: 'sun' },
    C: { days: ['mon', 'tue', 'wed', 'fri', 'sat'], long: 'sat' }
  },
  6: {
    A: { days: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'], long: 'sun' },
    B: { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sun'], long: 'sun' },
    C: { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], long: 'sat' }
  }
};

/** Mreža 02: obim po broju dana (D17, korak 5 km), nedelje 8–18, VDOT i trka kao mreža 01. */
export const GRID_02 = {
  days: [3, 4, 5, 6] as const,
  weeks: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  km: {
    3: [20, 25, 30, 35, 40],
    4: [25, 30, 35, 40, 45, 50, 55],
    5: [30, 35, 40, 45, 50, 55, 60, 65],
    6: [35, 40, 45, 50, 55, 60, 65, 70, 75, 80]
  } as Record<3 | 4 | 5 | 6, number[]>,
  vdot: GRID.vdot,
  schedule: GRID.schedule,
  race: GRID.race
};

/** Ulazi mreže 02 za jedan broj dana; id `d<dana>-<ned>w-<km>km-v<vdot>-<raspored>-<trka>`. Ukupno
    2640 + 3696 + 4224 + 5280 = 15 840. */
export function grid02Inputs(
  days: 3 | 4 | 5 | 6
): { id: string; days: number; weeks: number; km: number; input: Record<string, unknown> }[] {
  const out: {
    id: string;
    days: number;
    weeks: number;
    km: number;
    input: Record<string, unknown>;
  }[] = [];
  for (const weeks of GRID_02.weeks)
    for (const km of GRID_02.km[days])
      for (const vdot of GRID_02.vdot)
        for (const s of GRID_02.schedule)
          for (const race of GRID_02.race) {
            const sc = SCHEDULES_BY_DAYS[days][s];
            out.push({
              id: `d${days}-${weeks}w-${km}km-v${vdot}-${s}-${race}`,
              days,
              weeks,
              km,
              input: inputOf({ weeks, km, vdot, days: sc.days, long: sc.long, race })
            });
          }
  return out;
}

/** FNV-1a 32-bit (determinizam i poređenje planova bez čuvanja celih planova). */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** Heš rezultata za regresiju između verzija: bez oznake verzije i bez teksta poruke CAPACITY_LIMITED
    (D22 menja samo tekst). Isti normalizator koristi skripta koja je upisala heševe 53da370. */
export function planHash(result: unknown): number {
  return fnv1a(
    JSON.stringify(undo07(result))
      .replace(/10k-v2\.\d+\.\d+/g, 'VERSION')
      .replace(/\d dana ne nose ovaj obim[^."]*\./g, 'CAPACITY.')
  );
}

interface HashedResult {
  ok: boolean;
  plan?: {
    warnings: { rule: string }[];
    weeks: { days: { workout: { dose: { zone: string; structure: Structure } | null } }[] }[];
  };
}

/**
 * Regresija prema 49ad476 (10k-v2.2.0), isti normalizator u skripti koja je upisala heševe 49ad476:
 * [heš kao planHash bez upozorenja LONG_SHORTER_THAN_QUALITY (D25, plan se ne menja); heš nedelja bez
 * trkačke (uzrok D23 menja samo trkačku nedelju); 1 ako plan ima RP deonicu < 1000 m (D22b je zabranjuje)].
 */
export function planHashes49(result: unknown): [number, number, number] {
  const r = result as HashedResult;
  if (!r.ok || !r.plan) return [planHash(result), 0, 0];
  const warnings = r.plan.warnings.filter((w) => w.rule !== 'LONG_SHORTER_THAN_QUALITY');
  const full = planHash({ ...r, plan: { ...r.plan, warnings } });
  const preRace = fnv1a(JSON.stringify(r.plan.weeks.slice(0, -1)));
  const rpShort = r.plan.weeks.some((w) =>
    w.days.some((d) => {
      const s = d.workout.dose?.zone === 'RP' ? d.workout.dose.structure : null;
      return !!s && repsOf(s).some((m) => m < 1000);
    })
  );
  return [full, preRace, rpShort ? 1 : 0];
}

/** Segment 03: lagan tempo mreže po osećaju [s/km] (D26). */
export const FEEL_EASY = [270, 315, 360, 405, 450, 510];

export interface GridCase {
  id: string;
  days: number;
  weeks: number;
  km: number;
  input: Record<string, unknown>;
}

/** Mreža po osećaju za jedan broj dana: nedelje 8–18 × obim po D17 × lagan tempo × raspored × trka, bez
    rezultata; id `f-d<dana>-<ned>w-<km>km-e<tempo>-<raspored>-<trka>`. Ukupno 11 880. */
export function feelGridInputs(days: 3 | 4 | 5 | 6): GridCase[] {
  const out: GridCase[] = [];
  for (const weeks of GRID_02.weeks)
    for (const km of GRID_02.km[days])
      for (const easy of FEEL_EASY)
        for (const s of GRID_02.schedule)
          for (const race of GRID_02.race) {
            const sc = SCHEDULES_BY_DAYS[days][s];
            out.push({
              id: `f-d${days}-${weeks}w-${km}km-e${easy}-${s}-${race}`,
              days,
              weeks,
              km,
              input: {
                ...inputOf({ weeks, km, days: sc.days, long: sc.long, race }),
                recentResult: null,
                easyPaceSecPerKm: easy
              }
            });
          }
  return out;
}

/** Mreža početnika (D28): dana 3/4 × nedelje 10–18 × obim × {po osećaju lagan 330/390/450/510, rezultat
    VDOT 30/35/40} × raspored × trka; id `b-d<dana>-<ned>w-<km>km-<e330|v30>-<raspored>-<trka>`. */
export const BEGINNER_GRID = {
  days: [3, 4] as const,
  weeks: [10, 11, 12, 13, 14, 15, 16, 17, 18],
  km: { 3: [15, 20, 25, 30], 4: [18, 22, 26, 30, 35] } as Record<3 | 4, number[]>,
  pace: [
    { easy: 330 },
    { easy: 390 },
    { easy: 450 },
    { easy: 510 },
    { vdot: 30 },
    { vdot: 35 },
    { vdot: 40 }
  ] as ({ easy: number } | { vdot: number })[]
};

export function beginnerGridInputs(days: 3 | 4): GridCase[] {
  const out: GridCase[] = [];
  for (const weeks of BEGINNER_GRID.weeks)
    for (const km of BEGINNER_GRID.km[days])
      for (const pace of BEGINNER_GRID.pace)
        for (const s of GRID_02.schedule)
          for (const race of GRID_02.race) {
            const sc = SCHEDULES_BY_DAYS[days][s];
            const base = inputOf({
              weeks,
              km,
              ...('vdot' in pace ? { vdot: pace.vdot } : {}),
              days: sc.days,
              long: sc.long,
              race
            });
            out.push({
              id: `b-d${days}-${weeks}w-${km}km-${'vdot' in pace ? `v${pace.vdot}` : `e${pace.easy}`}-${s}-${race}`,
              days,
              weeks,
              km,
              input: {
                ...base,
                ...('easy' in pace ? { recentResult: null, easyPaceSecPerKm: pace.easy } : {}),
                experience: 'beginner'
              }
            });
          }
  return out;
}

/** Normalizator regresije prema 21c03f1 (10k-v2.2.1): bez oznake verzije i bez novih polja 10k-v2.3.0 sa
    podrazumevanom vrednošću (plan.paceBasis 'result'; input.experience 'regular' i
    input.easyPaceSecPerKm null — u planu sa rezultatom uvek iste). Nad planom 21c03f1 ne menja ništa. */
function normalize21(result: unknown): string {
  return JSON.stringify(undo07(result))
    .replace(/10k-v2\.\d+\.\d+/g, 'VERSION')
    .replace(/,"paceBasis":"result"/g, '')
    .replace(/,"experience":"regular","easyPaceSecPerKm":null/g, '');
}

/**
 * Regresija prema 21c03f1 (isti kod u skripti koja je upisala heševe 21c03f1):
 * [heš celog plana (normalize21); isti heš bez upozorenja RACE_WEEK_SHORT (D30b uklanja samo njega)].
 */
export function planHashes21(result: unknown): [number, number] {
  const r = result as { ok: boolean; plan?: { warnings: { rule: string }[] } };
  const full = fnv1a(normalize21(result));
  if (!r.ok || !r.plan) return [full, full];
  const warnings = r.plan.warnings.filter((w) => w.rule !== 'RACE_WEEK_SHORT');
  return [full, fnv1a(normalize21({ ...r, plan: { ...r.plan, warnings } }))];
}

/** Regresija prema 81bd351 (10k-v2.3.0): heš celog rezultata bez oznake verzije (isti kod u skripti koja
    je upisala heševe 81bd351). */
export function planHash81(result: unknown): number {
  return fnv1a(JSON.stringify(undo07(result)).replace(/10k-v2\.\d+\.\d+/g, 'VERSION'));
}

/** Regresija prema 4917959 (10k-v2.4.1) u 06c: kao planHash81 i bez polja koraka `reduced` (novo u
    10k-v2.5.0, A17; normalizacija kao normalize21). Nad izlazom 4917959 ne menja ništa. */
export const stripReduced = (result: unknown): string =>
  JSON.stringify(undo07(result))
    .replace(/10k-v2\.\d+\.\d+/g, 'VERSION')
    .replace(/,"reduced":(true|false)/g, '');
export const planHash06c = (result: unknown): number => fnv1a(stripReduced(result));

/* ---------- Segment 04: mreža scenarija adaptacije ---------- */

export interface AdaptBase {
  id: string;
  input: Record<string, unknown>;
}

/** Bazni planovi mreže adaptacije: 3/4/5/6 dana × sa rezultatom (VDOT 45) i po osećaju (lagan 6:00) ×
    10/14/18 ned, + početnik 3 dana po osećaju (7:30) i 4 dana sa rezultatom (VDOT 35) × 10/14/18 ned =
    30 planova. */
export function adaptBases(): AdaptBase[] {
  const km: Record<3 | 4 | 5 | 6, number> = { 3: 25, 4: 35, 5: 45, 6: 55 };
  const out: AdaptBase[] = [];
  for (const weeks of [10, 14, 18])
    for (const days of [3, 4, 5, 6] as const) {
      const sc = SCHEDULES_BY_DAYS[days].A;
      const base = inputOf({ weeks, km: km[days], vdot: 45, days: sc.days, long: sc.long });
      out.push({ id: `d${days}-r-${weeks}w`, input: { ...base, goalTimeSec: 2700 } });
      out.push({
        id: `d${days}-f-${weeks}w`,
        input: { ...base, recentResult: null, easyPaceSecPerKm: 360 }
      });
    }
  for (const weeks of [10, 14, 18]) {
    const b3 = SCHEDULES_BY_DAYS[3].A;
    const b4 = SCHEDULES_BY_DAYS[4].A;
    out.push({
      id: `beg-d3-f-${weeks}w`,
      input: {
        ...inputOf({ weeks, km: 20, days: b3.days, long: b3.long }),
        recentResult: null,
        easyPaceSecPerKm: 450,
        experience: 'beginner'
      }
    });
    out.push({
      id: `beg-d4-r-${weeks}w`,
      input: {
        ...inputOf({ weeks, km: 25, vdot: 35, days: b4.days, long: b4.long }),
        experience: 'beginner'
      }
    });
  }
  return out;
}

/** asOf mreže: kraj ned 2, sreda ned 6, kraj ned 8, sreda nedelje tapera. */
export const AS_OF_KINDS = ['w2end', 'w6wed', 'w8end', 'taperWed'] as const;
export type AsOfKind = (typeof AS_OF_KINDS)[number];

interface PlanLike {
  input: { startDate: string; runDays: readonly string[]; currentWeeklyKm: number };
  vdot: number;
  weeks: readonly {
    index: number;
    phase: string;
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

export function asOfOf(plan: PlanLike, kind: AsOfKind): string {
  const w = (i: number) => plan.weeks[i - 1]!;
  if (kind === 'w2end') return w(2).endDate;
  if (kind === 'w6wed') return addDays(w(6).startDate, 2);
  if (kind === 'w8end') return w(8).endDate;
  return addDays(plan.weeks.find((x) => x.phase === 'taper')!.startDate, 2);
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

const dayIdx = mustDay;

/** Odrađeni treninzi u [from, to]: dan plana (sa dayId, planirani km × `share`) ili, pre starta plana, trčanje
    van plana na dan trčanja (obim ulaza / broj dana). */
export function runsIn(
  plan: PlanLike,
  from: string,
  to: string,
  share = 1,
  extra: Record<string, unknown> = {}
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const byDate = new Map(plan.weeks.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
  for (let d = from; dayIdx(d) <= dayIdx(to); d = addDays(d, 1)) {
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
      dayIdx(d) < dayIdx(plan.input.startDate) &&
      plan.input.runDays.includes(weekdayOf(d))
    )
      out.push({
        date: d,
        km: Math.round((plan.input.currentWeeklyKm / plan.input.runDays.length) * share * 10) / 10,
        durationSec: 2400,
        completed: true,
        rpe: 5,
        ...extra
      });
  }
  return out;
}

/** Činjenice scenarija (asOf = dan adaptacije). 'chain' = prvi korak (pauza 10); drugi korak gradi test. */
export function factsOf(plan: PlanLike, s: Scenario, asOf: string): Record<string, unknown> {
  const back = (n: number): string => addDays(asOf, -n);
  const cov = (from: string, complete = true) => ({ from, to: asOf, complete });
  const resultFor = (vdot: number, kind: 'race' | 'test') => ({
    distM: 5000,
    sec: timeForVdot(vdot, 5000),
    date: asOf,
    kind
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
    case 'pain8':
      return {
        workouts: [
          { date: asOf, km: 5, durationSec: 1800, completed: true, pain: s === 'pain5' ? 5 : 8 }
        ]
      };
    case 'fatigue':
      return {
        workouts: [
          { date: back(1), km: 6, durationSec: 2400, completed: true, rpe: 8 },
          { date: back(3), km: 6, durationSec: 2400, completed: true, rpe: 7 }
        ]
      };
    case 'faster':
      return { results: [resultFor(Math.round((plan.vdot + 2) * 10) / 10, 'race')] };
    case 'slower':
      return { results: [resultFor(Math.round((plan.vdot - 2) * 10) / 10, 'race')] };
    case 'test5k':
      return { results: [{ distM: 5000, sec: 1470, date: asOf, kind: 'test' }] };
    case 'incomplete':
      return { coverage: cov(back(13), false) };
    case 'locked': {
      const future = plan.weeks
        .flatMap((w) => w.days)
        .filter((d) => dayIdx(d.date) > dayIdx(asOf) && d.role !== 'race')
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

/* ---------- Segment 06b: mreža bola P ---------- */

/** Planovi mreže P (6 iz mreže 04 i istog recepta, adaptBases) i po dve nedelje izgradnje: sve faze
    izgradnje (baza, razvoj, specifično), nedelja pre rasterećenja, rasterećenje, nedelja testa, nedelja pred
    taperom. Početnik 4 dana sa rezultatom, 12 ned, nije u mreži 04 (isti recept kao beg-d4-r-*w). */
export const PAIN_GRID: readonly { id: string; weeks: readonly [number, number] }[] = [
  { id: 'd4-r-14w', weeks: [3, 10] },
  { id: 'd6-r-18w', weeks: [6, 12] },
  { id: 'd3-f-10w', weeks: [3, 7] },
  { id: 'beg-d3-f-14w', weeks: [5, 9] },
  { id: 'd5-f-18w', weeks: [4, 14] },
  { id: 'beg-d4-r-12w', weeks: [7, 10] }
];
export const PAIN_LEVELS = [4, 5, 7, 8] as const;

/** Bazni planovi mreže P (ulazi). */
export function painGridBases(): AdaptBase[] {
  const b4 = SCHEDULES_BY_DAYS[4].A;
  const all = [
    ...adaptBases(),
    {
      id: 'beg-d4-r-12w',
      input: {
        ...inputOf({ weeks: 12, km: 25, vdot: 35, days: b4.days, long: b4.long }),
        experience: 'beginner'
      }
    }
  ];
  return PAIN_GRID.map((g) => all.find((b) => b.id === g.id)!);
}

/** Činjenica bola: bol `level` na dan asOf (zapis bez trčanja). */
export const painFacts = (asOf: string, level: number): Record<string, unknown> => ({
  workouts: [{ date: asOf, km: 0, durationSec: 0, completed: false, pain: level }]
});

export interface PainCase {
  key: string;
  id: string;
  week: number;
  asOf: string;
  level: number;
}

/** Tokovi mreže P za plan: 2 nedelje × 7 dana (asOf = taj dan, bol na dan asOf) × nivo bola 4/5/7/8. */
export function painCases(id: string, plan: PlanLike): PainCase[] {
  const g = PAIN_GRID.find((x) => x.id === id)!;
  const out: PainCase[] = [];
  for (const week of g.weeks)
    for (let i = 0; i < 7; i++) {
      const asOf = addDays(plan.weeks[week - 1]!.startDate, i);
      for (const level of PAIN_LEVELS)
        out.push({ key: `${id}/w${week}/${asOf}/p${level}`, id, week, asOf, level });
    }
  return out;
}

/* ---------- Segment 06c: mreža R (rasterećenje posle smanjenja, A17) ---------- */

/** `n` ravnomerno izabranih elemenata (indeks ⌊i · dužina / n⌋). */
const spread = <T>(xs: readonly T[], n: number): T[] =>
  Array.from({ length: n }, (_, i) => xs[Math.floor((i * xs.length) / n)]!);

/** Planovi mreže R: svaki 12. ulaz mreže 01 (gridInputs, 252 plana) i po 20 ravnomerno izabranih iz mreže po
    osećaju (F, 3–6 dana) i mreže početnika (B, 3–4 dana). */
export function reliefGridBases(): AdaptBase[] {
  const r = gridInputs().filter((_, i) => i % 12 === 0);
  const f = spread(
    ([3, 4, 5, 6] as const).flatMap((d) => feelGridInputs(d)),
    20
  );
  const b = spread(
    ([3, 4] as const).flatMap((d) => beginnerGridInputs(d)),
    20
  );
  return [...r, ...f, ...b].map((x) => ({ id: x.id, input: x.input }));
}

export const RELIEF_SCENARIOS = [
  'pause10',
  'pause20',
  'pain5',
  'pain8',
  'under',
  'fatigue',
  'pause10pain5'
] as const;
export type ReliefScenario = (typeof RELIEF_SCENARIOS)[number];

/** asOf mreže R: kraj svake nedelje 2…N − 4. */
export function reliefAsOfs(plan: PlanLike): { week: number; asOf: string }[] {
  return plan.weeks
    .filter((w) => w.index >= 2 && w.index <= plan.weeks.length - 4)
    .map((w) => ({ week: w.index, asOf: w.endDate }));
}

/** Činjenice mreže R (asOf = kraj nedelje): pauza 10/20 dana (breaks), bol 5/8 na dan asOf, manjak (potpuna
    pokrivenost nedelje asOf, odrađen samo prvi dan plana te nedelje), umor (2 lagana van plana sa RPE 8),
    pauza 10 + bol 5 u istom koraku. */
export function reliefFacts(
  plan: PlanLike,
  s: ReliefScenario,
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
    case 'pain8':
      return painFacts(asOf, s === 'pain5' ? 5 : 8);
    case 'under': {
      const first = plan.weeks
        .find((w) => w.endDate === asOf)!
        .days.find((d) => d.countsToWeek)!.date;
      return {
        workouts: runsIn(plan, first, first),
        coverage: { from: back(6), to: asOf, complete: true }
      };
    }
    case 'fatigue':
      return {
        workouts: [
          { date: back(1), km: 6, durationSec: 2400, completed: true, rpe: 8 },
          { date: back(3), km: 6, durationSec: 2400, completed: true, rpe: 8 }
        ]
      };
    case 'pause10pain5':
      return { breaks: pause(10), ...painFacts(asOf, 5) };
  }
}

/* ---------- Segment 06d: mreža E (rana adaptacija i pred nedeljom testa, N7) ---------- */

export const EARLY_SCENARIOS = [
  'pause10',
  'pause20',
  'pain5',
  'pain8',
  'pause10pain5',
  'under',
  'fatigue'
] as const;
/** 06e (10k-v2.5.2, pouka 34): asOf PRE STARTA plana (start − 1, − 3, − 6) — umor, bol 5, pauza 10, rezultat
    (trka 5 km, VDOT + 2). */
export const EARLY_PRE_SCENARIOS = ['fatigue', 'pain5', 'pause10', 'faster'] as const;
export const EARLY_PRE_BACK = [1, 3, 6] as const;
/** 06h (10k-v2.6.2, pouke 23 i 34): asOf = PRVI DAN plana (zapisi pre starta, dan 1 zaštićen) — svi scenariji mreže E
    i rezultat; trajna mreža u repeatGrid.harness.node.test.ts (heševi segment06h.startday-hashes-b8fcf22.json). */
export const START0_SCENARIOS = [...EARLY_SCENARIOS, 'faster'] as const;
/** asOf mreže „prvi dan plana" (jedino mesto; sabotaža: mreža bez start + 0). */
export const start0AsOf = (plan: PlanLike): string => plan.weeks[0]!.startDate;
export type EarlyScenario = (typeof EARLY_SCENARIOS)[number] | (typeof EARLY_PRE_SCENARIOS)[number];

/** Činjenice mreže E (asOf = dan adaptacije): pauza 10/20 dana (breaks do asOf), bol 5/8 na dan asOf, pauza 10 +
    bol 5, manjak (odrađen samo dan asOf − 6 po planu, pokrivenost asOf − 6 … asOf), umor (reliefFacts). */
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
      return reliefFacts(plan, 'fatigue', asOf);
    case 'faster':
      return factsOf(plan, 'faster', asOf);
  }
}

export interface EarlyBase extends AdaptBase {
  family: 'R' | 'F' | 'B';
}

/** Planovi mreže E (redosled R, F, B): svaki 12. ulaz mreže 01, svaki 7. mreže po osećaju (3–6 dana), svaki 3.
    mreže početnika (3–4 dana) — 252 + 1698 + 1134 = 3084. */
export function earlyGridBases(): EarlyBase[] {
  const every = <X>(xs: readonly X[], n: number): X[] => xs.filter((_, i) => i % n === 0);
  return [
    ...every(gridInputs(), 12).map((c) => ({ id: c.id, family: 'R' as const, input: c.input })),
    ...every(
      ([3, 4, 5, 6] as const).flatMap((d) => feelGridInputs(d)),
      7
    ).map((c) => ({ id: c.id, family: 'F' as const, input: c.input })),
    ...every(
      ([3, 4] as const).flatMap((d) => beginnerGridInputs(d)),
      3
    ).map((c) => ({ id: c.id, family: 'B' as const, input: c.input }))
  ];
}

/** asOf mreže E po planu, svaki sa svojim scenarijima: sreda i kraj nedelje 1 i (u planu sa testom) nedelje pre
    nedelje testa kad je ≥ 2 — svih 7 scenarija; kraj nedelje N − 2 — bol 8 (taper skraćen danima odmora/bola, D23).
    Oznaka `w<i>wed` / `w<i>end`. */
export function earlyAsOfs(
  plan: PlanLike
): { tag: string; asOf: string; scenarios: readonly EarlyScenario[] }[] {
  const N = plan.weeks.length;
  const tw = plan.weeks.find((w) => w.test)?.index;
  const weeks = [1, ...(tw !== undefined && tw - 1 >= 2 ? [tw - 1] : [])];
  const wedOf = (i: number): string => {
    let d = plan.weeks[i - 1]!.startDate;
    while (weekdayOf(d) !== 'wed') d = addDays(d, 1);
    return d;
  };
  return [
    ...weeks.flatMap((i) => [
      { tag: `w${i}wed`, asOf: wedOf(i), scenarios: EARLY_SCENARIOS },
      { tag: `w${i}end`, asOf: plan.weeks[i - 1]!.endDate, scenarios: EARLY_SCENARIOS }
    ]),
    {
      tag: `w${N - 2}end`,
      asOf: plan.weeks[N - 3]!.endDate,
      scenarios: weeks.includes(N - 2) ? [] : (['pain8'] as const)
    }
  ];
}

/** Imenovani tokovi mreže E van pravila asOf (sreda nedelje 10–11 početnika, dan Q1 zaštićen: stanje doze iz
    upisanih dana, N-c/N-d iz 06d): `<plan>/<w#wed>/<scenario>`. */
export const EARLY_NAMED = [
  'b-d3-17w-30km-e330-B-sun/w10wed/pause10',
  'b-d3-17w-30km-e330-B-sun/w10wed/under',
  'b-d3-18w-30km-e330-B-sun/w10wed/pause20',
  'b-d3-18w-30km-e330-B-sun/w11wed/pause10',
  'b-d3-18w-30km-e330-B-sun/w11wed/pause20',
  'b-d3-18w-30km-e330-B-sun/w11wed/under',
  'b-d3-16w-30km-e330-B-sun/w11wed/pause20'
] as const;

export interface EarlyFlow {
  /** Redni broj u celom skupu (redosled heševa segment06d.early-hashes-51a924f.json). */
  n: number;
  key: string;
  base: EarlyBase;
  asOf: string;
  s: EarlyScenario;
}

/** Broj tokova mreže E iz 06d (redni brojevi 0 … EARLY_06D − 1, heševi segment06d.early-hashes-51a924f.json);
    tokovi asOf pre starta (06e) slede posle njih. */
export const EARLY_06D = 65699;

/** Svi tokovi mreže E (redosled: plan, asOf, scenario; imenovani na kraju svog plana); posle svih tokova 06d —
    asOf pre starta (06e: plan, start − 1/− 3/− 6, EARLY_PRE_SCENARIOS; oznaka `start-<d>`). `planOf` = generisan
    plan. */
export function earlyFlows(planOf: (b: EarlyBase) => PlanLike): EarlyFlow[] {
  const out: EarlyFlow[] = [];
  const bases = earlyGridBases();
  for (const base of bases) {
    const p = planOf(base);
    const seen = new Set<string>();
    const add = (tag: string, asOf: string, s: EarlyScenario): void => {
      const key = `${base.id}/${tag}/${s}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ n: out.length, key, base, asOf, s });
    };
    for (const a of earlyAsOfs(p)) for (const s of a.scenarios) add(a.tag, a.asOf, s);
    for (const k of EARLY_NAMED) {
      const [id, tag, s] = k.split('/') as [string, string, EarlyScenario];
      if (id !== base.id) continue;
      let wed = p.weeks[Number(tag.slice(1, -3)) - 1]!.startDate;
      while (weekdayOf(wed) !== 'wed') wed = addDays(wed, 1);
      add(tag, wed, s);
    }
  }
  for (const base of bases) {
    const start = planOf(base).input.startDate;
    for (const d of EARLY_PRE_BACK)
      for (const s of EARLY_PRE_SCENARIOS)
        out.push({
          n: out.length,
          key: `${base.id}/start-${d}/${s}`,
          base,
          asOf: addDays(start, -d),
          s
        });
  }
  return out;
}

/* ---------- 10K-07 (10k-v2.9.0): normalizator regresije prema starijim heševima ---------- */

interface U7Day {
  role: string;
  workout: {
    km: number;
    title: string;
    dose: unknown;
  };
}
interface U7Week {
  index: number;
  phase: string;
  plannedKm: number;
  targetKm: number;
  days: U7Day[];
  notes: string[];
}
interface U7Plan {
  input: Record<string, unknown>;
  weeks: U7Week[];
  warnings: { rule: string; message: string }[];
  adaptation?: { steps: never[] };
}

const D25_NEW =
  /Dan kvaliteta ili testa duži od dugog po trajanju u (\d+) od (\d+) nedelja izgradnje \((\d+)\. nedelja: (\d+) > (\d+) min\)/g;
const ADV_NEW =
  /; preporuka ([\d–]+) dana \(plan sa manje dana podržava obim ([^ ]+) km, dugi dobija veći udeo; (D17|D28)\)/g;
const UVOD_NEW = /Uvod: (\d+)\. od (\d+) nedelje uvoda bez kvaliteta/g;

/**
 * 10K-07: izlaz 10k-v2.9.0 u obliku pre 10K-07 za promene objašnjene ispravkom — (a) oštrenje trkačke nedelje sa
 * WU/CD po pojasu D14 (pre: pojas, sada WU/CD trke), planirano i cilj trkačke nedelje (cilj = planirano, D8) i oznake
 * dana u `changes`; (b) tekst uvoda (stavka 7), upozorenja D25 i saveta D25 (stavke 5–6). NE vraća: novu preporuku
 * dana D22 (O-1b), D25 sa testom (F3), Z1, vraćanje/predaju — to su izuzeci po uzroku. Nad izlazom pre 10K-07 ne
 * menja ništa (nema oštrenja sa WU/CD trke, nema novih tekstova).
 */
export function undo07<T>(result: T): T {
  const r = JSON.parse(JSON.stringify(result)) as {
    plan?: U7Plan;
    changes?: { week: number; field: string; before: string; after: string }[];
  };
  const plan = r?.plan;
  if (!plan || !Array.isArray(plan.weeks)) return result;
  const chk = checkInput(plan.input);
  if (!chk.ok) return result;
  const steps = plan.adaptation?.steps ?? [];
  const wcOld = warmupCooldown(chk.input.currentWeeklyKm, chk.rule.beginner);
  const raceWc = { warmupSec: 900, cooldownSec: 600 };
  const titleOld = (t: string): string =>
    t.replace(
      /^WU 15 min \+ (.*) \+ CD 10 min$/u,
      `WU ${wcOld.warmupSec / 60} min + $1 + CD ${wcOld.cooldownSec / 60} min`
    );
  let delta100 = 0;
  for (const w of plan.weeks) {
    if (w.phase !== 'race') continue;
    const sd = w.days.find((d) => d.role === 'sharpener');
    if (!sd || !sd.workout.dose) continue;
    const paces = pacesAt(chk.pace, steps, w.index);
    const feel = basisAt(chk.pace, steps, w.index) === 'feel';
    const now = qualityWorkout(sd.workout.dose as never, paces, raceWc, feel);
    if (JSON.stringify(now) !== JSON.stringify(sd.workout)) continue;
    const old = qualityWorkout(sd.workout.dose as never, paces, wcOld, feel);
    delta100 = Math.round(old.km * 100) - Math.round(sd.workout.km * 100);
    sd.workout = old as never;
    const p100 = Math.round(w.plannedKm * 100) + delta100;
    const t100 = Math.round(w.targetKm * 100);
    w.plannedKm = p100 / 100;
    if (t100 === Math.round(Math.round((p100 - delta100) / 10)) * 10)
      w.targetKm = Math.round(p100 / 10) / 10;
  }
  const text = (t: string): string =>
    t
      .replace(UVOD_NEW, 'Uvod (D28): nedelja $1 od $2 bez kvaliteta')
      .replace(
        D25_NEW,
        'Kvalitetni dan duži od dugog po trajanju u $1 od $2 nedelja izgradnje (ned $3: $4 > $5 min; D25)'
      )
      .replace(
        ADV_NEW,
        '; preporuka $1 dana (red $3 sa manje dana podržava obim $2 km, dugi dobija veći udeo)'
      );
  for (const w of plan.weeks) w.notes = w.notes.map(text);
  for (const v of plan.warnings) v.message = text(v.message);
  if (Array.isArray(r.changes))
    for (const c of r.changes) {
      if (c.field === 'day') {
        c.before = c.before.replace(
          /^sharpener: (.*)$/u,
          (_, t: string) => `sharpener: ${titleOld(t)}`
        );
        c.after = c.after.replace(
          /^sharpener: (.*)$/u,
          (_, t: string) => `sharpener: ${titleOld(t)}`
        );
      } else if (
        c.field === 'plannedKm' &&
        plan.weeks[c.week - 1]?.phase === 'race' &&
        delta100 !== 0
      ) {
        c.before = String((Math.round(Number(c.before) * 100) + delta100) / 100);
        c.after = String((Math.round(Number(c.after) * 100) + delta100) / 100);
      } else if (
        c.field === 'targetKm' &&
        plan.weeks[c.week - 1]?.phase === 'race' &&
        delta100 !== 0
      ) {
        const t = (x: string): string =>
          String(Math.round((Math.round(Number(x) * 100) + delta100) / 10) / 10);
        c.before = t(c.before);
        c.after = t(c.after);
      }
    }
  return r as T;
}
