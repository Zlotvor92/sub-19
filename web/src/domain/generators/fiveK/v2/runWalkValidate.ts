/* 2.6.0: provera plana trčanje/hodanje — SAMO prijavljuje. Lestvica (aktivni deo 20–35 min, hod pre i
   posle, napor), sesije prema tabeli, dani trčanja, projekcija nivoa (konstruktor runWalk.ts) posle
   poslednje adaptacije, trkačka nedelja i trka, Uslov 8 (prazna sesija, skok nivoa > 1). Kontinuirani deo
   posle prelaza proverava validatePlan (validate.ts). */

import { addDays, mustDay, weekdayOf } from './dates.ts';
import { checkInput, weekLabel } from './input.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import {
  constructRunWalk,
  MAX_LEVEL,
  raceWeekSessionDates,
  runWalkRace,
  runWalkSession,
  weekCount
} from './runWalk.ts';
import type { FiveKV2RunWalkPlan, Violation } from './types.ts';

const RW = P.runWalk;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function validateRunWalk(plan: FiveKV2RunWalkPlan): Violation[] {
  const out: Violation[] = [];
  const wl = (k: number): number => weekLabel(k, plan.input.weekOffset);
  const err = (rule: string, message: string, week?: number, date?: string): void => {
    out.push({
      rule,
      severity: 'error',
      message,
      ...(week !== undefined ? { week } : {}),
      ...(date ? { date } : {})
    });
  };
  const input = plan.input;
  const c = checkInput(input);
  if (!c.ok || input.canRun30Min !== false || plan.planType !== 'runWalk') {
    err('RW_INPUT', 'Plan trčanje/hodanje traži ispravan ulaz sa canRun30Min = false.');
    return out;
  }
  if (plan.policyId !== P.id || plan.policyVersion !== P.version)
    err('POLICY', `Plan mora nositi ${P.id} / ${P.version}.`);
  if (plan.goal.status !== 'finish') err('RW_GOAL', 'Cilj plana trčanje/hodanje je „završiti".');

  // Lestvica (policy.runWalk.levels): aktivni deo u opsegu, nivo raste trajanjem jednog trčanja.
  RW.levels.forEach((l, i) => {
    const active = l.reps * l.runSec + (l.reps - 1) * l.walkSec;
    if (l.level !== i + 1 || active < RW.activeSec.min || active > RW.activeSec.max)
      err(
        'RW_LEVELS',
        `Nivo L${l.level}: aktivni deo ${active} s van ${RW.activeSec.min}–${RW.activeSec.max} s.`
      );
    if (i > 0 && l.runSec <= RW.levels[i - 1]!.runSec)
      err('RW_LEVELS', `Nivo L${l.level}: trčanje nije duže od prethodnog nivoa.`);
  });

  // Struktura nedelja; posle prelaza (Odluka 8) kontinuirani deo od nedelje fromWeek.
  const N = weekCount(input);
  const cont = plan.continuous;
  const K = cont ? cont.fromWeek - 1 : N;
  if (cont) {
    const ci = cont.plan.input;
    if (
      cont.fromWeek < 2 ||
      N - cont.fromWeek + 1 < RW.transitionMinWeeks ||
      ci.startDate !== addDays(input.startDate, (cont.fromWeek - 1) * 7) ||
      ci.raceDate !== input.raceDate ||
      !same(ci.runDays, input.runDays) ||
      ci.experience !== 'beginner' ||
      ci.canRun30Min !== true ||
      cont.plan.paceMode !== 'feel'
    )
      err(
        'RW_TRANSITION',
        'Kontinuirani deo mora biti plan početnika po osećaju od nedelje prelaza do trke.'
      );
  }
  if (plan.weeks.length !== K)
    err('STRUCTURE', `Plan ima ${plan.weeks.length} nedelja trčanja/hodanja umesto ${K}.`);
  const pace = input.typicalEasyPaceSecPerKm ?? null;
  const raceSessions = raceWeekSessionDates(input);
  let prevLevel: number | null = null;
  plan.weeks.forEach((w, i) => {
    const start = addDays(input.startDate, i * 7);
    if (w.index !== i + 1 || w.startDate !== start || w.endDate !== addDays(start, 6))
      err('STRUCTURE', `Nedelja ${wl(i + 1)}: redni broj ili datumi.`, w.index);
    const race = w.index === N;
    if (w.phase !== (race ? 'race' : 'runWalk'))
      err('PHASES', `Nedelja ${wl(w.index)}: faza ${w.phase}.`, w.index);
    const sessions = w.days.filter((d) => d.role === 'session');
    const expected = race
      ? raceSessions
      : Array.from({ length: 7 }, (_, k) => addDays(start, k)).filter((d) =>
          input.runDays.includes(weekdayOf(d))
        );
    if (
      !same(
        sessions.map((d) => d.date),
        expected
      )
    )
      err(
        'RUN_DAYS',
        `Nedelja ${wl(w.index)}: sesije ${sessions.map((d) => d.date).join(', ')}.`,
        w.index
      );
    for (const d of w.days) {
      if (mustDay(d.date) < mustDay(w.startDate) || mustDay(d.date) > mustDay(w.endDate))
        err('STRUCTURE', `Dan ${d.date} je van nedelje.`, w.index, d.date);
      if (d.level < 1 || d.level > MAX_LEVEL || !Number.isInteger(d.level))
        err('RW_LEVEL', `Nivo ${d.level} nije u lestvici.`, w.index, d.date);
      if (d.role === 'session') {
        if (!same(d.session, runWalkSession(d.level, pace)))
          err(
            'RW_SESSION',
            `Sesija ne odgovara nivou L${d.level} (lestvica, hod 5 min, napor, km).`,
            w.index,
            d.date
          );
        if (d.session.activeSec <= 0 || d.session.totalSec <= 0)
          err('EMPTY_WORKOUT', 'Prazna sesija.', w.index, d.date);
        if (prevLevel !== null && d.level > prevLevel + 1)
          err('RW_LEVEL_JUMP', `Nivo L${prevLevel} → L${d.level} (više od +1).`, w.index, d.date);
        prevLevel = d.level;
      } else {
        if (d.date !== input.raceDate || !race)
          err('RACE_DAY', 'Trka mora biti na dan trke.', w.index, d.date);
        if (!same(d.race, runWalkRace(d.level)))
          err(
            'RW_RACE',
            `Trka ne odgovara nivou L${d.level} (odnos, cilj „završiti").`,
            w.index,
            d.date
          );
        const easier = Math.max(1, d.level - 1);
        if (
          sessions.some(
            (x) =>
              x.level !== easier && mustDay(x.date) > mustDay(plan.adaptation?.asOf ?? '0000-01-01')
          )
        )
          err(
            'RW_RACE_WEEK',
            `Trkačka nedelja: sesije moraju biti L${easier} (nivo trke − 1).`,
            w.index
          );
      }
    }
    if (race && w.days.filter((d) => d.role === 'race').length !== 1)
      err('RACE_DAY', 'Trkačka nedelja mora imati tačno jednu trku.', w.index);
    if (!race && sessions.length !== RW.days)
      err(
        'RUN_DAYS',
        `Nedelja ${wl(w.index)}: ${sessions.length} sesija umesto ${RW.days}.`,
        w.index
      );
  });
  if (!cont && plan.weeks.at(-1)?.endDate !== input.raceDate)
    err('STRUCTURE', 'Poslednja nedelja se ne završava danom trke.');

  // Projekcija (Odluke 5–7): dani posle poslednje adaptacije (bez zaključanih) = konstruktor.
  const ad = plan.adaptation;
  const built = constructRunWalk(input, ad?.steps ?? []);
  const locked = new Set(ad?.lockedDayIds ?? []);
  const asOf = ad ? mustDay(ad.asOf) : -Infinity;
  for (const w of plan.weeks)
    for (const d of w.days) {
      if (mustDay(d.date) <= asOf || locked.has(d.date)) continue;
      const b = built[w.index - 1]?.days.find((x) => x.date === d.date);
      if (!b || b.level !== d.level || b.projection !== d.projection)
        err(
          'RW_PROJECTION',
          `Nivo L${d.level} ne odgovara projekciji (${b ? `L${b.level}` : 'nema dana'}).`,
          w.index,
          d.date
        );
    }
  return out;
}
