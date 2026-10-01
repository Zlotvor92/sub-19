/* „Tempo isprekidan" (cruise intervali): prag u ponavljanjima sa kratkom pauzom u laganom trčanju. */

import type { SessionDay } from '../types';
import { sessInt, wuCdForVolume } from './build';

export interface CruiseParams {
  /** Ukupan prag: najviše `floorCapKm` km ili `floorShare` × obim (veće od toga i budžeta). */
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
  const total =
    Math.max(Math.min(p.floorCapKm, vol * p.floorShare), vol * tempoBudgetPct) * (share || 1);
  const repKm = p.ladder.find((s) => total >= s.fromKm)?.repKm ?? p.minRepKm;
  const n = Math.max(2, Math.floor(total / repKm + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
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
