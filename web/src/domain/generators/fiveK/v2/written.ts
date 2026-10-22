/* 2.8.0 (pouka 29): plan kakav se upisuje posle adaptacije — JEDINO mesto spajanja (obrazac 10K written.ts,
   kopiran, ne uvezen — Uslov 7). Nedelja koja je cela ≤ asOf ostaje iz prethodnog plana; u ostalim nedeljama
   zaštićeni dani (≤ asOf, urađeni, zaključani) iz prethodnog plana i sastavljeni dani na ostalim datumima.
   Čitaju ga spajanje (adapt.ts) i konstruktor (generate.construct): svako stanje koje zavisi od prošlosti
   (poslednji dugi trkačke nedelje, stanje doze, taper za trkačku nedelju, kontrolno trčanje) konstruktor
   računa iz upisanih dana, a validator vidi isti upisani plan. */

import { mustDay } from './dates.ts';
import type { PlanDay, PlanWeek } from './types.ts';

/** Prethodni plan i zaštita dana — konstruktor ih zna unapred (Uslov 4). */
export interface Written {
  weeks: readonly PlanWeek[];
  /** Zaštićen dan: ≤ asOf, urađen ili zaključan. */
  keep: (d: PlanDay) => boolean;
  /** asOf (broj dana) i kao datum (napomena spajanja). */
  asOf: number;
  at: string;
  /** 2.10.1 (pouka 37): km zaštićenog dana po činjenicama (assess.factKmOf); null/izostavljeno = planirani km. */
  factKm?: (d: PlanDay) => number | null;
}

const r2 = (x: number): number => Math.round(x * 100) / 100;
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

/** Nedelja kakva se upisuje (`prev` iz prethodnog plana, `b` sastavljena); `mixed` = razlikuje se od `b`. */
export function writtenWeek(
  prev: PlanWeek,
  b: PlanWeek,
  w: Written
): { week: PlanWeek; mixed: boolean } {
  if (mustDay(prev.endDate) <= w.asOf) return { week: prev, mixed: !same(prev, b) };
  const days = [...writtenDays(prev, b.days, w)];
  // 2.10.1 (pouka 37): nedelja sa zbirom zaštićenih po činjenicama (protectedKm) je mešovita i kad su dani isti.
  if (same(days, b.days) && b.protectedKm === undefined)
    return { week: same(prev, b) ? prev : b, mixed: false };
  const kept = prev.days.filter((d) => w.keep(d) && mustDay(d.date) > w.asOf).map((d) => d.date);
  const past = mustDay(prev.startDate) <= w.asOf;
  return {
    week: {
      ...b,
      days,
      plannedKm: r2(days.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0)),
      notes: [
        ...b.notes,
        `Adaptacija ${w.at}: ${past ? `dani do ${w.at} nepromenjeni` : ''}${kept.length > 0 ? `${past ? '; ' : ''}zaključano/urađeno zadržano: ${kept.join(', ')}` : ''}.`
      ]
    },
    mixed: true
  };
}

/** Nedelje plana kakve se upisuju i mešovite nedelje iz sastavljenih nedelja `built`. */
export function writtenWeeks(
  built: readonly PlanWeek[],
  w: Written
): { weeks: PlanWeek[]; mixed: number[] } {
  const mixed: number[] = [];
  const weeks = built.map((b, i) => {
    const r = writtenWeek(w.weeks[i]!, b, w);
    if (r.mixed) mixed.push(b.index);
    return r.week;
  });
  return { weeks, mixed };
}
