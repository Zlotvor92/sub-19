/* Validacija ulaza. Sve nepodržano → strukturisano odbijanje (sve razloge odjednom), bez fallback-a. */

import { dayNumber, daysBetween, isWeekday, weekdayIndex } from './dates.ts';
import { vdotFromResult } from './paces.ts';
import { daysRule, isRunDaysCount, FIVE_K_V2_POLICY as P } from './policy.ts';
import type { FiveKV2Input, FiveKV2Result, InputCheck, Reason, Weekday } from './types.ts';

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
  // 2.4.0: rezultat je opcion (izostavljen/null → plan po osećaju).
  const rawRes = r['recentResult'];
  const hasRes = rawRes !== undefined && rawRes !== null;
  if (hasRes && typeof rawRes !== 'object')
    add('INPUT_SHAPE', 'recentResult mora biti objekat ili izostavljen.');
  const res = (hasRes && typeof rawRes === 'object' ? rawRes : {}) as Record<string, unknown>;

  // Datumi i trajanje plana.
  const start = dayNumber(r['startDate']);
  const race = dayNumber(r['raceDate']);
  const resultDay = dayNumber(res['date']);
  if (start === null) add('DATE_INVALID', 'startDate mora biti ispravan datum YYYY-MM-DD.');
  if (race === null) add('DATE_INVALID', 'raceDate mora biti ispravan datum YYYY-MM-DD.');
  if (hasRes && resultDay === null)
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

  // 2.4.0: iskustvo i run/walk.
  const exp = r['experience'];
  if (exp !== undefined && exp !== 'beginner' && exp !== 'regular')
    add('INPUT_SHAPE', "experience mora biti 'beginner' ili 'regular'.");
  const beginner = exp === 'beginner';
  const can30 = r['canRun30Min'];
  if (can30 !== undefined && typeof can30 !== 'boolean')
    add('INPUT_SHAPE', 'canRun30Min mora biti true/false.');
  if ((beginner && can30 !== true) || can30 === false)
    add(
      'RUN_WALK_NOT_SUPPORTED_YET',
      'Plan traži 30 min kontinuiranog trčanja (canRun30Min: true); plan trčanje/hodanje još nije podržan.'
    );

  // Dani trčanja.
  const runDays = r['runDays'];
  if (!Array.isArray(runDays)) add('INPUT_SHAPE', 'runDays mora biti niz dana (mon…sun).');
  else {
    if (!isRunDaysCount(runDays.length))
      add(
        'RUN_DAYS_COUNT',
        `Podržano je ${Object.keys(P.days).join(', ')} dana trčanja nedeljno; zadato ${runDays.length}.`
      );
    else if (beginner && runDays.length > P.beginner.maxRunDays)
      add(
        'RUN_DAYS_COUNT',
        `Početnik: najviše ${P.beginner.maxRunDays} dana trčanja nedeljno; zadato ${runDays.length}.`
      );
    if (!runDays.every(isWeekday) || new Set(runDays).size !== runDays.length)
      add('RUN_DAYS_INVALID', 'runDays sme sadržati samo različite dane mon…sun.');
  }

  // Obim (2.3.0: opseg po broju dana; bez ispravnog broja dana — najširi opseg tabele).
  const km = r['currentWeeklyKm'];
  const n = Array.isArray(runDays) ? runDays.length : 0;
  const rules = Object.values(P.days);
  const range = isRunDaysCount(n)
    ? daysRule(n).weeklyKm
    : {
        min: Math.min(...rules.map((x) => x.weeklyKm.min)),
        max: Math.max(...rules.map((x) => x.weeklyKm.max))
      };
  if (!isNum(km) || km < range.min || km > range.max)
    add(
      'WEEKLY_KM_OUT_OF_RANGE',
      n === 3 && isNum(km) && km < range.min
        ? `Trenutni obim ${km} km: ${P.input.lowVolume3DaysMessage}.`
        : `Trenutni obim mora biti ${range.min}–${range.max} km nedeljno${isRunDaysCount(n) ? ` za ${n} dana` : ''}.`
    );

  // Rezultat (2.4.0: opcion; stariji od 12 nedelja → plan po osećaju, rezultat samo informacija).
  const dist = res['distanceM'];
  const time = res['timeSec'];
  const distOk = (P.input.resultDistancesM as readonly unknown[]).includes(dist);
  let fresh = false;
  /** Da li se zna da nema pouzdanog rezultata (tada je lagan tempo obavezan). */
  let feelKnown = !hasRes;
  if (hasRes) {
    if (!distOk) add('RESULT_DISTANCE_UNSUPPORTED', 'Rezultat mora biti sa 3K, 5K ili 10K.');
    if (!isNum(time) || time <= 0) add('RESULT_TIME_INVALID', 'Vreme rezultata mora biti > 0 s.');
    if (start !== null && resultDay !== null) {
      if (resultDay > start) add('RESULT_AFTER_START', 'Rezultat ne sme biti posle datuma starta.');
      else {
        fresh = start - resultDay <= P.input.resultMaxAgeDays;
        feelKnown = !fresh;
      }
    }
    if (fresh && distOk && isNum(time) && time > 0) {
      const vdot = Math.round(vdotFromResult(dist as number, time) * 10) / 10;
      if (vdot < P.input.vdot.min || vdot > P.input.vdot.max)
        add(
          'VDOT_OUT_OF_RANGE',
          `VDOT rezultata (${vdot}) mora biti ${P.input.vdot.min}–${P.input.vdot.max}.`
        );
    }
  }

  // 2.4.0: uobičajen lagan tempo — obavezan bez pouzdanog rezultata.
  const ep = r['typicalEasyPaceSecPerKm'];
  const epRange = P.input.easyPaceSecPerKm;
  const hasEp = ep !== undefined && ep !== null;
  if (feelKnown && !hasEp)
    add(
      'MISSING_EASY_PACE',
      `Bez pouzdanog rezultata (nema ga ili je stariji od ${P.input.resultMaxAgeDays / 7} nedelja) potreban je uobičajen lagan tempo (typicalEasyPaceSecPerKm).`
    );
  if (hasEp && (!isNum(ep) || ep < epRange.min || ep > epRange.max))
    add(
      'EASY_PACE_OUT_OF_RANGE',
      `Uobičajen lagan tempo mora biti ${epRange.min}–${epRange.max} s/km (4:30–8:30 /km).`
    );

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
    recentResult: hasRes
      ? {
          distanceM: dist as FiveKV2Result['distanceM'],
          timeSec: time as number,
          date: res['date'] as string
        }
      : null,
    goalTimeSec: goal === undefined || goal === null ? null : (goal as number),
    typicalEasyPaceSecPerKm: hasEp ? (ep as number) : null,
    experience: beginner ? 'beginner' : 'regular',
    ...(typeof can30 === 'boolean' ? { canRun30Min: can30 } : {})
  };
  return { ok: true, input };
}

/** 2.4.0: rezultat je pouzdan ako postoji i nije stariji od resultMaxAgeDays (jedino mesto odluke). */
export function hasFreshResult(
  input: FiveKV2Input
): input is FiveKV2Input & { recentResult: FiveKV2Result } {
  const r = input.recentResult;
  return (
    r !== undefined &&
    r !== null &&
    daysBetween(r.date, input.startDate) <= P.input.resultMaxAgeDays
  );
}
