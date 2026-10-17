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
