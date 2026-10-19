/* Zajednički ulazi za testove HM v2 (nije testni fajl, da bi ga izolacioni test video kao deo v2).
   Mreža 01 (MASTER § 3): 4 dana × nedelje 10–20 × obim 30–60 km (korak 5) × VDOT {30, 35, 40, 45, 50, 55,
   60, 70} × 3 rasporeda × trka sub/ned = 11 × 7 × 8 × 3 × 2 = 3696 ulaza. */

import { addDays } from './dates.ts';
import { raceTimeForVdot, round1, vdotFromResult } from './paces.ts';
import type { Weekday } from './types.ts';

/** Ponedeljak; trka nedelja = START + 7N − 1. Trka subota: start nedelja (dan ranije). */
export const START = '2026-11-02';

export const SCHEDULES: Record<'A' | 'B' | 'C', { days: Weekday[]; long: Weekday }> = {
  A: { days: ['tue', 'thu', 'sat', 'sun'], long: 'sun' },
  B: { days: ['mon', 'wed', 'fri', 'sun'], long: 'sun' },
  C: { days: ['mon', 'tue', 'thu', 'sat'], long: 'sat' }
};

/** Vreme [s] na distanci čiji je VDOT (zaokružen na 0,1) tačno `vdot`: najsporije celo vreme sa tim VDOT-om. */
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
  weeks: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  km: [30, 35, 40, 45, 50, 55, 60],
  vdot: [30, 35, 40, 45, 50, 55, 60, 70],
  schedule: ['A', 'B', 'C'] as const,
  race: ['sat', 'sun'] as const
};

export interface GridInput {
  id: string;
  weeks: number;
  km: number;
  vdot: number;
  schedule: 'A' | 'B' | 'C';
  race: 'sat' | 'sun';
  input: Record<string, unknown>;
}

/** Mreža 01: id `<ned>w-<km>km-v<vdot>-<raspored>-<trka>`. */
export function gridInputs(): GridInput[] {
  const out: GridInput[] = [];
  for (const weeks of GRID.weeks)
    for (const km of GRID.km)
      for (const vdot of GRID.vdot)
        for (const schedule of GRID.schedule)
          for (const race of GRID.race)
            out.push({
              id: `${weeks}w-${km}km-v${vdot}-${schedule}-${race}`,
              weeks,
              km,
              vdot,
              schedule,
              race,
              input: inputOf({
                weeks,
                km,
                vdot,
                days: SCHEDULES[schedule].days,
                long: SCHEDULES[schedule].long,
                race
              })
            });
  return out;
}

/** Gusta mreža nedelje 1 (K1 = 0, pouka 9): obim 30,0–60,0 km korak 0,1 × VDOT 30–80 korak 0,5, 10 nedelja,
    raspored A, trka nedelja = 301 × 101 = 30 401 ulaz. Nedelja 1 ne zavisi od broja nedelja ni rasporeda. */
export function denseWeek1Inputs(): {
  id: string;
  km: number;
  vdot: number;
  input: Record<string, unknown>;
}[] {
  const out: { id: string; km: number; vdot: number; input: Record<string, unknown> }[] = [];
  for (let km10 = 300; km10 <= 600; km10++)
    for (let v2 = 60; v2 <= 160; v2++) {
      const km = km10 / 10;
      const vdot = v2 / 2;
      out.push({
        id: `d10w-${km}km-v${vdot}-A-sun`,
        km,
        vdot,
        input: inputOf({ weeks: 10, km, vdot, days: SCHEDULES.A.days, long: SCHEDULES.A.long })
      });
    }
  return out;
}

/** FNV-1a (32 bit) nad JSON-om plana bez oznake verzije — regresija prema prethodnom segmentu (pouka 1). */
export function planHash(plan: { policyVersion: string }): string {
  const s = JSON.stringify({ ...plan, policyVersion: '' });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
