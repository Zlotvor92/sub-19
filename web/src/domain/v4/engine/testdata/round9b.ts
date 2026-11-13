/* KRUG 9b — provere nad planom bez imena distance (koriste ih testovi foldera distanci). */
import { NO_TEST_AFTER_RACE_DAYS } from '../constants';
import { addDays, diffDays, mondayOf } from '../dates';
import { minEasyOf } from '../decide';
import { fmtDate } from '../format';
import { weekCost } from '../guard';
import { paceCtxOf, summarize } from '../load';
import { adjustmentWindow } from '../readiness';
import type { DistanceData, PlanDoc, RunnerFacts, RunnerState, Weekday } from '../types';

/** A10 (a): nedelja −1 ≤ nedelja −2 ≤ vrh (km, + 0,5 zaokruživanja); u nedeljama −2 i −1 nijedan traženi dan nije
    izostavljen (kad događaj ne seče te nedelje). Vraća opise prekršaja. */
export function taperShape(id: string, doc: PlanDoc, runDays: readonly Weekday[]): string[] {
  const bad: string[] = [];
  const ctx = paceCtxOf(doc.header);
  const race = doc.header.goal.raceDate;
  const raceMonday = mondayOf(race);
  const byStart = new Map(doc.weeks.map((w) => [w.start, w]));
  const m1 = byStart.get(addDays(raceMonday, -7));
  const m2 = byStart.get(addDays(raceMonday, -14));
  if (m1 === undefined || m2 === undefined || m2.start < doc.header.startDate) return bad;
  /* nedelje koje seče prozor događaja (rampa + 28 dana) se ne mere — povratak ima svoje pravilo (A10 b) */
  const touched = (doc.header.adjustments ?? []).some((a) => {
    const w = adjustmentWindow(a);
    return w !== null && w.from <= addDays(m1.start, 6) && addDays(w.rampEnd, 28) >= m2.start;
  });
  if (touched) return bad;
  const km = (w: typeof m1): number => weekCost(w, race, ctx).km;
  const peak = Math.max(
    0,
    ...doc.weeks
      .filter((w) => w.intent.kind === 'peak' || w.intent.kind === 'build')
      .filter((w) => w.start < m2.start)
      .map(km)
  );
  if (km(m1) > km(m2) + 0.5)
    bad.push(`${id} nedelja −1 ${km(m1).toFixed(1)} > nedelja −2 ${km(m2).toFixed(1)} km`);
  if (peak > 0 && km(m2) > peak + 0.5)
    bad.push(`${id} nedelja −2 ${km(m2).toFixed(1)} > vrh ${peak.toFixed(1)} km`);
  /* silazak ne skida dan koji je nedelja gradnje imala (plan malog obima sa danom manje svuda je drugo pravilo) */
  const runsOf = (w: typeof m1): number => w.days.filter((d) => d.workout !== null).length;
  const built = doc.weeks.filter(
    (w) => (w.intent.kind === 'peak' || w.intent.kind === 'build') && w.start < m2.start
  );
  const want = Math.min(runDays.length, Math.max(0, ...built.map(runsOf)));
  for (const w of [m2, m1])
    if (runsOf(w) < want)
      bad.push(
        `${id} n${String(w.index)} ${String(runsOf(w))} trčanja uz ${String(want)} u gradnji`
      );
  return bad;
}

/** Mala mreža ulaza (dani × nedelje × obim × forma) za proveru svojstava. */
export function smallGrid(
  distanceM: number,
  formSecs: readonly number[]
): {
  label: string;
  runDays: Weekday[];
  facts: RunnerFacts;
  raceDate: string;
}[] {
  const DAYS: Record<number, Weekday[]> = {
    3: [1, 3, 6],
    4: [1, 3, 5, 6],
    5: [0, 1, 3, 5, 6],
    6: [0, 1, 2, 3, 5, 6]
  };
  const out = [];
  for (const days of [3, 4, 5, 6])
    for (const weeks of [8, 12, 16])
      for (const km of [20, 30, 45, 70])
        for (const formSec of formSecs) {
          const runDays = DAYS[days] ?? [1, 3, 5, 6];
          out.push({
            label: JSON.stringify({ days, weeks, km, formSec }),
            runDays,
            facts: {
              today: '2026-11-01',
              availability: { runDays, longDay: 6 as Weekday },
              profile: {
                weeklyKm: km,
                recentResult: { distanceM, timeSec: formSec, date: '2026-10-19' }
              },
              runs: [],
              pauses: [],
              pain: []
            },
            raceDate: addDays('2026-11-01', 7 * weeks)
          });
        }
  return out;
}

/** A2 (krug 9b): posle neplanirane trke (effort race) — render dana trke prikazuje trku; nema provere forme
    `NO_TEST_AFTER_RACE_DAYS` dana posle; 3 dana posle bez brzog. Vraća opise prekršaja. */
export function raceInWindow(
  id: string,
  doc: PlanDoc,
  state: RunnerState,
  data: DistanceData,
  renderPlan: (d: PlanDoc, s: RunnerState, data: DistanceData) => string
): string[] {
  const bad: string[] = [];
  const race = state.runs.find((r) => r.effort === 'race');
  if (race === undefined) return bad;
  /* na dan trke render prikazuje trku, ne stari trening */
  const text = renderPlan(doc, state, data);
  const line = text
    .split('\n')
    .find((l) => l.includes(fmtDate(race.date)) && (l.includes('trka') || l.includes('TRKA')));
  if (line === undefined) bad.push(`${id} dan trke ne prikazuje trku`);
  /* 3 dana posle bez brzog; nema provere forme 14 dana posle */
  for (const w of doc.weeks)
    for (const d of w.days) {
      if (d.workout === null || d.date <= race.date) continue;
      const days = diffDays(d.date, race.date);
      if (days <= 3 && d.workout.workSec > 0 && d.workout.kind !== 'long')
        bad.push(`${id} ${d.date} brz rad ${String(days)} dana posle trke`);
      if (days <= NO_TEST_AFTER_RACE_DAYS && d.workout.kind === 'test')
        bad.push(`${id} ${d.date} provera forme ${String(days)} dana posle trke`);
    }
  return bad;
}

/** Odluka organizatora (krug 9b, umesto A15): dan posle provere forme je lagano trčanje (ne „dugi"), najviše 60 %
    poslednjeg dugog pre provere (+ 1 min zaokruživanja). Vraća opise prekršaja. */
export function afterTestEasy(id: string, doc: PlanDoc, data: DistanceData): string[] {
  const bad: string[] = [];
  const ctx = paceCtxOf(doc.header);
  const days = doc.weeks.flatMap((w) => w.days);
  let lastLong = 0;
  days.forEach((d, i) => {
    if (d.workout?.kind === 'long') lastLong = summarize(d.workout, ctx).durationSec;
    if (d.workout?.kind !== 'test') return;
    const next = days[i + 1];
    if (next?.workout == null) return;
    const sec = summarize(next.workout, ctx).durationSec;
    if (next.workout.kind !== 'easy')
      bad.push(`${id} ${next.date} posle provere „${next.workout.kind}"`);
    /* ne kraće od najkraćeg smislenog trčanja (kod malog obima 60 % dugog je ispod njega) */
    else if (
      lastLong > 0 &&
      sec >
        Math.max(
          0.6 * lastLong,
          minEasyOf(data.safety, doc.header.decisions.level, doc.header.decisions.runDays.length)
        ) +
          Math.max(60, 0.5 * ctx.paces.easy)
    )
      bad.push(`${id} ${next.date} ${String(Math.round(sec / 60))} min > 60 % dugog`);
  });
  return bad;
}
