/* 5K v2 → aplikacija: kalendarske funkcije sa potpisom formata razmene (brendirani `IsoDate`), nad aritmetikom
   `../dates.ts` (bez sata i vremenske zone). Iste vrednosti kao `fiveK/date` (kopija ponašanja, ne uvoz). */

import type { IsoDate } from '../../exchange.ts';
import { addDays as add, dayNumber, mustDay, weekdayIndexOfDay } from '../dates.ts';

export type { IsoDate };

/** Strogo: samo postojeći kalendarski datum oblika YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is IsoDate {
  return dayNumber(value) !== null;
}

export function parseIsoDate(value: unknown): IsoDate | null {
  return isIsoDate(value) ? value : null;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return add(date, days) as IsoDate;
}

/** Broj dana od `from` do `to` (pozitivan ako je `to` kasnije). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return mustDay(to) - mustDay(from);
}

/** 0 = ponedeljak … 6 = nedelja. */
export function weekdayIndex(date: IsoDate): number {
  return weekdayIndexOfDay(mustDay(date));
}
