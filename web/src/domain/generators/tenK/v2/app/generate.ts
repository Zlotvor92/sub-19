/* 10K v2 → aplikacija: generisanje (čarobnjak i ugovor), procena za čarobnjak, proizvod, napor dana.

   Pravila ulaza, plana i odbijanja su v2 (`../generate.ts`, `../input.ts`); ovde je samo prevod oblika. Odbijanje se
   vraća sa razlozima v2 doslovno (aplikacija ga prikazuje kao poruku). */

import { userText } from './format.ts';
import { generateTenKV2 } from '../generate.ts';
import { assessGoal, raceTimeForVdot, round1, vdotFromResult } from '../paces.ts';
import { TEN_K_V2_POLICY as P } from '../policy.ts';
import type { Reason, Weekday } from '../types.ts';
import { addDays, diffDays } from './date.ts';
import { generatedPlan, storedPlan, type GeneratedV2Plan } from './plan.ts';
import type {
  PlanRejectionReason,
  RpeTarget,
  StoredPlan,
  StructuredPlanInput,
  StructuredPlanResult,
  WorkoutStructure
} from './types.ts';

const DISTANCE_M = P.paces.raceDistanceM;
const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Prvi dan plana: cele nedelje koje se završavaju danom trke, najkasnije 6 dana posle `today` (plan ne kreće u
 *  prošlosti). `null` za neispravan datum ili trku pre `today`. Broj nedelja proverava v2 (8–18; početnik 10–18). */
export function alignedStart(raceDate: string, today: string): string | null {
  let days: number;
  try {
    days = diffDays(today, raceDate) + 1;
  } catch {
    return null;
  }
  const weeks = Math.floor(days / 7);
  return weeks >= 1 ? addDays(raceDate, -7 * weeks + 1) : null;
}

/** Odbijanje v2 doslovno, u obliku razmene (greške validatora v2 su već razlozi `PLAN_VIOLATES_POLICY`). */
export function rejection(reasons: readonly Reason[]): PlanRejectionReason[] {
  return reasons.map((x) => ({
    code: x.code,
    message: userText(x.message),
    ...(x.week != null ? { week: x.week } : {})
  }));
}

/** Novi plan iz čarobnjaka: plan za upis ili razlozi odbijanja. */
export function generateStructured(input: StructuredPlanInput): StructuredPlanResult {
  const r = generateTenKV2(input);
  if (!r.ok) return { ok: false, reasons: rejection(r.reasons) };
  return { ok: true, plan: storedPlan(generatedPlan(r.plan)) };
}

/** Ulaz ugovora (zajednički oblik čarobnjaka ostalih distanci) — polja koja v2 razume. */
interface ContractInput {
  startDate: string;
  raceDate: string;
  pb: { distM: number; sec: number; date?: string };
  weeklyKm: number;
  runDows?: number[];
  lrDow?: number;
  goalSec?: number | null;
  trainedRecently?: boolean;
}

/** Ugovor `generatePlan`: zajednički ulaz → ulaz v2 (rezultat sa datumom, tačni dani, dan dugog, cilj; početnik =
 *  `trainedRecently === false`). Šta zajednički ulaz ne nosi (lak tempo za plan po osećaju) v2 traži sam i odbija ako
 *  nedostaje. Aplikacija nov 10K v2 plan pravi kroz `generateStructured` (čarobnjak v2). */
export function generatePlan(input: ContractInput): GeneratedV2Plan | { error: string } {
  const start = alignedStart(input.raceDate, input.startDate);
  const v2: Record<string, unknown> = {
    startDate: start ?? input.startDate,
    raceDate: input.raceDate,
    runDays: (input.runDows ?? []).map((d) => WEEKDAYS[d - 1]),
    longRunDay: input.lrDow != null ? (WEEKDAYS[input.lrDow - 1] ?? null) : null,
    currentWeeklyKm: input.weeklyKm,
    recentResult:
      input.pb && input.pb.date
        ? { distanceM: input.pb.distM, timeSec: input.pb.sec, date: input.pb.date }
        : null,
    goalTimeSec: input.goalSec ?? null,
    experience: input.trainedRecently === false ? 'beginner' : 'regular'
  };
  const r = generateTenKV2(v2);
  if (!r.ok)
    return {
      error: rejection(r.reasons)
        .map((x) => x.message)
        .join(' ')
    };
  return generatedPlan(r.plan);
}

const isGenerated = (g: unknown): g is GeneratedV2Plan =>
  typeof g === 'object' &&
  g !== null &&
  'tenKV2' in g &&
  Array.isArray((g as { weeks?: unknown }).weeks);

/** Ugovor `adaptGeneratedPlan`: izlaz v2 generatora → plan za upis; odbijanje ili tuđ izlaz → `null`. */
export function adaptGeneratedPlan(gen: { error: string } | object): StoredPlan | null {
  if ('error' in gen || !isGenerated(gen)) return null;
  return storedPlan(gen);
}

/** Procena za čarobnjak iz rezultata: trenutna forma (v2 ne projektuje napredak), prognoza 10K i ocena cilja v2. */
export function assess(
  pb: { distM: number; sec: number },
  weeks: number,
  _intensity: unknown,
  goalSec: number | null
) {
  const vdot = round1(vdotFromResult(pb.distM, pb.sec));
  const goal = goalSec ? assessGoal(vdot, goalSec, weeks) : null;
  return {
    assessmentBasis: 'current-fitness' as const,
    vdot0: vdot,
    vdotGoal: vdot,
    predictedSec: raceTimeForVdot(vdot, DISTANCE_M),
    realno: goal ? goal.status === 'realistic' : null,
    goalVdot: goal ? goal.goalVdot : null
  };
}

/** Proizvod 10K v2: ime i najkraća priprema iz v2 (8 nedelja). Pojmovi starog 10K proizvoda (bazne nedelje početnika,
 *  prag obima za dva kvaliteta, minimalni vrh) v2 nema — NaN, ne izmišljena vrednost. */
export const PRODUCT = {
  name: '10K',
  minWeeks: P.input.weeksMin,
  baseWeeksBeginner: Number.NaN,
  qual2MinKm: Number.NaN,
  minPeakKm: Number.NaN
};
export const product = (raceDistM: number) => (raceDistM === DISTANCE_M ? PRODUCT : undefined);

/** Napor dana: onaj koji v2 propisuje u strukturi (plan po osećaju); bez njega v2 nema smernicu napora. */
export function rpeTarget(
  d: { rest: boolean; structure?: WorkoutStructure } | null | undefined
): RpeTarget | null {
  if (!d || d.rest) return null;
  const r = d.structure?.rpe;
  return r ? { min: r.min, max: r.max, txt: r.txt } : null;
}
