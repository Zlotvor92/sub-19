/* Zajednički ulazi za testove 5K v2 (nije testni fajl, da bi ga izolacioni test video kao deo v2). */

import { addDays } from './dates.ts';
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
