/* M1 — opseg ulaza; M15 — dani i obim po redu tabele; M13a — skorašnji najduži trk; M16 — put plana po
   osećaju; M17 — početnik i trčanje/hodanje. Van opsega: strukturisano odbijanje (kod + poruka sa preporukom). */

import { addDays, dayNumber, isWeekday, weekdayIndex } from './dates.ts';
import { round1, vdotFromResult } from './paces.ts';
import {
  BEGINNER_DAYS_COUNTS,
  MARATHON_V2_POLICY as P,
  planRule,
  type PlanRule,
  RUN_DAYS_COUNTS
} from './policy.ts';
import { patternOf, suggestSchedule } from './schedule.ts';
import type {
  Experience,
  MarathonV2Input,
  MarathonV2Result,
  Pattern,
  Reason,
  Weekday
} from './types.ts';

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

/** Osnova tempa (M2 / M16): VDOT iz rezultata ili lagan tempo (plan po osećaju; `why` = zašto). */
export type PaceInput =
  { kind: 'result'; vdotRaw: number } | { kind: 'feel'; easySecPerKm: number; why: string };

export type InputCheck =
  | {
      ok: true;
      input: MarathonV2Input;
      weeks: number;
      pace: PaceInput;
      pattern: Pattern;
      rule: PlanRule;
      /** M1: rezultat 5 km (upozorenje RESULT_5K). */
      shortResult: boolean;
    }
  | { ok: false; reasons: Reason[] };

const mmss = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const range = (xs: readonly number[]): string =>
  xs.length === 1 ? `${xs[0]}` : `${xs[0]}–${xs[xs.length - 1]}`;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const optional = (x: unknown, ok: (v: unknown) => boolean): boolean =>
  x === undefined || x === null || ok(x);

/** Najviši broj dana van tabele M15 koji maraton trajno odbija: 1, 2 (premalo) i 7 (bez dana odmora). */
const PERMANENT_DAYS = [1, 2, 7];

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
    !optional(raw['recentLongRunKm'], (v) => typeof v === 'number') ||
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
            'Ulaz mora imati startDate, raceDate (YYYY-MM-DD), runDays (niz dana) i currentWeeklyKm (broj); recentResult ({ distanceM, timeSec, date }), goalTimeSec, longRunDay, recentLongRunKm, easyPaceSecPerKm (broj), experience (beginner/regular) i runWalk (da/ne) su opcioni.'
        }
      ]
    };
  // M17: maraton traži neprekidno trčanje (trajno, ostali ulazi nisu bitni).
  if (raw['runWalk'] === true)
    return {
      ok: false,
      reasons: [
        {
          code: 'RUN_WALK_NOT_SUPPORTED',
          message:
            'Maratonski plan traži neprekidno trčanje; preporuka: kraća distanca (5K plan trčanje/hodanje).'
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
      `Plan od ${weeks} nedelja je prekratak: maraton traži najmanje ${q.weeksMin} nedelja pripreme; preporuka: polumaraton.`
    );
  else if (weeks > q.weeksMax)
    no(
      'PLAN_TOO_LONG',
      `Plan od ${weeks} nedelja je predug (najviše ${q.weeksMax}): počni plan kasnije, najranije ${addDays(raceDate, -7 * q.weeksMax + 1)}.`
    );
  else if (beginner && weeks < P.beginner.weeksMin)
    no(
      'BEGINNER_SHORT',
      `Početnik: maratonski plan traži najmanje ${P.beginner.weeksMin} nedelja (izabrano ${weeks}); počni plan najkasnije ${addDays(raceDate, -7 * P.beginner.weeksMin + 1)} ili izaberi polumaraton.`
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
  if (daysOk && !regularRule)
    no(
      'RUN_DAYS_COUNT',
      runDays.length === 7
        ? 'Maratonski plan traži najmanje jedan dan odmora nedeljno (izabrano 7 dana trčanja).'
        : PERMANENT_DAYS.includes(runDays.length)
          ? `Maratonski plan traži najmanje ${RUN_DAYS_COUNTS[0]} dana trčanja (izabrano ${runDays.length}).`
          : `Maraton v2 radi sa ${RUN_DAYS_COUNTS.join(', ')} dana trčanja (izabrano ${runDays.length}).`
    );
  else if (daysOk && !rule)
    no(
      'BEGINNER_DAYS',
      `Početnik: maratonski plan radi sa ${range(BEGINNER_DAYS_COUNTS)} dana trčanja (izabrano ${runDays.length}); preporuka ${range(BEGINNER_DAYS_COUNTS)} dana.`
    );
  const longRaw = raw['longRunDay'];
  let longRunDay: Weekday | null = null;
  if (longRaw !== undefined && longRaw !== null) {
    if (!isWeekday(longRaw) || (daysOk && !runDays.includes(longRaw)))
      no('LONG_DAY_INVALID', 'Dan dugog trka mora biti jedan od izabranih dana trčanja.');
    else longRunDay = longRaw;
  }

  // Obim (M15): red broja dana; bez ispravnog broja dana — red 4. Preporuka: brojevi dana čiji red nosi obim.
  // Početnik (M17): tabela početnika.
  const km = raw['currentWeeklyKm'];
  const row = rule ?? P.days[4];
  const b = P.beginner.days;
  const bLo = rule ? rule.kmMin : b[BEGINNER_DAYS_COUNTS[0]!].kmMin;
  const bHi = rule ? rule.kmMax : b[BEGINNER_DAYS_COUNTS[BEGINNER_DAYS_COUNTS.length - 1]!].kmMax;
  const bFor = rule ? ` sa ${runDays.length} dana trčanja` : '';
  const fits = RUN_DAYS_COUNTS.filter((n) => km >= P.days[n].kmMin && km <= P.days[n].kmMax);
  const daysAdvice = (): string =>
    fits.length === 0
      ? ''
      : ` Obim ${km} km nosi ${fits.length === 1 ? fits[0] : `${fits[0]}–${fits[fits.length - 1]}`} dana trčanja.`;
  const n = rule ? runDays.length : 4;
  if (beginner) {
    if (km < bLo)
      no(
        'WEEKLY_KM_TOO_LOW',
        `Početnik${bFor}: trenutni obim ${km} km je ispod ${bLo} km — preporuka: kraća distanca (polumaraton ili 10K) pre maratona.`
      );
    else if (km > bHi)
      no(
        'WEEKLY_KM_TOO_HIGH',
        `Početnik${bFor}: trenutni obim ${km} km je iznad ${bHi} km (opseg početnika ${bLo}–${bHi} km); uz ovaj obim plan bez oznake početnika.`
      );
  } else if (km < row.kmMin)
    no(
      'WEEKLY_KM_TOO_LOW',
      `Trenutni obim ${km} km je ispod ${row.kmMin} km nedeljno za ${n} dana trčanja.` +
        (fits.length > 0
          ? daysAdvice()
          : ' Preporuka: polumaraton ili izgradnja osnove pre maratonskog plana.')
    );
  else if (km > row.kmMax)
    no(
      'WEEKLY_KM_TOO_HIGH',
      `Trenutni obim ${km} km je iznad ${row.kmMax} km za ${n} dana trčanja.` +
        (fits.length > 0 ? daysAdvice() : ' Obim je van opsega plana.')
    );

  // M13a: skorašnji najduži trk (opcion).
  const recent = raw['recentLongRunKm'] as number | null | undefined;
  if (
    recent !== undefined &&
    recent !== null &&
    !(isNum(recent) && recent >= q.recentLongMinKm && recent <= q.recentLongMaxKm)
  )
    no(
      'RECENT_LONG_INVALID',
      `Skorašnje najduže trčanje mora biti ${q.recentLongMinKm}–${q.recentLongMaxKm} km (unet ${String(recent)}).`
    );
  // MAR-11 (T7, plauzibilnost): skorašnji najduži trk duži od trenutnog nedeljnog obima nije moguć u jednoj nedelji.
  else if (isNum(recent) && isNum(km) && recent > km)
    no(
      'RECENT_LONG_INVALID',
      `Skorašnje najduže trčanje ${String(recent).replace('.', ',')} km je duže od trenutnog nedeljnog obima ${String(km).replace('.', ',')} km — proveri unos.`
    );
  // F3 (plauzibilnost): kraće od nedeljnog obima / 7 — ni sa 7 dana trčanja nedelja ne može biti tolika (granica 7
  // dana, ne broj dana plana: trenutno trčanje može biti na više dana).
  else if (isNum(recent) && isNum(km) && recent * 7 < km)
    no(
      'RECENT_LONG_INVALID',
      `Skorašnje najduže trčanje ${String(recent).replace('.', ',')} km je prekratko za trenutni nedeljni obim ${String(km).replace('.', ',')} km (ni sa 7 dana trčanja nedelja ne može biti tolika) — proveri unos.`
    );

  // Rezultat → VDOT; bez pouzdanog rezultata plan po osećaju (M16).
  const res = raw['recentResult'] as MarathonV2Result | null | undefined;
  let vdotRaw = NaN;
  let shortResult = false;
  let feelWhy: string | null = null;
  if (!res) feelWhy = 'bez rezultata trke';
  else {
    const rDay = dayNumber(res.date);
    if (!q.resultDistancesM.includes(res.distanceM))
      no(
        'RESULT_DISTANCE_UNSUPPORTED',
        'Rezultat mora biti sa 10 km, polumaratona ili maratona (5 km uz upozorenje).'
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
      else shortResult = res.distanceM === q.shortResultM;
    }
  }
  // M16: plan po osećaju traži lagan tempo.
  const easy = raw['easyPaceSecPerKm'] as number | null | undefined;
  const f = P.feel;
  if (feelWhy !== null) {
    if (easy === undefined || easy === null)
      no(
        'EASY_PACE_REQUIRED',
        `Nema pouzdanog rezultata (${feelWhy}): za plan po osećaju unesi lagan tempo (easyPaceSecPerKm, ${mmss(f.easyPaceMinSec)}–${mmss(f.easyPaceMaxSec)}/km) ili rezultat 10 km, polumaratona ili maratona ne stariji od ${q.resultMaxAgeDays} dana.`
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

  // M9: raspored (samo kad su dani ispravni).
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
  // Polja M16/M17 samo kad nisu podrazumevana (plan sa rezultatom bez oznake početnika ostaje isti kao u
  // marathon-v2.1.0).
  const input: MarathonV2Input = {
    startDate,
    raceDate,
    runDays,
    longRunDay,
    currentWeeklyKm: km,
    recentResult: res ?? null,
    goalTimeSec: (goal as number | null | undefined) ?? null,
    ...(recent !== undefined && recent !== null ? { recentLongRunKm: recent } : {}),
    ...(beginner ? { experience } : {}),
    ...(feelWhy !== null ? { easyPaceSecPerKm: easy! } : {})
  };
  const pace: PaceInput =
    feelWhy === null
      ? { kind: 'result', vdotRaw }
      : { kind: 'feel', easySecPerKm: easy!, why: feelWhy };
  return { ok: true, input, weeks, pace, pattern, rule, shortResult };
}
