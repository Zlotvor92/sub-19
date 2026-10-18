/* ČAROBNJAK 10K v2 (segment 05, samo uz uključen prekidač i 10K): polja koja v2 traži — rezultat (3/5/10 km,
   polumaraton) ILI uobičajen lagan tempo, iskustvo (početnik/redovno), trčanje/hodanje, trenutni obim, tačni dani i dan
   dugog, opcioni cilj — i prevod u ulaz v2. Pravila (opsezi, broj dana, razmak, trajanje plana, odbijanje trčanja/
   hodanja sa preporukom 5K) proverava v2 i odbija sa razlozima; ovde je samo provera da su polja popunjena. Bez DOM-a. */

import { diffDays, parseIsoDate, type IsoDate } from '../date';
import { tenKV2Start } from '../generators/select';
import type { TenKV2PlanInput, WeekdayName } from '../generators/contract';

export const TEN_K_V2_STEPS = 4;
/** Distance rezultata koje v2 prihvata (D1). */
export const TEN_K_V2_RESULT_DISTS = [
  [3000, '3 km'],
  [5000, '5 km'],
  [10000, '10 km'],
  [21097.5, 'Polumaraton']
] as const;
export type TenKV2ResultDist = (typeof TEN_K_V2_RESULT_DISTS)[number][0];
/** Rezultat stariji od ovoga v2 ne koristi za tempo (plan po osećaju) — prikazni prag, odluku donosi v2. */
export const TEN_K_V2_RESULT_FRESH_DAYS = 84;

export interface TenKV2Wizard {
  /** null dok korisnik ne izabere. */
  hasResult: boolean | null;
  resultDist: TenKV2ResultDist;
  resH: string;
  resMin: string;
  resSec: string;
  resDate: string;
  easyMin: string;
  easySec: string;
  weeklyKm: string;
  experience: 'beginner' | 'regular' | null;
  /** Neprekidno trčanje 30 min; „ne" → trčanje/hodanje (v2 odbija sa preporukom 5K). */
  canRun30: boolean | null;
  /** 1 = ponedeljak … 7 = nedelja. */
  runDows: number[];
  /** Dan dugog trčanja (jedan od izabranih); null = bira plan. */
  longDow: number | null;
  goalMin: string;
  goalSec: string;
}

export const initialTenKV2Wizard = (): TenKV2Wizard => ({
  hasResult: null,
  resultDist: 10000,
  resH: '',
  resMin: '',
  resSec: '',
  resDate: '',
  easyMin: '',
  easySec: '',
  weeklyKm: '',
  experience: null,
  canRun30: null,
  runDows: [],
  longDow: null,
  goalMin: '',
  goalSec: ''
});

const WEEKDAYS: readonly WeekdayName[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function secOf(h: string, min: string, sec: string): number | null {
  if (min === '' || sec === '') return null;
  const hh = h === '' ? 0 : +h;
  const m = +min;
  const s = +sec;
  if (![hh, m, s].every((x) => Number.isInteger(x) && x >= 0) || s > 59) return null;
  const t = hh * 3600 + m * 60 + s;
  return t > 0 ? t : null;
}
/** Polumaraton se upisuje sa satima. */
export const tenKV2ResultHasHours = (v: TenKV2Wizard): boolean => v.resultDist === 21097.5;
export const tenKV2ResultSec = (v: TenKV2Wizard): number | null =>
  secOf(tenKV2ResultHasHours(v) ? v.resH : '', v.resMin, v.resSec);
export const tenKV2EasyPaceSec = (v: TenKV2Wizard): number | null =>
  secOf('', v.easyMin, v.easySec);
export const tenKV2GoalSec = (v: TenKV2Wizard): number | null => secOf('', v.goalMin, v.goalSec);

/** Prvi dan plana za izabrani datum trke (cele nedelje do trke, ne pre danas). */
export const tenKV2PlanStart = (raceDate: string, today: string): string | null =>
  raceDate ? tenKV2Start(raceDate, today) : null;

/** Rezultat je stariji od praga v2 (plan bi bio po osećaju, pa treba i lak tempo). */
export function tenKV2ResultStale(v: TenKV2Wizard, raceDate: string, today: string): boolean {
  const start = tenKV2PlanStart(raceDate, today);
  const d = parseIsoDate(v.resDate);
  if (!start || !d) return false;
  return diffDays(d, start as IsoDate) > TEN_K_V2_RESULT_FRESH_DAYS;
}

/** Treba li uobičajen lagan tempo: nema rezultata ili je rezultat star. */
export const tenKV2NeedsEasyPace = (v: TenKV2Wizard, raceDate: string, today: string): boolean =>
  v.hasResult === false || (v.hasResult === true && tenKV2ResultStale(v, raceDate, today));

export function tenKV2ResultDateMessage(v: TenKV2Wizard, today: string): string | null {
  if (!v.resDate) return null;
  return !parseIsoDate(v.resDate) || v.resDate > today
    ? 'Datum rezultata mora biti ispravan datum koji nije u budućnosti.'
    : null;
}

/** Korak je popunjen (pravila proverava v2 pri izradi plana). Trčanje/hodanje (korak 3) ne ide dalje: v2 ga odbija sa
 *  preporukom 5K plana (D29), a korak prikazuje to odbijanje doslovno. */
export function tenKV2StepValid(
  v: TenKV2Wizard,
  step: number,
  raceDate: string,
  today: string
): boolean {
  if (step === 1) return !!raceDate && !!tenKV2PlanStart(raceDate, today);
  if (step === 2) {
    if (v.hasResult === null) return false;
    const easyOk = !tenKV2NeedsEasyPace(v, raceDate, today) || tenKV2EasyPaceSec(v) != null;
    if (v.hasResult === false) return easyOk;
    return (
      tenKV2ResultSec(v) != null && !!v.resDate && !tenKV2ResultDateMessage(v, today) && easyOk
    );
  }
  if (step === 3)
    return (
      v.canRun30 === true &&
      v.weeklyKm !== '' &&
      Number.isFinite(+v.weeklyKm) &&
      +v.weeklyKm >= 0 &&
      v.experience !== null
    );
  return v.runDows.length > 0;
}

/** Ulaz v2 iz čarobnjaka; `null` dok polja nisu popunjena. */
export function toTenKV2Input(
  v: TenKV2Wizard,
  raceDate: string,
  today: string
): TenKV2PlanInput | null {
  const start = tenKV2PlanStart(raceDate, today);
  if (!start || v.canRun30 === null) return null;
  const runDays = [...v.runDows].sort((a, b) => a - b).map((d) => WEEKDAYS[d - 1] as WeekdayName);
  if (v.canRun30 === false)
    return {
      startDate: start,
      raceDate,
      runDays,
      currentWeeklyKm: v.weeklyKm === '' ? 0 : +v.weeklyKm,
      runWalk: true
    };
  if (v.experience === null || v.hasResult === null) return null;
  const result = v.hasResult ? tenKV2ResultSec(v) : null;
  const easy = tenKV2NeedsEasyPace(v, raceDate, today) ? tenKV2EasyPaceSec(v) : null;
  const long = v.longDow != null && v.runDows.includes(v.longDow) ? v.longDow : null;
  return {
    startDate: start,
    raceDate,
    runDays,
    longRunDay: long != null ? WEEKDAYS[long - 1] : null,
    currentWeeklyKm: +v.weeklyKm,
    recentResult:
      v.hasResult && result != null
        ? { distanceM: v.resultDist, timeSec: result, date: v.resDate }
        : null,
    goalTimeSec: tenKV2GoalSec(v),
    easyPaceSecPerKm: easy,
    experience: v.experience
  };
}
