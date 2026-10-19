/* Zajednički ulazi za testove HM v2 (nije testni fajl, da bi ga izolacioni test video kao deo v2).
   Mreža 01 (MASTER § 3): 4 dana × nedelje 10–20 × obim 30–60 km (korak 5) × VDOT {30, 35, 40, 45, 50, 55,
   60, 70} × 3 rasporeda × trka sub/ned = 11 × 7 × 8 × 3 × 2 = 3696 ulaza (id bez prefiksa dana).
   Mreža 02: svaki broj dana (3–6) × nedelje 10–20 × obim reda H15 korak 5 × isti VDOT × 3 rasporeda po broju
   dana × trka sub/ned = 2640 + 3696 + 4752 + 5808 = 16 896 ulaza (id `d<n>-…`; 4 dana = mreža 01). */

import { addDays } from './dates.ts';
import { raceTimeForVdot, round1, vdotFromResult } from './paces.ts';
import type { Weekday } from './types.ts';

/** Ponedeljak; trka nedelja = START + 7N − 1. Trka subota: start nedelja (dan ranije). */
export const START = '2026-11-02';

type Sched = Record<'A' | 'B' | 'C', { days: Weekday[]; long: Weekday }>;
/** Rasporedi 4 dana (mreža 01). */
export const SCHEDULES: Sched = {
  A: { days: ['tue', 'thu', 'sat', 'sun'], long: 'sun' },
  B: { days: ['mon', 'wed', 'fri', 'sun'], long: 'sun' },
  C: { days: ['mon', 'tue', 'thu', 'sat'], long: 'sat' }
};

/** Rasporedi po broju dana (mreža 02): različit dan dugog, dan odmora i položaj laganih dana. */
export const SCHEDULES_BY_DAYS: Record<3 | 4 | 5 | 6, Sched> = {
  3: {
    A: { days: ['tue', 'thu', 'sun'], long: 'sun' },
    B: { days: ['mon', 'wed', 'sat'], long: 'sat' },
    C: { days: ['wed', 'sat', 'sun'], long: 'sun' }
  },
  4: SCHEDULES,
  5: {
    A: { days: ['mon', 'tue', 'thu', 'sat', 'sun'], long: 'sun' },
    B: { days: ['mon', 'wed', 'thu', 'fri', 'sun'], long: 'sun' },
    C: { days: ['tue', 'wed', 'thu', 'sat', 'sun'], long: 'sat' }
  },
  6: {
    A: { days: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'], long: 'sun' },
    B: { days: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'], long: 'sun' },
    C: { days: ['mon', 'tue', 'thu', 'fri', 'sat', 'sun'], long: 'sat' }
  }
};

/** H15: obim reda po broju dana (korak 5). */
export const KM_BY_DAYS: Record<3 | 4 | 5 | 6, { min: number; max: number }> = {
  3: { min: 25, max: 45 },
  4: { min: 30, max: 60 },
  5: { min: 35, max: 75 },
  6: { min: 40, max: 90 }
};
export const DAY_COUNTS = [3, 4, 5, 6] as const;
export type DayCount = (typeof DAY_COUNTS)[number];

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
  recentLongRunKm?: number;
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
    goalTimeSec: p.goalTimeSec ?? null,
    ...(p.recentLongRunKm !== undefined ? { recentLongRunKm: p.recentLongRunKm } : {})
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
  days: DayCount;
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
              days: 4,
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

/** Mreža 02: id `d<n>-<ned>w-<km>km-v<vdot>-<raspored>-<trka>`; redom 3, 4, 5, 6 dana. */
export function grid02Inputs(): GridInput[] {
  const out: GridInput[] = [];
  for (const days of DAY_COUNTS) {
    const k = KM_BY_DAYS[days];
    for (const weeks of GRID.weeks)
      for (let km = k.min; km <= k.max; km += 5)
        for (const vdot of GRID.vdot)
          for (const schedule of GRID.schedule)
            for (const race of GRID.race) {
              const sc = SCHEDULES_BY_DAYS[days][schedule];
              out.push({
                id: `d${days}-${weeks}w-${km}km-v${vdot}-${schedule}-${race}`,
                days,
                weeks,
                km,
                vdot,
                schedule,
                race,
                input: inputOf({ weeks, km, vdot, days: sc.days, long: sc.long, race })
              });
            }
  }
  return out;
}

/** Gusta mreža nedelje 1 po broju dana (K1 = 0, pouka 9): obim reda H15 korak 0,1 × VDOT 30–80 korak 0,5,
    10 nedelja, raspored A, trka nedelja (3 d 20 301, 4 d 30 401, 5 d 40 501, 6 d 50 601 ulaz). */
export function denseInputs(days: DayCount): {
  id: string;
  km: number;
  vdot: number;
  input: Record<string, unknown>;
}[] {
  const k = KM_BY_DAYS[days];
  const sc = SCHEDULES_BY_DAYS[days].A;
  const out: { id: string; km: number; vdot: number; input: Record<string, unknown> }[] = [];
  for (let km10 = k.min * 10; km10 <= k.max * 10; km10++)
    for (let v2 = 60; v2 <= 160; v2++) {
      const km = km10 / 10;
      const vdot = v2 / 2;
      out.push({
        id: `d${days}-d10w-${km}km-v${vdot}-A-sun`,
        km,
        vdot,
        input: inputOf({ weeks: 10, km, vdot, days: sc.days, long: sc.long })
      });
    }
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
  return fnv(JSON.stringify({ ...plan, policyVersion: '' }));
}

/** Napomena nedelje 1 bez ulaza `recentLongRunKm` (pouka 28, HM-02) — počinje ovim tekstom. */
export const RECENT_LONG_NOTE = 'Dugi nedelje 1';

/** Heš plana bez TEKSTA poruka koje menja HM-02 bez promene treninga (regresija 4 dana prema 3979237):
    bez oznake verzije, bez napomena plana (CAPACITY_LIMITED sa preporukom dana), upozorenja samo kao pravilo i
    nedelja (preporuka manje/više dana iz novih redova H15), bez napomene nedelje 1 o skorašnjem dugom. */
export function planHashNorm(plan: {
  policyVersion: string;
  notes: readonly string[];
  warnings: readonly { rule: string; severity: string; week?: number }[];
  weeks: readonly { notes: readonly string[] }[];
}): string {
  return fnv(
    JSON.stringify({
      ...plan,
      policyVersion: '',
      notes: [],
      warnings: plan.warnings.map((v) => [v.rule, v.severity, v.week ?? null]),
      weeks: plan.weeks.map((w) => ({
        ...w,
        notes: w.notes.filter((n) => !n.startsWith(RECENT_LONG_NOTE))
      }))
    })
  );
}

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
