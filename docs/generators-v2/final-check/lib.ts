/* Faza 4a — zajednički kod mernih skripti (SAMO ČITANJE: uvozi v2 foldere distanci, ništa ne menja).
   Po distanci: generator, adaptacija, nezavisne invarijante distance (gde postoje), ulazi mreža i trajne mreže
   rane adaptacije (da bi uzorak bio različit od njih), činjenice 17 scenarija mreže 04 (+ drugi korak lanca).
   5K nema helper scenarija mreže 04 — `facts5k` je ekvivalent HM/10K `factsOf` (isti oblik činjenica, AdaptFacts). */

import { adaptFiveKV2 } from "../../../web/src/domain/generators/fiveK/v2/adapt.ts";
import { generateFiveKV2 } from "../../../web/src/domain/generators/fiveK/v2/generate.ts";
import { raceTimeForVdot as rt5 } from "../../../web/src/domain/generators/fiveK/v2/paces.ts";
import { START as START5 } from "../../../web/src/domain/generators/fiveK/v2/testInputs.ts";
import { adaptNetwork } from "../../../web/src/domain/generators/fiveK/v2/testInputs.ts";

import { adaptTenKV2 } from "../../../web/src/domain/generators/tenK/v2/adapt.ts";
import { generateTenKV2 } from "../../../web/src/domain/generators/tenK/v2/generate.ts";
import { adaptInvariants as inv10 } from "../../../web/src/domain/generators/tenK/v2/adaptInvariants.ts";
import * as T10 from "../../../web/src/domain/generators/tenK/v2/testInputs.ts";

import { adaptHmV2 } from "../../../web/src/domain/generators/halfMarathon/v2/adapt.ts";
import { generateHmV2 } from "../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import { adaptInvariants as invHm } from "../../../web/src/domain/generators/halfMarathon/v2/adaptInvariants.ts";
import * as AHM from "../../../web/src/domain/generators/halfMarathon/v2/adaptInputs.ts";
import * as THM from "../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

import { adaptMarathonV2 } from "../../../web/src/domain/generators/marathon/v2/adapt.ts";
import { generateMarathonV2 } from "../../../web/src/domain/generators/marathon/v2/generate.ts";
import { adaptInvariants as invMar } from "../../../web/src/domain/generators/marathon/v2/adaptInvariants.ts";
import * as TM from "../../../web/src/domain/generators/marathon/v2/testInputs.ts";

/* ---------- datumi (lokalno, bez uvoza) ---------- */
const DAY = 86_400_000;
export const addDays = (d: string, n: number): string =>
  new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const weekdayOf = (d: string): string => WD[new Date(d + "T00:00:00Z").getUTCDay()]!;
export const wedOf = (startDate: string): string => {
  let d = startDate;
  while (weekdayOf(d) !== "wed") d = addDays(d, 1);
  return d;
};

/* ---------- strukturni tipovi plana ---------- */
export interface Day {
  date: string;
  role: string;
  hard?: boolean;
  countsToWeek: boolean;
  workout: { km: number; sec: number; kind: string; title: string; qualityType?: string | null };
}
export interface Week {
  index: number;
  phase: string;
  deload: boolean;
  test?: boolean;
  startDate: string;
  endDate: string;
  targetKm: number;
  plannedKm: number;
  days: Day[];
  notes: string[];
}
export interface Plan {
  input: Record<string, unknown> & {
    startDate: string;
    raceDate: string;
    runDays: string[];
    currentWeeklyKm: number;
  };
  vdot: number | null;
  weeks: Week[];
  warnings: { code: string; message: string }[];
  planType?: string;
  [k: string]: unknown;
}
export type Res =
  | { ok: true; plan: Plan }
  | { ok: false; reasons: { code: string; message: string }[] };
export interface Base {
  id: string;
  family: string;
  input: Record<string, unknown>;
}

export interface Dist {
  name: "5K" | "10K" | "HM" | "MAR";
  generate: (input: unknown) => Res;
  adapt: (plan: unknown, facts: unknown, asOf: string) => Res;
  /** Nezavisne invarijante distance (test kod distance); 5K: nema (samo zajedničke provere). */
  inv: ((before: Plan, after: Plan, asOf: string, facts: unknown) => string[]) | null;
  facts: (plan: Plan, s: Scenario, asOf: string) => Record<string, unknown>;
  chain2: (plan: Plan, asOf2: string) => Record<string, unknown>;
  /** Svi ulazi mreža generatora (porodica R/F/B). */
  all: () => Base[];
  /** Ključevi (JSON ulaza) planova trajnih mreža rane/široke adaptacije — uzorak ih izbegava. */
  permanent: () => Set<string>;
}

export const SCENARIOS = [
  "none",
  "done100",
  "under50",
  "over120",
  "pause10",
  "pause20",
  "pause35",
  "pain5",
  "pain8",
  "fatigue",
  "faster",
  "slower",
  "test5k",
  "incomplete",
  "locked",
  "chain",
  "painPause",
] as const;
export type Scenario = (typeof SCENARIOS)[number];

/* ---------- 5K: ekvivalent factsOf (kopija HM adaptInputs.factsOf; rezultat 5 km iz 5K paces) ---------- */
function runsIn(plan: Plan, from: string, to: string, share = 1): Record<string, unknown>[] {
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
        rpe: 5,
      });
    else if (!pd && d < plan.input.startDate && plan.input.runDays.includes(weekdayOf(d)))
      out.push({
        date: d,
        km: Math.round((plan.input.currentWeeklyKm / plan.input.runDays.length) * share * 10) / 10,
        durationSec: 2400,
        completed: true,
        rpe: 5,
      });
  }
  return out;
}
const pain = (asOf: string, level: number) => ({
  workouts: [{ date: asOf, km: 0, durationSec: 0, completed: false, pain: level }],
});
export function facts5k(plan: Plan, s: Scenario, asOf: string): Record<string, unknown> {
  const back = (n: number): string => addDays(asOf, -n);
  const cov = (from: string, complete = true) => ({ from, to: asOf, complete });
  const v = plan.vdot ?? 38;
  const result = (vdot: number, kind: "race" | "test") => ({
    distM: 5000,
    sec: Math.round(rt5(vdot, 5000)),
    date: asOf,
    kind,
  });
  switch (s) {
    case "none":
      return {};
    case "done100":
      return { workouts: runsIn(plan, back(13), asOf), coverage: cov(back(13)) };
    case "under50":
      return {
        workouts: [...runsIn(plan, back(13), back(7)), ...runsIn(plan, back(6), asOf, 0.5)],
        coverage: cov(back(13)),
      };
    case "over120":
      return { workouts: runsIn(plan, back(13), asOf, 1.2), coverage: cov(back(13)) };
    case "pause10":
    case "chain":
      return { workouts: runsIn(plan, back(23), back(10)), coverage: cov(back(23)) };
    case "pause20":
      return { breaks: [{ kind: "break", from: back(19), to: asOf }] };
    case "pause35":
      return { workouts: runsIn(plan, back(48), back(35)), coverage: cov(back(48)) };
    case "pain5":
      return pain(asOf, 5);
    case "pain8":
      return pain(asOf, 8);
    case "fatigue":
      return {
        workouts: [
          { date: back(1), km: 6, durationSec: 2400, completed: true, rpe: 8 },
          { date: back(3), km: 6, durationSec: 2400, completed: true, rpe: 7 },
        ],
      };
    case "faster":
      return { results: [result(Math.round((v + 2) * 10) / 10, "race")] };
    case "slower":
      return { results: [result(Math.round((v - 2) * 10) / 10, "race")] };
    case "test5k":
      return { results: [{ ...result(v + 1, "test") }] };
    case "incomplete":
      return { coverage: cov(back(13), false) };
    case "locked": {
      const future = plan.weeks
        .flatMap((w) => w.days)
        .filter((d) => d.date > asOf && d.role !== "race")
        .slice(0, 3)
        .map((d) => d.date);
      return { workouts: runsIn(plan, back(1), asOf), lockedDayIds: future };
    }
    case "painPause":
      return {
        workouts: [
          ...runsIn(plan, back(33), back(20)),
          { date: asOf, km: 0, durationSec: 0, completed: false, pain: 6 },
        ],
        coverage: cov(back(33)),
      };
  }
}
const chain2Generic = (plan: Plan, a2: string): Record<string, unknown> => ({
  workouts: runsIn(plan, addDays(a2, -6), a2, 0.5),
  coverage: { from: addDays(a2, -6), to: a2, complete: true },
});

/* ---------- 5K: mreža ulaza (5K nema veliku mrežu generatora u testInputs) ---------- */
const D5K: Record<3 | 4 | 5, string[][]> = {
  3: [["tue", "thu", "sun"], ["mon", "wed", "sat"]],
  4: [["tue", "thu", "sat", "sun"], ["mon", "wed", "fri", "sun"]],
  5: [["mon", "tue", "thu", "sat", "sun"], ["mon", "wed", "thu", "fri", "sun"]],
};
const KM5K: Record<3 | 4 | 5, number[]> = { 3: [12, 16, 20, 25, 30], 4: [15, 20, 25, 30, 35, 40], 5: [25, 30, 40, 50, 60] };
function grid5k(): Base[] {
  const out: Base[] = [];
  const race = (w: number) => addDays(START5, w * 7 - 1);
  const res = (vdot: number) => ({
    distanceM: 5000,
    timeSec: Math.round(rt5(vdot, 5000)),
    date: addDays(START5, -14),
  });
  for (const weeks of [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])
    for (const d of [3, 4, 5] as const)
      for (const km of KM5K[d])
        for (const [si, days] of D5K[d].entries()) {
          for (const v of [32, 38, 45, 52, 58])
            out.push({
              id: `r-d${d}-${weeks}w-${km}km-v${v}-${si}`,
              family: "R",
              input: { startDate: START5, raceDate: race(weeks), runDays: days, currentWeeklyKm: km, recentResult: res(v), goalTimeSec: null },
            });
          for (const e of [300, 360, 420, 480])
            out.push({
              id: `f-d${d}-${weeks}w-${km}km-e${e}-${si}`,
              family: "F",
              input: { startDate: START5, raceDate: race(weeks), runDays: days, currentWeeklyKm: km, typicalEasyPaceSecPerKm: e, goalTimeSec: null },
            });
          if (d <= 4 && km <= 30 && weeks >= 8)
            for (const b of [{ e: 420 }, { e: 480 }, { v: 32 }, { v: 36 }])
              out.push({
                id: `b-d${d}-${weeks}w-${km}km-${"e" in b ? "e" + b.e : "v" + b.v}-${si}`,
                family: "B",
                input: {
                  startDate: START5,
                  raceDate: race(weeks),
                  runDays: days,
                  currentWeeklyKm: km,
                  experience: "beginner",
                  canRun30Min: true,
                  ...("e" in b ? { typicalEasyPaceSecPerKm: b.e } : { recentResult: res(b.v!) }),
                  goalTimeSec: null,
                },
              });
        }
  return out;
}

const key = (input: unknown): string => JSON.stringify(input);
const every = <X>(xs: readonly X[], k: number, off = 0): X[] => xs.filter((_, i) => i % k === off);

export const DISTS: Dist[] = [
  {
    name: "5K",
    generate: (i) => generateFiveKV2(i) as unknown as Res,
    adapt: (p, f, a) => adaptFiveKV2(p as never, f, a) as unknown as Res,
    inv: null,
    facts: facts5k,
    chain2: chain2Generic,
    all: grid5k,
    permanent: () => new Set(adaptNetwork().map((x) => key(x.input))),
  },
  {
    name: "10K",
    generate: (i) => generateTenKV2(i) as unknown as Res,
    adapt: (p, f, a) => adaptTenKV2(p, f, a) as unknown as Res,
    inv: (b, a, at, f) => inv10(b as never, a as never, at, f as never),
    facts: (p, s, a) => T10.factsOf(p as never, s, a),
    chain2: chain2Generic,
    all: () => [
      ...([3, 4, 5, 6] as const).flatMap((d) => T10.grid02Inputs(d)).map((c) => ({ id: c.id, family: "R", input: c.input })),
      ...([3, 4, 5, 6] as const).flatMap((d) => T10.feelGridInputs(d)).map((c) => ({ id: c.id, family: "F", input: c.input })),
      ...([3, 4] as const).flatMap((d) => T10.beginnerGridInputs(d)).map((c) => ({ id: c.id, family: "B", input: c.input })),
    ],
    permanent: () => new Set([...T10.earlyGridBases(), ...T10.adaptBases()].map((b) => key(b.input))),
  },
  {
    name: "HM",
    generate: (i) => generateHmV2(i) as unknown as Res,
    adapt: (p, f, a) => adaptHmV2(p, f, a) as unknown as Res,
    inv: (b, a, at, f) => invHm(b as never, a as never, at, f as never),
    facts: (p, s, a) => AHM.factsOf(p as never, s, a),
    chain2: (p, a2) => AHM.chainSecond(p as never, a2),
    all: () => [
      ...THM.grid02Inputs().map((c) => ({ id: c.id, family: "R", input: c.input })),
      ...THM.feelInputs().map((c) => ({ id: c.id, family: "F", input: c.input })),
      ...THM.beginnerInputs().map((c) => ({ id: c.id, family: "B", input: c.input })),
    ],
    // Trajna rana mreža (earlyBases 400/80/40) + mreža 04 + široka pretraga HM-04 (150/60/25).
    permanent: () => {
      const s = new Set([...AHM.earlyBases({ r: 400, f: 80, b: 40 }), ...AHM.adaptBases()].map((b) => key(b.input)));
      for (const b of AHM.earlyBases({ r: 150, f: 60, b: 25 })) s.add(key(b.input));
      return s;
    },
  },
  {
    name: "MAR",
    generate: (i) => generateMarathonV2(i) as unknown as Res,
    adapt: (p, f, a) => adaptMarathonV2(p, f, a) as unknown as Res,
    inv: (b, a, at, f) => invMar(b as never, a as never, at, f as never),
    facts: (p, s, a) => TM.factsOf(p as never, s, a),
    chain2: (p, a2) => TM.chainFacts(p as never, a2),
    all: () => [
      ...TM.gridInputs().map((c) => ({ id: c.id, family: "R", input: c.input })),
      ...TM.feelInputs().map((c) => ({ id: c.id, family: "F", input: c.input })),
      ...TM.beginnerInputs().map((c) => ({ id: c.id, family: "B", input: c.input })),
    ],
    // Trajna rana mreža (91/39/21) + mreža 04 + široka pretraga MAR-04b (211/97/47).
    permanent: () => {
      const s = new Set([...TM.earlyGridBases(), ...TM.adaptBases()].map((b) => key(b.input)));
      for (const b of TM.earlyGridBases(211, 97, 47)) s.add(key(b.input));
      return s;
    },
  },
];
export const distOf = (n: string): Dist => DISTS.find((d) => d.name === n)!;

/** Uzorak: svaki k-ti plan porodice od pomaka `off` (k/2), bez planova trajnih mreža. */
export function sampleBases(d: Dist, k: Record<string, number>): { bases: Base[]; excluded: number } {
  const perm = d.permanent();
  const all = d.all();
  let excluded = 0;
  const out: Base[] = [];
  for (const fam of ["R", "F", "B"]) {
    const xs = all.filter((b) => b.family === fam);
    for (const b of every(xs, k[fam]!, Math.floor(k[fam]! / 2)))
      if (perm.has(key(b.input))) excluded++;
      else out.push(b);
  }
  return { bases: out, excluded };
}

/* ---------- nezavisne zajedničke provere (sve 4 distance) ---------- */
const S = JSON.stringify;
/** Prekršaji: prošlost bajt-ista (dani ≤ asOf, urađeni, zaključani), prazan trening, dugi ≥ lagan (budući
    dani svake nedelje), trkačka (bez trke) ≤ planirano poslednje nedelje tapera. */
export function commonChecks(before: Plan, after: Plan, asOf: string, facts: Record<string, unknown>): string[] {
  const bad: string[] = [];
  const done = new Set(
    ((facts["workouts"] as { completed: boolean; dayId?: string; date: string }[] | undefined) ?? [])
      .filter((x) => x.completed)
      .map((x) => x.dayId ?? x.date),
  );
  const locked = new Set((facts["lockedDayIds"] as string[] | undefined) ?? []);
  const aDays = new Map(after.weeks.flatMap((w) => w.days.map((d) => [d.date, d] as const)));
  for (const w of before.weeks)
    for (const d of w.days)
      if (d.date <= asOf || done.has(d.date) || locked.has(d.date))
        if (S(aDays.get(d.date)) !== S(d)) bad.push(`PROSLOST ${d.date <= asOf ? "dan≤asOf" : "urađen/zaključan"}`);
  for (const w of after.weeks) {
    const fut = w.days.filter((d) => d.date > asOf);
    for (const d of fut)
      if (d.role !== "race" && (!(d.workout.km > 0) || !(d.workout.sec > 0))) bad.push(`PRAZAN_TRENING ${d.role}`);
    const long = fut.find((d) => d.role === "long");
    if (long)
      for (const d of fut)
        if (d.role === "easy" && d.workout.km > long.workout.km + 1e-6) bad.push("DUGI<LAGAN");
  }
  const N = after.weeks.length;
  const race = after.weeks[N - 1]!;
  const tapers = after.weeks.filter((w) => w.phase === "taper");
  const taper = tapers[tapers.length - 1];
  if (taper) {
    const raceKm = race.days.filter((d) => d.countsToWeek).reduce((a, d) => a + d.workout.km, 0);
    if (raceKm > taper.plannedKm + 0.05 && race.days.some((d) => d.date > asOf)) bad.push("TRKACKA>TAPER");
  }
  return bad;
}
