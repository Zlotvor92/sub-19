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
