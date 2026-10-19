/* H1 — opseg ulaza (3–6 dana, 10–20 nedelja, obim po redu H15, rezultat ≤ 84 dana, VDOT 30–80); H15 —
   red tabele dana; H17 — trčanje/hodanje; HI7 — skorašnji najduži trk (5–42 km, opcion). Van opsega:
   strukturisano odbijanje (kod + poruka sa preporukom). Jedino mesto provere ulaza. */

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
    !optional(raw['recentLongRunKm'], isNum) ||
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
            'Ulaz mora imati startDate, raceDate (YYYY-MM-DD), runDays (niz dana), currentWeeklyKm (broj) i recentResult (distanceM, timeSec, date); goalTimeSec, longRunDay, experience (beginner/regular), runWalk (da/ne) i recentLongRunKm (km) su opcioni.'
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
  const rule = daysOk ? dayRule(runDays.length) : null;
  const counts = RUN_DAYS_COUNTS.join(', ');
  if (daysOk && !rule)
    no(
      'RUN_DAYS_COUNT',
      runDays.length === 7
        ? `Plan polumaratona traži najmanje jedan dan odmora nedeljno; HM v2 radi sa ${counts} dana trčanja (izabrano 7).`
        : `Za polumaraton je potrebno više dana trčanja: HM v2 radi sa ${counts} dana (izabrano ${runDays.length}).`
    );
  const longRaw = raw['longRunDay'];
  let longRunDay: Weekday | null = null;
  if (longRaw !== undefined && longRaw !== null) {
    if (!isWeekday(longRaw) || (daysOk && !runDays.includes(longRaw)))
      no('LONG_DAY_INVALID', 'Dan dugog trka mora biti jedan od izabranih dana trčanja.');
    else longRunDay = longRaw;
  }

  // Obim (H1/H15): red broja dana; bez ispravnog broja dana — ceo opseg tabele. Preporuka: brojevi dana
  // čiji red podržava obim; ispod najmanjeg reda 10K ili izgradnja osnove.
  const km = raw['currentWeeklyKm'];
  const km10 = Math.round(km * 10);
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

  // HI7 (pouka 28): skorašnji najduži trk, opcion, 5–42 km.
  const recentLong = raw['recentLongRunKm'] as number | null | undefined;
  const rl = P.recentLong;
  if (recentLong != null && (recentLong < rl.minKm || recentLong > rl.maxKm))
    no(
      'RECENT_LONG_INVALID',
      `Skorašnji najduži trk mora biti između ${rl.minKm} i ${rl.maxKm} km (uneto ${recentLong}).`
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
        `U danima ${daysSr(runDays)} ${rule.quality === 1 ? 'kvalitet i dugi ne mogu biti nesusedni' : 'dva kvaliteta i dugi ne mogu biti međusobno nesusedni'}.` +
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
    goalTimeSec: (goal as number | null | undefined) ?? null,
    ...(recentLong != null ? { recentLongRunKm: recentLong } : {})
  };
  return { ok: true, input, weeks, vdotRaw, pattern, rule };
}
