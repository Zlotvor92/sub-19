/* 5K v2 → aplikacija: 5K v2 kao CILJ predaje „kraća distanca" (faza 3, segment 3d; DESIGN.md § 3 P3/P5, § 8 O3a, O4a,
   O6b). Izvor je HM v2 (`halfMarathon/v2/app/preparation.ts`); obrazac je HM v2 cilj (3f), kopija, ne uvoz.

   Izvor predaje samo činjenice: ulaz čarobnjaka bez izvedenih polja, potvrđeno izvršenje i sirove činjenice (`raw`).
   Ovaj cilj iz njih sam gradi plan:
   1. generate: ulaz cilja iz činjenica ulaza. Obim je iz čarobnjaka izvora (O3a), trka istog datuma. Start je prva
      granica nedelje posle dana potvrde (`alignedStart(trka, asOf + 1)`). Rezultat ide doslovno (distancu proverava
      ulaz 5K v2: 3K/5K/10K); lak tempo samo ako ga izvor ima. Početnik: plan izvora je kontinuirano trčanje (HM v2
      nema trčanje/hodanje), pa `canRun30Min: true` — činjenica izvora, ne nov broj. Dan dugog 5K v2 bira sam.
   2. adapt(plan, raw, asOf): povratnu politiku (pauza, manjak, bol, umor) određuje adaptacija OVOG generatora; nema
      novih brojeva. Potvrđena pauza iz izvršenja je činjenica pauze. `dayId` i zaključani dani izvora se ne čitaju
      (dan izvora nije dan cilja).
   3. O6(b): prošle nedelje i tekuća nedelja izvora ostaju doslovno ispred plana (`plan.ts` prefiks). Nedelje cilja
      imaju broj i id dana kao nedelja izvora istog početka. Oba plana v2 se završavaju danom trke (`alignedStart`),
      pa su granice nedelja iste. Nedelja izvora bez iste granice → odbijanje sa razlogom.
   Odbijanje generatora ili adaptacije → opcija nedostupna, uz razlog v2 doslovno (O4a); van 6–16 nedelja →
   PLAN_LENGTH_OUT_OF_RANGE doslovno (O8a). Nema tihog prelaza na v1.
   Pokrivenost: 5K v2 nema pojam nepotpune pripreme (plan koji generator i adaptacija prihvate je plan 5K po pravilima
   5K v2), pa je prihvaćen plan 'full'. */

import { adaptFiveKV2 } from '../adapt.ts';
import { generateFiveKV2 } from '../generate.ts';
import type { Weekday } from '../types.ts';
import { addDays, isIsoDate } from './date.ts';
import { confirmedBreakFact } from './facts.ts';
import { alignedStart, rejection } from './generate.ts';
import { generatedPlan, storedPlan } from './plan.ts';
import type { GenPlanState } from '../../exchange.ts';
import type { IsoDate } from './date.ts';

const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Ulaz ugovora koji izvor predaje (samo činjenice čarobnjaka; `easyPaceSecPerKm` samo izvor v2 koji ga ima). */
export interface HandoffInput {
  raceDate: string;
  pb?: { distM: number; sec: number; date?: string };
  weeklyKm: number;
  runDows?: number[];
  trainedRecently?: boolean;
  easyPaceSecPerKm?: number;
}
interface Execution {
  date: string;
  reason?: string;
  breakDays: number;
}
export interface HandoffFacts {
  execution: Execution | null;
  restartFromBase: boolean;
  notes?: string[];
  meta?: Record<string, unknown>;
  raw?: Readonly<Record<string, unknown>>;
}
export type Coverage = 'full' | 'distance' | 'insufficient';

const fail = (reasons: readonly { message: string }[]): { error: string } => ({
  error: reasons.map((r) => r.message).join(' ')
});

/** Činjenice za adaptaciju cilja: sirove činjenice izvora bez `dayId` i bez zaključanih dana izvora; potvrđena pauza
 *  iz izvršenja (N dana do dana potvrde) kao prijavljena pauza. */
export function targetFacts(facts: HandoffFacts): Record<string, unknown> {
  const { lockedDayIds: _locked, ...raw } = (facts.raw ?? {}) as Record<string, unknown>;
  const workouts = raw['workouts'] as Record<string, unknown>[] | undefined;
  const e = facts.execution;
  const brk =
    e && e.reason === 'confirmed-break' && e.breakDays > 0 && isIsoDate(e.date)
      ? [confirmedBreakFact(e.date, e.breakDays)]
      : [];
  const breaks = [...((raw['breaks'] as unknown[] | undefined) ?? []), ...brk];
  return {
    ...raw,
    ...(workouts ? { workouts: workouts.map(({ dayId: _d, ...w }) => w) } : {}),
    ...(breaks.length ? { breaks } : {})
  };
}

/** Ulaz 5K v2 iz činjenica ulaza izvora (bez izvedenih polja izvora). */
export function targetInput(
  input: HandoffInput,
  start: string,
  weekOffset = 0
): Record<string, unknown> {
  const pb = input.pb;
  const beginner = input.trainedRecently === false;
  return {
    startDate: start,
    raceDate: input.raceDate,
    runDays: (input.runDows ?? []).map((d) => WEEKDAYS[d - 1]),
    currentWeeklyKm: input.weeklyKm,
    recentResult: pb && pb.date ? { distanceM: pb.distM, timeSec: pb.sec, date: pb.date } : null,
    ...(input.easyPaceSecPerKm != null ? { typicalEasyPaceSecPerKm: input.easyPaceSecPerKm } : {}),
    experience: beginner ? 'beginner' : 'regular',
    ...(beginner ? { canRun30Min: true } : {}),
    goalTimeSec: null,
    // 08l (3i): broj nedelja izvora ispred plana (= prefiks) — poruke jezgra sa brojem nedelje ga dodaju.
    ...(weekOffset > 0 ? { weekOffset } : {})
  };
}

/** Plan 5K iz činjenica izvora (predaja „kraća distanca"): plan za upis i pokrivenost, ili odbijanje sa razlogom v2
 *  doslovno. */
export function handoffFuture(
  current: GenPlanState,
  input: HandoffInput,
  today: IsoDate,
  _context: unknown,
  facts: HandoffFacts
): { result: GenPlanState; coverage: Coverage } | { error: string } {
  if (!isIsoDate(today)) return { error: 'Neispravan datum predaje.' };
  const start = alignedStart(input.raceDate, addDays(today, 1));
  if (!start) return { error: 'Do trke nema cele nedelje posle dana predaje.' };
  // O6(b): nedelje izvora pre starta cilja ostaju; nedelja izvora sa istim početkom daje broj (i id) nedelja cilja.
  const at = current.weeks.find((w) => w.start === start);
  if (!at)
    return {
      error:
        'Nedelje plana izvora se ne poklapaju sa nedeljama 5K istog dana trke; kraća distanca se ne pravi.'
    };
  const prefix = {
    offset: at.w - 1,
    weeks: current.weeks.filter((w) => w.start < start)
  };
  const g = generateFiveKV2(targetInput(input, start, prefix.offset));
  if (!g.ok) return fail(rejection(g));
  const a = adaptFiveKV2(g.plan, targetFacts(facts), today);
  if (!a.ok) return fail(rejection(a));
  return { result: storedPlan(generatedPlan(a.plan), prefix), coverage: 'full' };
}
