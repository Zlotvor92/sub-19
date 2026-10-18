/* D1 — opseg ulaza; D17 — dani i obim po broju dana; D26 — put plana po osećaju (lagan tempo); D28 —
   početnik; D29 — trčanje/hodanje. Van opsega: strukturisano odbijanje (kod + poruka). */

import { addDays, dayNumber, isWeekday, weekdayIndex } from './dates.ts';
import { round1, vdotFromResult } from './paces.ts';
import {
  BEGINNER_DAYS_COUNTS,
  planRule,
  type PlanRule,
  RUN_DAYS_COUNTS,
  TEN_K_V2_POLICY as P
} from './policy.ts';
import { patternOf, suggestSchedule } from './schedule.ts';
import type { Experience, Pattern, Reason, TenKV2Input, TenKV2Result, Weekday } from './types.ts';

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

/** D26: osnova tempa — VDOT iz rezultata ili lagan tempo (plan po osećaju; `why` = razlog za napomenu). */
export type PaceInput =
  { kind: 'result'; vdotRaw: number } | { kind: 'feel'; easySecPerKm: number; why: string };

export type InputCheck =
  | {
      ok: true;
      input: TenKV2Input;
      weeks: number;
      pace: PaceInput;
      pattern: Pattern;
      rule: PlanRule;
    }
  | { ok: false; reasons: Reason[] };

/** Tempo [s/km] kao m:ss. */
const mmss = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const range = (ns: readonly number[]): string =>
  ns.length === 1 ? `${ns[0]}` : `${ns[0]}–${ns[ns.length - 1]}`;

/** D17: brojevi dana čiji red tabele podržava obim `km` (npr. „3–5"); prazno ako nijedan. */
function daysForKm(km: number): string {
  const ok = RUN_DAYS_COUNTS.filter((n) => km >= P.days[n].kmMin && km <= P.days[n].kmMax);
  if (ok.length === 0) return '';
  return ok.length === 1 ? `${ok[0]}` : `${ok[0]}–${ok[ok.length - 1]}`;
}

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
    !optional(raw['easyPaceSecPerKm'], (v) => typeof v === 'number') ||
    !optional(raw['experience'], (v) => v === 'beginner' || v === 'regular') ||
    !optional(raw['runWalk'], (v) => typeof v === 'boolean') ||
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
            'Ulaz mora imati startDate, raceDate (YYYY-MM-DD), runDays (niz dana), currentWeeklyKm (broj); recentResult, goalTimeSec, longRunDay, easyPaceSecPerKm (broj), experience (beginner/regular) i runWalk (da/ne) su opcioni.'
        }
      ]
    };
  // D29: nema 10K plana trčanja/hodanja (ostali ulazi nisu bitni).
  if (raw['runWalk'] === true)
    return {
      ok: false,
      reasons: [
        {
          code: 'RUN_WALK_NOT_SUPPORTED',
          message: `10K plan traži neprekidno trčanje ≥ ${P.input.continuousRunMin} min; preporuka: 5K plan (trčanje/hodanje).`
        }
      ]
    };
  const experience: Experience = raw['experience'] === 'beginner' ? 'beginner' : 'regular';
  const beginner = experience === 'beginner';
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
  else if (weeks < q.weeksMin)
    no(
      'PLAN_TOO_SHORT',
      `Plan od ${weeks} nedelja je prekratak: 10K plan traži najmanje ${q.weeksMin} nedelja.`
    );
  else if (weeks > q.weeksMax)
    no(
      'PLAN_TOO_LONG',
      `Plan od ${weeks} nedelja je predug (najviše ${q.weeksMax}): počni plan kasnije, najranije ${addDays(raceDate, -7 * q.weeksMax + 1)}.`
    );
  else if (beginner && weeks < P.beginner.weeksMin)
    no(
      'BEGINNER_SHORT',
      `Početnik: 10K plan traži najmanje ${P.beginner.weeksMin} nedelja (izabrano ${weeks}); počni plan najkasnije ${addDays(raceDate, -7 * P.beginner.weeksMin + 1)}.`
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
  const regularRule = daysOk ? planRule(runDays.length, 'regular') : null;
  const rule = daysOk ? planRule(runDays.length, experience) : null;
  const minDays = RUN_DAYS_COUNTS[0]!;
  const maxDays = RUN_DAYS_COUNTS[RUN_DAYS_COUNTS.length - 1]!;
  if (daysOk && !regularRule)
    no(
      'RUN_DAYS_COUNT',
      runDays.length > maxDays
        ? `10K plan traži najmanje jedan dan odmora nedeljno: najviše ${maxDays} dana trčanja (izabrano ${runDays.length}).`
        : `10K plan v2 radi sa ${minDays}–${maxDays} dana trčanja (izabrano ${runDays.length}).`
    );
  else if (daysOk && !rule)
    no(
      'BEGINNER_DAYS',
      `Početnik: 10K plan radi sa ${range(BEGINNER_DAYS_COUNTS)} dana trčanja (izabrano ${runDays.length}); preporuka ${range(BEGINNER_DAYS_COUNTS)} dana.`
    );
  const longRaw = raw['longRunDay'];
  let longRunDay: Weekday | null = null;
  if (longRaw !== undefined && longRaw !== null) {
    if (!isWeekday(longRaw) || (daysOk && !runDays.includes(longRaw)))
      no('LONG_DAY_INVALID', 'Dan dugog trka mora biti jedan od izabranih dana trčanja.');
    else longRunDay = longRaw;
  }

  // Obim (D17): red broja dana; bez ispravnog broja dana — opseg cele tabele. Početnik: tabela D28.
  const km = raw['currentWeeklyKm'];
  if (beginner) {
    const b = P.beginner.days;
    const lo = rule ? rule.kmMin : b[BEGINNER_DAYS_COUNTS[0]!].kmMin;
    const hi = rule ? rule.kmMax : b[BEGINNER_DAYS_COUNTS[BEGINNER_DAYS_COUNTS.length - 1]!].kmMax;
    const forDays = rule ? ` sa ${runDays.length} dana trčanja` : '';
    if (km < lo)
      no(
        'WEEKLY_KM_TOO_LOW',
        `Početnik${forDays}: trenutni obim ${km} km je ispod ${lo} km — preporuka je 5K plan pre 10K plana.`
      );
    else if (km > hi)
      no(
        'WEEKLY_KM_TOO_HIGH',
        `Početnik${forDays}: trenutni obim ${km} km je iznad ${hi} km (opseg početnika ${lo}–${hi} km); uz ovaj obim plan bez oznake početnika.`
      );
  } else {
    const kmLo = rule ? rule.kmMin : P.days[minDays].kmMin;
    const kmHi = rule ? rule.kmMax : P.days[maxDays].kmMax;
    const other = daysForKm(km);
    const forDays = rule ? ` za ${runDays.length} dana trčanja` : '';
    if (km < kmLo)
      no(
        'WEEKLY_KM_TOO_LOW',
        other
          ? `Trenutni obim ${km} km je ispod ${kmLo} km${forDays}: za ${km} km plan podržava ${other} dana trčanja.`
          : `Trenutni obim ${km} km je ispod ${P.days[minDays].kmMin} km nedeljno: preporuka je 5K plan ili izgradnja osnove pre 10K plana.`
      );
    else if (km > kmHi)
      no(
        'WEEKLY_KM_TOO_HIGH',
        other
          ? `Trenutni obim ${km} km je iznad ${kmHi} km${forDays}: za ${km} km plan podržava ${other} dana trčanja.`
          : `Trenutni obim ${km} km je iznad ${P.days[maxDays].kmMax} km nedeljno, van opsega ovog plana.`
      );
  }

  // Rezultat → VDOT; bez pouzdanog rezultata plan po osećaju (D26).
  const res = raw['recentResult'] as TenKV2Result | null | undefined;
  let vdotRaw = NaN;
  let feelWhy: string | null = null;
  if (!res) feelWhy = 'bez rezultata trke';
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
      feelWhy = `rezultat je star ${start - rDay} dana (> ${q.resultMaxAgeDays})`;
    else {
      vdotRaw = vdotFromResult(res.distanceM, res.timeSec);
      const v = round1(vdotRaw);
      if (v < q.vdotMin) feelWhy = `VDOT iz rezultata ${v} je ispod ${q.vdotMin}`;
      else if (v > q.vdotMax)
        no('VDOT_TOO_HIGH', `VDOT ${v} je iznad ${q.vdotMax}, van opsega plana.`);
    }
  }
  // D26: plan po osećaju traži lagan tempo.
  const easy = raw['easyPaceSecPerKm'] as number | null | undefined;
  const f = P.feel;
  if (feelWhy !== null) {
    if (easy === undefined || easy === null)
      no(
        'EASY_PACE_REQUIRED',
        `Nema pouzdanog rezultata (${feelWhy}): za plan po osećaju unesi lagan tempo (easyPaceSecPerKm, ${mmss(f.easyPaceMinSec)}–${mmss(f.easyPaceMaxSec)}/km) ili rezultat 3/5/10 km ili polumaratona ne stariji od ${q.resultMaxAgeDays} dana.`
      );
    else if (!isNum(easy) || easy < f.easyPaceMinSec || easy > f.easyPaceMaxSec)
      no(
        'EASY_PACE_OUT_OF_RANGE',
        `Lagan tempo mora biti ${mmss(f.easyPaceMinSec)}–${mmss(f.easyPaceMaxSec)}/km (${f.easyPaceMinSec}–${f.easyPaceMaxSec} s/km); uneto ${easy}.`
      );
  }

  // Cilj (opcion).
  const goal = raw['goalTimeSec'];
  if (goal !== undefined && goal !== null && !(isNum(goal) && goal > 0))
    no('GOAL_INVALID', 'Ciljno vreme mora biti pozitivan broj sekundi.');

  // D9: raspored (samo kad su dani ispravni).
  let pattern: Pattern | null = null;
  if (rule && !reasons.some((r) => r.code === 'LONG_DAY_INVALID')) {
    pattern = patternOf(runDays, longRunDay, rule.quality);
    if (!pattern) {
      const s = suggestSchedule(runDays, longRunDay, rule.quality);
      no(
        'SCHEDULE_NO_RECOVERY',
        `U danima ${daysSr(runDays)} ${rule.quality === 1 ? 'kvalitet i dugi ne mogu biti nesusedni' : 'dva kvaliteta i dugi ne mogu biti međusobno nesusedni'}.` +
          (s ? ` Predlog: ${daysSr(s.runDays)} (dugi ${daySr(s.long)}).` : '')
      );
    }
  }

  if (reasons.length > 0 || !pattern || !rule) return { ok: false, reasons };
  const input: TenKV2Input = {
    startDate,
    raceDate,
    runDays,
    longRunDay,
    currentWeeklyKm: km,
    recentResult: res ?? null,
    goalTimeSec: (goal as number | null | undefined) ?? null,
    experience,
    easyPaceSecPerKm: easy ?? null
  };
  const pace: PaceInput =
    feelWhy === null
      ? { kind: 'result', vdotRaw }
      : { kind: 'feel', easySecPerKm: easy!, why: feelWhy };
  return { ok: true, input, weeks, pace, pattern, rule };
}
