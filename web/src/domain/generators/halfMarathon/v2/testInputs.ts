/* Zajednički ulazi za testove HM v2 (nije testni fajl, da bi ga izolacioni test video kao deo v2).
   Mreža 01 (MASTER § 3): 4 dana × nedelje 10–20 × obim 30–60 km (korak 5) × VDOT {30, 35, 40, 45, 50, 55,
   60, 70} × 3 rasporeda × trka sub/ned = 11 × 7 × 8 × 3 × 2 = 3696 ulaza (id bez prefiksa dana).
   Mreža 02: svaki broj dana (3–6) × nedelje 10–20 × obim reda H15 korak 5 × isti VDOT × 3 rasporeda po broju
   dana × trka sub/ned = 2640 + 3696 + 4752 + 5808 = 16 896 ulaza (id `d<n>-…`; 4 dana = mreža 01).
   Mreža 03 (HM-03): po osećaju — lagan {270, 315, 360, 405, 450, 510} × 3–6 dana × obim reda korak 5 × nedelje
   10–20 × 3 rasporeda (trka nedelja) = 6336 ulaza (id `f-d<n>-…`); početnik — po osećaju {330, 390, 450, 510} i
   VDOT {30, 35, 40} × 4–5 dana × obim H17 korak 5 × nedelje 12–20 × 3 rasporeda = 1890 ulaza (id `b-d<n>-…`). */

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
  /** H16: bez rezultata, lagan tempo [s/km]. */
  easyPaceSecPerKm?: number;
  /** H17. */
  beginner?: boolean;
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
    recentResult:
      p.easyPaceSecPerKm !== undefined
        ? null
        : { ...res, date: addDays(start, -(p.resultDaysBefore ?? 14)) },
    goalTimeSec: p.goalTimeSec ?? null,
    ...(p.recentLongRunKm !== undefined ? { recentLongRunKm: p.recentLongRunKm } : {}),
    ...(p.easyPaceSecPerKm !== undefined ? { easyPaceSecPerKm: p.easyPaceSecPerKm } : {}),
    ...(p.beginner ? { experience: 'beginner' } : {})
  };
}

/** Mreža 03 (H16): lagan tempo plana po osećaju [s/km]. */
export const FEEL_PACES = [270, 315, 360, 405, 450, 510] as const;

export interface Grid03Input {
  id: string;
  days: DayCount;
  weeks: number;
  km: number;
  /** Lagan tempo (po osećaju) ili null (rezultat sa VDOT-om `vdot`). */
  easy: number | null;
  vdot: number | null;
  schedule: 'A' | 'B' | 'C';
  input: Record<string, unknown>;
}

/** Mreža 03 po osećaju (H16): id `f-d<n>-<ned>w-<km>km-e<lagan>-<raspored>`; 6336 ulaza. */
export function feelInputs(): Grid03Input[] {
  const out: Grid03Input[] = [];
  for (const days of DAY_COUNTS) {
    const k = KM_BY_DAYS[days];
    for (const easy of FEEL_PACES)
      for (const weeks of GRID.weeks)
        for (let km = k.min; km <= k.max; km += 5)
          for (const schedule of GRID.schedule) {
            const sc = SCHEDULES_BY_DAYS[days][schedule];
            out.push({
              id: `f-d${days}-${weeks}w-${km}km-e${easy}-${schedule}`,
              days,
              weeks,
              km,
              easy,
              vdot: null,
              schedule,
              input: inputOf({ weeks, km, days: sc.days, long: sc.long, easyPaceSecPerKm: easy })
            });
          }
  }
  return out;
}

/** H17: obim početnika po broju dana (korak 5). */
export const BEGINNER_KM: Record<4 | 5, { min: number; max: number }> = {
  4: { min: 20, max: 40 },
  5: { min: 25, max: 45 }
};
/** Mreža 03 početnik: po osećaju (lagan tempo) i sa rezultatom (VDOT). */
export const BEGINNER_PACES = [
  { easy: 330 },
  { easy: 390 },
  { easy: 450 },
  { easy: 510 },
  { vdot: 30 },
  { vdot: 35 },
  { vdot: 40 }
] as const;

/** Mreža 03 početnik (H17): id `b-d<n>-<ned>w-<km>km-<e…|v…>-<raspored>`; 1890 ulaza. */
export function beginnerInputs(): Grid03Input[] {
  const out: Grid03Input[] = [];
  for (const days of [4, 5] as const) {
    const k = BEGINNER_KM[days];
    for (const pace of BEGINNER_PACES)
      for (let weeks = 12; weeks <= 20; weeks++)
        for (let km = k.min; km <= k.max; km += 5)
          for (const schedule of GRID.schedule) {
            const sc = SCHEDULES_BY_DAYS[days][schedule];
            const easy = 'easy' in pace ? pace.easy : null;
            const vdot = 'vdot' in pace ? pace.vdot : null;
            out.push({
              id: `b-d${days}-${weeks}w-${km}km-${easy !== null ? `e${easy}` : `v${vdot}`}-${schedule}`,
              days,
              weeks,
              km,
              easy,
              vdot,
              schedule,
              input: inputOf({
                weeks,
                km,
                days: sc.days,
                long: sc.long,
                beginner: true,
                ...(easy !== null ? { easyPaceSecPerKm: easy } : { vdot: vdot! })
              })
            });
          }
  }
  return out;
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
