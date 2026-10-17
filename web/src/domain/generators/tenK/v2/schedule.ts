/* D9 — raspored nedelje po broju dana (D17): 4–6 dana Q1 + Q2 + dugi + lagani (D19), 3 dana jedan kvalitet
   + dugi + lagan (D18); teški dani (kvaliteti i dugi) međusobno nesusedni (ciklično: nedelja i ponedeljak
   su susedni). Jedino mesto izbora dana po ulozi. */

import { WEEKDAYS, weekdayIndex } from './dates.ts';
import { dayRule, TEN_K_V2_POLICY as P } from './policy.ts';
import type { Pattern, Weekday } from './types.ts';

/** Broj dana od a do b unapred (0–6). */
export function forwardGap(a: Weekday, b: Weekday): number {
  return (((weekdayIndex(b) - weekdayIndex(a)) % 7) + 7) % 7;
}

export function adjacentDays(a: Weekday, b: Weekday): boolean {
  return forwardGap(a, b) === 1 || forwardGap(b, a) === 1;
}

const ordered = (days: readonly Weekday[]): Weekday[] =>
  [...days].sort((a, b) => weekdayIndex(a) - weekdayIndex(b));

/** Dan dugog: iz ulaza; bez njega nedelja ako je dan trčanja, inače poslednji dan trčanja u nedelji. */
export function longDayOf(runDays: readonly Weekday[], longRunDay?: Weekday | null): Weekday {
  if (longRunDay) return longRunDay;
  if (runDays.includes(P.schedule.defaultLongDay)) return P.schedule.defaultLongDay;
  return ordered(runDays)[runDays.length - 1]!;
}

/** Šablon ili null kad teški dani ne mogu biti međusobno nesusedni (ili broj dana nije u tabeli D17).
    Više rešenja → najveći razmak dugi → Q1, pa Q1 → Q2, pa raniji Q1 (tehnički, deterministički izbor). */
export function patternOf(
  runDays: readonly Weekday[],
  longRunDay?: Weekday | null
): Pattern | null {
  const rule = dayRule(runDays.length);
  if (!rule) return null;
  const long = longDayOf(runDays, longRunDay);
  const rest = ordered(runDays.filter((d) => d !== long));
  const options: Pattern[] = [];
  for (const a of rest) {
    if (adjacentDays(a, long)) continue;
    // D18: jedan kvalitet — samo nesusedan dugom; lagan bilo gde.
    if (rule.quality === 1) {
      options.push({ long, q1: a, q2: null, easy: rest.filter((d) => d !== a) });
      continue;
    }
    for (const b of rest) {
      if (a === b || adjacentDays(b, long) || adjacentDays(a, b)) continue;
      // Q1 je prvi kvalitet posle dugog (ciklično).
      if (forwardGap(long, a) > forwardGap(long, b)) continue;
      options.push({ long, q1: a, q2: b, easy: rest.filter((d) => d !== a && d !== b) });
    }
  }
  const q1q2 = (p: Pattern): number => (p.q2 ? forwardGap(p.q1, p.q2) : 0);
  options.sort(
    (x, y) =>
      forwardGap(y.long, y.q1) - forwardGap(x.long, x.q1) ||
      q1q2(y) - q1q2(x) ||
      weekdayIndex(x.q1) - weekdayIndex(y.q1)
  );
  return options[0] ?? null;
}

/** Predlog za SCHEDULE_NO_RECOVERY: drugi dan dugog među izabranim danima, pa zamena jednog dana. */
export function suggestSchedule(
  runDays: readonly Weekday[],
  longRunDay?: Weekday | null
): { runDays: Weekday[]; long: Weekday } | null {
  if (longRunDay)
    for (const l of ordered(runDays))
      if (l !== longRunDay && patternOf(runDays, l)) return { runDays: ordered(runDays), long: l };
  for (const out of ordered(runDays))
    for (const add of WEEKDAYS) {
      if (runDays.includes(add)) continue;
      const days = ordered([...runDays.filter((d) => d !== out), add]);
      const keep = longRunDay && days.includes(longRunDay) ? longRunDay : null;
      const p = patternOf(days, keep);
      if (p) return { runDays: days, long: p.long };
    }
  return null;
}
