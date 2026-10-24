/* HM v2 → aplikacija: HM v2 kao CILJ predaje „kraća distanca" (faza 3, segment 3f; DESIGN.md § 3 P3/P5, § 8 O3a, O4a,
   O6b). Za sada ga koristi maraton v2 kao izvor (3e).

   Izvor predaje samo činjenice: ulaz čarobnjaka bez izvedenih polja, potvrđeno izvršenje i sirove činjenice (`raw`).
   Ovaj cilj iz njih sam gradi plan:
   1. generate: ulaz cilja iz činjenica ulaza. Obim je iz čarobnjaka izvora (O3a), trka istog datuma. Start je prva
      granica nedelje posle dana potvrde (`alignedStart(trka, asOf + 1)`).
   2. adapt(plan, raw, asOf): povratnu politiku (pauza, manjak, bol, umor) određuje adaptacija OVOG generatora; nema
      novih brojeva. Potvrđena pauza iz izvršenja je činjenica pauze. `dayId` i zaključani dani izvora se ne čitaju
      (dan izvora nije dan cilja).
   3. O6(b): prošle nedelje i tekuća nedelja izvora ostaju doslovno ispred plana (`plan.ts` prefiks). Nedelje cilja
      imaju broj i id dana kao nedelja izvora istog početka. Oba plana v2 se završavaju danom trke, pa su granice
      nedelja iste; pregrupisanje u ponedeljak (dopuna 3b) ovde nije potrebno. Nedelja izvora bez iste granice →
      odbijanje sa razlogom.
   Odbijanje generatora ili adaptacije → opcija nedostupna, uz razlog v2 doslovno (O4a). Nema tihog prelaza na v1.
   Pokrivenost po pravilu ovog cilja: najduži dugi ≥ praga upozorenja (`longRunShort`) → 'full', inače 'insufficient'. */

import { adaptHmV2 } from '../adapt.ts';
import { generateHmV2 } from '../generate.ts';
import { longRunShort } from '../lengths.ts';
import { longWarnKmOf } from '../shorter.ts';
import { userText } from '../userText.ts';
import type { Weekday } from '../types.ts';
import { addDays, isIsoDate } from './date.ts';
import { confirmedBreakFact } from './facts.ts';
import { alignedStart, rejection } from './generate.ts';
import { generatedPlan, storedPlan } from './plan.ts';
import type { AppPlan, IsoDate, StoredPlan, StoredWeek } from './types.ts';

const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** Ulaz ugovora koji izvor predaje (samo činjenice čarobnjaka; `easyPaceSecPerKm` samo izvor v2 po osećaju). */
export interface HandoffInput {
  raceDate: string;
  pb?: { distM: number; sec: number; date?: string };
  weeklyKm: number;
  recentLongRunKm?: number;
  runDows?: number[];
  lrDow?: number;
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
  error: reasons.map((r) => userText(r.message)).join(' ')
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

/** Ulaz HM v2 iz činjenica ulaza izvora (bez izvedenih polja izvora). */
export function targetInput(
  input: HandoffInput,
  start: string,
  weekOffset = 0
): Record<string, unknown> {
  const pb = input.pb;
  return {
    startDate: start,
    raceDate: input.raceDate,
    runDays: (input.runDows ?? []).map((d) => WEEKDAYS[d - 1]),
    longRunDay: input.lrDow != null ? (WEEKDAYS[input.lrDow - 1] ?? null) : null,
    currentWeeklyKm: input.weeklyKm,
    recentResult: pb && pb.date ? { distanceM: pb.distM, timeSec: pb.sec, date: pb.date } : null,
    ...(input.easyPaceSecPerKm != null ? { easyPaceSecPerKm: input.easyPaceSecPerKm } : {}),
    ...(input.recentLongRunKm != null ? { recentLongRunKm: input.recentLongRunKm } : {}),
    experience: input.trainedRecently === false ? 'beginner' : 'regular',
    goalTimeSec: null,
    // 3i: broj nedelja prefiksa izvora — poznat uslov jezgra (broj nedelje u porukama = broj u kalendaru).
    ...(weekOffset > 0 ? { weekOffset } : {})
  };
}

/** Plan polumaratona iz činjenica izvora (predaja „kraća distanca"): plan za upis i pokrivenost, ili odbijanje sa
 *  razlogom v2 doslovno. */
export function handoffFuture(
  current: AppPlan,
  input: HandoffInput,
  today: IsoDate,
  _context: unknown,
  facts: HandoffFacts
): { result: StoredPlan; coverage: Coverage } | { error: string } {
  if (!isIsoDate(today)) return { error: 'Neispravan datum predaje.' };
  const start = alignedStart(input.raceDate, addDays(today, 1));
  if (!start) return { error: 'Do trke nema cele nedelje posle dana predaje.' };
  // O6(b): nedelje izvora pre starta cilja ostaju; nedelja izvora sa istim početkom daje broj (i id) nedelja cilja.
  const at = current.weeks.find((w) => w.start === start);
  if (!at)
    return {
      error:
        'Nedelje plana izvora se ne poklapaju sa nedeljama polumaratona istog dana trke; kraća distanca se ne pravi.'
    };
  const prefix = {
    offset: at.w - 1,
    weeks: current.weeks.filter((w) => w.start < start) as unknown as StoredWeek[]
  };
  const ti = targetInput(input, start, prefix.offset);
  // Z5b (uslov 5): politiku određuje cilj — početnik izvora iznad opsega početnika OVOG generatora
  // (WEEKLY_KM_TOO_HIGH, odluka input.checkInput) → plan bez oznake početnika, kako poruka i kaže.
  let g = generateHmV2(ti);
  if (
    !g.ok &&
    ti['experience'] === 'beginner' &&
    g.reasons.some((r) => r.code === 'WEEKLY_KM_TOO_HIGH')
  )
    g = generateHmV2({ ...ti, experience: 'regular' });
  if (!g.ok) return fail(rejection(g.reasons));
  const a = adaptHmV2(g.plan, targetFacts(facts), today);
  if (!a.ok)
    return fail([...rejection(a.reasons), ...a.violations.filter((v) => v.severity === 'error')]);
  const result = storedPlan(generatedPlan(a.plan), prefix);
  const warn = longWarnKmOf(a.plan);
  return {
    result,
    coverage: warn !== null && !longRunShort(a.plan.weeks, warn) ? 'full' : 'insufficient'
  };
}
