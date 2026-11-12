/* V4 — OBLIKOVANJE ZA ČOVEKA (§ 14.2): decimalni zarez, datumi „17. 11.", množina kroz jednu funkciju. */
import { dayNumber, weekdayOf } from './dates';
import type { IsoDate, Meters, SecPerKm, Seconds } from './types';

export type Forms = readonly [one: string, few: string, many: string];

export const WEEKS: Forms = ['nedelja', 'nedelje', 'nedelja'];
export const DAYS: Forms = ['dan', 'dana', 'dana'];
export const WORKOUTS: Forms = ['trening', 'treninga', 'treninga'];
export const KM: Forms = ['kilometar', 'kilometra', 'kilometara'];

export const MINUTES: Forms = ['minut', 'minuta', 'minuta'];

/** Padež imenice uz broj: nominativ („do trke je 1 nedelja") ili akuzativ („produži za 1 nedelju"). */
export type Case = 'nom' | 'acc';

/** Akuzativ se razlikuje od nominativa samo gde je ovde naveden (ženski rod u jednini). */
const ACCUSATIVE = new Map<Forms, Forms>([[WEEKS, ['nedelju', 'nedelje', 'nedelja']]]);

/** Oblik imenice uz broj: 1 nedelja, 2 nedelje, 5 nedelja, 11 nedelja, 21 nedelja, 22 nedelje;
    u akuzativu 1 nedelju, 21 nedelju. */
export function pluralForm(n: number, forms: Forms, kase: Case = 'nom'): string {
  const used = kase === 'acc' ? (ACCUSATIVE.get(forms) ?? forms) : forms;
  const abs = Math.abs(Math.round(n));
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last === 1 && lastTwo !== 11) return used[0];
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return used[1];
  return used[2];
}

/** Broj sa imenicom u pravom obliku i padežu. */
export function count(n: number, forms: Forms, kase: Case = 'nom'): string {
  return `${fmtNumber(n)} ${pluralForm(n, forms, kase)}`;
}

/** Pridev + broj + imenica: „prvi dan", „prva 3 dana", „prvih 11 dana". */
export function countWith(n: number, adjective: Forms, noun: Forms): string {
  if (n === 1) return `${adjective[0]} ${noun[0]}`;
  return `${pluralForm(n, adjective)} ${count(n, noun)}`;
}

export const FIRST: Forms = ['prvi', 'prva', 'prvih'];
export const NEXT: Forms = ['naredni', 'naredna', 'narednih'];

/** Broj sa decimalnim zarezom, najviše `digits` decimala, bez nula na kraju. */
export function fmtNumber(value: number, digits = 1): string {
  const scale = 10 ** digits;
  const rounded = Math.round(value * scale) / scale;
  const fixed = rounded.toFixed(digits);
  const text = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  return text.replace('.', ',');
}

export function fmtKm(meters: Meters): string {
  return `${fmtNumber(meters / 1000)} km`;
}

/** Dužina deonice: ispod 1 km u metrima („400 m"), inače u km. */
export function fmtDistance(meters: Meters): string {
  return meters < 1000 ? `${String(Math.round(meters))} m` : fmtKm(meters);
}

const two = (n: number): string => String(n).padStart(2, '0');

/** Trajanje deonice ili oporavka: „20 s", „8 min", „1:30 min". */
export function fmtDuration(sec: Seconds): string {
  const s = Math.round(sec);
  if (s < 60) return `${String(s)} s`;
  if (s % 60 === 0) return `${String(s / 60)} min`;
  return `${String(Math.floor(s / 60))}:${two(s % 60)} min`;
}

/** Trajanje treninga, zaokruženo na minut: „43 min", „1 h 45 min". */
export function fmtMinutes(sec: Seconds): string {
  const min = Math.round(sec / 60);
  if (min < 100) return `${String(min)} min`;
  const rest = min % 60;
  return rest === 0
    ? `${String(Math.floor(min / 60))} h`
    : `${String(Math.floor(min / 60))} h ${String(rest)} min`;
}

/** Vreme trke: „22:30" ili „1:41:00". */
export function fmtClock(sec: Seconds): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${String(h)}:${two(m)}:${two(s % 60)}` : `${String(m)}:${two(s % 60)}`;
}

/** „4:40" */
export function fmtPaceBare(secPerKm: SecPerKm): string {
  const s = Math.round(secPerKm);
  return `${String(Math.floor(s / 60))}:${two(s % 60)}`;
}

/** „4:40/km" */
export function fmtPace(secPerKm: SecPerKm): string {
  return `${fmtPaceBare(secPerKm)}/km`;
}

/** „17. 11." */
export function fmtDate(iso: IsoDate): string {
  return `${String(Number(iso.slice(8, 10)))}. ${String(Number(iso.slice(5, 7)))}.`;
}

/** „17. 11. 2026." */
export function fmtDateYear(iso: IsoDate): string {
  return `${fmtDate(iso)} ${iso.slice(0, 4)}.`;
}

/** „14–20. 12." u istom mesecu, inače „28. 12. – 3. 1." */
export function fmtDateRange(from: IsoDate, to: IsoDate): string {
  if (from === to) return fmtDate(from);
  if (from.slice(0, 7) === to.slice(0, 7))
    return `${String(Number(from.slice(8, 10)))}–${fmtDate(to)}`;
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

const WEEKDAY_SHORT = ['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned'] as const;

export function fmtWeekday(iso: IsoDate): string {
  return Number.isFinite(dayNumber(iso)) ? WEEKDAY_SHORT[weekdayOf(iso)] : '';
}

/** Zamena `{ključ}` u šablonu teksta; nepoznat ključ ostaje prazan. */
export function fillText(template: string, values: Readonly<Record<string, string>>): string {
  return template
    .replace(/\{(\w+)\}/g, (_all, key: string) => values[key] ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Odnos ciljnog vremena i raspona na dan trke (krug 2, R6): sporiji ili jednak očekivanom → dostižan;
    između najbržeg u rasponu i očekivanog → na ivici; brži od najbržeg → van raspona. */
export type GoalStatus = 'dostizan' | 'na-ivici' | 'van-raspona';

export function goalStatus(
  targetSec: Seconds,
  raceDay: { lowSec: Seconds; expectedSec: Seconds }
): GoalStatus {
  if (targetSec >= raceDay.expectedSec) return 'dostizan';
  return targetSec >= raceDay.lowSec ? 'na-ivici' : 'van-raspona';
}

/** Vreme po kom se trči na dan trke (R6): cilj ako je u rasponu, inače očekivano vreme. */
export function raceBasis(
  targetSec: Seconds | undefined,
  raceDay: { lowSec: Seconds; expectedSec: Seconds }
): { timeSec: Seconds; fromGoal: boolean } {
  if (targetSec !== undefined && goalStatus(targetSec, raceDay) !== 'van-raspona') {
    return { timeSec: targetSec, fromGoal: true };
  }
  return { timeSec: raceDay.expectedSec, fromGoal: false };
}
