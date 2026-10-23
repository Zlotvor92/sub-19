/* ČAROBNJAK MARATONA v2 (segment MAR-05, samo uz uključen prekidač i maraton): polja koja v2 traži — rezultat (5/10 km,
   polumaraton, maraton) ILI uobičajen lagan tempo, iskustvo (početnik/redovno), trčanje/hodanje, trenutni obim,
   opciono skorašnji najduži trk, tačni dani i dan dugog, opcioni cilj — i prevod u ulaz v2. Pravila (opsezi, broj dana,
   trajanje plana, odbijanje trčanja/hodanja sa preporukom kraće distance) proverava v2 i odbija sa razlozima; ovde je
   samo provera da su polja popunjena. Bez DOM-a. Kopija obrasca `hmV2.ts` (posebna, distance se ne dele). */

import { diffDays, parseIsoDate, type IsoDate } from '../date';
import { marathonV2Start } from '../generators/select';
import type { MarathonV2PlanInput, WeekdayName } from '../generators/contract';

export const MARATHON_V2_STEPS = 4;
/** Distance rezultata koje v2 prihvata (M1; 5 km uz upozorenje v2). */
export const MARATHON_V2_RESULT_DISTS = [
  [5000, '5 km'],
  [10000, '10 km'],
  [21097.5, 'Polumaraton'],
  [42195, 'Maraton']
] as const;
export type MarathonV2ResultDist = (typeof MARATHON_V2_RESULT_DISTS)[number][0];
/** Rezultat stariji od ovoga v2 ne koristi za tempo (plan po osećaju) — prikazni prag, odluku donosi v2. */
export const MARATHON_V2_RESULT_FRESH_DAYS = 84;

export interface MarathonV2Wizard {
  /** null dok korisnik ne izabere. */
  hasResult: boolean | null;
  resultDist: MarathonV2ResultDist;
  resH: string;
  resMin: string;
  resSec: string;
  resDate: string;
  easyMin: string;
  easySec: string;
  weeklyKm: string;
  /** Skorašnji najduži trk [km] — opciono (M13a, pouka 28). */
  longestKm: string;
  experience: 'beginner' | 'regular' | null;
  /** Neprekidno trčanje 30 min; „ne" → trčanje/hodanje (v2 odbija sa preporukom kraće distance, M17). */
  canRun30: boolean | null;
  /** 1 = ponedeljak … 7 = nedelja. */
  runDows: number[];
  /** Dan dugog trčanja (jedan od izabranih); null = bira plan. */
  longDow: number | null;
  goalH: string;
  goalMin: string;
  goalSec: string;
}

export const initialMarathonV2Wizard = (): MarathonV2Wizard => ({
  hasResult: null,
  resultDist: 10000,
  resH: '',
  resMin: '',
  resSec: '',
  resDate: '',
  easyMin: '',
  easySec: '',
  weeklyKm: '',
  longestKm: '',
  experience: null,
  canRun30: null,
  runDows: [],
  longDow: null,
  goalH: '',
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
/** Polumaraton i maraton se upisuju sa satima. */
export const marathonV2ResultHasHours = (v: MarathonV2Wizard): boolean => v.resultDist >= 21097.5;
export const marathonV2ResultSec = (v: MarathonV2Wizard): number | null =>
  secOf(marathonV2ResultHasHours(v) ? v.resH : '', v.resMin, v.resSec);
export const marathonV2EasyPaceSec = (v: MarathonV2Wizard): number | null =>
  secOf('', v.easyMin, v.easySec);
export const marathonV2GoalSec = (v: MarathonV2Wizard): number | null =>
  secOf(v.goalH, v.goalMin, v.goalSec);
/** Skorašnji najduži trk [km]; prazno = nije unet; neispravno = NaN (v2 odbija van 5–42 km). */
export const marathonV2LongestKm = (v: MarathonV2Wizard): number | null =>
  v.longestKm.trim() === '' ? null : +v.longestKm.replace(',', '.');

/** Prvi dan plana za izabrani datum trke (cele nedelje do trke, ne pre danas). */
export const marathonV2PlanStart = (raceDate: string, today: string): string | null =>
  raceDate ? marathonV2Start(raceDate, today) : null;

/** Rezultat je stariji od praga v2 (plan bi bio po osećaju, pa treba i lak tempo). */
export function marathonV2ResultStale(
  v: MarathonV2Wizard,
  raceDate: string,
  today: string
): boolean {
  const start = marathonV2PlanStart(raceDate, today);
  const d = parseIsoDate(v.resDate);
  if (!start || !d) return false;
  return diffDays(d, start as IsoDate) > MARATHON_V2_RESULT_FRESH_DAYS;
}

/** Treba li uobičajen lagan tempo: nema rezultata ili je rezultat star. */
export const marathonV2NeedsEasyPace = (
  v: MarathonV2Wizard,
  raceDate: string,
  today: string
): boolean =>
  v.hasResult === false || (v.hasResult === true && marathonV2ResultStale(v, raceDate, today));

export function marathonV2ResultDateMessage(v: MarathonV2Wizard, today: string): string | null {
  if (!v.resDate) return null;
  return !parseIsoDate(v.resDate) || v.resDate > today
    ? 'Datum rezultata mora biti ispravan datum koji nije u budućnosti.'
    : null;
}

/** Korak je popunjen (pravila proverava v2 pri izradi plana). Trčanje/hodanje (korak 3) ne ide dalje: v2 ga odbija sa
 *  preporukom kraće distance (M17), a korak prikazuje to odbijanje doslovno. */
export function marathonV2StepValid(
  v: MarathonV2Wizard,
  step: number,
  raceDate: string,
  today: string
): boolean {
  if (step === 1) return !!raceDate && !!marathonV2PlanStart(raceDate, today);
  if (step === 2) {
    if (v.hasResult === null) return false;
    const easyOk = !marathonV2NeedsEasyPace(v, raceDate, today) || marathonV2EasyPaceSec(v) != null;
    if (v.hasResult === false) return easyOk;
    return (
      marathonV2ResultSec(v) != null &&
      !!v.resDate &&
      !marathonV2ResultDateMessage(v, today) &&
      easyOk
    );
  }
  if (step === 3) {
    const longest = marathonV2LongestKm(v);
    return (
      v.canRun30 === true &&
      v.weeklyKm !== '' &&
      Number.isFinite(+v.weeklyKm) &&
      +v.weeklyKm >= 0 &&
      (longest === null || (Number.isFinite(longest) && longest > 0)) &&
      v.experience !== null
    );
  }
  return v.runDows.length > 0;
}

/** Ulaz v2 iz čarobnjaka; `null` dok polja nisu popunjena. */
export function toMarathonV2Input(
  v: MarathonV2Wizard,
  raceDate: string,
  today: string
): MarathonV2PlanInput | null {
  const start = marathonV2PlanStart(raceDate, today);
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
  const result = v.hasResult ? marathonV2ResultSec(v) : null;
  const easy = marathonV2NeedsEasyPace(v, raceDate, today) ? marathonV2EasyPaceSec(v) : null;
  const long = v.longDow != null && v.runDows.includes(v.longDow) ? v.longDow : null;
  const longest = marathonV2LongestKm(v);
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
    goalTimeSec: marathonV2GoalSec(v),
    easyPaceSecPerKm: easy,
    ...(longest !== null ? { recentLongRunKm: longest } : {}),
    experience: v.experience
  };
}
