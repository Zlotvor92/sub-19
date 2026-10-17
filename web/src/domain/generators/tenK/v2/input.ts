/* D1 — opseg ulaza. Van opsega: strukturisano odbijanje (kod + poruka). Privremeni kodovi
   (SUPPORTED_FROM_SEGMENT_02, FEEL_PLAN_SEGMENT_03) označavaju ulaze koje pokrivaju kasniji segmenti. */

import { addDays, dayNumber, isWeekday, weekdayIndex } from './dates.ts';
import { round1, vdotFromResult } from './paces.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import { patternOf, suggestSchedule } from './schedule.ts';
import type { Pattern, Reason, TenKV2Input, TenKV2Result, Weekday } from './types.ts';

const DAY_SR: Record<Weekday, string> = {
  mon: 'pon',
  tue: 'uto',
  wed: 'sre',
  thu: 'čet',
  fri: 'pet',
  sat: 'sub',
  sun: 'ned'
};
export const daySr = (d: Weekday): string => DAY_SR[d];
const daysSr = (ds: readonly Weekday[]): string => ds.map(daySr).join(', ');

export type InputCheck =
  | { ok: true; input: TenKV2Input; weeks: number; vdotRaw: number; pattern: Pattern }
  | { ok: false; reasons: Reason[] };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const optional = (x: unknown, ok: (v: unknown) => boolean): boolean =>
  x === undefined || x === null || ok(x);

export function checkInput(raw: unknown): InputCheck {
  const reasons: Reason[] = [];
  const no = (code: Reason['code'], message: string): void => {
    reasons.push({ code, message });
  };
  if (
    !isObj(raw) ||
    typeof raw['startDate'] !== 'string' ||
    typeof raw['raceDate'] !== 'string' ||
    !Array.isArray(raw['runDays']) ||
    !isNum(raw['currentWeeklyKm']) ||
    !optional(raw['longRunDay'], (v) => typeof v === 'string') ||
    !optional(raw['goalTimeSec'], (v) => typeof v === 'number') ||
    !optional(
      raw['recentResult'],
      (v) =>
        isObj(v) &&
        typeof v['distanceM'] === 'number' &&
        typeof v['timeSec'] === 'number' &&
        typeof v['date'] === 'string'
    )
  )
    return {
      ok: false,
      reasons: [
        {
          code: 'INPUT_SHAPE',
          message:
            'Ulaz mora imati startDate, raceDate (YYYY-MM-DD), runDays (niz dana), currentWeeklyKm (broj); recentResult, goalTimeSec i longRunDay su opcioni.'
        }
      ]
    };
  const startDate = raw['startDate'];
  const raceDate = raw['raceDate'];
  const start = dayNumber(startDate);
  const race = dayNumber(raceDate);
  if (start === null || race === null)
    return {
      ok: false,
      reasons: [{ code: 'DATE_INVALID', message: 'Neispravan datum starta ili trke.' }]
    };
  if (race <= start)
    return {
      ok: false,
      reasons: [{ code: 'RACE_NOT_AFTER_START', message: 'Dan trke mora biti posle starta plana.' }]
    };

  // Nedelje: tehničko poravnanje — start je prvi dan nedelje 1, trka poslednji dan poslednje nedelje.
  const span = race - start + 1;
  const weeks = span / 7;
  const q = P.input;
  if (span % 7 !== 0)
    no(
      'PLAN_NOT_WHOLE_WEEKS',
      `Od starta do trke mora biti ceo broj nedelja (sada ${span} dana); start ${addDays(raceDate, -7 * Math.max(1, Math.round(weeks)) + 1)} daje ${Math.max(1, Math.round(weeks))} nedelja.`
    );
  else if (weeks < q.weeksAbsoluteMin)
    no(
      'PLAN_TOO_SHORT',
      `Plan od ${weeks} nedelja je prekratak: 10K plan traži najmanje ${q.weeksAbsoluteMin} nedelja.`
    );
  else if (weeks < q.weeksMin)
    no(
      'SUPPORTED_FROM_SEGMENT_02',
      `Plan od ${weeks} nedelja biće podržan od segmenta 02 (sada ${q.weeksMin}–${q.weeksMax} nedelja).`
    );
  else if (weeks > q.weeksMax)
    no(
      'PLAN_TOO_LONG',
      `Plan od ${weeks} nedelja je predug (najviše ${q.weeksMax}): počni plan kasnije, najranije ${addDays(raceDate, -7 * q.weeksMax + 1)}.`
    );

  // Dani trčanja i dan dugog.
  const rd = raw['runDays'] as unknown[];
  const daysOk = rd.every(isWeekday) && new Set(rd).size === rd.length;
  const runDays = daysOk
    ? rd.filter(isWeekday).sort((a, b) => weekdayIndex(a) - weekdayIndex(b))
    : [];
  if (!daysOk)
    no(
      'RUN_DAYS_INVALID',
      'Dani trčanja moraju biti različiti dani (mon, tue, wed, thu, fri, sat, sun).'
    );
  else if (runDays.length !== q.runDays) {
    if (q.runDaysLaterSegment.includes(runDays.length))
      no(
        'SUPPORTED_FROM_SEGMENT_02',
        `${runDays.length} dana trčanja biće podržano od segmenta 02 (sada tačno ${q.runDays} dana).`
      );
    else
      no(
        'RUN_DAYS_COUNT',
        `10K plan v2 radi sa ${q.runDays} dana trčanja (izabrano ${runDays.length}).`
      );
  }
  const longRaw = raw['longRunDay'];
  let longRunDay: Weekday | null = null;
  if (longRaw !== undefined && longRaw !== null) {
    if (!isWeekday(longRaw) || (daysOk && !runDays.includes(longRaw)))
      no('LONG_DAY_INVALID', 'Dan dugog trka mora biti jedan od izabranih dana trčanja.');
    else longRunDay = longRaw;
  }

  // Obim.
  const km = raw['currentWeeklyKm'];
  if (km < q.weeklyKmMin)
    no(
      'WEEKLY_KM_TOO_LOW',
      `Trenutni obim ${km} km je ispod ${q.weeklyKmMin} km nedeljno: preporuka je 5K plan ili izgradnja osnove pre 10K plana.`
    );
  else if (km > q.weeklyKmMax)
    no(
      'WEEKLY_KM_TOO_HIGH',
      `Trenutni obim ${km} km je iznad ${q.weeklyKmMax} km nedeljno, van opsega ovog plana.`
    );

  // Rezultat → VDOT.
  const res = raw['recentResult'] as TenKV2Result | null | undefined;
  let vdotRaw = NaN;
  if (!res)
    no(
      'FEEL_PLAN_SEGMENT_03',
      'Bez rezultata trke nema pouzdanog tempa: plan po osećaju dolazi u segmentu 03.'
    );
  else {
    const rDay = dayNumber(res.date);
    if (!q.resultDistancesM.includes(res.distanceM))
      no(
        'RESULT_DISTANCE_UNSUPPORTED',
        'Rezultat mora biti sa 3 km, 5 km, 10 km ili polumaratona.'
      );
    else if (!(res.timeSec > 0) || !Number.isFinite(res.timeSec))
      no('RESULT_TIME_INVALID', 'Vreme rezultata mora biti pozitivan broj sekundi.');
    else if (rDay === null) no('DATE_INVALID', 'Neispravan datum rezultata.');
    else if (rDay > start) no('RESULT_AFTER_START', 'Rezultat ne sme biti posle starta plana.');
    else if (start - rDay > q.resultMaxAgeDays)
      no(
        'FEEL_PLAN_SEGMENT_03',
        `Rezultat je star ${start - rDay} dana (> ${q.resultMaxAgeDays}): tempo nije pouzdan; plan po osećaju dolazi u segmentu 03.`
      );
    else {
      vdotRaw = vdotFromResult(res.distanceM, res.timeSec);
      const v = round1(vdotRaw);
      if (v < q.vdotMin)
        no(
          'FEEL_PLAN_SEGMENT_03',
          `VDOT ${v} je ispod ${q.vdotMin}: tempo iz modela nije pouzdan; plan po osećaju dolazi u segmentu 03.`
        );
      else if (v > q.vdotMax)
        no('VDOT_TOO_HIGH', `VDOT ${v} je iznad ${q.vdotMax}, van opsega plana.`);
    }
  }

  // Cilj (opcion).
  const goal = raw['goalTimeSec'];
  if (goal !== undefined && goal !== null && !(isNum(goal) && goal > 0))
    no('GOAL_INVALID', 'Ciljno vreme mora biti pozitivan broj sekundi.');

  // D9: raspored (samo kad su dani ispravni).
  let pattern: Pattern | null = null;
  if (
    daysOk &&
    runDays.length === q.runDays &&
    !reasons.some((r) => r.code === 'LONG_DAY_INVALID')
  ) {
    pattern = patternOf(runDays, longRunDay);
    if (!pattern) {
      const s = suggestSchedule(runDays, longRunDay);
      no(
        'SCHEDULE_NO_RECOVERY',
        `U danima ${daysSr(runDays)} dva kvaliteta i dugi ne mogu biti međusobno nesusedni.` +
          (s ? ` Predlog: ${daysSr(s.runDays)} (dugi ${daySr(s.long)}).` : '')
      );
    }
  }

  if (reasons.length > 0 || !pattern) return { ok: false, reasons };
  const input: TenKV2Input = {
    startDate,
    raceDate,
    runDays,
    longRunDay,
    currentWeeklyKm: km,
    recentResult: res!,
    goalTimeSec: (goal as number | null | undefined) ?? null
  };
  return { ok: true, input, weeks, vdotRaw, pattern };
}
