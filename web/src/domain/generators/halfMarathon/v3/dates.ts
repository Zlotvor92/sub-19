/* Kalendar bez vremenske zone: datum = broj dana od 1970-01-01 (UTC). */
import { WEEKDAYS, type Weekday } from './types.ts';

const DAY = 86_400_000;

export function parseIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return Math.round(t / DAY);
}

export function toIso(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

export function weekdayOf(day: number): Weekday {
  // 1970-01-01 je četvrtak
  return WEEKDAYS[(((day + 3) % 7) + 7) % 7]!;
}

/** ponedeljak nedelje kojoj dan pripada */
export const mondayOf = (day: number): number => day - WEEKDAYS.indexOf(weekdayOf(day));

export function fmtShort(day: number): string {
  const [, m, d] = toIso(day).split('-');
  return `${d}.${m}.`;
}
