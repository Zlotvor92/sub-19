/* Zajednički ulazi za testove 5K v2 (nije testni fajl, da bi ga izolacioni test video kao deo v2). */

import { addDays, weekdayOf } from './dates.ts';
import { adaptFiveKV2 } from './adapt.ts';
import { assess, checkFacts } from './assess.ts';
import { mustDay } from './dates.ts';
import { construct, generateFiveKV2 } from './generate.ts';
import { raceTimeForVdot } from './paces.ts';
import type { AdaptResult, FiveKV2Plan, PlanDay } from './types.ts';
import type { Weekday } from './types.ts';

export const START = '2026-11-02'; // ponedeljak

export interface Profile {
  weeks: number;
  km: number;
  distanceM: 3000 | 5000 | 10000;
  timeSec: number;
  days: Weekday[];
  resultDaysBefore?: number;
  goalTimeSec?: number | null;
}

export function inputOf(p: Profile): Record<string, unknown> {
  return {
    startDate: START,
    raceDate: addDays(START, p.weeks * 7 - 1),
    runDays: p.days,
    currentWeeklyKm: p.km,
    recentResult: {
      distanceM: p.distanceM,
      timeSec: p.timeSec,
      date: addDays(START, -(p.resultDaysBefore ?? 14))
    },
    goalTimeSec: p.goalTimeSec ?? null
  };
}

/** Podržani profili koji moraju dati plan (razvojni + granični iz primera). */
export const PROFILES: Record<string, Profile> = {
  vdot32_20km_10w: {
    weeks: 10,
    km: 20,
    distanceM: 5000,
    timeSec: 1745,
    days: ['tue', 'thu', 'sat', 'sun'],
    goalTimeSec: 1680
  },
  vdot40_25km_12w: {
    weeks: 12,
    km: 25,
    distanceM: 10000,
    timeSec: 3000,
    days: ['mon', 'wed', 'fri', 'sun']
  },
  vdot48_30km_9w: {
    weeks: 9,
    km: 30,
    distanceM: 3000,
    timeSec: 720,
    days: ['tue', 'thu', 'sat', 'sun']
  },
  vdot50_35km_14w: {
    weeks: 14,
    km: 35,
    distanceM: 5000,
    timeSec: 1197,
    days: ['mon', 'wed', 'fri', 'sat']
  },
  vdot55_40km_16w: {
    weeks: 16,
    km: 40,
    distanceM: 10000,
    timeSec: 2280,
    days: ['tue', 'wed', 'fri', 'sun']
  },
  vdot58_42km_11w: {
    weeks: 11,
    km: 42,
    distanceM: 5000,
    timeSec: 1045,
    days: ['mon', 'tue', 'thu', 'sat']
  },
  edge_15km_8w: {
    weeks: 8,
    km: 15,
    distanceM: 5000,
    timeSec: 1800,
    days: ['tue', 'thu', 'sat', 'sun']
  },
  edge_45km_16w: {
    weeks: 16,
    km: 45,
    distanceM: 5000,
    timeSec: 1080,
    days: ['mon', 'wed', 'fri', 'sun']
  },
  edge_result_84d: {
    weeks: 10,
    km: 28,
    distanceM: 10000,
    timeSec: 2760,
    days: ['tue', 'thu', 'sat', 'sun'],
    resultDaysBefore: 84
  },
  edge_vdot30: {
    weeks: 12,
    km: 22,
    distanceM: 5000,
    timeSec: 1840,
    days: ['mon', 'wed', 'fri', 'sun']
  }
};

/* ---------- 2.5.0 (Segment 06): mreža adaptacije ---------- */

const D3: Weekday[] = ['tue', 'thu', 'sun'];
const D4: Weekday[] = ['tue', 'thu', 'sat', 'sun'];
const D5: Weekday[] = ['mon', 'tue', 'thu', 'sat', 'sun'];
const race = (weeks: number): string => addDays(START, weeks * 7 - 1);

/** 60 ulaza: sa rezultatom (VDOT ~45 i ~38; 3/4/5 dana; 7/10/14 ned), po osećaju (E 6:00), početnik
    (po osećaju E 7:00 i sa rezultatom 30:00), kratka priprema, 16 ned 5 dana, dev-04, 15 km/8 ned. */
export function adaptNetwork(): { id: string; input: Record<string, unknown> }[] {
  const out: { id: string; input: Record<string, unknown> }[] = [];
  const km: Record<3 | 4 | 5, number[]> = { 3: [15, 28], 4: [22, 38], 5: [30, 50] };
  const days: Record<3 | 4 | 5, Weekday[]> = { 3: D3, 4: D4, 5: D5 };
  const res = (timeSec: number, distanceM = 5000) => ({
    distanceM,
    timeSec,
    date: addDays(START, -14)
  });
  for (const t of [1340, 1560])
    for (const d of [3, 4, 5] as const)
      for (const k of km[d])
        for (const weeks of [7, 10, 14])
          out.push({
            id: `v${t === 1340 ? 45 : 38}-d${d}-${k}km-${weeks}w`,
            input: {
              startDate: START,
              raceDate: race(weeks),
              runDays: days[d],
              currentWeeklyKm: k,
              recentResult: res(t),
              goalTimeSec: t - 60
            }
          });
  for (const d of [3, 4, 5] as const)
    for (const k of km[d])
      for (const weeks of [8, 12])
        out.push({
          id: `feel-d${d}-${k}km-${weeks}w`,
          input: {
            startDate: START,
            raceDate: race(weeks),
            runDays: days[d],
            currentWeeklyKm: k,
            typicalEasyPaceSecPerKm: 360,
            goalTimeSec: 1500
          }
        });
  for (const d of [3, 4] as const)
    for (const k of [d === 3 ? 12 : 15, 20])
      for (const withResult of [false, true])
        out.push({
          id: `beg-${withResult ? 'res' : 'feel'}-d${d}-${k}km-10w`,
          input: {
            startDate: START,
            raceDate: race(10),
            runDays: days[d],
            currentWeeklyKm: k,
            experience: 'beginner',
            canRun30Min: true,
            ...(withResult ? { recentResult: res(1800) } : { typicalEasyPaceSecPerKm: 420 }),
            goalTimeSec: 1740
          }
        });
  const extra: [string, Record<string, unknown>][] = [
    ['short-6w-d4-30km', { weeks: 6, days: D4, km: 30, r: res(1210) }],
    ['d5-60km-16w-v58', { weeks: 16, days: D5, km: 60, r: res(1045) }],
    ['dev-04', { weeks: 14, days: ['mon', 'wed', 'fri', 'sat'], km: 35, r: res(1197), goal: 1170 }],
    ['edge-15km-8w', { weeks: 8, days: D4, km: 15, r: res(1800) }]
  ];
  for (const [id, o] of extra)
    out.push({
      id,
      input: {
        startDate: START,
        raceDate: race(o['weeks'] as number),
        runDays: o['days'],
        currentWeeklyKm: o['km'],
        recentResult: o['r'],
        goalTimeSec: o['goal'] ?? null
      }
    });
  return out;
}

/** Plan dani do `to` (uključivo) kao izvršeni treninzi (km/trajanje kao u planu). */
export function doneFacts(
  plan: {
    weeks: {
      days: { date: string; countsToWeek: boolean; workout: { km: number; sec: number } }[];
    }[];
  },
  to: string,
  from = '0000-01-01'
): { date: string; dayId: string; km: number; durationSec: number; completed: boolean }[] {
  return plan.weeks
    .flatMap((w) => w.days)
    .filter((d) => d.countsToWeek && d.date >= from && d.date <= to)
    .map((d) => ({
      date: d.date,
      dayId: d.date,
      km: d.workout.km,
      durationSec: d.workout.sec,
      completed: true
    }));
}

/** Istorija pre starta: 4 nedelje trenutnog obima na dane trčanja (da pauza ≥ 28 ima „pre pauze"). */
export function historyFacts(
  input: Record<string, unknown>
): { date: string; km: number; durationSec: number; completed: boolean }[] {
  const days = input['runDays'] as Weekday[];
  const km = Math.round(((input['currentWeeklyKm'] as number) / days.length) * 10) / 10;
  const out: { date: string; km: number; durationSec: number; completed: boolean }[] = [];
  for (let i = -28; i < 0; i++) {
    const d = addDays(START, i);
    const wd = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const)[(i + 28) % 7]!;
    if (days.includes(wd))
      out.push({ date: d, km, durationSec: Math.round(km * 360), completed: true });
  }
  return out;
}

/* ---------- Segment 08d (5k-v2.6.1): tokovi mreža adaptacije (regresija) i mreža bola P ---------- */

/** API koji se meri: tekuće stablo (testovi) ili checkout polaznog SHA (regresiona skripta 08d). */
export interface AdaptApi {
  generate: (input: Record<string, unknown>) => unknown;
  adapt: (plan: unknown, facts: unknown, asOf: string) => unknown;
}
export interface AdaptFlow {
  key: string;
  result: unknown;
}
interface FlowDay {
  date: string;
  role: string;
  countsToWeek: boolean;
  workout: { km: number; sec: number };
  session: { totalSec: number };
}
interface FlowPlan {
  input: Record<string, unknown>;
  vdot: number | null;
  experience: string;
  weeks: { startDate: string; days: FlowDay[] }[];
  continuous: { fromWeek: number; plan: FlowPlan } | null;
}
type FlowResult = { ok: true; plan: FlowPlan } | { ok: false };
type FlowFacts = Record<string, unknown> & { workouts: Record<string, unknown>[] };

const endOfWeek = (k: number): string => addDays(START, k * 7 - 1);
const flowDays = (p: FlowPlan): FlowDay[] => p.weeks.flatMap((w) => w.days);
const historyStart = addDays(START, -28);

/** JSON rezultata adaptacije bez oznake verzije (heš regresije 08d: policyVersion → „-" na svim nivoima). */
export const canonResult = (r: unknown): string =>
  JSON.stringify(r, (k, v: unknown) => (k === 'policyVersion' ? '-' : v));

function planFrom(api: AdaptApi, input: Record<string, unknown>): FlowPlan {
  const r = api.generate(input) as FlowResult;
  if (!r.ok) throw new Error(`generate: ${JSON.stringify(r).slice(0, 300)}`);
  return JSON.parse(JSON.stringify(r.plan)) as FlowPlan;
}
const done = (p: FlowPlan, to: string): Record<string, unknown>[] => [
  ...historyFacts(p.input),
  ...doneFacts(p, to)
];
const missed = (p: FlowPlan, from: string, to: string): Record<string, unknown>[] =>
  flowDays(p)
    .filter((d) => d.countsToWeek && d.date >= from && d.date <= to)
    .map((d) => ({ date: d.date, dayId: d.date, km: 0, durationSec: 0, completed: false }));
const pauseFacts = (p: FlowPlan, asOf: string, n: number): Record<string, unknown>[] => [
  ...done(p, addDays(asOf, -n)),
  ...missed(p, addDays(asOf, -n + 1), asOf)
];

/** Segment 07, mreža B: plan trčanje/hodanje (canRun30Min = false). */
const rwInput = (weeks: number, o: Record<string, unknown> = {}): Record<string, unknown> => ({
  startDate: START,
  raceDate: race(weeks),
  runDays: ['tue', 'thu', 'sat'],
  currentWeeklyKm: 0,
  canRun30Min: false,
  ...o
});
/** Isti spisak kao RW_NET u segment07.node.test.ts (16 planova). */
export const RW_NETWORK: readonly { id: string; input: Record<string, unknown> }[] = [
  6, 8, 12, 16
].flatMap((weeks) => [
  {
    id: `rw-${weeks}w-pocetnik-e420`,
    input: rwInput(weeks, { experience: 'beginner', typicalEasyPaceSecPerKm: 420 })
  },
  { id: `rw-${weeks}w-bez-tempa`, input: rwInput(weeks, { runDays: ['mon', 'wed', 'fri'] }) },
  {
    id: `rw-${weeks}w-pocetnik-e480`,
    input: rwInput(weeks, {
      experience: 'beginner',
      typicalEasyPaceSecPerKm: 480,
      runDays: ['mon', 'thu', 'sat']
    })
  },
  {
    id: `rw-${weeks}w-rezultat-e400`,
    input: rwInput(weeks, {
      typicalEasyPaceSecPerKm: 400,
      runDays: ['sun', 'tue', 'thu'],
      currentWeeklyKm: 8,
      recentResult: { distanceM: 5000, timeSec: 2700, date: addDays(START, -30) },
      goalTimeSec: 2400
    })
  }
]);
/** Sesije plana trčanje/hodanje do `to` kao zapisi (vremenski: km 0, trajanje sesije). */
const sessionFacts = (
  p: FlowPlan,
  to: string,
  extra: (i: number) => Record<string, unknown> = () => ({ rpe: 5 }),
  from = '0000-01-01'
): Record<string, unknown>[] =>
  flowDays(p)
    .filter((d) => d.role === 'session' && d.date >= from && d.date <= to)
    .map((d, i) => ({
      date: d.date,
      dayId: d.date,
      km: 0,
      durationSec: d.session.totalSec,
      completed: true,
      ...extra(i)
    }));
const rwCov = (asOf: string, complete = true) => ({ from: START, to: asOf, complete });

/**
 * Postojeće mreže adaptacije 5K v2 (isti ulazi, činjenice i asOf kao u testovima):
 * - s06: segment06 „Mreža" — adaptNetwork (60) × 7 scenarija = 420;
 * - s07a: segment07 „Mreža A" — adaptNetwork (60) × (nepotpun unos, eksplicitna pauza) = 120;
 * - s07b: segment07 „Mreža B" — RW_NETWORK (16) × 6 scenarija × (korak + lanac posle 7 dana) = 192.
 * Ukupno 732 toka; ključ `mreža/plan/scenario[/chain]`.
 */
export function adaptNetworkFlows(
  api: AdaptApi,
  raceTimeForVdot: (vdot: number, distM: number) => number
): AdaptFlow[] {
  const out: AdaptFlow[] = [];
  const full = (f: FlowFacts, asOf: string): FlowFacts =>
    f.workouts.length > 0 && f['coverage'] === undefined
      ? { ...f, coverage: { from: historyStart, to: asOf, complete: true } }
      : f;
  for (const { id, input } of adaptNetwork()) {
    const plan = planFrom(api, input);
    const asOf = endOfWeek(Math.max(2, Math.floor(plan.weeks.length / 2)));
    const v = plan.vdot ?? (plan.experience === 'beginner' ? 33 : 40);
    const s06: Record<string, FlowFacts> = {
      none: { workouts: done(plan, asOf) },
      missedWeek: { workouts: pauseFacts(plan, asOf, 7) },
      pause10: { workouts: pauseFacts(plan, asOf, 10) },
      pause20: { workouts: pauseFacts(plan, asOf, 20) },
      pause35: { workouts: pauseFacts(plan, asOf, 35) },
      pain5: {
        workouts: done(plan, asOf).map((x, i, a) => (i === a.length - 1 ? { ...x, pain: 5 } : x))
      },
      test3k: {
        workouts: done(plan, asOf),
        results: [
          { distM: 3000, sec: raceTimeForVdot(v + 1, 3000), date: addDays(asOf, -1), kind: 'test' }
        ]
      }
    };
    for (const [name, facts] of Object.entries(s06))
      out.push({ key: `s06/${id}/${name}`, result: api.adapt(plan, full(facts, asOf), asOf) });
    const s07a: Record<string, FlowFacts> = {
      incomplete: {
        workouts: done(plan, addDays(asOf, -5)),
        coverage: { from: historyStart, to: asOf, complete: false }
      },
      break: {
        workouts: done(plan, addDays(asOf, -10)),
        breaks: [{ kind: 'break', from: addDays(asOf, -9), to: asOf }]
      }
    };
    for (const [name, facts] of Object.entries(s07a))
      out.push({ key: `s07a/${id}/${name}`, result: api.adapt(plan, facts, asOf) });
  }
  for (const { id, input } of RW_NETWORK) {
    const p = planFrom(api, input);
    const asOf = endOfWeek(Math.max(2, Math.floor(p.weeks.length / 2)));
    const scenarios: Record<string, FlowFacts> = {
      sve: { workouts: sessionFacts(p, asOf), coverage: rwCov(asOf) },
      rpe7: { workouts: sessionFacts(p, asOf, () => ({ rpe: 7 })), coverage: rwCov(asOf) },
      bol5: {
        workouts: sessionFacts(p, asOf).map((x, i, a) =>
          i === a.length - 1 ? { ...x, pain: 5 } : x
        ),
        coverage: rwCov(asOf)
      },
      pauza10: { workouts: sessionFacts(p, addDays(asOf, -10)), coverage: rwCov(asOf) },
      pauza20: { workouts: sessionFacts(p, addDays(asOf, -20)), coverage: rwCov(asOf) },
      nepotpun: { workouts: sessionFacts(p, addDays(asOf, -5)), coverage: rwCov(asOf, false) }
    };
    for (const [name, facts] of Object.entries(scenarios)) {
      const r = api.adapt(p, facts, asOf) as FlowResult;
      out.push({ key: `s07b/${id}/${name}`, result: r });
      if (!r.ok) continue;
      const a2 = addDays(asOf, 7);
      const c = r.plan.continuous;
      const more = c
        ? doneFacts(c.plan, a2)
        : sessionFacts(r.plan, a2, () => ({ rpe: 5 }), addDays(asOf, 1));
      const complete = (facts['coverage'] as { complete: boolean }).complete;
      const f2 = {
        ...facts,
        workouts: [...facts.workouts, ...more],
        coverage: rwCov(a2, complete)
      };
      out.push({ key: `s07b/${id}/${name}/chain`, result: api.adapt(r.plan, f2, a2) });
    }
  }
  return out;
}

/** Mreža bola P (08d): 6 kontinuiranih planova iz adaptNetwork (rezultat i po osećaju, 3/4/5 dana, kratka
    i duga priprema, početnik) i plan trčanje/hodanje posle prelaza (kontinuirani deo od nedelje 9; nedelje
    `weeks` su nedelje kontinuiranog plana). Po dve nedelje izgradnje: nedelja pred rasterećenjem, nedelja
    testa, vrhunac, oštrenje i nedelja pred taperom (asOf nedelja → r = taper, bez povratka). */
export const PAIN_GRID: readonly { id: string; weeks: readonly [number, number] }[] = [
  { id: 'v45-d4-22km-14w', weeks: [3, 11] },
  { id: 'v38-d3-15km-10w', weeks: [2, 6] },
  { id: 'v45-d5-50km-7w', weeks: [2, 4] },
  { id: 'feel-d4-22km-12w', weeks: [3, 8] },
  { id: 'feel-d3-28km-8w', weeks: [2, 5] },
  { id: 'beg-res-d4-20km-10w', weeks: [4, 7] },
  { id: 'rw-16w-pocetnik-e420', weeks: [1, 4] }
];
export const PAIN_LEVELS = [4, 5, 7, 8] as const;

/** Činjenica bola: bol `level` na dan asOf (zapis bez trčanja). */
export const painFacts = (asOf: string, level: number): Record<string, unknown> => ({
  workouts: [{ date: asOf, km: 0, durationSec: 0, completed: false, pain: level }]
});

export interface PainBase {
  id: string;
  /** Plan koji se adaptira (kod trčanja/hodanja: plan posle prelaza). */
  plan: unknown;
  /** Kontinuirani plan čije se nedelje mere (kod trčanja/hodanja: continuous.plan). */
  cont: unknown;
  /** Nedelja celog plana = nedelja kontinuiranog + offset (trčanje/hodanje: fromWeek − 1). */
  offset: number;
}
export interface PainCase {
  key: string;
  id: string;
  week: number;
  asOf: string;
  level: number;
}

/** Bazni planovi mreže P; plan trčanje/hodanje prelazi u kontinuirani na kraju nedelje 8 (sve sesije RPE 5). */
export function painGridBases(api: AdaptApi): PainBase[] {
  return PAIN_GRID.map(({ id }) => {
    const rw = RW_NETWORK.find((x) => x.id === id);
    if (!rw) {
      const plan = planFrom(api, adaptNetwork().find((x) => x.id === id)!.input);
      return { id, plan, cont: plan, offset: 0 };
    }
    const p = planFrom(api, rw.input);
    const asOf = endOfWeek(8);
    const r = api.adapt(p, { workouts: sessionFacts(p, asOf), coverage: rwCov(asOf) }, asOf);
    const t = r as FlowResult;
    if (!t.ok || !t.plan.continuous) throw new Error(`${id}: nema prelaza`);
    const plan = JSON.parse(JSON.stringify(t.plan)) as FlowPlan;
    return { id, plan, cont: plan.continuous!.plan, offset: plan.continuous!.fromWeek - 1 };
  });
}

/** Tokovi mreže P za plan: 2 nedelje × 7 dana (asOf = taj dan, bol na dan asOf) × bol 4/5/7/8. */
export function painCases(b: PainBase): PainCase[] {
  const g = PAIN_GRID.find((x) => x.id === b.id)!;
  const weeks = (b.cont as FlowPlan).weeks;
  const out: PainCase[] = [];
  for (const week of g.weeks)
    for (let i = 0; i < 7; i++) {
      const asOf = addDays(weeks[week - 1]!.startDate, i);
      for (const level of PAIN_LEVELS)
        out.push({ key: `${b.id}/w${week}/${asOf}/p${level}`, id: b.id, week, asOf, level });
    }
  return out;
}

/* ---------- Segment 08e (5k-v2.7.0): rasterećenje posle smanjenja i rana adaptacija ---------- */

/** Pretraga organizatora (08e): pauza 10/20 (breaks do asOf), bol 5/8, pauza 10 + bol 5, manjak. */
export const RELIEF_NARROW = [
  'pause10',
  'pause20',
  'pain5',
  'pain8',
  'pause10pain5',
  'missed'
] as const;
/** Šira pretraga: + pauza 35 (nov start), višak, umor, rezultat brži/sporiji. */
export const RELIEF_WIDE = [
  ...RELIEF_NARROW,
  'pause35',
  'over',
  'fatigue',
  'faster',
  'slower'
] as const;
export type ReliefScenario = (typeof RELIEF_WIDE)[number];

export interface ReliefBase {
  id: string;
  /** Plan koji se adaptira (trčanje/hodanje: plan posle prelaza na kraju nedelje 8). */
  plan: unknown;
  /** Prva nedelja čiji kraj sme biti asOf (posle prethodne adaptacije). */
  firstWeek: number;
}
export interface ReliefCase {
  key: string;
  id: string;
  week: number;
  asOf: string;
  scenario: ReliefScenario;
  facts: Record<string, unknown>;
}

/** Bazni planovi: adaptNetwork (60) i, uz `runWalk`, rw-16w-pocetnik-e420 posle prelaza (kao mreža P). */
export function reliefBases(api: AdaptApi, runWalk = false): ReliefBase[] {
  const out: ReliefBase[] = adaptNetwork().map(({ id, input }) => ({
    id,
    plan: planFrom(api, input),
    firstWeek: 1
  }));
  if (runWalk) {
    const b = painGridBases(api).find((x) => x.id === 'rw-16w-pocetnik-e420')!;
    out.push({ id: b.id, plan: b.plan, firstWeek: 9 });
  }
  return out;
}

const breakFacts = (asOf: string, n: number) => [
  { kind: 'break', from: addDays(asOf, -(n - 1)), to: asOf }
];

/** Činjenice scenarija na dan asOf; null = scenario nema smisla za plan (npr. < 2 lagana dana za umor). */
export function reliefFacts(
  plan: unknown,
  scenario: ReliefScenario,
  asOf: string,
  raceTimeForVdot: (vdot: number, distM: number) => number
): Record<string, unknown> | null {
  const p = plan as FlowPlan & { planType?: string };
  const days = p.continuous ? flowDays(p.continuous.plan) : flowDays(p);
  const within = (d: FlowDay, from: string): boolean =>
    d.countsToWeek && d.date >= from && d.date <= asOf;
  const v = p.vdot ?? (p.experience === 'beginner' ? 33 : 40);
  const result = (dv: number) => [
    { distM: 3000, sec: raceTimeForVdot(v + dv, 3000), date: addDays(asOf, -1), kind: 'test' }
  ];
  switch (scenario) {
    case 'pause10':
      return { workouts: [], breaks: breakFacts(asOf, 10) };
    case 'pause20':
      return { workouts: [], breaks: breakFacts(asOf, 20) };
    case 'pause35':
      return { workouts: [], breaks: breakFacts(asOf, 35) };
    case 'pain5':
      return painFacts(asOf, 5);
    case 'pain8':
      return painFacts(asOf, 8);
    case 'pause10pain5':
      return { ...painFacts(asOf, 5), breaks: breakFacts(asOf, 10) };
    case 'missed':
      return {
        workouts: [{ date: addDays(asOf, -6), km: 3, durationSec: 1080, completed: true }],
        coverage: { from: addDays(asOf, -6), to: asOf, complete: true }
      };
    case 'over': {
      if (p.continuous) return null;
      const from = addDays(asOf, -13);
      return {
        workouts: days
          .filter((d) => within(d, from))
          .map((d) => ({
            date: d.date,
            dayId: d.date,
            km: Math.round(d.workout.km * 1.25 * 10) / 10,
            durationSec: Math.round(d.workout.sec * 1.25),
            completed: true
          })),
        coverage: { from, to: asOf, complete: true }
      };
    }
    case 'fatigue': {
      if (p.continuous) return null;
      const easy = days
        .filter((d) => within(d, addDays(asOf, -6)) && (d.role === 'easy' || d.role === 'long'))
        .slice(0, 2);
      if (easy.length < 2) return null;
      return {
        workouts: easy.map((d) => ({
          date: d.date,
          dayId: d.date,
          km: d.workout.km,
          durationSec: d.workout.sec,
          completed: true,
          rpe: 7
        }))
      };
    }
    case 'faster':
      return { workouts: [], results: result(2) };
    case 'slower':
      return { workouts: [], results: result(-2) };
  }
}

/** Tokovi baznog plana: asOf = kraj nedelje w i kraj − 3 (`narrow`) ili sreda i kraj nedelje (`wide`),
    w = firstWeek … N − 2, × scenariji. Ključ `plan/asOf/scenario`. */
export function reliefCases(
  b: ReliefBase,
  points: 'narrow' | 'wide',
  scenarios: readonly ReliefScenario[],
  raceTimeForVdot: (vdot: number, distM: number) => number
): ReliefCase[] {
  const n = (b.plan as FlowPlan).weeks.length;
  const out: ReliefCase[] = [];
  for (let week = b.firstWeek; week <= n - 2; week++)
    for (const back of points === 'narrow' ? [0, 3] : [4, 0]) {
      const asOf = addDays(endOfWeek(week), -back);
      for (const scenario of scenarios) {
        const facts = reliefFacts(b.plan, scenario, asOf, raceTimeForVdot);
        if (facts)
          out.push({ key: `${b.id}/${asOf}/${scenario}`, id: b.id, week, asOf, scenario, facts });
      }
    }
  return out;
}

interface CheckStep {
  fromWeek: number;
  firstWeek: number;
  startKm: number | null;
  restart: boolean;
  deload: boolean;
  reduced?: boolean;
  returnFrom?: { week: number } | null;
}
interface CheckWeek {
  index: number;
  phase: string;
  deload: boolean;
  test?: boolean;
  targetKm: number;
}
interface CheckPlan {
  experience: string;
  weeks: CheckWeek[];
  adaptation?: { steps: CheckStep[] };
  continuous?: { fromWeek: number; plan: CheckPlan } | null;
  planType?: string;
}
interface CheckResult {
  ok: boolean;
  plan?: CheckPlan;
  reasons: { condition?: string; applied?: boolean; code?: string; message: string }[];
  violations?: { rule: string; severity: string; week?: number }[];
}

export interface ReliefCheck {
  ok: boolean;
  /** Odbijanje: kod razloga i pravila grešaka validatora (jedinstvena, sortirana). */
  rejected: { code: string; rules: string[] } | null;
  /** Primenjeni uslovi poslednjeg koraka (reasons, applied). */
  applied: string[];
  /** Nedelje smanjenja (Odluka 9, iz uslova koraka — nezavisno od steps.ts): (a) pauza/manjak → fromWeek,
      (b) bol sa povratkom → returnFrom.week; nov start ne ulazi. Nedelje kontinuiranog plana. */
  reducedWeeks: number[];
  /** n + 1 je redovno rasterećenje (nije prinudno) u fazi izgradnje, niz od n + 1 ≤ granice (J1 kršenje). */
  p1: number[];
  /** n + 1 je redovno rasterećenje, ali bi niz od n + 1 bio > granice (zadržano). */
  keptByBound: number[];
  /** Ukinuta rasterećenja: n + 1 posle nedelje smanjenja, rasteretna u planu pre adaptacije (`before`), sada
      nedelja izgradnje — nedelja i niz izgradnje od nje do sledećeg rasterećenja ili kraja izgradnje (J2). */
  dropped: { week: number; run: number }[];
  /** Granica niza (Odluka 9) za trkača plana. */
  limit: number;
  /** Nedelje iz rečenice „Redovno rasterećenje u nedelji {w} otpada …" u razlozima koraka. */
  noted: number[];
  /** Polje reduced poslednjeg koraka (undefined = nema polja) i očekivano po uslovu. */
  reduced: { got: boolean | undefined; want: boolean | undefined } | null;
  /** Nedelja kontrolnog trčanja (null = nema). */
  testWeek: number | null;
}

const isBuildPhase = (p: string): boolean => p === 'base' || p === 'peak' || p === 'sharpen';

/** Ocena toka (J1–J2 i polje reduced) iz rezultata adaptacije; `bound(beginner)` = granica niza. */
export function reliefCheck(
  r: unknown,
  bound: (beginner: boolean) => number,
  before: unknown
): ReliefCheck {
  const res = r as CheckResult;
  if (!res.ok) {
    const rules = [
      ...new Set((res.violations ?? []).filter((v) => v.severity === 'error').map((v) => v.rule))
    ].sort();
    return {
      ok: false,
      rejected: { code: res.reasons[0]?.code ?? '?', rules },
      applied: [],
      reducedWeeks: [],
      p1: [],
      keptByBound: [],
      dropped: [],
      limit: 0,
      noted: [],
      reduced: null,
      testWeek: null
    };
  }
  const top = res.plan!;
  const plan = top.continuous ? top.continuous.plan : top;
  const steps = plan.adaptation?.steps ?? [];
  const step = steps[steps.length - 1]!;
  const applied = res.reasons.filter((x) => x.applied).map((x) => x.condition!);
  const reducedWeeks: number[] = [];
  if (!step.restart) {
    if (applied.includes('PAUSE') || applied.includes('UNDER_EXECUTION'))
      reducedWeeks.push(step.fromWeek);
    const rf = step.returnFrom;
    if (rf && !reducedWeeks.includes(rf.week)) reducedWeeks.push(rf.week);
  }
  const weeks = plan.weeks;
  const forced = (i: number): boolean => steps.some((s) => s.deload && s.fromWeek === i);
  const limit = bound(plan.experience === 'beginner');
  const p1: number[] = [];
  const keptByBound: number[] = [];
  const dropped: { week: number; run: number }[] = [];
  const b0 = before as CheckPlan;
  const was = (b0.continuous ? b0.continuous.plan : b0).weeks;
  for (const n of reducedWeeks) {
    const next = weeks[n];
    if (!next || !isBuildPhase(next.phase)) continue;
    let k = n + 1;
    while (k < weeks.length && isBuildPhase(weeks[k]!.phase) && !weeks[k]!.deload) k++;
    const run = k - n;
    if (next.deload && !forced(next.index)) (run <= limit ? p1 : keptByBound).push(next.index);
    else if (!next.deload && was[n]?.deload) dropped.push({ week: next.index, run });
  }
  const pauseOrUnder = applied.includes('PAUSE') || applied.includes('UNDER_EXECUTION');
  const want = pauseOrUnder ? true : applied.includes('OVER_EXECUTION') ? false : undefined;
  return {
    ok: true,
    rejected: null,
    applied,
    reducedWeeks,
    p1,
    keptByBound,
    dropped,
    limit,
    noted: res.reasons.flatMap((x) =>
      [...x.message.matchAll(/Redovno rasterećenje u nedelji (\d+) otpada/g)].map((m) =>
        Number(m[1])
      )
    ),
    reduced: { got: step.reduced, want },
    testWeek: weeks.find((w) => w.test)?.index ?? null
  };
}

/** JSON rezultata bez oznake verzije i bez polja reduced (heš regresije 08e). */
export const canonResult08e = (r: unknown): string =>
  JSON.stringify(r, (k, v: unknown) =>
    k === 'policyVersion' ? '-' : k === 'reduced' ? undefined : v
  );

/* ---------- Segment 08g (5k-v2.8.0, pouka 23/29/30): trajna rana mreža (kopija Faza 4a early.ts, lib.ts grid5k /
   facts5k / commonChecks — ne uvozi se iz docs/, Uslov 7) ---------- */

/** Svih 17 scenarija Faze 4a ('chain' + drugi korak asOf + 7). */
export const EARLY_SCENARIOS = [
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
export type EarlyScenario = (typeof EARLY_SCENARIOS)[number];

export interface EarlyBase {
  id: string;
  family: 'R' | 'F' | 'B';
  input: Record<string, unknown>;
}

const D5K: Record<3 | 4 | 5, Weekday[][]> = {
  3: [
    ['tue', 'thu', 'sun'],
    ['mon', 'wed', 'sat']
  ],
  4: [
    ['tue', 'thu', 'sat', 'sun'],
    ['mon', 'wed', 'fri', 'sun']
  ],
  5: [
    ['mon', 'tue', 'thu', 'sat', 'sun'],
    ['mon', 'wed', 'thu', 'fri', 'sun']
  ]
};
const KM5K: Record<3 | 4 | 5, number[]> = {
  3: [12, 16, 20, 25, 30],
  4: [15, 20, 25, 30, 35, 40],
  5: [25, 30, 40, 50, 60]
};

/** Mreža ulaza Faze 4a (lib.ts grid5k): 6–16 ned × 3/4/5 dana × obim × 2 rasporeda; R (VDOT 32–58), F (po
    osećaju E 300–480 s), B (početnik ≤ 4 dana, ≤ 30 km, ≥ 8 ned). 3816 ulaza. */
export function earlyGridInputs(): EarlyBase[] {
  const out: EarlyBase[] = [];
  const raceOf = (w: number): string => addDays(START, w * 7 - 1);
  const res = (vdot: number) => ({
    distanceM: 5000,
    timeSec: Math.round(raceTimeForVdot(vdot, 5000)),
    date: addDays(START, -14)
  });
  for (const weeks of [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
    for (const d of [3, 4, 5] as const)
      for (const km of KM5K[d])
        for (const [si, days] of D5K[d].entries()) {
          const base = {
            startDate: START,
            raceDate: raceOf(weeks),
            runDays: days,
            currentWeeklyKm: km
          };
          for (const v of [32, 38, 45, 52, 58])
            out.push({
              id: `r-d${d}-${weeks}w-${km}km-v${v}-${si}`,
              family: 'R',
              input: { ...base, recentResult: res(v), goalTimeSec: null }
            });
          for (const e of [300, 360, 420, 480])
            out.push({
              id: `f-d${d}-${weeks}w-${km}km-e${e}-${si}`,
              family: 'F',
              input: { ...base, typicalEasyPaceSecPerKm: e, goalTimeSec: null }
            });
          if (d <= 4 && km <= 30 && weeks >= 8)
            for (const b of [{ e: 420 }, { e: 480 }, { v: 32 }, { v: 36 }])
              out.push({
                id: `b-d${d}-${weeks}w-${km}km-${'e' in b ? `e${b.e}` : `v${b.v}`}-${si}`,
                family: 'B',
                input: {
                  ...base,
                  experience: 'beginner',
                  canRun30Min: true,
                  ...('e' in b ? { typicalEasyPaceSecPerKm: b.e } : { recentResult: res(b.v) }),
                  goalTimeSec: null
                }
              });
        }
  return out;
}

/** Uzorak trajne mreže = uzorak Faze 4a (early.ts 5K 29 19 11): svaki k-ti ulaz porodice od pomaka ⌊k/2⌋. */
export const EARLY_STEP = { R: 29, F: 19, B: 11 } as const;
export function earlyGridBases(): EarlyBase[] {
  const all = earlyGridInputs();
  return (['R', 'F', 'B'] as const).flatMap((fam) => {
    const k = EARLY_STEP[fam];
    return all.filter((b) => b.family === fam).filter((_, i) => i % k === Math.floor(k / 2));
  });
}

interface EarlyDay {
  date: string;
  role: string;
  countsToWeek: boolean;
  workout: { km: number; sec: number };
}
export interface EarlyPlan {
  input: { startDate: string; raceDate: string; runDays: Weekday[]; currentWeeklyKm: number };
  vdot: number | null;
  weeks: {
    index: number;
    phase: string;
    startDate: string;
    endDate: string;
    plannedKm: number;
    days: EarlyDay[];
  }[];
}

/** asOf: start − 1/− 3/− 6, sreda i kraj svake nedelje 1 … N − 2. */
export function earlyAsOfs(plan: EarlyPlan): { tag: string; asOf: string }[] {
  const out = [1, 3, 6].map((k) => ({ tag: `pre${k}`, asOf: addDays(plan.input.startDate, -k) }));
  for (let i = 1; i <= plan.weeks.length - 2; i++) {
    const w = plan.weeks[i - 1]!;
    let wed = w.startDate;
    while (weekdayOf(wed) !== 'wed') wed = addDays(wed, 1);
    out.push({ tag: `w${i}wed`, asOf: wed }, { tag: `w${i}end`, asOf: w.endDate });
  }
  return out;
}

function earlyRuns(
  plan: EarlyPlan,
  from: string,
  to: string,
  share = 1
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const byDate = new Map(plan.weeks.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const pd = byDate.get(d);
    if (pd && pd.countsToWeek)
      out.push({
        date: d,
        dayId: d,
        km: Math.round(pd.workout.km * share * 100) / 100,
        durationSec: Math.round(pd.workout.sec * share),
        completed: true,
        rpe: 5
      });
    else if (!pd && d < plan.input.startDate && plan.input.runDays.includes(weekdayOf(d)))
      out.push({
        date: d,
        km: Math.round((plan.input.currentWeeklyKm / plan.input.runDays.length) * share * 10) / 10,
        durationSec: 2400,
        completed: true,
        rpe: 5
      });
  }
  return out;
}

/** Činjenice scenarija (lib.facts5k, kopija). */
export function earlyFacts(
  plan: EarlyPlan,
  s: EarlyScenario,
  asOf: string
): Record<string, unknown> {
  const back = (n: number): string => addDays(asOf, -n);
  const cov = (from: string, complete = true) => ({ from, to: asOf, complete });
  const v = plan.vdot ?? 38;
  const result = (vdot: number, kind: 'race' | 'test') => ({
    distM: 5000,
    sec: Math.round(raceTimeForVdot(vdot, 5000)),
    date: asOf,
    kind
  });
  const painAt = (level: number) => ({
    workouts: [{ date: asOf, km: 0, durationSec: 0, completed: false, pain: level }]
  });
  switch (s) {
    case 'none':
      return {};
    case 'done100':
      return { workouts: earlyRuns(plan, back(13), asOf), coverage: cov(back(13)) };
    case 'under50':
      return {
        workouts: [...earlyRuns(plan, back(13), back(7)), ...earlyRuns(plan, back(6), asOf, 0.5)],
        coverage: cov(back(13))
      };
    case 'over120':
      return { workouts: earlyRuns(plan, back(13), asOf, 1.2), coverage: cov(back(13)) };
    case 'pause10':
    case 'chain':
      return { workouts: earlyRuns(plan, back(23), back(10)), coverage: cov(back(23)) };
    case 'pause20':
      return { breaks: [{ kind: 'break', from: back(19), to: asOf }] };
    case 'pause35':
      return { workouts: earlyRuns(plan, back(48), back(35)), coverage: cov(back(48)) };
    case 'pain5':
      return painAt(5);
    case 'pain8':
      return painAt(8);
    case 'fatigue':
      return {
        workouts: [
          { date: back(1), km: 6, durationSec: 2400, completed: true, rpe: 8 },
          { date: back(3), km: 6, durationSec: 2400, completed: true, rpe: 7 }
        ]
      };
    case 'faster':
      return { results: [result(Math.round((v + 2) * 10) / 10, 'race')] };
    case 'slower':
      return { results: [result(Math.round((v - 2) * 10) / 10, 'race')] };
    case 'test5k':
      return { results: [result(v + 1, 'test')] };
    case 'incomplete':
      return { coverage: cov(back(13), false) };
    case 'locked': {
      const future = plan.weeks
        .flatMap((w) => w.days)
        .filter((d) => d.date > asOf && d.role !== 'race')
        .slice(0, 3)
        .map((d) => d.date);
      return { workouts: earlyRuns(plan, back(1), asOf), lockedDayIds: future };
    }
    case 'painPause':
      return {
        workouts: [
          ...earlyRuns(plan, back(33), back(20)),
          { date: asOf, km: 0, durationSec: 0, completed: false, pain: 6 }
        ],
        coverage: cov(back(33))
      };
  }
}

/** Drugi korak lanca (asOf + 7): pola plana poslednjih 7 dana, pokrivenost potpuna (lib.chain2Generic). */
export const earlyChain2 = (plan: EarlyPlan, at2: string): Record<string, unknown> => ({
  workouts: earlyRuns(plan, addDays(at2, -6), at2, 0.5),
  coverage: { from: addDays(at2, -6), to: at2, complete: true }
});

/** Nezavisne provere toka (lib.commonChecks, kopija): prošlost bajt-ista (dani ≤ asOf, urađeni, zaključani),
    prazan trening, dugi ≥ lagan (budući dani), trkačka (bez trke) ≤ planirano poslednje nedelje tapera. */
export function earlyChecks(
  before: EarlyPlan,
  after: EarlyPlan,
  asOf: string,
  facts: Record<string, unknown>
): string[] {
  const bad: string[] = [];
  const S = JSON.stringify;
  const done = new Set(
    (
      (facts['workouts'] as { completed: boolean; dayId?: string; date: string }[] | undefined) ??
      []
    )
      .filter((x) => x.completed)
      .map((x) => x.dayId ?? x.date)
  );
  const locked = new Set((facts['lockedDayIds'] as string[] | undefined) ?? []);
  const aDays = new Map(after.weeks.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
  for (const w of before.weeks)
    for (const d of w.days)
      if (d.date <= asOf || done.has(d.date) || locked.has(d.date))
        if (S(aDays.get(d.date)) !== S(d)) bad.push(`PROSLOST ${d.date}`);
  for (const w of after.weeks) {
    const fut = w.days.filter((d) => d.date > asOf);
    for (const d of fut)
      if (d.role !== 'race' && (!(d.workout.km > 0) || !(d.workout.sec > 0)))
        bad.push(`PRAZAN_TRENING ${d.date}`);
    const long = fut.find((d) => d.role === 'long');
    if (long)
      for (const d of fut)
        if (d.role === 'easy' && d.workout.km > long.workout.km + 1e-6)
          bad.push(`DUGI<LAGAN ${d.date}`);
  }
  const race = after.weeks[after.weeks.length - 1]!;
  const tapers = after.weeks.filter((w) => w.phase === 'taper');
  const taper = tapers[tapers.length - 1];
  if (taper) {
    const raceKm = race.days.filter((d) => d.countsToWeek).reduce((a, d) => a + d.workout.km, 0);
    if (raceKm > taper.plannedKm + 0.05 && race.days.some((d) => d.date > asOf))
      bad.push(`TRKACKA>TAPER ${raceKm.toFixed(2)} > ${taper.plannedKm}`);
  }
  return bad;
}

/** 08g: zašto se tok menja prema starijim heš fixture-ima (nezavisno od toka konstrukcije) — 'N3': trkačka nedelja
    skraćena po pouci 30 (raceRest u rezultatu); 'F': umor vezan za zapise (pouka 36) — rasterećenje tih zapisa je
    već u planu, novo se ne pravi (razlog FATIGUE to kaže), ili rasterećenje ostatka tekuće nedelje (deloadWeek); 'N4': konstruktor sa upisanim danima (prior, pouka 29)
    daje drugačiji plan nego bez njih; 'P' (08h, pouka 35): drugi dan kvaliteta lagan u rezultatu ili u prethodnom planu (hasSecondEasy); 'M' (08i, pouka 37): mešovita nedelja skraćena na ostatak do cilja u rezultatu ili u prethodnom planu (hasMixedRemainder); null: ništa od toga (tok mora ostati bajt-isti). Plan trčanje/hodanje: null. */
export function family08g(
  plan: unknown,
  facts: unknown,
  asOf: string,
  res: unknown
): 'N3' | 'N4' | 'F' | 'P' | 'M' | null {
  const r = res as {
    ok: boolean;
    plan?: FiveKV2Plan;
    reasons?: { condition?: string; message: string }[];
  };
  const p = plan as FiveKV2Plan;
  if ((p as { planType?: string }).planType === 'runWalk') return null;
  if (r.ok && (r.plan!.weeks[r.plan!.weeks.length - 1]!.raceRest?.length ?? 0) > 0) return 'N3';
  if (r.ok && (hasMixedRemainder(res) || hasMixedRemainder(p))) return 'M';
  if (
    r.ok &&
    ((r.reasons ?? []).some(
      (x) =>
        x.condition === 'FATIGUE' && x.message.includes('rasterećenje za ove zapise je već u planu')
    ) ||
      r.plan!.adaptation?.steps[r.plan!.adaptation.steps.length - 1]?.deloadWeek !== undefined)
  )
    return 'F';
  if (r.ok && (hasSecondEasy(res) || hasSecondEasy(p))) return 'P';
  const ids = new Set(p.weeks.flatMap((w) => w.days.map((d) => d.date)));
  const cf = checkFacts(facts, asOf, ids);
  if (!cf.ok) return null;
  const as = assess(p, cf.facts, asOf);
  if (!as.ok) return null;
  const steps = [...(p.adaptation?.steps ?? []), as.step];
  const t = mustDay(asOf);
  const done = new Set(cf.facts.workouts.filter((x) => x.completed).map((x) => x.dayId ?? x.date));
  const locked = new Set(cf.facts.lockedDayIds);
  const keep = (d: PlanDay): boolean =>
    mustDay(d.date) <= t || done.has(d.date) || locked.has(d.date);
  const a = construct(p.input, steps, { weeks: p.weeks, keep, asOf: t, at: asOf });
  const b = construct(p.input, steps);
  return JSON.stringify(a) !== JSON.stringify(b) ? 'N4' : null;
}

export interface EarlyFlow {
  key: string;
  plan: FiveKV2Plan;
  facts: Record<string, unknown>;
  asOf: string;
  res: AdaptResult;
}

/** Tokovi trajne rane mreže jednog plana (asOf × scenario; drugi korak lanca odmah posle prvog; 2.8.0, pouka 36:
    posle umora isti zapisi ponovo asOf + 1 … + 7 — ključ „…/fatigue/+k"). `api` = tekuće stablo ili polazni SHA. */
export function earlyFlows(
  id: string,
  input: Record<string, unknown>,
  api: AdaptApi = { generate: generateFiveKV2, adapt: adaptFiveKV2 }
): EarlyFlow[] {
  const g = api.generate(input) as { ok: boolean; plan: FiveKV2Plan };
  if (!g.ok) throw new Error(`generate ${id}`);
  const p = g.plan;
  const ep = p as unknown as EarlyPlan;
  const out: EarlyFlow[] = [];
  const run = (plan: FiveKV2Plan, facts: Record<string, unknown>, asOf: string): AdaptResult =>
    api.adapt(plan, facts, asOf) as AdaptResult;
  for (const { tag, asOf } of earlyAsOfs(ep))
    for (const s of EARLY_SCENARIOS) {
      const key = `${id}/${tag}/${s}`;
      const facts = earlyFacts(ep, s, asOf);
      const res = run(p, facts, asOf);
      out.push({ key, plan: p, facts, asOf, res });
      if (s === 'chain' && res.ok) {
        const at2 = addDays(asOf, 7);
        if (at2 < p.input.raceDate) {
          const f2 = earlyChain2(ep, at2);
          out.push({
            key: `${key}/2`,
            plan: res.plan,
            facts: f2,
            asOf: at2,
            res: run(res.plan, f2, at2)
          });
        }
      }
      if (s === 'fatigue' && res.ok)
        for (let k = 1; k <= 7; k++) {
          const at = addDays(asOf, k);
          if (at >= p.input.raceDate) break;
          out.push({
            key: `${key}/+${k}`,
            plan: res.plan,
            facts,
            asOf: at,
            res: run(res.plan, facts, at)
          });
        }
    }
  return out;
}

/** 08h (5k-v2.8.1, pouka 35): rezultat (plan ili plan adaptacije; i kontinuirani deo plana trčanje/hodanje) ima
    nedelju izgradnje u kojoj je drugi dan kvaliteta lagan — oznaka week.SECOND_EASY_NOTE. */
export function hasSecondEasy(res: unknown): boolean {
  const r = res as { ok?: boolean; plan?: unknown };
  const plan = (r.ok === undefined ? res : r.ok ? r.plan : null) as {
    weeks?: { notes: string[] }[];
    continuous?: { plan: unknown } | null;
  } | null;
  if (!plan) return false;
  if (plan.weeks?.some((w) => w.notes.some((n) => n.includes('(pouka 35)')))) return true;
  return plan.continuous ? hasSecondEasy(plan.continuous.plan) : false;
}

/** 08i (5k-v2.10.0, pouka 37): rezultat (plan ili plan adaptacije; i kontinuirani deo plana trčanje/hodanje) ima
    mešovitu nedelju čiji su preostali dani sastavljeni na ostatak do cilja — oznaka week.MIXED_NOTE; 2.10.1: ili nedelju
    sa zbirom zaštićenih dana po činjenicama (PlanWeek.protectedKm). */
export function hasMixedRemainder(res: unknown): boolean {
  const r = res as { ok?: boolean; plan?: unknown };
  const plan = (r.ok === undefined ? res : r.ok ? r.plan : null) as {
    weeks?: { notes: string[] }[];
    continuous?: { plan: unknown } | null;
  } | null;
  if (!plan) return false;
  if (
    plan.weeks?.some(
      (w) =>
        w.notes.some((n) => n.includes('(pouka 37)')) ||
        (w as { protectedKm?: number }).protectedKm !== undefined
    )
  )
    return true;
  return plan.continuous ? hasMixedRemainder(plan.continuous.plan) : false;
}
