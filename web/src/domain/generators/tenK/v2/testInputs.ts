/* Zajednički ulazi za testove 10K v2 (nije testni fajl, da bi ga izolacioni test video kao deo v2).
   Mreža 01 (4 dana, 10–18 ned) i mreža 02 (3/4/5/6 dana, 8–18 ned). */

import { addDays } from './dates.ts';
import { raceTimeForVdot, round1, vdotFromResult } from './paces.ts';
import type { Structure, Weekday } from './types.ts';
import { repsOf } from './workouts.ts';

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
    JSON.stringify(result)
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
