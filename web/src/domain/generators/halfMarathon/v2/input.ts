/* H1 — opseg ulaza (3–6 dana, 10–20 nedelja, obim po redu H15, rezultat ≤ 84 dana, VDOT 30–80); H15 —
   red tabele dana; H16 — plan po osećaju (lagan tempo 270–510 s/km); H17 — početnik (4–5 dana, 12–20
   nedelja, obim 20–40 / 25–45 km) i trčanje/hodanje; HI7 — skorašnji najduži trk (5–42 km, opcion). Van
   opsega: strukturisano odbijanje (kod + poruka sa preporukom). Jedino mesto provere ulaza i izbora puta
   tempa (rezultat ili osećaj). */

import { addDays, dayNumber, isWeekday, weekdayIndex } from './dates.ts';
import { round1, vdotFromResult } from './paces.ts';
import {
  BEGINNER_DAYS_COUNTS,
  HM_V2_POLICY as P,
  type PlanRule,
  planRule,
  RUN_DAYS_COUNTS
} from './policy.ts';
import { patternOf, suggestSchedule } from './schedule.ts';
import type { Experience, HmV2Input, HmV2Result, Pattern, Reason, Weekday } from './types.ts';

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
const mmss = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const range = (xs: readonly number[]): string =>
  xs.length === 1 ? `${xs[0]}` : `${xs[0]}–${xs[xs.length - 1]}`;

/** Put tempa: VDOT iz rezultata (neokrugljen) ili plan po osećaju (H16: lagan tempo, razlog). */
export type PaceInput =
  { kind: 'result'; vdotRaw: number } | { kind: 'feel'; easySecPerKm: number; why: string };

export type InputCheck =
  | {
      ok: true;
      input: HmV2Input;
      weeks: number;
      pace: PaceInput;
      pattern: Pattern;
      rule: PlanRule;
    }
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
    !optional(raw['experience'], (v) => v === 'beginner' || v === 'regular') ||
    !optional(raw['runWalk'], (v) => typeof v === 'boolean') ||
    !optional(raw['recentLongRunKm'], isNum) ||
    !optional(raw['easyPaceSecPerKm'], (v) => typeof v === 'number') ||
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
            'Ulaz mora imati startDate, raceDate (YYYY-MM-DD), runDays (niz dana) i currentWeeklyKm (broj); recentResult (distanceM, timeSec, date), easyPaceSecPerKm (s/km), goalTimeSec, longRunDay, experience (beginner/regular), runWalk (da/ne) i recentLongRunKm (km) su opcioni.'
        }
      ]
    };
  // H17: nema plana polumaratona trčanja/hodanja (ostali ulazi nisu bitni).
  if (raw['runWalk'] === true)
    return {
      ok: false,
      reasons: [
        {
          code: 'RUN_WALK_NOT_SUPPORTED',
          message: 'Plan polumaratona traži neprekidno trčanje; preporuka: 5K plan trčanja/hodanja.'
        }
      ]
    };
  // Segment 3i: broj nedelja prefiksa (samo broj nedelje u porukama, weekLabel.ts).
  const off = raw['weekOffset'];
  if (off !== undefined && off !== null && !(Number.isInteger(off) && (off as number) >= 0))
    return {
      ok: false,
      reasons: [
        {
          code: 'INPUT_SHAPE',
          message: 'weekOffset mora biti ceo broj ≥ 0 (broj nedelja ispred plana).'
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

  // Nedelje: start je prvi dan nedelje 1, trka poslednji dan poslednje nedelje.
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
      `Plan od ${weeks} nedelja je prekratak: polumaraton traži najmanje ${q.weeksMin} nedelja; preporuka: 10K plan.`
    );
  else if (weeks > q.weeksMax)
    no(
      'PLAN_TOO_LONG',
      `Plan od ${weeks} nedelja je predug (najviše ${q.weeksMax}): počni plan kasnije, najranije ${addDays(raceDate, -7 * q.weeksMax + 1)}.`
    );
  else if (beginner && weeks < P.beginner.weeksMin)
    no(
      'BEGINNER_SHORT',
      `Početnik: plan polumaratona traži najmanje ${P.beginner.weeksMin} nedelja (izabrano ${weeks}); počni plan najkasnije ${addDays(raceDate, -7 * P.beginner.weeksMin + 1)} ili izaberi 10K plan.`
    );

  // Dani trčanja i dan dugog (H15).
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
  const counts = RUN_DAYS_COUNTS.join(', ');
  if (daysOk && !regularRule)
    no(
      'RUN_DAYS_COUNT',
      runDays.length === 7
        ? `Plan polumaratona traži najmanje jedan dan odmora nedeljno; HM v2 radi sa ${counts} dana trčanja (izabrano 7).`
        : `Za polumaraton je potrebno više dana trčanja: HM v2 radi sa ${counts} dana (izabrano ${runDays.length}).`
    );
  else if (daysOk && !rule)
    no(
      'BEGINNER_DAYS',
      `Početnik: plan polumaratona radi sa ${range(BEGINNER_DAYS_COUNTS)} dana trčanja (izabrano ${runDays.length}); preporuka ${range(BEGINNER_DAYS_COUNTS)} dana.`
    );
  const longRaw = raw['longRunDay'];
  let longRunDay: Weekday | null = null;
  if (longRaw !== undefined && longRaw !== null) {
    if (!isWeekday(longRaw) || (daysOk && !runDays.includes(longRaw)))
      no('LONG_DAY_INVALID', 'Dan dugog trka mora biti jedan od izabranih dana trčanja.');
    else longRunDay = longRaw;
  }

  // Obim (H1/H15): red broja dana; bez ispravnog broja dana — ceo opseg tabele. Preporuka: brojevi dana
  // čiji red podržava obim; ispod najmanjeg reda 10K ili izgradnja osnove. Početnik: tabela H17.
  const km = raw['currentWeeklyKm'];
  const km10 = Math.round(km * 10);
  if (beginner) {
    // H17: tabela početnika; ispod → 10K plan, iznad → plan bez oznake početnika.
    const b = P.beginner.days;
    const lo = rule ? rule.kmMin : b[BEGINNER_DAYS_COUNTS[0]!].kmMin;
    const hi = rule ? rule.kmMax : b[BEGINNER_DAYS_COUNTS[BEGINNER_DAYS_COUNTS.length - 1]!].kmMax;
    const forDays = rule ? ` sa ${runDays.length} dana trčanja` : '';
    if (km < lo)
      no(
        'WEEKLY_KM_TOO_LOW',
        `Početnik${forDays}: trenutni obim ${km} km je ispod ${lo} km — preporuka je 10K plan pre plana polumaratona.`
      );
    else if (km > hi)
      no(
        'WEEKLY_KM_TOO_HIGH',
        `Početnik${forDays}: trenutni obim ${km} km je iznad ${hi} km (opseg početnika ${lo}–${hi} km); uz ovaj obim plan bez oznake početnika.`
      );
  } else {
    const rows = RUN_DAYS_COUNTS.map((n) => ({ n, r: P.days[n] }));
    const lo = rule ? rule.kmMin : Math.min(...rows.map((x) => x.r.kmMin));
    const hi = rule ? rule.kmMax : Math.max(...rows.map((x) => x.r.kmMax));
    const fits = rows
      .filter((x) => Math.round(x.r.kmMin * 10) <= km10 && km10 <= Math.round(x.r.kmMax * 10))
      .map((x) => x.n);
    const advice =
      fits.length === 0
        ? ''
        : ` Obim podržava ${fits.length === 1 ? fits[0] : `${fits[0]}–${fits[fits.length - 1]}`} dana trčanja.`;
    const nDays = rule ? ` za ${runDays.length} dana trčanja` : '';
    if (km < lo)
      no(
        'WEEKLY_KM_TOO_LOW',
        fits.length === 0
          ? `Trenutni obim ${km} km je ispod ${lo} km nedeljno: preporuka je 10K plan ili izgradnja osnove pre plana polumaratona.`
          : `Trenutni obim ${km} km je ispod ${lo} km${nDays}.${advice}`
      );
    else if (km > hi)
      no(
        'WEEKLY_KM_TOO_HIGH',
        `Trenutni obim ${km} km je iznad ${hi} km${nDays}.${advice || ` HM v2 podržava najviše ${Math.max(...rows.map((x) => x.r.kmMax))} km (${RUN_DAYS_COUNTS[RUN_DAYS_COUNTS.length - 1]} dana).`}`
      );
  }

  // HI7 (pouka 28): skorašnji najduži trk, opcion, 5–42 km.
  const recentLong = raw['recentLongRunKm'] as number | null | undefined;
  const rl = P.recentLong;
  if (recentLong != null && (recentLong < rl.minKm || recentLong > rl.maxKm))
    no(
      'RECENT_LONG_INVALID',
      `Skorašnje najduže trčanje mora biti između ${rl.minKm} i ${rl.maxKm} km (uneto ${recentLong}).`
    );

  // Rezultat → VDOT (H1); bez pouzdanog rezultata plan po osećaju (H16).
  const res = raw['recentResult'] as HmV2Result | null | undefined;
  let vdotRaw = NaN;
  let feelWhy: string | null = null;
  if (!res) feelWhy = 'bez rezultata trke';
  else {
    const rDay = dayNumber(res.date);
    if (!q.resultDistancesM.includes(res.distanceM))
      no(
        'RESULT_DISTANCE_UNSUPPORTED',
        'Rezultat mora biti sa 5 km, 10 km, polumaratona ili maratona.'
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
  // H16: plan po osećaju traži lagan tempo.
  const easy = raw['easyPaceSecPerKm'] as number | null | undefined;
  const f = P.feel;
  if (feelWhy !== null) {
    if (easy === undefined || easy === null)
      no(
        'EASY_PACE_REQUIRED',
        `Nema pouzdanog rezultata (${feelWhy}): za plan po osećaju unesi lagan tempo (easyPaceSecPerKm, ${mmss(f.easyPaceMinSec)}–${mmss(f.easyPaceMaxSec)}/km) ili rezultat 5 km, 10 km, polumaratona ili maratona ne stariji od ${q.resultMaxAgeDays} dana.`
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

  // H9: raspored (samo kad su dani ispravni).
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
  // Oblik plana sa rezultatom je bajt-isti kao u hm-v2.1.0: nova polja samo kad su data (početnik, lagan
  // tempo).
  const input: HmV2Input = {
    startDate,
    raceDate,
    runDays,
    longRunDay,
    currentWeeklyKm: km,
    recentResult: res ?? null,
    goalTimeSec: (goal as number | null | undefined) ?? null,
    ...(recentLong != null ? { recentLongRunKm: recentLong } : {}),
    ...(beginner ? { experience } : {}),
    ...(easy != null ? { easyPaceSecPerKm: easy } : {}),
    ...(typeof off === 'number' && off > 0 ? { weekOffset: off } : {})
  };
  const pace: PaceInput =
    feelWhy === null
      ? { kind: 'result', vdotRaw }
      : { kind: 'feel', easySecPerKm: easy!, why: feelWhy };
  return { ok: true, input, weeks, pace, pattern, rule };
}
