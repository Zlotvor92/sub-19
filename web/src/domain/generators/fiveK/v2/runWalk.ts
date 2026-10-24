/* 2.6.0: plan trčanje/hodanje (canRun30Min = false) — JEDINO mesto konstrukcije: nivo lestvice → sesija,
   projekcija nivoa po danima (+1 nivo na svake 2 odrađene sesije od stanja poslednjeg koraka), trkačka
   nedelja (2 sesije nivo − 1) i trka (odnos poslednjeg nivoa; cilj „završiti"). Plan je vremenski: bez
   tempa i kvaliteta; km samo procena trčanja iz typicalEasyPaceSecPerKm. Isti konstruktor koriste
   generate (bez koraka), adapt (sa koracima) i validator. */

import { addDays, daysBetween, mustDay, weekdayOf } from './dates.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import type {
  FiveKV2Input,
  FiveKV2RunWalkPlan,
  IsoDate,
  RunWalkDay,
  RunWalkLevel,
  RunWalkRace,
  RunWalkSession,
  RunWalkStep,
  RunWalkWeek
} from './types.ts';

const RW = P.runWalk;
export const MAX_LEVEL = RW.levels.length;
/** 5k-v2.12.0 (T5): L12 — trka bez hodanja i prelaz na kontinuirani plan; L13–L14 samo produžavaju lestvicu. */
export const TRANSITION_LEVEL = RW.continuousLevel;
const r2 = (x: number): number => Math.round(x * 100) / 100;
const mmss = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

export function levelOf(level: number): RunWalkLevel {
  return RW.levels[Math.min(Math.max(level, 1), MAX_LEVEL) - 1]!;
}

/** Sesija nivoa (5 min hoda, aktivni deo, 5 min hoda). km: procena trčanja ili null bez tempa. */
export function runWalkSession(level: number, easyPace: number | null): RunWalkSession {
  const l = levelOf(level);
  const continuous = l.walkSec === 0;
  const activeSec = l.reps * l.runSec + (l.reps - 1) * l.walkSec;
  const runTotalSec = l.reps * l.runSec;
  return {
    level: l.level,
    runSec: l.runSec,
    walkSec: l.walkSec,
    reps: l.reps,
    continuous,
    warmupWalkSec: RW.warmupWalkSec,
    cooldownWalkSec: RW.cooldownWalkSec,
    activeSec,
    totalSec: RW.warmupWalkSec + activeSec + RW.cooldownWalkSec,
    runTotalSec,
    estRunKm: easyPace === null ? null : r2(runTotalSec / easyPace),
    effort: { ...RW.effort },
    title: `Nivo ${l.level}: ${continuous ? `${mmss(l.runSec)} trčanja bez prekida` : `${l.reps} × (${mmss(l.runSec)} trčanje / ${mmss(l.walkSec)} hod)`}, 5 min hoda pre i posle`
  };
}

/** Odluka 7: odnos trke — nivo < L12 sa hodom: njegov odnos; kontinuiran nivo < L12: trčanje = trajanje
    nivoa, hod = raceWalkSec; L12: bez hodanja. */
export function runWalkRace(level: number): RunWalkRace {
  const l = levelOf(level);
  const continuous = l.level >= TRANSITION_LEVEL;
  const walkSec = continuous ? 0 : l.walkSec > 0 ? l.walkSec : RW.raceWalkSec;
  return {
    distanceKm: RW.raceKm,
    runSec: l.runSec,
    walkSec,
    continuous,
    warmupWalkSec: RW.warmupWalkSec,
    cooldownWalkSec: RW.cooldownWalkSec,
    goal: 'finish',
    effort: { ...RW.effort, cue: 'ravnomerno, kao na treningu; cilj je završiti' },
    title: `Trka ${RW.raceKm} km — ${continuous ? 'trčanje bez prekida' : `u trci smeš da hodaš: ${mmss(l.runSec)} trčanja, pa ${mmss(walkSec)} hoda, i tako do cilja`}; cilj: završiti`
  };
}

/** Početno stanje (pre prve sesije). */
export const initialStep = (input: FiveKV2Input): RunWalkStep => ({
  asOf: addDays(input.startDate, -1),
  level: 1,
  good: 0,
  pauseDays: 0,
  transitionWeek: null
});

/** Odluka 5: nivo j-te sesije posle stanja `s` (j od 1): +1 nivo na svakih sessionsPerLevel; projection =
    nivo zavisi od pretpostavljenih (još neodrađenih) sesija. */
export function projectLevel(s: RunWalkStep, j: number): { level: number; projection: boolean } {
  const k = Math.floor((s.good + j - 1) / RW.sessionsPerLevel);
  return { level: Math.min(MAX_LEVEL, s.level + k), projection: k > 0 && s.level < MAX_LEVEL };
}

export const weekCount = (input: FiveKV2Input): number =>
  (daysBetween(input.startDate, input.raceDate) + 1) / 7;

function runDatesOfWeek(input: FiveKV2Input, w: number): IsoDate[] {
  const start = addDays(input.startDate, (w - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) =>
    input.runDays.includes(weekdayOf(d))
  );
}

/** Odluka 7: sesije trkačke nedelje — dani trčanja pre trke; od tri bez dana pred trku; dve najbliže trci. */
export function raceWeekSessionDates(input: FiveKV2Input): IsoDate[] {
  const c = runDatesOfWeek(input, weekCount(input)).filter(
    (d) => mustDay(d) < mustDay(input.raceDate)
  );
  const eve = addDays(input.raceDate, -1);
  const pool = c.length > RW.raceWeekSessions ? c.filter((d) => d !== eve) : c;
  return pool.slice(-RW.raceWeekSessions);
}

/** Nedelja (1…) kojoj pripada datum. */
export const weekOfDate = (input: FiveKV2Input, d: IsoDate): number =>
  Math.floor(daysBetween(input.startDate, d) / 7) + 1;

/** Datumi sesija izgradnje (sve nedelje osim trkačke; posle prelaza do nedelje pre prelaza). */
export function buildSessionDates(input: FiveKV2Input, untilWeek: number): IsoDate[] {
  const out: IsoDate[] = [];
  for (let w = 1; w <= untilWeek; w++) out.push(...runDatesOfWeek(input, w));
  return out;
}

/**
 * Konstruktor (Odluke 5 i 7): nivo svake sesije iz poslednjeg koraka pre nje (stanje u asOf, j = redni broj
 * sesije izgradnje posle asOf); trkačka nedelja: nivo L = nivo sledeće sesije na početku trkačke nedelje,
 * sesije max(1, L − 1), trka odnosom L. Korak sa prelazom (Odluka 8) završava plan trčanja/hodanja
 * nedeljom pre prelaza (ostatak gradi generate kao početnik).
 */
export function constructRunWalk(
  input: FiveKV2Input,
  steps: readonly RunWalkStep[]
): RunWalkWeek[] {
  const N = weekCount(input);
  const pace = input.typicalEasyPaceSecPerKm ?? null;
  const all = [initialStep(input), ...steps];
  const transition = steps.at(-1)?.transitionWeek ?? null;
  const last = transition === null ? N : transition - 1;
  const sessions = buildSessionDates(input, Math.min(last, N - 1));
  const governing = (d: IsoDate): RunWalkStep =>
    [...all].reverse().find((s) => mustDay(s.asOf) < mustDay(d)) ?? all[0]!;
  const after = (s: RunWalkStep, d: IsoDate): number =>
    sessions.filter((x) => mustDay(x) > mustDay(s.asOf) && mustDay(x) <= mustDay(d)).length;
  const day = (d: IsoDate, level: number, projection: boolean): RunWalkDay => ({
    date: d,
    weekday: weekdayOf(d),
    role: 'session',
    level,
    projection,
    session: runWalkSession(level, pace)
  });
  const weeks: RunWalkWeek[] = [];
  for (let w = 1; w <= last; w++) {
    const startDate = addDays(input.startDate, (w - 1) * 7);
    const base = {
      index: w,
      startDate,
      endDate: addDays(startDate, 6)
    };
    if (w < N) {
      const days = runDatesOfWeek(input, w).map((d) => {
        const s = governing(d);
        const p = projectLevel(s, after(s, d));
        return day(d, p.level, p.projection);
      });
      weeks.push({ ...base, phase: 'runWalk', days, notes: [] });
      continue;
    }
    const s = governing(input.raceDate);
    const L = projectLevel(s, sessions.filter((x) => mustDay(x) > mustDay(s.asOf)).length + 1);
    const easier = Math.max(1, L.level - 1);
    const race = runWalkRace(L.level);
    const days: RunWalkDay[] = [
      ...raceWeekSessionDates(input).map((d) => day(d, easier, L.projection)),
      {
        date: input.raceDate,
        weekday: weekdayOf(input.raceDate),
        role: 'race',
        level: L.level,
        projection: L.projection,
        race
      }
    ];
    weeks.push({
      ...base,
      phase: 'race',
      days,
      notes: [
        `Trkačka nedelja: ${RW.raceWeekSessions} lakše sesije (nivo ${easier}), pa trka ${RW.raceKm} km ${race.continuous ? 'bez hodanja' : `uz hodanje: ${mmss(race.runSec)} trčanja, pa ${mmss(race.walkSec)} hoda, i tako do cilja`}; cilj: završiti.`
      ]
    });
  }
  return weeks;
}

/** Odluka 8: ulaz kontinuiranog plana početnika od nedelje `week` (po osećaju): obim = 3 sesije L12
    tipičnim laganim tempom; bez tempa → null (prelaz nije moguć). Proveru opsega radi checkInput. */
export function transitionInput(input: FiveKV2Input, week: number): Record<string, unknown> | null {
  const pace = input.typicalEasyPaceSecPerKm ?? null;
  if (pace === null) return null;
  const top = levelOf(TRANSITION_LEVEL);
  return {
    startDate: addDays(input.startDate, (week - 1) * 7),
    raceDate: input.raceDate,
    runDays: [...input.runDays],
    currentWeeklyKm: Math.round(((RW.days * top.reps * top.runSec) / pace) * 10) / 10,
    typicalEasyPaceSecPerKm: pace,
    experience: 'beginner',
    canRun30Min: true
  };
}

/** Plan trčanje/hodanje bez adaptacije (generate.ts ga validira). */
export function buildRunWalkPlan(input: FiveKV2Input): FiveKV2RunWalkPlan {
  const old = input.recentResult;
  return {
    policyId: P.id,
    policyVersion: P.version,
    planType: 'runWalk',
    input,
    experience: input.experience ?? 'regular',
    goal: { status: 'finish', message: RW.goalMessage },
    notes: [
      RW.note,
      RW.projectionNote,
      input.typicalEasyPaceSecPerKm ? RW.kmNote : RW.noKmNote,
      ...(old
        ? [
            RW.resultNote
              .replace('{result}', `${old.distanceM / 1000}K ${mmss(old.timeSec)}`)
              .replace('{date}', old.date)
          ]
        : [])
    ],
    weeks: constructRunWalk(input, []),
    continuous: null,
    warnings: []
  };
}
