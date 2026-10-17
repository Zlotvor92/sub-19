/* 5K v2 → aplikacija: generisanje (čarobnjak i ugovor), procena za čarobnjak, proizvod, napor dana.

   Pravila ulaza, plana i odbijanja su v2 (`../generate.ts`, `../input.ts`); ovde je samo prevod oblika. Odbijanje se
   vraća sa razlozima v2 doslovno (aplikacija ga prikazuje kao poruku). */

import { generateFiveKV2 } from '../generate.ts';
import { assessGoal, raceTimeForVdot, vdotFromResult } from '../paces.ts';
import { FIVE_K_V2_POLICY as P } from '../policy.ts';
import type { Weekday } from '../types.ts';
import type { GenPlanState } from '../../exchange.ts';
import { addDays, diffDays, type IsoDate } from './date.ts';
import { generatedPlan, storedPlan, type GeneratedV2Plan } from './plan.ts';
import type {
  PlanRejectionReason,
  RpeTarget,
  StructuredPlanInput,
  StructuredPlanResult,
  WorkoutStructure
} from './types.ts';

const DISTANCE_M = P.paces.raceDistanceM;
const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const round1 = (x: number): number => Math.round(x * 10) / 10;

/** Prvi dan plana: cele nedelje koje se završavaju danom trke, najkasnije 6 dana posle `today` (plan ne kreće u
 *  prošlosti). `null` za neispravan datum ili trku pre `today`. Broj nedelja proverava v2 (6–16). */
export function alignedStart(raceDate: string, today: string): string | null {
  let days: number;
  try {
    days = diffDays(today as IsoDate, raceDate as IsoDate) + 1;
  } catch {
    return null;
  }
  const weeks = Math.floor(days / 7);
  return weeks >= 1 ? addDays(raceDate as IsoDate, -7 * weeks + 1) : null;
}

function rejection(r: {
  reasons: readonly PlanRejectionReason[];
  violations: readonly { rule: string; severity: string; message: string; week?: number }[];
}): PlanRejectionReason[] {
  return [
    ...r.reasons.map((x) => ({
      code: x.code,
      message: x.message,
      ...(x.week != null ? { week: x.week } : {})
    })),
    ...r.violations
      .filter((v) => v.severity === 'error')
      .map((v) => ({
        code: `VIOLATION:${v.rule}`,
        message: v.message,
        ...(v.week != null ? { week: v.week } : {})
      }))
  ];
}

/** Novi plan iz čarobnjaka: plan za upis ili razlozi odbijanja. */
export function generateStructured(input: StructuredPlanInput): StructuredPlanResult {
  const r = generateFiveKV2(input);
  if (!r.ok) return { ok: false, reasons: rejection(r) };
  return { ok: true, plan: storedPlan(generatedPlan(r.plan)) };
}

/** Ulaz ugovora (zajednički oblik čarobnjaka ostalih distanci) — polja koja v2 razume. */
interface ContractInput {
  startDate: string;
  raceDate: string;
  pb: { distM: number; sec: number; date?: string };
  weeklyKm: number;
  runDows?: number[];
  goalSec?: number | null;
  trainedRecently?: boolean;
}

/** Ugovor `generatePlan`: zajednički ulaz → ulaz v2 (rezultat sa datumom, tačni dani, cilj; početnik = `trainedRecently
 *  === false`). Šta zajednički ulaz ne nosi (lak tempo, 30 min kontinuirano) v2 traži sam i odbija ako nedostaje. */
export function generatePlan(input: ContractInput): GeneratedV2Plan | { error: string } {
  const start = alignedStart(input.raceDate, input.startDate);
  const dist = input.pb?.distM;
  const v2: Record<string, unknown> = {
    startDate: start ?? input.startDate,
    raceDate: input.raceDate,
    runDays: (input.runDows ?? []).map((d) => WEEKDAYS[d - 1]),
    currentWeeklyKm: input.weeklyKm,
    recentResult:
      input.pb && input.pb.date
        ? { distanceM: dist, timeSec: input.pb.sec, date: input.pb.date }
        : null,
    goalTimeSec: input.goalSec ?? null,
    experience: input.trainedRecently === false ? 'beginner' : 'regular'
  };
  const r = generateFiveKV2(v2);
  if (!r.ok)
    return {
      error: rejection(r)
        .map((x) => x.message)
        .join(' ')
    };
  return generatedPlan(r.plan);
}

const isGenerated = (g: unknown): g is GeneratedV2Plan =>
  typeof g === 'object' &&
  g !== null &&
  'fiveKV2' in g &&
  Array.isArray((g as { weeks?: unknown }).weeks);

/** Ugovor `adaptGeneratedPlan`: izlaz v2 generatora → plan za upis; odbijanje ili tuđ izlaz → `null`. */
export function adaptGeneratedPlan(gen: { error: string } | object): GenPlanState | null {
  if ('error' in gen || !isGenerated(gen)) return null;
  return storedPlan(gen);
}

/** Procena za čarobnjak iz rezultata: trenutna forma (v2 ne projektuje napredak), prognoza 5K i ocena cilja v2. */
export function assess(
  pb: { distM: number; sec: number },
  _weeks: number,
  _intensity: unknown,
  goalSec: number | null
) {
  const vdot = round1(vdotFromResult(pb.distM, pb.sec));
  const goal = goalSec ? assessGoal(vdot, goalSec) : null;
  return {
    assessmentBasis: 'current-fitness' as const,
    vdot0: vdot,
    vdotGoal: vdot,
    predictedSec: raceTimeForVdot(vdot, DISTANCE_M),
    realno: goal ? goal.status === 'feasible' : null,
    goalVdot: goal ? goal.goalVdot : null
  };
}

/** Proizvod 5K v2: ime i najkraća priprema iz v2 (6 nedelja). Pojmovi starog 5K proizvoda (bazne nedelje početnika,
 *  prag obima za dva kvaliteta, minimalni vrh) v2 nema — NaN, ne izmišljena vrednost. */
export const PRODUCT = {
  name: '5K',
  minWeeks: P.input.planWeeks.min,
  baseWeeksBeginner: Number.NaN,
  qual2MinKm: Number.NaN,
  minPeakKm: Number.NaN
};
export const product = (raceDistM: number) => (raceDistM === DISTANCE_M ? PRODUCT : undefined);

/** Napor dana: onaj koji v2 propisuje u strukturi dana (deo po osećaju, trčanje/hodanje); bez njega v2 nema smernicu. */
export function rpeTarget(
  d: { rest: boolean; structure?: WorkoutStructure } | null | undefined
): RpeTarget | null {
  if (!d || d.rest) return null;
  const r = d.structure?.rpe;
  return r ? { min: r.min, max: r.max, txt: r.txt } : null;
}
