/* A11 — plan kakav se upisuje posle adaptacije (jedino mesto spajanja; 10k-v2.5.1: prošlost = upisani dani).
   Nedelja koja je cela ≤ asOf ostaje iz prethodnog plana; u ostalim nedeljama zaštićeni dani (≤ asOf, urađeni,
   zaključani) iz prethodnog plana i sastavljeni dani na ostalim datumima. Čitaju ga spajanje (adapt.ts) i
   konstruktor (generate.ts): svako stanje koje zavisi od prošlosti (najduži dugi D7, poslednji dugi D5, stanje
   doze D5/D7/D31, taper za trkačku nedelju D8/D23) i validacija u construct vide upisane dane. */

import { mustDay } from './dates.ts';
import type { PlanDay, PlanWeek } from './types.ts';

/** Prethodni plan i zaštita dana (A11) — konstruktor ih zna unapred (Uslov 4). */
export interface Written {
  weeks: readonly PlanWeek[];
  /** Zaštićen dan: ≤ asOf, urađen ili zaključan. */
  keep: (d: PlanDay) => boolean;
  /** asOf (broj dana) i kao datum (napomena spajanja). */
  asOf: number;
  at: string;
  lockedDayIds: readonly string[];
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Dani nedelje kakvi se upisuju: `prev` = ista nedelja prethodnog plana, `built` = sastavljeni dani. */
export function writtenDays(
  prev: PlanWeek,
  built: readonly PlanDay[],
  w: Written
): readonly PlanDay[] {
  if (mustDay(prev.endDate) <= w.asOf) return prev.days;
  return [
    ...prev.days.filter(w.keep),
    ...built.filter((d) => !prev.days.some((x) => x.date === d.date && w.keep(x)))
  ].sort((x, y) => x.date.localeCompare(y.date));
}

/** Nedelje plana kakve se upisuju i mešovite nedelje (A11/A15) iz sastavljenih nedelja `built`. */
export function writtenWeeks(
  built: readonly PlanWeek[],
  w: Written
): { weeks: PlanWeek[]; mixed: number[] } {
  const t = w.asOf;
  const mixed: number[] = [];
  const weeks = built.map((b, i) => {
    const s = w.weeks[i]!;
    if (mustDay(s.endDate) <= t) {
      if (!same(s, b)) mixed.push(s.index);
      return s;
    }
    const days = [...writtenDays(s, b.days, w)];
    if (same(days, b.days)) return same(s, b) ? s : b;
    mixed.push(s.index);
    const kept = s.days.filter((d) => w.keep(d) && mustDay(d.date) > t).map((d) => d.date);
    const past = mustDay(s.startDate) <= t;
    return {
      ...b,
      days,
      plannedKm:
        days.reduce((a, d) => a + (d.countsToWeek ? Math.round(d.workout.km * 100) : 0), 0) / 100,
      notes: [
        ...b.notes,
        `Adaptacija ${w.at}: ${past ? `dani do ${w.at} nepromenjeni` : ''}${kept.length > 0 ? `${past ? '; ' : ''}zaključano/urađeno zadržano: ${kept.join(', ')}` : ''}.`
      ]
    };
  });
  return { weeks, mixed };
}
