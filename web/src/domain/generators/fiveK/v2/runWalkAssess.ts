/* 2.6.0: činjenice → stanje plana trčanje/hodanje (RunWalkStep). JEDINO mesto Odluka 6 i 8:
   - sesija „dobra" = završena, RPE ≤ goodRpeMax, bol < painMin, nivo sesije ≥ trenutnog: 2 uzastopne → +1;
     RPE ≥ holdRpe (ili bez RPE) → isti nivo; propuštena sesija prekida niz;
   - bol ≥ painMin (bilo koji zapis) → −1; pauza 7–13 dana → −1; ≥ 14 → −2; ne ispod L1;
   - pauza = uzastopni POZNATI dani bez trčanja (potpuna pokrivenost, Odluka 3) ili eksplicitna pauza;
     dan bez zapisa van potpune pokrivenosti je nepoznat (nije pauza ni propuštena sesija);
   - prelaz (Odluka 8): nivo L12 i ≥ transitionMinWeeks nedelja do trke → kontinuirani plan početnika.
   Obrađuju se činjenice posle prethodnog koraka (njegovo stanje je polazno); pauza koja traje preko
   prethodnog asOf umanjuje samo razliku stepena. */

import type { CheckedFacts } from './assess.ts';
import { addDays, mustDay } from './dates.ts';
import { checkInput, weekLabel } from './input.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import {
  initialStep,
  MAX_LEVEL,
  TRANSITION_LEVEL,
  transitionInput,
  weekCount,
  weekOfDate
} from './runWalk.ts';
import type { AdaptReason, FiveKV2RunWalkPlan, IsoDate, RunWalkStep } from './types.ts';

const RW = P.runWalk;
const A = P.adapt;

/** Stepen pada nivoa za pauzu od `days` dana. */
const pauseDrop = (days: number): number =>
  days >= A.pause.midDays ? 2 : days >= A.pause.shortDays ? 1 : 0;

export function assessRunWalk(
  plan: FiveKV2RunWalkPlan,
  facts: CheckedFacts,
  asOf: IsoDate
): { step: RunWalkStep; reasons: AdaptReason[] } {
  const input = plan.input;
  const prev = plan.adaptation?.steps.at(-1) ?? initialStep(input);
  const t = mustDay(asOf);
  const p0 = mustDay(prev.asOf);
  const start = mustDay(input.startDate);
  const out: AdaptReason[] = [];
  const reason = (condition: AdaptReason['condition'], applied: boolean, message: string): void => {
    out.push({ condition, applied, message });
  };
  const sessions = new Map<IsoDate, number>();
  for (const w of plan.weeks)
    for (const d of w.days) if (d.role === 'session') sessions.set(d.date, d.level);
  const isRun = (x: { completed: boolean; km: number; durationSec: number }): boolean =>
    x.completed && (x.km > 0 || x.durationSec > 0);

  // Poznati dani bez trčanja (od starta plana do asOf): potpuna pokrivenost bez zapisa trčanja + pauze.
  const cov = facts.coverage;
  const ran = new Set(facts.workouts.filter(isRun).map((x) => mustDay(x.date)));
  const known = new Set<number>();
  const covFrom = cov && cov.complete ? Math.max(mustDay(cov.from), start) : Infinity;
  const covTo = cov && cov.complete ? Math.min(mustDay(cov.to), t) : -Infinity;
  for (let d = covFrom; d <= covTo; d++) if (!ran.has(d)) known.add(d);
  for (const b of facts.breaks)
    for (let d = Math.max(mustDay(b.from), start); d <= Math.min(mustDay(b.to), t); d++)
      known.add(d);
  const covered = (d: number): boolean => d >= covFrom && d <= covTo;

  // Događaji posle prethodnog koraka, po datumu (pauza se primenjuje posle svog poslednjeg dana).
  type Ev =
    | { at: number; kind: 'pain'; pain: number; date: IsoDate }
    | { at: number; kind: 'session'; level: number; rpe: number | undefined; date: IsoDate }
    | { at: number; kind: 'miss' }
    | { at: number; kind: 'pause'; days: number; drop: number };
  const evs: Ev[] = [];
  const recorded = new Set<IsoDate>();
  for (const x of facts.workouts) {
    const d = mustDay(x.date);
    if (d <= p0 || d > t) continue;
    const id = x.dayId ?? x.date;
    if (sessions.has(id)) recorded.add(id);
    if ((x.pain ?? 0) >= A.painMin) evs.push({ at: d, kind: 'pain', pain: x.pain!, date: x.date });
    else if (sessions.has(id))
      evs.push(
        isRun(x)
          ? { at: d, kind: 'session', level: sessions.get(id)!, rpe: x.rpe, date: x.date }
          : { at: d, kind: 'miss' }
      );
  }
  // Sesija bez zapisa u potpunoj pokrivenosti = propuštena; van nje nepoznata.
  for (const [date] of sessions) {
    const d = mustDay(date);
    if (d > p0 && d <= t && !recorded.has(date) && covered(d)) evs.push({ at: d, kind: 'miss' });
  }
  // Pauze: segmenti uzastopnih poznatih dana bez trčanja koji se završavaju posle prethodnog asOf.
  const days = [...known].sort((a, b) => a - b);
  let pauseDays = 0;
  for (let i = 0; i < days.length;) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j]! + 1) j++;
    const [from, to] = [days[i]!, days[j]!];
    if (to > p0) {
      const len = to - from + 1;
      const already = from <= p0 ? pauseDrop(prev.pauseDays) : 0;
      const drop = Math.max(0, pauseDrop(len) - already);
      if (pauseDrop(len) > 0) evs.push({ at: to + 0.5, kind: 'pause', days: len, drop });
      if (to === t) pauseDays = len;
    }
    i = j + 1;
  }
  evs.sort((a, b) => a.at - b.at);

  let level = prev.level;
  let good = prev.good;
  let ups = 0;
  let holds = 0;
  for (const e of evs) {
    if (e.kind === 'pain') {
      const was = level;
      level = Math.max(1, level - 1);
      good = 0;
      reason(
        'PAIN',
        true,
        `Bol ${e.pain}/10 (${e.date}): nivo ${was} → ${level}. ${RW.painMessage}`
      );
    } else if (e.kind === 'pause') {
      const was = level;
      level = Math.max(1, level - e.drop);
      good = 0;
      reason(
        'PAUSE',
        e.drop > 0,
        `Pauza ${e.days} dana: ${e.drop > 0 ? `nivo ${was} → ${level}` : 'već primenjeno u prethodnoj adaptaciji'}.`
      );
    } else if (e.kind === 'miss') good = 0;
    else if (e.rpe === undefined || e.rpe >= RW.holdRpe || e.rpe > RW.goodRpeMax) {
      good = 0;
      if (e.rpe !== undefined && e.rpe >= RW.holdRpe) holds++;
    } else if (e.level >= level) {
      good++;
      if (good >= RW.sessionsPerLevel) {
        if (level < MAX_LEVEL) ups++;
        level = Math.min(MAX_LEVEL, level + 1);
        good = 0;
      }
    } else good = 0;
  }
  if (holds > 0)
    reason(
      'FATIGUE',
      true,
      `${holds} sesija sa RPE ≥ ${RW.holdRpe}: nivo se na njima ne povećava.`
    );
  for (const x of facts.results)
    reason(
      'RESULT_IGNORED',
      false,
      `Rezultat ${x.date}: plan trčanje/hodanje ne koristi tempo (samo informacija).`
    );
  const anyFacts =
    facts.workouts.length + facts.results.length + facts.lockedDayIds.length + facts.breaks.length >
    0;
  if (!anyFacts) reason('NO_FACTS', true, 'Nema činjenica: budući deo plana ostaje isti.');
  else
    reason(
      'LEVEL',
      true,
      `Nivo ${asOf}: ${level} (bilo ${prev.level}${ups > 0 ? `; +${ups} posle po 2 uzastopne sesije RPE ≤ ${RW.goodRpeMax} bez bola` : ''}); dalje se ide od nivoa ${level}.`
    );

  // Odluka 8: prelaz na kontinuirani plan početnika.
  const N = weekCount(input);
  // Prva puna nedelja posle asOf (kao assess.ts).
  const k = mustDay(addDays(asOf, 1)) - start;
  const n = k <= 0 ? 1 : Math.ceil(k / 7) + 1;
  let transitionWeek: number | null = null;
  if (level >= TRANSITION_LEVEL) {
    const left = N - n + 1;
    const vi = transitionInput(input, n);
    const c = vi ? checkInput(vi) : null;
    const lockedAfter = facts.lockedDayIds.some((d) => weekOfDate(input, d) >= n);
    const why =
      left < RW.transitionMinWeeks
        ? `do trke ostaje ${left} nedelja (< ${RW.transitionMinWeeks}); plan ostaje trčanje/hodanje (nivo ${level})`
        : vi === null
          ? 'prelaz traži uobičajen lagan tempo (typicalEasyPaceSecPerKm); plan ostaje trčanje/hodanje'
          : c && !c.ok
            ? `kontinuirani plan nije moguć (${c.reasons.map((x) => x.message).join(' ')}); plan ostaje trčanje/hodanje`
            : lockedAfter
              ? 'zaključani dani posle prelaza; plan ostaje trčanje/hodanje'
              : null;
    if (why === null) transitionWeek = n;
    reason(
      'TRANSITION',
      why === null,
      why === null
        ? `Nivo ${TRANSITION_LEVEL} (30 min trčanja bez prekida) dostignut, do trke ${left} nedelja: od nedelje ${weekLabel(n, input.weekOffset)} kontinuirani plan početnika (po osećaju, ${vi!['currentWeeklyKm'] as number} km = 3 × 30 min tipičnim laganim tempom), isti konstruktor kao generator.`
        : `Nivo ${TRANSITION_LEVEL} (30 min trčanja bez prekida) dostignut: ${why}.`
    );
  }
  return { step: { asOf, level, good, pauseDays, transitionWeek }, reasons: out };
}
