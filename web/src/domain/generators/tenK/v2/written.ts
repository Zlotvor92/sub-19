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
  /** 06f: urađeni dani posle asOf (zaštićeni; validator ih ne sudi po danu). */
  doneDayIds: readonly string[];
  /** Pouka 37 (10k-v2.8.0): km zaštićenog dana po ČINJENICAMA (adapt.ts iz činjenica; protectedKm ga sabira). */
  factKm: (d: PlanDay) => number;
}

/** Pouka 37 (10k-v2.8.0): zaštićeni dani nedelje prethodnog plana `prev` koja nije cela ≤ asOf (prazno: cela je prošlost). */
export function keptDays(prev: PlanWeek, w: Written): PlanDay[] {
  return mustDay(prev.endDate) <= w.asOf ? [] : prev.days.filter(w.keep);
}

/**
 * Pouka 37 (10k-v2.8.0, dopuna 5K-08i) — JEDINA definicija zbira zaštićenih dana mešovite nedelje: dani ≤ asOf po
 * činjenicama, ne po planu — dan u prijavljenoj pauzi 0, dan sa upisanim treningom upisani km (neurađen 0), ≤ asOf
 * bez zapisa po pokrivenosti/planu (factKm). C4 (10K-08, MASTER pouka 37, kao 5K/MAR): zaštićen dan POSLE asOf
 * (urađen unapred, zaključan) = planirani km. Neodrađen dan tako ne „jede" cilj nedelje.
 */
export function protectedKm(kept: readonly PlanDay[], w: Written): number {
  return (
    kept.reduce(
      (a, d) =>
        a +
        Math.round(
          (mustDay(d.date) > w.asOf ? (d.countsToWeek ? d.workout.km : 0) : w.factKm(d)) * 100
        ),
      0
    ) / 100
  );
}

/** Pouka 37 (organizator, jedno pravilo za sve 4 distance; uzor 5K-08i-b): km dana po činjenicama (adapt.ts gradi
    `Written.factKm`): eksplicitna pauza → 0; zapisi dana (dayId ili datum) → zbir urađenih km (neurađen 0); dan POZNAT iz
    potpune pokrivenosti (A10) bez zapisa → 0; inače (bez zapisa i bez pokrivenosti, zaključan budući dan) → planirano. */
export function factKmOf(
  workouts: readonly { date: string; dayId?: string; km: number; completed: boolean }[],
  breaks: readonly { from: string; to: string }[],
  coverage: { from: string; to: string; complete: boolean } | null = null
): (d: PlanDay) => number {
  return (d) => {
    const t = mustDay(d.date);
    if (breaks.some((b) => mustDay(b.from) <= t && t <= mustDay(b.to))) return 0;
    const recs = workouts.filter((x) => (x.dayId ?? x.date) === d.date);
    if (recs.length > 0) return recs.reduce((a, x) => a + (x.completed ? x.km : 0), 0);
    if (coverage?.complete && mustDay(coverage.from) <= t && t <= mustDay(coverage.to)) return 0;
    return d.countsToWeek ? d.workout.km : 0;
  };
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Dani nedelje kakvi se upisuju: `prev` = ista nedelja prethodnog plana, `built` = sastavljeni dani. */
export function writtenDays(
  prev: PlanWeek,
  built: readonly PlanDay[],
  w: Written
): readonly PlanDay[] {
  if (mustDay(prev.endDate) <= w.asOf) return prev.days;
  // 10K-08 (T1): dan ≤ asOf koga prethodni plan nema (odmor) ostaje odmor — prošlost se ne dopisuje.
  return [
    ...prev.days.filter(w.keep),
    ...built.filter(
      (d) => mustDay(d.date) > w.asOf && !prev.days.some((x) => x.date === d.date && w.keep(x))
    )
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
    // Pouka 37: nedelja sa preostalim danima na ostatku (keptKm) je mešovita i kad su zaštićeni dani isti kao sastavljeni.
    if (same(days, b.days) && b.keptKm === undefined) return same(s, b) ? s : b;
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
