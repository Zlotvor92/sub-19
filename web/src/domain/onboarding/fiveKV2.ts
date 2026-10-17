/* ČAROBNJAK 5K v2 (segment 08a, samo uz uključen prekidač i 5K): polja koja v2 traži — rezultat ILI uobičajen lagan
   tempo, iskustvo (početnik/redovno), 30 min kontinuirano, tačni dani — i prevod u ulaz v2. Pravila (opsezi, broj dana,
   razmak, trajanje plana) proverava v2 i odbija sa razlozima; ovde je samo provera da su polja popunjena. Bez DOM-a. */

import { diffDays, parseIsoDate, type IsoDate } from '../date';
import { fiveKV2Start } from '../generators/select';
import type { StructuredPlanInput, WeekdayName } from '../generators/contract';

export const FIVE_K_V2_STEPS = 4;
/** Distance rezultata koje v2 prihvata. */
export const V2_RESULT_DISTS = [
  [3000, '3 km'],
  [5000, '5 km'],
  [10000, '10 km']
] as const;
/** Rezultat stariji od ovoga v2 ne koristi za tempo (plan po osećaju) — prikazni prag, odluku donosi v2. */
export const V2_RESULT_FRESH_DAYS = 84;

export interface FiveKV2Wizard {
  /** null dok korisnik ne izabere. */
  hasResult: boolean | null;
  resultDist: 3000 | 5000 | 10000;
  resMin: string;
  resSec: string;
  resDate: string;
  easyMin: string;
  easySec: string;
  weeklyKm: string;
  experience: 'beginner' | 'regular' | null;
  canRun30: boolean | null;
  /** 1 = ponedeljak … 7 = nedelja. */
  runDows: number[];
  goalMin: string;
  goalSec: string;
}

export const initialFiveKV2Wizard = (): FiveKV2Wizard => ({
  hasResult: null,
  resultDist: 5000,
  resMin: '',
  resSec: '',
  resDate: '',
  easyMin: '',
  easySec: '',
  weeklyKm: '',
  experience: null,
  canRun30: null,
  runDows: [],
  goalMin: '',
  goalSec: ''
});

const WEEKDAYS: readonly WeekdayName[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function secOf(min: string, sec: string): number | null {
  if (min === '' || sec === '') return null;
  const m = +min;
  const s = +sec;
  if (!Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0 || s > 59) return null;
  const t = m * 60 + s;
  return t > 0 ? t : null;
}
export const v2ResultSec = (v: FiveKV2Wizard): number | null => secOf(v.resMin, v.resSec);
export const v2EasyPaceSec = (v: FiveKV2Wizard): number | null => secOf(v.easyMin, v.easySec);
export const v2GoalSec = (v: FiveKV2Wizard): number | null => secOf(v.goalMin, v.goalSec);

/** Prvi dan plana za izabrani datum trke (cele nedelje do trke, ne pre danas). */
export const v2PlanStart = (raceDate: string, today: string): string | null =>
  raceDate ? fiveKV2Start(raceDate, today) : null;

/** Rezultat je stariji od praga v2 (plan bi bio po osećaju, pa treba i lak tempo). */
export function v2ResultStale(v: FiveKV2Wizard, raceDate: string, today: string): boolean {
  const start = v2PlanStart(raceDate, today);
  const d = parseIsoDate(v.resDate);
  if (!start || !d) return false;
  return diffDays(d, start as IsoDate) > V2_RESULT_FRESH_DAYS;
}

/** Treba li uobičajen lagan tempo: nema rezultata ili je rezultat star. */
export const v2NeedsEasyPace = (v: FiveKV2Wizard, raceDate: string, today: string): boolean =>
  v.hasResult === false || (v.hasResult === true && v2ResultStale(v, raceDate, today));

export function v2ResultDateMessage(v: FiveKV2Wizard, today: string): string | null {
  if (!v.resDate) return null;
  return !parseIsoDate(v.resDate) || v.resDate > today
    ? 'Datum rezultata mora biti ispravan datum koji nije u budućnosti.'
    : null;
}

/** Korak je popunjen (pravila proverava v2 pri izradi plana). */
export function v2StepValid(
  v: FiveKV2Wizard,
  step: number,
  raceDate: string,
  today: string
): boolean {
  if (step === 1) return !!raceDate && !!v2PlanStart(raceDate, today);
  if (step === 2) {
    if (v.hasResult === null) return false;
    const easyOk = !v2NeedsEasyPace(v, raceDate, today) || v2EasyPaceSec(v) != null;
    if (v.hasResult === false) return easyOk;
    return v2ResultSec(v) != null && !!v.resDate && !v2ResultDateMessage(v, today) && easyOk;
  }
  if (step === 3)
    return (
      v.weeklyKm !== '' &&
      Number.isFinite(+v.weeklyKm) &&
      +v.weeklyKm >= 0 &&
      v.experience !== null &&
      (v.experience === 'regular' || v.canRun30 !== null)
    );
  return v.runDows.length > 0;
}

/** Ulaz v2 iz čarobnjaka; `null` dok polja nisu popunjena. */
export function toFiveKV2Input(
  v: FiveKV2Wizard,
  raceDate: string,
  today: string
): StructuredPlanInput | null {
  const start = v2PlanStart(raceDate, today);
  if (!start || v.experience === null || v.hasResult === null) return null;
  const result = v.hasResult ? v2ResultSec(v) : null;
  const easy = v2NeedsEasyPace(v, raceDate, today) ? v2EasyPaceSec(v) : null;
  const canRun30 = v.canRun30 ?? (v.experience === 'regular' ? null : undefined);
  if (canRun30 === undefined) return null;
  return {
    startDate: start,
    raceDate,
    runDays: [...v.runDows].sort((a, b) => a - b).map((d) => WEEKDAYS[d - 1] as WeekdayName),
    currentWeeklyKm: +v.weeklyKm,
    recentResult:
      v.hasResult && result != null
        ? { distanceM: v.resultDist, timeSec: result, date: v.resDate }
        : null,
    goalTimeSec: v2GoalSec(v),
    typicalEasyPaceSecPerKm: easy,
    experience: v.experience,
    ...(canRun30 !== null ? { canRun30Min: canRun30 } : {})
  };
}
