/* Zajednički ulazi za testove maratona v2 (nije testni fajl, da bi ga izolacioni test video kao deo v2).
   Mreža 02 (MASTER § 3): svaki broj dana 3–6 × 12–24 ned × obim po redu M15 (korak 5) × VDOT {30..70} × 3
   rasporeda po broju dana × trka sub/ned = 3120 + 4368 + 6240 + 8112 = 21 840 ulaza. Red 4 dana = mreža 01
   (isti ulazi, id bez prefiksa `d4-` = id mreže 01). */

import { addDays } from './dates.ts';
import { raceTimeForVdot, round1, vdotFromResult } from './paces.ts';
import { MARATHON_V2_POLICY as P, RUN_DAYS_COUNTS, type RunDaysCount } from './policy.ts';
import type { MarathonV2Plan, Weekday } from './types.ts';

/** Ponedeljak; trka nedelja = START + 7N − 1. Trka subota: start nedelja (dan ranije). */
export const START = '2026-11-02';

type Schedule = { days: Weekday[]; long: Weekday };
/** Rasporedi mreže 01 (4 dana). */
export const SCHEDULES: Record<'A' | 'B' | 'C', Schedule> = {
  A: { days: ['tue', 'thu', 'sat', 'sun'], long: 'sun' },
  B: { days: ['mon', 'wed', 'fri', 'sun'], long: 'sun' },
  C: { days: ['mon', 'tue', 'thu', 'sat'], long: 'sat' }
};

/** Mreža 02: 3 rasporeda po broju dana (A/B dugi nedelja, C dugi subota). */
export const SCHEDULES_BY_DAYS: Record<RunDaysCount, Record<'A' | 'B' | 'C', Schedule>> = {
  3: {
    A: { days: ['tue', 'thu', 'sun'], long: 'sun' },
    B: { days: ['wed', 'sat', 'sun'], long: 'sun' },
    C: { days: ['mon', 'wed', 'sat'], long: 'sat' }
  },
  4: SCHEDULES,
  5: {
    A: { days: ['mon', 'tue', 'thu', 'sat', 'sun'], long: 'sun' },
    B: { days: ['tue', 'wed', 'thu', 'sat', 'sun'], long: 'sun' },
    C: { days: ['mon', 'wed', 'thu', 'fri', 'sat'], long: 'sat' }
  },
  6: {
    A: { days: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'], long: 'sun' },
    B: { days: ['mon', 'tue', 'thu', 'fri', 'sat', 'sun'], long: 'sun' },
    C: { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], long: 'sat' }
  }
};

/** Vreme [s] za distancu čiji je VDOT (zaokružen na 0,1) tačno `vdot`: najsporije celo vreme sa tim VDOT-om. */
export function timeForVdot(vdot: number, distanceM = 21097.5): number {
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
  recentLongRunKm?: number | null;
}

/** Ulaz iz profila; podrazumevani rezultat je polumaraton sa tačnim VDOT-om. */
export function inputOf(p: Profile): Record<string, unknown> {
  const start = p.race === 'sat' ? addDays(START, -1) : START;
  const res = p.result ?? { distanceM: 21097.5, timeSec: timeForVdot(p.vdot ?? 45) };
  return {
    startDate: start,
    raceDate: addDays(start, p.weeks * 7 - 1),
    runDays: p.days,
    longRunDay: p.long ?? null,
    currentWeeklyKm: p.km,
    recentResult: { ...res, date: addDays(start, -(p.resultDaysBefore ?? 14)) },
    goalTimeSec: p.goalTimeSec ?? null,
    ...(p.recentLongRunKm != null ? { recentLongRunKm: p.recentLongRunKm } : {})
  };
}

export const GRID = {
  weeks: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  vdot: [30, 35, 40, 45, 50, 55, 60, 70],
  schedule: ['A', 'B', 'C'] as const,
  race: ['sat', 'sun'] as const
};

/** Obim reda M15 korak 5 km (kmMin…kmMax). */
export function gridKm(days: RunDaysCount): number[] {
  const r = P.days[days];
  const out: number[] = [];
  for (let km = r.kmMin; km <= r.kmMax; km += 5) out.push(km);
  return out;
}

export interface GridInput {
  id: string;
  days: RunDaysCount;
  weeks: number;
  km: number;
  vdot: number;
  schedule: 'A' | 'B' | 'C';
  race: 'sat' | 'sun';
  input: Record<string, unknown>;
}

/** Mreža 02 za `days` dana (bez argumenta: svi brojevi dana redom); red 4 dana = mreža 01 (4368). */
export function gridInputs(days?: RunDaysCount): GridInput[] {
  if (days === undefined) return RUN_DAYS_COUNTS.flatMap((d) => gridInputs(d));
  const out: GridInput[] = [];
  const S = SCHEDULES_BY_DAYS[days];
  for (const weeks of GRID.weeks)
    for (const km of gridKm(days))
      for (const vdot of GRID.vdot)
        for (const schedule of GRID.schedule)
          for (const race of GRID.race)
            out.push({
              id: `d${days}-${weeks}w-${km}km-v${vdot}-${schedule}-${race}`,
              days,
              weeks,
              km,
              vdot,
              schedule,
              race,
              input: inputOf({
                weeks,
                km,
                vdot,
                days: S[schedule].days,
                long: S[schedule].long,
                race
              })
            });
  return out;
}

/* ---------- Heševi za regresiju (mreže i artifacts/segment-02/regression-01.ts) ---------- */

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** FNV-1a (32 bit) nad JSON-om plana bez oznake verzije — heš za regresiju sledećih segmenata. */
export function planHash(p: MarathonV2Plan): string {
  return fnv(JSON.stringify({ ...p, policyVersion: '' }));
}

/** Pravila upozorenja čiji se TEKST menja sa tabelom 3–6 dana (preporuka broja dana), ne sadržaj plana. */
const TEXT_RULES = ['MARATHON_LONG_SHORT', 'CAPACITY_LIMITED'];

/** Heš normalizovanog plana za regresiju prema MAR-01: bez oznake verzije, napomene ned 1 M13a (pouka 28),
    teksta TEXT_RULES i napomene kapaciteta. Isti kod normalizuje i plan MAR-01 (regression-01.ts). */
export function normalizedHash(p: MarathonV2Plan): string {
  const q = JSON.parse(JSON.stringify(p)) as MarathonV2Plan;
  q.policyVersion = '';
  q.weeks[0]!.notes = q.weeks[0]!.notes.filter((n) => !n.includes('(M13a)'));
  for (const w of q.warnings) if (TEXT_RULES.includes(w.rule)) w.message = '';
  q.notes = q.notes.map((n) => (n.includes('ne nose ovaj obim') ? 'CAP' : n));
  return fnv(JSON.stringify(q));
}

/** Plan sadrži piramidu M10a (I 5000 m). */
export const hasPyramid = (p: MarathonV2Plan): boolean =>
  p.weeks.some((w) =>
    w.days.some(
      (d) => d.workout.dose?.structure.form === 'pyramid' && d.workout.dose.doseM === 5000
    )
  );

/** Gusta mreža nedelje 1 (MAR-02): za svaki broj dana obim kmMin…kmMax korak 0,1 × VDOT 30–80 korak 0,5;
    12 ned (najkraća priprema), raspored A, trka nedelja = 20 301 + 30 401 + 45 551 + 60 701 = 157 954 ulaza. */
export function denseInputs(): GridInput[] {
  const out: GridInput[] = [];
  for (const days of RUN_DAYS_COUNTS) {
    const r = P.days[days];
    const S = SCHEDULES_BY_DAYS[days].A;
    for (let k10 = r.kmMin * 10; k10 <= r.kmMax * 10; k10++)
      for (let v2 = 2 * P.input.vdotMin; v2 <= 2 * P.input.vdotMax; v2++) {
        const km = k10 / 10;
        const vdot = v2 / 2;
        out.push({
          id: `dense-d${days}-${km}km-v${vdot}`,
          days,
          weeks: 12,
          km,
          vdot,
          schedule: 'A',
          race: 'sun',
          input: inputOf({ weeks: 12, km, vdot, days: S.days, long: S.long })
        });
      }
  }
  return out;
}

/** Mreža skorašnjeg najdužeg trka (M13a, MAR-02): svaki broj dana × obim po redu (korak 5) × VDOT {30,45,70} ×
    12/16/24 ned × rasporedi A/B/C × r 5–42 km (korak 1), trka nedelja = 35 910 ulaza. */
export function recentInputs(): GridInput[] {
  const out: GridInput[] = [];
  for (const days of RUN_DAYS_COUNTS)
    for (const km of gridKm(days))
      for (const vdot of [30, 45, 70])
        for (const weeks of [12, 16, 24])
          for (const schedule of GRID.schedule)
            for (let r = 5; r <= 42; r++) {
              const S = SCHEDULES_BY_DAYS[days][schedule];
              out.push({
                id: `recent-d${days}-${weeks}w-${km}km-v${vdot}-${schedule}-r${r}`,
                days,
                weeks,
                km,
                vdot,
                schedule,
                race: 'sun',
                input: inputOf({ weeks, km, vdot, days: S.days, long: S.long, recentLongRunKm: r })
              });
            }
  return out;
}
