/* A11 — plan kakav se upisuje posle adaptacije (jedino mesto spajanja; pouka 29: prošlost = upisani dani). Nedelja
   koja je cela ≤ asOf ostaje iz prethodnog plana; u ostalim nedeljama zaštićeni dani (≤ asOf, urađeni, zaključani) iz
   prethodnog plana i sastavljeni dani na ostalim datumima. Čitaju ga spajanje (adapt.ts) i konstruktor (generate.ts):
   svako stanje koje zavisi od prošlosti (najduži dugi M7, dugi prethodnih nedelja M13a, poslednji dugi M5, stanje doze
   M5/M7/M12 uključujući MP, taper za trkačku nedelju M8) i validacija u construct vide upisane dane. Kopija obrasca
   tenK/v2/written.ts (ne uvoz). */

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
  /** MAR-07b: urađeni dani posle asOf (zaštićeni; validator ih ne sudi). */
  doneDayIds: readonly string[];
  /** MAR-08 (pouka 37): km zaštićenih dana po činjenicama (mixed.factKmOf). */
  factKm: Readonly<Record<string, number>>;
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
    // MAR-08 (pouka 37): nedelja sa zaštićenim danom čiji se km po činjenicama razlikuje od plana je mešovita i kad su
    // dani isti kao sastavljeni (ostatak se računa po činjenicama).
    const facts = days.some((d) => w.factKm[d.date] !== undefined);
    if (same(days, b.days) && !facts) return same(s, b) ? s : b;
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
