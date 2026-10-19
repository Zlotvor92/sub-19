/* Segment 04 (H18): ulazi mreža adaptacije (nije testni fajl, da bi ga izolacioni test video kao deo v2; dele ga
   adapt testovi i docs/hm-v2/artifacts/segment-04/*). Činjenice su oblika HmV2Facts (obrazac 10K v2). */

import { addDays, mustDay, weekdayOf } from './dates.ts';
import {
  beginnerInputs,
  feelInputs,
  grid02Inputs,
  inputOf,
  SCHEDULES_BY_DAYS,
  timeForVdot
} from './testInputs.ts';

export interface AdaptBase {
  id: string;
  input: Record<string, unknown>;
}

/** Mreža 04 (MASTER § 3): 3/4/5/6 dana × sa rezultatom (VDOT 45, cilj 1:40:00) i po osećaju (lagan 6:00) ×
    10/14/18 ned, + početnik 4 d po osećaju (6:30, 25 km), 4 d sa rezultatom (VDOT 35, 25 km) i 5 d po osećaju
    (7:00, 30 km) × 12/16/20 ned = 24 + 9 = 33 plana. */
export function adaptBases(): AdaptBase[] {
  const km: Record<3 | 4 | 5 | 6, number> = { 3: 30, 4: 40, 5: 50, 6: 60 };
  const out: AdaptBase[] = [];
  for (const weeks of [10, 14, 18])
    for (const days of [3, 4, 5, 6] as const) {
      const sc = SCHEDULES_BY_DAYS[days].A;
      const base = inputOf({ weeks, km: km[days], vdot: 45, days: sc.days, long: sc.long });
      out.push({ id: `d${days}-r-${weeks}w`, input: { ...base, goalTimeSec: 6000 } });
      out.push({
        id: `d${days}-f-${weeks}w`,
        input: inputOf({ weeks, km: km[days], days: sc.days, long: sc.long, easyPaceSecPerKm: 360 })
      });
    }
  for (const weeks of [12, 16, 20]) {
    const b4 = SCHEDULES_BY_DAYS[4].A;
    const b5 = SCHEDULES_BY_DAYS[5].A;
    out.push({
      id: `beg-d4-f-${weeks}w`,
      input: inputOf({
        weeks,
        km: 25,
        days: b4.days,
        long: b4.long,
        beginner: true,
        easyPaceSecPerKm: 390
      })
    });
    out.push({
      id: `beg-d4-r-${weeks}w`,
      input: inputOf({ weeks, km: 25, vdot: 35, days: b4.days, long: b4.long, beginner: true })
    });
    out.push({
      id: `beg-d5-f-${weeks}w`,
      input: inputOf({
        weeks,
        km: 30,
        days: b5.days,
        long: b5.long,
        beginner: true,
        easyPaceSecPerKm: 420
      })
    });
  }
  return out;
}

/** Plan kakav čitaju generatori činjenica (strukturno, bez uvoza tipova plana). */
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

const wedOf = (plan: PlanLike, i: number): string => {
  let d = plan.weeks[i - 1]!.startDate;
  while (weekdayOf(d) !== 'wed') d = addDays(d, 1);
  return d;
};

/** asOf mreže 04 (MASTER § 3): nedelja 1 sreda i kraj, kraj ned 2, sredina plana (sreda), kraj nedelje pre
    testa / prvog rasterećenja / tapera, sreda tapera. Isti datum se ne ponavlja. */
export function asOfs04(plan: PlanLike): { tag: string; asOf: string }[] {
  const N = plan.weeks.length;
  const end = (i: number) => plan.weeks[i - 1]!.endDate;
  const tw = plan.weeks.find((w) => w.test)?.index;
  const dw = plan.weeks.find((w) => w.deload)?.index;
  const taper = plan.weeks.find((w) => w.phase === 'taper')!.index;
  const xs: { tag: string; asOf: string }[] = [
    { tag: 'w1wed', asOf: wedOf(plan, 1) },
    { tag: 'w1end', asOf: end(1) },
    { tag: 'w2end', asOf: end(2) },
    { tag: 'mid', asOf: wedOf(plan, Math.ceil(N / 2)) },
    ...(tw && tw > 1 ? [{ tag: 'preTest', asOf: end(tw - 1) }] : []),
    ...(dw && dw > 1 ? [{ tag: 'preDeload', asOf: end(dw - 1) }] : []),
    { tag: 'preTaper', asOf: end(taper - 1) },
    { tag: 'taperWed', asOf: wedOf(plan, taper) }
  ];
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.asOf) ? false : (seen.add(x.asOf), true)));
}

/** Scenariji mreže 04 (MASTER § 3). */
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

/** Odrađeni treninzi u [from, to]: dan plana (dayId, planirani km × `share`) ili, pre starta plana, trčanje van
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
        durationSec: 2400,
        completed: true,
        rpe: 5,
        ...extra
      });
  }
  return out;
}

/** Bol nivoa `level` na dan asOf (zapis bez trčanja). */
export const painFacts = (asOf: string, level: number): Record<string, unknown> => ({
  workouts: [{ date: asOf, km: 0, durationSec: 0, completed: false, pain: level }]
});

/** Činjenice scenarija (asOf = dan adaptacije). 'chain' = prvi korak (pauza 10, coverage); drugi korak
    (manjak) gradi test. */
export function factsOf(plan: PlanLike, s: Scenario, asOf: string): Record<string, unknown> {
  const back = (n: number): string => addDays(asOf, -n);
  const cov = (from: string, complete = true) => ({ from, to: asOf, complete });
  const result = (vdot: number, kind: 'race' | 'test') => ({
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
      return painFacts(asOf, 5);
    case 'pain8':
      return painFacts(asOf, 8);
    case 'fatigue':
      return {
        workouts: [
          { date: back(1), km: 6, durationSec: 2400, completed: true, rpe: 8 },
          { date: back(3), km: 6, durationSec: 2400, completed: true, rpe: 7 }
        ]
      };
    case 'faster':
      return { results: [result(Math.round((plan.vdot + 2) * 10) / 10, 'race')] };
    case 'slower':
      return { results: [result(Math.round((plan.vdot - 2) * 10) / 10, 'race')] };
    case 'test5k':
      return { results: [{ distM: 5000, sec: 1500, date: asOf, kind: 'test' }] };
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

/** Drugi korak lanca: manjak 50 % u 7 dana posle prvog koraka (asOf2 = asOf + 7). */
export function chainSecond(plan: PlanLike, asOf2: string): Record<string, unknown> {
  return {
    workouts: runsIn(plan, addDays(asOf2, -6), asOf2, 0.5),
    coverage: { from: addDays(asOf2, -6), to: asOf2, complete: true }
  };
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

/** Činjenice rane mreže: pauza 10/20 dana (breaks do asOf), bol 5/8 na dan asOf, pauza 10 + bol 5, manjak
    (odrađen samo dan asOf − 6, pokrivenost asOf − 6 … asOf), umor (2 lagana sa RPE 8 i 7). */
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
      return factsOf(plan, 'fatigue', asOf);
  }
}

/** asOf rane i srednje adaptacije (pouka 23): pre starta (start − 1, − 3, − 6); nedelja 1 sreda i kraj; sreda svake nedelje 2 … N − 1; kraj
    nedelje pre svake posebne nedelje (test, rasterećenje, taper). Oznaka `w<i>wed` / `w<i>end`. */
export function earlyAsOfs(plan: PlanLike): { tag: string; asOf: string }[] {
  const N = plan.weeks.length;
  const special = plan.weeks
    .filter((w) => w.test || w.deload || w.phase === 'taper')
    .map((w) => w.index)
    .filter((i) => i > 1);
  // Pouka 23/34: i asOf pre starta (start − 1, − 3, − 6).
  const xs = [
    ...[1, 3, 6].map((d) => ({ tag: `pre${d}`, asOf: addDays(plan.input.startDate, -d) })),
    { tag: 'w1wed', asOf: wedOf(plan, 1) },
    { tag: 'w1end', asOf: plan.weeks[0]!.endDate },
    ...Array.from({ length: Math.max(0, N - 2) }, (_, k) => ({
      tag: `w${k + 2}wed`,
      asOf: wedOf(plan, k + 2)
    })),
    ...special.map((i) => ({ tag: `w${i - 1}end`, asOf: plan.weeks[i - 2]!.endDate }))
  ];
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.asOf) ? false : (seen.add(x.asOf), true)));
}

/** Planovi rane mreže: svaki `n`-ti plan mreža 02, 03 po osećaju i početnika (redom). */
export function earlyBases(n: { r: number; f: number; b: number }): AdaptBase[] {
  const every = <X>(xs: readonly X[], k: number): X[] => xs.filter((_, i) => i % k === 0);
  return [
    ...every(grid02Inputs(), n.r).map((g) => ({ id: g.id, input: g.input })),
    ...every(feelInputs(), n.f).map((g) => ({ id: g.id, input: g.input })),
    ...every(beginnerInputs(), n.b).map((g) => ({ id: g.id, input: g.input }))
  ];
}
