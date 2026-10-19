/* H1 — opseg ulaza segmenta 01 (4 dana, 10–20 nedelja, 30–60 km, rezultat ≤ 84 dana, VDOT 30–80); H15 —
   red tabele dana (segment 01: samo 4 dana); H17 — trčanje/hodanje. Van opsega: strukturisano odbijanje
   (kod + poruka sa preporukom). Jedino mesto provere ulaza. */

import { addDays, dayNumber, isWeekday, weekdayIndex } from './dates.ts';
import { round1, vdotFromResult } from './paces.ts';
import { dayRule, type DayRule, HM_V2_POLICY as P, RUN_DAYS_COUNTS } from './policy.ts';
import { patternOf, suggestSchedule } from './schedule.ts';
import type { HmV2Input, HmV2Result, Pattern, Reason, Weekday } from './types.ts';

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
  | {
      ok: true;
      input: HmV2Input;
      weeks: number;
      /** VDOT iz rezultata (neokrugljen). */
      vdotRaw: number;
      pattern: Pattern;
      rule: DayRule;
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
            'Ulaz mora imati startDate, raceDate (YYYY-MM-DD), runDays (niz dana), currentWeeklyKm (broj) i recentResult (distanceM, timeSec, date); goalTimeSec, longRunDay, experience (beginner/regular) i runWalk (da/ne) su opcioni.'
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
  if (raw['experience'] === 'beginner')
    return {
      ok: false,
      reasons: [
        {
          code: 'BEGINNER_NOT_SUPPORTED',
          message:
            'Plan polumaratona za početnika još nije dostupan u HM v2 (segment 03); preporuka: 10K plan.'
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

  // Dani trčanja i dan dugog (H15: segment 01 samo red 4 dana).
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
  const rule = daysOk ? dayRule(runDays.length) : null;
  const counts = RUN_DAYS_COUNTS.join(', ');
  if (daysOk && !rule)
    no(
      'RUN_DAYS_COUNT',
      runDays.length === 7
        ? `Plan polumaratona traži najmanje jedan dan odmora nedeljno; HM v2 radi sa ${counts} dana trčanja (izabrano 7).`
        : runDays.length <= 2
          ? `Za polumaraton je potrebno više dana trčanja: HM v2 radi sa ${counts} dana (izabrano ${runDays.length}).`
          : `HM v2 (${P.version}) radi sa ${counts} dana trčanja (izabrano ${runDays.length}); ostali brojevi dana dolaze u segmentu 02.`
    );
  const longRaw = raw['longRunDay'];
  let longRunDay: Weekday | null = null;
  if (longRaw !== undefined && longRaw !== null) {
    if (!isWeekday(longRaw) || (daysOk && !runDays.includes(longRaw)))
      no('LONG_DAY_INVALID', 'Dan dugog trka mora biti jedan od izabranih dana trčanja.');
    else longRunDay = longRaw;
  }

  // Obim (H1/H15): red broja dana; bez ispravnog broja dana — red 4 dana.
  const km = raw['currentWeeklyKm'];
  const row = rule ?? P.days[RUN_DAYS_COUNTS[0]!];
  if (km < row.kmMin)
    no(
      'WEEKLY_KM_TOO_LOW',
      `Trenutni obim ${km} km je ispod ${row.kmMin} km nedeljno: preporuka je 10K plan ili izgradnja osnove pre plana polumaratona.`
    );
  else if (km > row.kmMax)
    no(
      'WEEKLY_KM_TOO_HIGH',
      `Trenutni obim ${km} km je iznad ${row.kmMax} km za ${runDays.length || RUN_DAYS_COUNTS[0]} dana trčanja (HM v2 ${P.version}); veći obim traži više dana (segment 02).`
    );

  // Rezultat → VDOT (H1). Bez pouzdanog rezultata: plan po osećaju je segment 03.
  const res = raw['recentResult'] as HmV2Result | null | undefined;
  let vdotRaw = NaN;
  const feel = (why: string): void =>
    no(
      'RESULT_REQUIRED',
      `${why}: plan po osećaju (lagan tempo) dolazi u segmentu 03; unesi rezultat 5 km, 10 km, polumaratona ili maratona ne stariji od ${q.resultMaxAgeDays} dana.`
    );
  if (!res) feel('Nema rezultata trke');
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
      feel(`Rezultat je star ${start - rDay} dana (> ${q.resultMaxAgeDays})`);
    else {
      vdotRaw = vdotFromResult(res.distanceM, res.timeSec);
      const v = round1(vdotRaw);
      if (v < q.vdotMin) feel(`VDOT iz rezultata ${v} je ispod ${q.vdotMin}`);
      else if (v > q.vdotMax)
        no('VDOT_TOO_HIGH', `VDOT ${v} je iznad ${q.vdotMax}, van opsega plana.`);
    }
  }

  // Cilj (opcion).
  const goal = raw['goalTimeSec'];
  if (goal !== undefined && goal !== null && !(isNum(goal) && goal > 0))
    no('GOAL_INVALID', 'Ciljno vreme mora biti pozitivan broj sekundi.');

  // H9: raspored (samo kad su dani ispravni).
  let pattern: Pattern | null = null;
  if (rule && !reasons.some((r) => r.code === 'LONG_DAY_INVALID')) {
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

  if (reasons.length > 0 || !pattern || !rule || !res) return { ok: false, reasons };
  const input: HmV2Input = {
    startDate,
    raceDate,
    runDays,
    longRunDay,
    currentWeeklyKm: km,
    recentResult: res,
    goalTimeSec: (goal as number | null | undefined) ?? null
  };
  return { ok: true, input, weeks, vdotRaw, pattern, rule };
}
