/* „Tempo isprekidan" (cruise intervali): prag u ponavljanjima sa kratkom pauzom u laganom trčanju. */

import type { SessionDay } from '../types';
import { sessInt, sessTempo, wuCdForVolume } from './build';

export interface CruiseParams {
  /** Željeni pod praga; nikada ne sme da podigne rad iznad budžeta. */
  floorCapKm: number;
  floorShare: number;
  /** Dužina ponavljanja po ukupnom pragu, od najvećeg praga nadole; ispod poslednjeg `minRepKm`. */
  ladder: ReadonlyArray<{ fromKm: number; repKm: number }>;
  minRepKm: number;
  restSec(repKm: number): number;
}

export function cruiseIntervals(
  tempoBudgetPct: number,
  p: CruiseParams,
  dow: number,
  vol: number,
  pT: number,
  share?: number | null
): SessionDay {
  const budget = vol * tempoBudgetPct;
  const desired = Math.max(Math.min(p.floorCapKm, vol * p.floorShare), budget);
  const total = Math.min(desired, budget) * (share ?? 1);
  const [wu, cd] = wuCdForVolume(vol);
  // A ladder threshold is a preference, not permission to exceed the budget
  // with the minimum two repetitions (e.g. 2×1600 at 30 km/week).
  const repKm =
    p.ladder.find((s) => total >= s.fromKm && 2 * s.repKm <= total + 1e-9)?.repKm ?? p.minRepKm;
  if (total + 1e-9 < 2 * repKm) {
    const day = sessTempo(
      dow,
      wu,
      Math.floor((total + 1e-9) * 10) / 10,
      pT,
      Math.max(cd, 1),
      'Tempo'
    );
    day.session.notes =
      'Kratak kontinuirani prag: budžet ne podržava dva puna pragovska ponavljanja.';
    day.desc = `${day.desc} · ${day.session.notes}`;
    return day;
  }
  const n = Math.floor((total + 1e-9) / repKm);
  return sessInt(
    dow,
    wu,
    n,
    Math.round(repKm * 1000),
    pT,
    p.restSec(repKm),
    Math.max(cd, 1),
    'Tempo isprekidan'
  );
}
