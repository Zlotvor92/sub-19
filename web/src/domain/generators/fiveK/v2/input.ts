/* Validacija ulaza. Sve nepodržano → strukturisano odbijanje (sve razloge odjednom), bez fallback-a. */

import { dayNumber, isWeekday, weekdayIndex } from './dates.ts';
import { vdotFromResult } from './paces.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import type { FiveKV2Input, InputCheck, Reason, Weekday } from './types.ts';

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function checkInput(raw: unknown): InputCheck {
  const reasons: Reason[] = [];
  const add = (code: Reason['code'], message: string): void => {
    reasons.push({ code, message });
  };

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reasons: [{ code: 'INPUT_SHAPE', message: 'Ulaz mora biti objekat.' }] };
  }
  const r = raw as Record<string, unknown>;
  const res = (
    typeof r['recentResult'] === 'object' && r['recentResult'] !== null ? r['recentResult'] : {}
  ) as Record<string, unknown>;

  // Datumi i trajanje plana.
  const start = dayNumber(r['startDate']);
  const race = dayNumber(r['raceDate']);
  const resultDay = dayNumber(res['date']);
  if (start === null) add('DATE_INVALID', 'startDate mora biti ispravan datum YYYY-MM-DD.');
  if (race === null) add('DATE_INVALID', 'raceDate mora biti ispravan datum YYYY-MM-DD.');
  if (resultDay === null)
    add('DATE_INVALID', 'recentResult.date mora biti ispravan datum YYYY-MM-DD.');
  if (start !== null && race !== null) {
    const days = race - start + 1;
    if (race <= start) add('RACE_NOT_AFTER_START', 'Trka mora biti posle datuma starta.');
    else if (days % 7 !== 0)
      add(
        'PLAN_NOT_WHOLE_WEEKS',
        `Od starta do trke (uključivo) mora biti ceo broj nedelja; sada je ${days} dana.`
      );
    else {
      const weeks = days / 7;
      if (weeks < P.input.planWeeks.min || weeks > P.input.planWeeks.max)
        add(
          'PLAN_LENGTH_OUT_OF_RANGE',
          `Plan mora trajati ${P.input.planWeeks.min}–${P.input.planWeeks.max} nedelja; sada ${weeks}.`
        );
    }
  }

  // Dani trčanja.
  const runDays = r['runDays'];
  if (!Array.isArray(runDays)) add('INPUT_SHAPE', 'runDays mora biti niz dana (mon…sun).');
  else {
    if (runDays.length !== P.input.runDaysPerWeek)
      add(
        'RUN_DAYS_COUNT',
        `Podržano je tačno ${P.input.runDaysPerWeek} dana trčanja nedeljno; zadato ${runDays.length}.`
      );
    if (!runDays.every(isWeekday) || new Set(runDays).size !== runDays.length)
      add('RUN_DAYS_INVALID', 'runDays sme sadržati samo različite dane mon…sun.');
  }

  // Obim.
  const km = r['currentWeeklyKm'];
  if (!isNum(km) || km < P.input.weeklyKm.min || km > P.input.weeklyKm.max)
    add(
      'WEEKLY_KM_OUT_OF_RANGE',
      `Trenutni obim mora biti ${P.input.weeklyKm.min}–${P.input.weeklyKm.max} km nedeljno.`
    );

  // Rezultat.
  const dist = res['distanceM'];
  const time = res['timeSec'];
  const distOk = (P.input.resultDistancesM as readonly unknown[]).includes(dist);
  if (!distOk) add('RESULT_DISTANCE_UNSUPPORTED', 'Rezultat mora biti sa 3K, 5K ili 10K.');
  if (!isNum(time) || time <= 0) add('RESULT_TIME_INVALID', 'Vreme rezultata mora biti > 0 s.');
  if (start !== null && resultDay !== null) {
    if (resultDay > start) add('RESULT_AFTER_START', 'Rezultat ne sme biti posle datuma starta.');
    else if (start - resultDay > P.input.resultMaxAgeDays)
      add(
        'RESULT_TOO_OLD',
        `Rezultat sme biti star najviše ${P.input.resultMaxAgeDays / 7} nedelja od starta.`
      );
  }
  if (distOk && isNum(time) && time > 0) {
    const vdot = Math.round(vdotFromResult(dist as number, time) * 10) / 10;
    if (vdot < P.input.vdot.min || vdot > P.input.vdot.max)
      add(
        'VDOT_OUT_OF_RANGE',
        `VDOT rezultata (${vdot}) mora biti ${P.input.vdot.min}–${P.input.vdot.max}.`
      );
  }

  // Cilj (opciono).
  const goal = r['goalTimeSec'];
  if (goal !== undefined && goal !== null) {
    const ok = isNum(goal) && goal > 0;
    const gv = ok ? vdotFromResult(P.paces.raceDistanceM, goal) : NaN;
    if (!ok || gv < P.input.goalVdot.min || gv > P.input.goalVdot.max)
      add('GOAL_INVALID', 'Ciljno vreme 5K nije u smislenom opsegu.');
  }

  if (reasons.length > 0) return { ok: false, reasons };

  const days = [...(runDays as Weekday[])].sort((a, b) => weekdayIndex(a) - weekdayIndex(b));
  const input: FiveKV2Input = {
    startDate: r['startDate'] as string,
    raceDate: r['raceDate'] as string,
    runDays: days,
    currentWeeklyKm: km as number,
    recentResult: {
      distanceM: dist as FiveKV2Input['recentResult']['distanceM'],
      timeSec: time as number,
      date: res['date'] as string
    },
    goalTimeSec: goal === undefined || goal === null ? null : (goal as number)
  };
  return { ok: true, input };
}
