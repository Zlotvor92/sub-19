import { describe, expect, it } from 'vitest';
import { buildCtx, weekTarget } from './build';
import { addDays, diffDays } from './dates';
import { decidePeak } from './decide';
import { raceTimeSec } from './vdot';
import { weekCost } from './guard';
import {
  buildState,
  declaredForm,
  deriveEvents,
  guard,
  paceCtxOf,
  plan,
  renderPlan,
  replan,
  summarize
} from './index';
import { EXAMPLE } from './testdata/example';
import { build, facts, goalAt, grid, HALF_M, runsAsPlanned } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type {
  DistanceData,
  EstimateFormFn,
  Goal,
  PlanDay,
  PlanDoc,
  PlanEvent,
  RunnerFacts,
  RunnerState,
  WeekIntent
} from './types';

/* KRUG 2 (R1–R11): ispravke posle prve ocene dva sudije — `docs/generators-v4/briefs/R2-ROUND2.md`. */

const GOAL: Goal = goalAt('2027-01-24');
const EX_GOAL: Goal = { distanceId: EXAMPLE.id, raceDate: '2027-03-07' };
/** Zaokruživanje laganog dana: 0,5 km (≈ 3 min) ili 5 min. */
const ROUND = 200;

function make(
  f: RunnerFacts,
  data: DistanceData,
  goal: Goal = GOAL
): { doc: PlanDoc; state: RunnerState } {
  const state = buildState(f, goal, data);
  const result = plan(state, goal, data);
  if (!result.ok) throw new Error('plan odbijen');
  return { doc: result.doc, state };
}

const days = (doc: PlanDoc): PlanDay[] => doc.weeks.flatMap((w) => w.days);
const secOf = (doc: PlanDoc, day: PlanDay | undefined): number =>
  summarize(day?.workout ?? null, paceCtxOf(doc.header)).durationSec;
const isEasy = (day: PlanDay): boolean => day.workout?.kind === 'easy';
const isFast = (day: PlanDay | undefined): boolean =>
  day?.workout != null &&
  day.workout.kind !== 'race' &&
  (day.workout.kind === 'quality' || day.workout.kind === 'test' || day.workout.workSec > 0);
const weekMin = (doc: PlanDoc, i: number): number => {
  const week = doc.weeks[i];
  return week === undefined
    ? 0
    : weekCost(week, doc.header.goal.raceDate, paceCtxOf(doc.header)).durationSec / 60;
};
const withSafety = (data: DistanceData, over: Partial<DistanceData['safety']>): DistanceData => ({
  ...data,
  safety: { ...data.safety, ...over }
});
const synTemplate = SYNTHETIC.templates[1];
if (synTemplate === undefined) throw new Error('nema šablona');

/** Mreža bez planova koji počinju u rampi i bez obima van razumnog (tamo važe pod i plafon dana). */
const calmGrid = grid().filter((c) => c.facts.runs.length === 0);

describe('R1: nedelja trke i sužavanje — lagan dan nije duži od plafona ni od istog dana prethodne nedelje', () => {
  it('podrazumevano 50 min (do 3 dana 40 min); neutrošen budžet se ne preliva', () => {
    let checked = 0;
    for (const c of calmGrid) {
      const { doc } = build(c.facts, c.goal);
      const runDays = doc.header.decisions.runDays.length;
      const cap = Math.max(SYNTHETIC.safety.minEasySec, runDays <= 3 ? 2400 : 3000);
      doc.weeks.forEach((week, i) => {
        if (week.intent.kind !== 'taper' && week.intent.kind !== 'race') return;
        const before = doc.weeks[i - 1];
        for (const day of week.days.filter(isEasy)) {
          const sec = secOf(doc, day);
          expect(sec, `${c.name} ${day.date}`).toBeLessThanOrEqual(cap + ROUND);
          const same = before?.days.find((d) => diffDays(day.date, d.date) === 7);
          if (same !== undefined && isEasy(same) && before?.intent.kind !== 'recovery') {
            expect(sec, `${c.name} ${day.date} isti dan`).toBeLessThanOrEqual(
              Math.max(secOf(doc, same), SYNTHETIC.safety.minEasySec) + ROUND
            );
          }
          checked += 1;
        }
      });
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('`safety.taperEasyMaxSec` iz podataka veže (30 min), i po broju dana', () => {
    const flat = withSafety(SYNTHETIC, { taperEasyMaxSec: 1800 });
    const byDays = withSafety(SYNTHETIC, { taperEasyMaxSec: { '1': 1500, '5': 2100 } });
    const big = facts({
      profile: { weeklyKm: 70, recentResult: { distanceM: HALF_M, timeSec: 6060 } }
    });
    for (const [data, cap] of [
      [flat, 1800],
      [byDays, 1500]
    ] as const) {
      const { doc } = make(big, data);
      const calm = doc.weeks.filter((w) => w.intent.kind === 'taper' || w.intent.kind === 'race');
      const easy = calm.flatMap((w) => w.days.filter(isEasy));
      expect(easy.length).toBeGreaterThan(2);
      for (const day of easy) expect(secOf(doc, day), day.date).toBeLessThanOrEqual(cap + ROUND);
      /* Bez plafona isti trkač ima duže lagane dane u tim nedeljama — budžet se nije prelio drugde. */
      const free = make(big, withSafety(SYNTHETIC, { taperEasyMaxSec: 99999 })).doc;
      const sum = (d: PlanDoc): number =>
        d.weeks
          .filter((w) => w.intent.kind === 'race')
          .reduce((a, w) => a + weekCost(w, GOAL.raceDate, paceCtxOf(d.header)).durationSec, 0);
      expect(sum(doc)).toBeLessThanOrEqual(sum(free));
    }
  });
});

describe('R2: lagani dani nisu pufer', () => {
  const data = withSafety(SYNTHETIC, { easyMaxShareOfLong: 0.65 });

  it('(a) lagan dan ≤ 65 % dugog te nedelje (ne ispod najkraćeg trčanja); udeo može i po broju dana', () => {
    for (const c of calmGrid) {
      const { doc } = build(c.facts, c.goal, data);
      for (const week of doc.weeks) {
        const long = week.days.find((d) => d.workout?.kind === 'long');
        if (long === undefined) continue;
        /* krug 5 (D1/D6): merilo je dugi koji trkač već trči (polazni) kad je dugi gradnje kraći */
        const building = week.intent.kind === 'build' || week.intent.kind === 'peak';
        const d0 = doc.header.decisions;
        const ref = building
          ? Math.max(secOf(doc, long), Math.min(d0.longStartSec, d0.longMaxSec))
          : secOf(doc, long);
        const cap = Math.max(data.safety.minEasySec, 0.65 * ref);
        for (const day of week.days.filter(isEasy)) {
          /* Na najkraćem trčanju (20 min) dodatak od 4 × (20 s + 60 s) ide preko laganog dela. */
          const addon = day.workout?.stimulus === null ? 0 : 320;
          const sec = secOf(doc, day);
          if (sec > cap + 1) {
            expect(sec, `${c.name} ${day.date}`).toBeLessThanOrEqual(
              data.safety.minEasySec + addon + ROUND
            );
          }
        }
      }
    }
    const byDays = withSafety(SYNTHETIC, { easyMaxShareOfLong: { '1': 0.7, '4': 0.5 } });
    const { doc } = make(facts(), byDays);
    for (const week of doc.weeks.filter((w) => w.longSec > 0)) {
      for (const day of week.days.filter(isEasy)) {
        expect(secOf(doc, day), day.date).toBeLessThanOrEqual(
          Math.max(byDays.safety.minEasySec + 320, 0.5 * week.longSec) + 1
        );
      }
    }
  });

  it('(b) lagan dan ≤ 1,25 × najduži lagan dan prethodne nedelje koja nije rasterećenje', () => {
    let checked = 0;
    for (const c of calmGrid) {
      const { doc } = build(c.facts, c.goal, data);
      let reference: number | null = null;
      for (const week of doc.weeks) {
        const easy = week.days.filter(isEasy).map((d) => secOf(doc, d));
        if (reference !== null) {
          for (const sec of easy) {
            expect(sec, `${c.name} ned ${String(week.index)}`).toBeLessThanOrEqual(
              Math.max(data.safety.minEasySec, 1.25 * reference) + 2 * ROUND
            );
            checked += 1;
          }
        }
        if (week.intent.kind !== 'recovery' && easy.length > 0) reference = Math.max(...easy);
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('(c) kad kvaliteta u nedelji nema, njegov budžet ne ide u lagane dane: nedelja je manja od cilja', () => {
    const quiet = (w: WeekIntent, i: number): WeekIntent =>
      i % 2 === 1 ? { ...w, stimuli: [] } : w;
    const gaps: DistanceData = {
      ...data,
      templates: [
        {
          ...synTemplate,
          recoveryEvery: 0,
          body: synTemplate.body.map((p) => ({ ...p, cycle: p.cycle.map(quiet) }))
        }
      ]
    };
    const f = facts({
      profile: { weeklyKm: 50, recentResult: { distanceM: HALF_M, timeSec: 6060 } }
    });
    const { doc, state } = make(f, gaps, goalAt('2027-02-21'));
    const ctx = paceCtxOf(doc.header);
    let under = 0;
    doc.weeks.forEach((week, i) => {
      const before = doc.weeks[i - 1];
      if (before === undefined || week.intent.stimuli.length > 0 || week.intent.kind !== 'build')
        return;
      const previous = Math.max(...before.days.filter(isEasy).map((d) => secOf(doc, d)));
      for (const day of week.days.filter(isEasy)) {
        expect(secOf(doc, day), day.date).toBeLessThanOrEqual(1.25 * previous + 2 * ROUND);
      }
      const cost = weekCost(week, doc.header.goal.raceDate, ctx);
      if (cost.load < week.targetLoad - 2) under += 1;
    });
    expect(under).toBeGreaterThan(0);
    /* Čuvar neplaniran višak ne prijavljuje do −15 %. */
    for (const f2 of guard(doc, state, gaps).filter((x) => x.check === 'ispod-cilja')) {
      const week = doc.weeks.find((w) => w.index === f2.weekIndex);
      const cost = week === undefined ? null : weekCost(week, doc.header.goal.raceDate, ctx);
      expect(cost?.load ?? 0).toBeLessThan(0.85 * (week?.targetLoad ?? 0));
    }
  });
});

describe('R3: rast i vrh', () => {
  it('vrh ≤ baza × `maxPeakOverBase` (podrazumevano 1,40), bez obzira na `startPct`', () => {
    const steep = { ...synTemplate, startPct: 0.5 };
    expect(decidePeak(200, steep, SYNTHETIC.safety, 'osnovni')).toBe(280);
    expect(decidePeak(200, steep, { ...SYNTHETIC.safety, maxPeakOverBase: 1.25 }, 'osnovni')).toBe(
      250
    );
    const data: DistanceData = { ...SYNTHETIC, templates: [steep] };
    const { doc } = make(facts(), data);
    expect(doc.header.decisions.peakLoad).toBeLessThanOrEqual(
      doc.header.decisions.baseLoad * 1.4 + 0.1
    );
  });

  it('obim nedelje ≤ najveći od prethodne 3 × (1 + rast); pravilo meri minute, kvalitet ide preko', () => {
    const { doc } = make(facts(), SYNTHETIC);
    const ctx = buildCtx(doc.header, SYNTHETIC);
    const intent = doc.weeks[1]?.intent;
    if (intent === undefined) throw new Error('nema nedelje');
    const input = { m: 150, fraction: 1, previousTarget: 150 };
    const plain = weekTarget({ ...intent, loadPct: 1 }, { ...input, extra: 0 }, ctx);
    const loaded = weekTarget({ ...intent, loadPct: 1 }, { ...input, extra: 30 }, ctx);
    /* 150 min × 1,10 = 165 min obima; dodatno opterećenje kvaliteta (30) ide preko, ne umesto. */
    expect(plain.full).toBeCloseTo(165, 5);
    expect(loaded.full).toBeCloseTo(195, 5);
    /* krug 4 (S2): prva nedelja plana je sadašnji obim — bez rasta */
    const first = weekTarget(
      { ...intent, loadPct: 1 },
      { ...input, previousTarget: null, extra: 0 },
      ctx
    );
    expect(first.full).toBeCloseTo(150, 5);
  });

  it('nema izuzetka posle nedelje sa proverom forme: skok obima ostaje u pravilu rasta', () => {
    const tested: DistanceData = {
      ...SYNTHETIC,
      templates: [
        {
          ...synTemplate,
          recoveryEvery: 0,
          body: synTemplate.body.map((p) => ({
            ...p,
            cycle: p.cycle.map((w, i) =>
              i === 1 ? { ...w, stimuli: [{ stimulus: 'test' }, { stimulus: 'ubrzanja' }] } : w
            )
          }))
        }
      ]
    };
    const f = facts({
      profile: { weeklyKm: 45, recentResult: { distanceM: HALF_M, timeSec: 6060 } }
    });
    const { doc, state } = make(f, tested, goalAt('2027-03-07'));
    expect(days(doc).some((d) => d.workout?.kind === 'test')).toBe(true);
    const { maxWeeklyRampPct, minRampLoad } = tested.safety;
    const seen: number[] = [];
    doc.weeks.forEach((week, i) => {
      const minutes = weekMin(doc, i);
      const m = Math.max(
        ...seen.slice(-3),
        ...(seen.length < 3 ? [doc.header.decisions.baseLoad] : [])
      );
      if (week.intent.kind === 'build' || week.intent.kind === 'peak') {
        const rule = Math.max(m * (1 + maxWeeklyRampPct), m + minRampLoad);
        expect(minutes, String(week.index)).toBeLessThanOrEqual(rule + 4);
      }
      seen.push(minutes);
    });
    expect(guard(doc, state, tested).filter((x) => x.check === 'skok')).toEqual([]);
  });
});

describe('R4: dugi i traženi dani', () => {
  it('dugi ≤ udeo po danima × planirani minuti TE nedelje (ne × vrh)', () => {
    const { doc } = make(facts(), EXAMPLE, EX_GOAL);
    const share = 0.42;
    let bound = 0;
    doc.weeks.forEach((week, i) => {
      const long = week.days.find((d) => d.workout?.kind === 'long');
      if (long === undefined || week.intent.kind === 'race') return;
      const minutes = weekMin(doc, i);
      expect(secOf(doc, long) / 60, String(week.index)).toBeLessThanOrEqual(share * minutes + 4);
      if (
        week.longSec < Math.round((week.intent.long?.lenPct ?? 0) * doc.header.decisions.longMaxSec)
      )
        bound += 1;
    });
    expect(bound).toBeGreaterThan(0);
  });

  it('rasterećenje nema duži dugi od prethodne nedelje', () => {
    for (const c of calmGrid) {
      const { doc } = build(c.facts, c.goal);
      doc.weeks.forEach((week, i) => {
        const before = doc.weeks[i - 1];
        if (week.intent.kind !== 'recovery' || before === undefined) return;
        expect(week.longSec, `${c.name} ned ${String(week.index)}`).toBeLessThanOrEqual(
          before.longSec
        );
      });
    }
  });

  it('sa ≥ 3 dana svaki traženi dan ostaje u planu; ako dan otpadne, plan to kaže upozorenjem', () => {
    let full = 0;
    let warned = 0;
    for (const c of calmGrid) {
      const { doc } = build(c.facts, c.goal);
      const asked = doc.header.decisions.runDays.length;
      if (asked < 3) continue;
      const short = doc.weeks.filter(
        (w) =>
          w.intent.kind !== 'race' &&
          w.start >= doc.header.startDate &&
          w.days.filter((d) => d.workout !== null).length < asked
      );
      const warning = doc.header.warnings.find((w) => w.code === 'dan-izostavljen');
      if (short.length === 0) {
        expect(warning, c.name).toBeUndefined();
        full += 1;
      } else {
        expect(warning, c.name).toBeDefined();
        expect(warning?.meaning).toContain('10 %');
        expect(warning?.proposal).toMatch(/nedelje plan koristi|ovaj plan ostaje na/);
        warned += 1;
      }
    }
    expect(full).toBeGreaterThan(40);
    expect(warned).toBeGreaterThan(0);
  });

  it('kad budžet ne da najkraće lagano trčanje: prvo kvalitet postaje lagan dan, dan ne otpada', () => {
    /* 24 km nedeljno na 7 dana: dugi je na svom udelu, a kvalitet ustupa mesto laganim danima. */
    const f = facts({
      availability: { runDays: [0, 1, 2, 3, 4, 5, 6], longDay: 6 },
      profile: { weeklyKm: 24, recentResult: { distanceM: HALF_M, timeSec: 6060 } }
    });
    const { doc } = make(f, EXAMPLE, EX_GOAL);
    const first = doc.weeks[0];
    expect(first?.days.filter((d) => d.workout !== null).length).toBe(7);
    expect(first?.days.some((d) => d.workout?.kind === 'quality')).toBe(false);
    expect(first?.days.some((d) => d.workout?.kind === 'long')).toBe(true);
    /* Kad obim nosi i najkraće lagane dane, kvalitet se vraća (krug 4: prva nedelja je sadašnji obim, pa 24 km na
       7 dana ostaje bez kvaliteta do kraja — 30 km ga ima). */
    const more = facts({
      availability: { runDays: [0, 1, 2, 3, 4, 5, 6], longDay: 6 },
      profile: { weeklyKm: 30, recentResult: { distanceM: HALF_M, timeSec: 6060 } }
    });
    expect(days(make(more, EXAMPLE, EX_GOAL).doc).some((d) => d.workout?.kind === 'quality')).toBe(
      true
    );
  });
});

describe('R5: osnova nije ispod sadašnjeg obima — kvalitet ide preko minuta, ne umesto njih', () => {
  it('veliki obim (90 km, 6 dana): nijedna nedelja gradnje nema manje minuta od sadašnjih', () => {
    const f = facts({
      availability: { runDays: [0, 1, 2, 3, 5, 6], longDay: 6 },
      profile: { weeklyKm: 90, recentResult: { distanceM: HALF_M, timeSec: 4680 } }
    });
    for (const data of [SYNTHETIC, EXAMPLE]) {
      const goal = { distanceId: data.id, raceDate: '2027-03-07' };
      const { doc } = make(f, data, goal);
      const base = doc.header.decisions.baseLoad;
      const ctx = paceCtxOf(doc.header);
      doc.weeks.forEach((week, i) => {
        if (week.intent.kind !== 'build' && week.intent.kind !== 'peak') return;
        expect(weekMin(doc, i), `${data.id} ned ${String(week.index)}`).toBeGreaterThanOrEqual(
          0.97 * base
        );
      });
      /* Nedelja 1 u kilometrima: bar 95 % sadašnjeg obima. */
      const first = doc.weeks[0];
      const km = first === undefined ? 0 : weekCost(first, goal.raceDate, ctx).km;
      expect(km).toBeGreaterThanOrEqual(0.95 * 90);
    }
  });

  it('cilj nedelje gradnje = max(loadPct × P, B + dodatno opterećenje kvaliteta)', () => {
    const { doc } = make(facts(), SYNTHETIC);
    const ctx = buildCtx(doc.header, SYNTHETIC);
    const { baseLoad, peakLoad } = doc.header.decisions;
    const intent = doc.weeks[0]?.intent;
    if (intent === undefined) throw new Error('nema nedelje');
    const input = { m: baseLoad, fraction: 1, previousTarget: null, extra: 20 };
    const low = weekTarget({ ...intent, loadPct: 0.5 }, input, ctx).full;
    expect(low).toBeCloseTo(baseLoad + 20, 5);
    const high = weekTarget({ ...intent, loadPct: 0.8 }, input, ctx).full;
    expect(high).toBeCloseTo(Math.max(0.8 * peakLoad, baseLoad + 20), 5);
  });
});

/* ------------------------------------------------------------------ R7–R9: događaji */

/** Plan od 16 nedelja (primer § 12), odrađen po planu do `through`. */
function midPlan(
  through: string,
  skip: (date: string) => boolean = () => false,
  data: DistanceData = EXAMPLE,
  over: Partial<RunnerFacts> = {}
): { start: PlanDoc; state: RunnerState; today: string } {
  const goal = { distanceId: data.id, raceDate: '2027-03-07' };
  const f = facts(over);
  const start = make(f, data, goal).doc;
  const state = buildState(
    { ...f, today: through, runs: runsAsPlanned(start, through, skip) },
    goal,
    data,
    undefined,
    start
  );
  return { start, state, today: through };
}

describe('R7: bol', () => {
  const { start, state, today } = midPlan('2026-12-27');
  const pain = (level: number): PlanEvent => ({
    id: `pain:${today}:${String(level)}`,
    date: today,
    kind: 'pain',
    level
  });
  const after = (doc: PlanDoc, n: number): PlanDay | undefined =>
    days(doc).find((d) => d.date === addDays(today, n));

  it('nivo 1–3: 1 dan odmora, prvo trčanje lagano, 5 dana bez jakog udara; tekst nosi uslov i lekara', () => {
    const everyDay = midPlan('2026-12-27', () => false, EXAMPLE, {
      availability: { runDays: [0, 1, 2, 3, 4, 5, 6], longDay: 6 },
      profile: { weeklyKm: 70, recentResult: { distanceM: HALF_M, timeSec: 6060 } }
    });
    const r = replan(everyDay.start, everyDay.state, [pain(2)], EXAMPLE);
    expect(after(r.doc, 1)?.workout).toBeNull();
    expect(isFast(after(r.doc, 2))).toBe(false);
    expect(after(r.doc, 2)?.workout).not.toBeNull();
    const reason = r.changes[0]?.reason ?? '';
    expect(reason).toContain('najviše 2 od 10 i ne raste');
    expect(reason).toContain('lekaru ili fizioterapeutu');
    expect(reason).toContain('4 ili više');
    expect(reason).not.toContain('plan se nastavlja kako je bio');
  });

  it('nivo 4–6: 2 dana odmora, 10 dana bez kvaliteta i bloka, dugi ≤ 75 % poslednjeg 14 dana, prvi kvalitet ≤ 60 % doze', () => {
    const r = replan(start, state, [pain(5)], EXAMPLE);
    const ctx = paceCtxOf(r.doc.header);
    expect(after(r.doc, 1)?.workout).toBeNull();
    expect(after(r.doc, 2)?.workout).toBeNull();
    const lastLong = Math.max(
      ...state.runs.filter((x) => diffDays(today, x.date) < 28).map((x) => x.durationSec)
    );
    let fastBefore = 0;
    for (const day of days(r.doc)) {
      const n = diffDays(day.date, today);
      if (n < 1) continue;
      if (n <= 10) expect(isFast(day), day.date).toBe(false);
      if (n <= 14 && day.workout?.kind === 'long') {
        expect(summarize(day.workout, ctx).durationSec, day.date).toBeLessThanOrEqual(
          0.75 * lastLong + ROUND
        );
      }
      if (n <= 10 && isFast(days(start).find((d) => d.date === day.date))) fastBefore += 1;
    }
    expect(fastBefore).toBeGreaterThan(0);
    const firstFast = days(r.doc).find((d) => d.date > today && d.workout?.kind === 'quality');
    const original = days(start).find((d) => d.date === firstFast?.date);
    expect(firstFast).toBeDefined();
    expect(diffDays(firstFast?.date ?? today, today)).toBeGreaterThan(10);
    expect(firstFast?.workout?.workSec ?? 0).toBeLessThanOrEqual(
      Math.max(0.6 * (original?.workout?.workSec ?? 0) + 150, EXAMPLE.safety.minDoseSec + 150)
    );
    expect(firstFast?.workout?.workSec ?? 0).toBeLessThan(original?.workout?.workSec ?? 0);
    /* Obim se vraća kao posle pauze: prva nedelja posle zaštite ≤ poslednja puna nedelja pre bola × 1,10. */
    const before = weekMin(
      start,
      start.weeks.findIndex((w) => w.start === '2026-12-21')
    );
    const back = r.doc.weeks.findIndex((w) => w.start > addDays(today, 14));
    expect(weekMin(r.doc, back)).toBeLessThanOrEqual(1.1 * before + 4);
    expect(guard(r.doc, state, EXAMPLE).filter((x) => x.check === 'skok')).toEqual([]);
    const reason = r.changes[0]?.reason ?? '';
    expect(reason).toContain('naredna 2 dana su odmor');
    expect(reason).toContain('najviše 2 od 10 i ne raste');
    expect(reason).toContain('prekini trčanje i javi se lekaru ili fizioterapeutu');
    expect(reason).not.toContain('plan se nastavlja kako je bio');
  });

  it('nivo ≥ 7: 7 dana odmora i upozorenje kao do sada', () => {
    const r = replan(start, state, [pain(8)], EXAMPLE);
    for (let n = 1; n <= 7; n += 1) expect(after(r.doc, n)?.workout ?? null).toBeNull();
    expect(r.doc.header.warnings.some((w) => w.code === 'bol')).toBe(true);
    expect(r.changes[0]?.reason).toContain('lekaru ili fizioterapeutu');
  });
});

describe('R8: propušten ključni trening', () => {
  const missedEvent = (doc: PlanDoc, date: string): PlanEvent => {
    const day = days(doc).find((d) => d.date === date);
    return { id: `missed:${date}:${day?.id ?? ''}`, date, kind: 'missed', dayId: day?.id ?? '' };
  };
  const longs = (doc: PlanDoc): PlanDay[] => days(doc).filter((d) => d.workout?.kind === 'long');
  const blocks = (doc: PlanDoc): PlanDay[] =>
    longs(doc).filter((d) => (d.workout?.workSec ?? 0) > 0);

  it('(a) uvek rečenica u promenama — i kad se treninzi ne menjaju; događaj se primenjuje jednom', () => {
    const probe = midPlan('2026-11-15').start;
    const lastBlock = blocks(probe).at(-1);
    if (lastBlock === undefined) throw new Error('nema bloka');
    /* Poslednji dugi sa blokom je propušten; posle njega ostaju samo sužavanje i nedelja trke. */
    const today = addDays(lastBlock.date, 1);
    const { start, state } = midPlan(today, (d) => d === lastBlock.date);
    const later = longs(start).filter((d) => d.date > lastBlock.date);
    const weekKind = (d: PlanDay): string =>
      start.weeks.find((w) => w.days.includes(d))?.intent.kind ?? '';
    const event = missedEvent(start, lastBlock.date);
    const r = replan(start, state, [event], EXAMPLE);
    if (later.every((d) => weekKind(d) !== 'build' && weekKind(d) !== 'peak')) {
      expect(days(r.doc).map((d) => JSON.stringify(d.workout))).toEqual(
        days(start).map((d) => JSON.stringify(d.workout))
      );
      expect(r.changes).toHaveLength(1);
      expect(r.changes[0]?.what).toBe('obavestenje');
      expect(r.changes[0]?.reason).toContain('poslednje dve nedelje su za odmor');
    }
    expect(r.changes.length).toBeGreaterThan(0);
    expect(r.changes[0]?.reason).toContain('Propušten je ključni trening');
    expect(r.changes[0]?.reason).toContain(lastBlock.workout?.text ?? 'x');
    expect(r.doc.header.appliedEvents).toContain(event.id);
    const again = replan(r.doc, state, [event], EXAMPLE);
    expect(again.changes).toEqual([]);
    expect(again.doc).toBe(r.doc);
    expect(renderPlan(r.doc, state, EXAMPLE, { changes: r.changes })).toContain(
      'Propušten je ključni trening'
    );
  });

  it('(b) propušten dugi sa blokom: sledeći dugi u nedelji gradnje nosi blok na prethodnom koraku, ne većem', () => {
    const probe = midPlan('2026-11-15').start;
    const all = blocks(probe);
    const missed = all.at(-2);
    const previous = all.at(-3);
    if (missed === undefined) throw new Error('nema dva bloka');
    const today = addDays(missed.date, 1);
    const { start, state } = midPlan(today, (d) => d === missed.date);
    const r = replan(start, state, [missedEvent(start, missed.date)], EXAMPLE);
    const next = longs(r.doc).find((d) => d.date > missed.date);
    const planned = longs(start).find((d) => d.date === next?.date);
    /* krug 6 (R1): nadoknada samo u naredne 2 nedelje i van sužavanja — inače plan ostaje isti, uz rečenicu */
    const late =
      next === undefined ||
      diffDays(next.date, today) > 14 ||
      r.doc.weeks.findIndex((w) => w.days.some((d) => d.id === next.id)) >= r.doc.weeks.length - 2;
    if (late) {
      expect(next?.workout?.workSec).toBe(planned?.workout?.workSec);
      expect(r.changes[0]?.reason).toContain('ostaje kako je planiran');
      return;
    }
    expect(next?.workout?.workSec ?? 0).toBeGreaterThan(0);
    expect(next?.workout?.workSec ?? 0).toBeLessThanOrEqual((missed.workout?.workSec ?? 0) + 60);
    /* Ne manje od planiranog ni od koraka pre propuštenog (kad je plan za taj dan imao manje). */
    expect(next?.workout?.workSec ?? 0).toBeGreaterThanOrEqual(
      Math.min(
        missed.workout?.workSec ?? 0,
        Math.max(planned?.workout?.workSec ?? 0, previous?.workout?.workSec ?? 0)
      ) - 150
    );
    expect(r.changes[0]?.reason).toContain('na prethodnom koraku, ne na većem');
  });

  it('(c) dva propuštena duga zaredom: sledeći dugi bez bloka, ne kraći od prvobitnog (krug 6, R1)', () => {
    /* Bez plafona udela u nedelji i sa malim korakom: dugi raste svake nedelje, pa propušteni lanac veže. */
    const data = withSafety(EXAMPLE, { longStepSec: 290, longShareByRunDays: { '1': 1 } });
    const probe = midPlan('2026-11-15', () => false, data).start;
    const all = longs(probe);
    const first = all[5];
    const second = all[6];
    if (first === undefined || second === undefined) throw new Error('nema dugih');
    const today = addDays(second.date, 1);
    const { start, state } = midPlan(today, (d) => d === first.date || d === second.date, data);
    const events = deriveEvents(start, state);
    const r = replan(start, state, events, data);
    const ctx = paceCtxOf(r.doc.header);
    const lastDone = Math.max(
      ...state.runs.filter((x) => diffDays(today, x.date) < 28).map((x) => x.durationSec)
    );
    const step = data.safety.longStepSec;
    const after = longs(r.doc).filter((d) => d.date > today);
    const next = after[0];
    expect(next?.workout?.workSec).toBe(0);
    /* krug 6 (R1): sledeći dugi nije kraći od prvobitnog (ne „poslednji odrađen + korak"), ali bez bloka */
    const plannedSec = summarize(
      longs(start).find((d) => d.date === next?.date)?.workout ?? null,
      ctx
    ).durationSec;
    expect(secOf(r.doc, next)).toBeGreaterThanOrEqual(plannedSec - ROUND);
    void lastDone;
    let previous = secOf(r.doc, next);
    for (const day of after.slice(1, 4)) {
      const sec = secOf(r.doc, day);
      expect(sec, day.date).toBeLessThanOrEqual(previous + step + ROUND);
      previous = Math.max(previous, sec);
    }
    expect(r.changes.some((c) => c.reason.includes('2 puta zaredom'))).toBe(true);
  });
});

describe('R9: pauza, provera forme i povratak', () => {
  /** Primer sa proverom forme u 6. nedelji (subota je lagan dan — provera ide na prvi dan kvaliteta). */
  const exTemplate = EXAMPLE.templates[0];
  if (exTemplate === undefined) throw new Error('nema šablona');
  const withTest = (weekIndex: number): DistanceData => {
    let n = 0;
    return {
      ...EXAMPLE,
      templates: [
        {
          ...exTemplate,
          recoveryEvery: 0,
          body: exTemplate.body.map((p) => ({
            ...p,
            loopFrom: p.cycle.length - 1,
            cycle: Array.from({ length: 12 }, (_, i) => {
              const base = p.cycle[Math.min(i, p.cycle.length - 1)];
              if (base === undefined) throw new Error('prazan ciklus');
              n += 1;
              return n === weekIndex
                ? { ...base, stimuli: [{ stimulus: 'test' }, ...base.stimuli.slice(1)] }
                : base;
            })
          }))
        }
      ]
    };
  };

  it('provera forme koja padne u pauzu se pomera u prvu nedelju posle rampe i zamenjuje njen kvalitet', () => {
    const data = withTest(6);
    const probe = midPlan('2026-11-15', () => false, data).start;
    const test = days(probe).find((d) => d.workout?.kind === 'test');
    if (test === undefined) throw new Error('plan nema proveru forme');
    const from = addDays(test.date, -3);
    const to = addDays(test.date, 3);
    const goal = { distanceId: data.id, raceDate: '2027-03-07' };
    const f = facts();
    const state = buildState(
      {
        ...f,
        today: to,
        runs: runsAsPlanned(probe, addDays(from, -1)),
        pauses: [{ from, to, reason: 'bolest' }]
      },
      goal,
      data,
      undefined,
      probe
    );
    const r = replan(probe, state, deriveEvents(probe, state), data);
    const moved = days(r.doc).filter((d) => d.date > to && d.workout?.kind === 'test');
    const rampEnd = addDays(to, 14);
    /* M4 (krug 5): u prvo RASTEREĆENJE najranije 10 dana posle kraja rampe i najkasnije 3 nedelje pred trku;
       bez takve nedelje provera otpada uz rečenicu */
    const rest = r.doc.weeks.find(
      (w) =>
        w.intent.kind === 'recovery' &&
        diffDays(addDays(w.start, 6), rampEnd) >= 10 &&
        w.start <= addDays(goal.raceDate, -21)
    );
    if (rest === undefined) {
      /* krug 10: bez rasterećenja jedina provera se pomera u prvu pogodnu nedelju (≥ 10 dana posle rampe, ≥ 3
         nedelje pred trku), a otpada samo kad takvog dana nema */
      expect(moved.length).toBeLessThanOrEqual(1);
      for (const m of moved) {
        expect(diffDays(m.date, rampEnd)).toBeGreaterThanOrEqual(10);
        expect(m.date <= addDays(goal.raceDate, -21)).toBe(true);
      }
      if (moved.length === 0) expect(r.changes[0]?.reason).toContain('Provera forme otpada');
    } else {
      expect(moved).toHaveLength(1);
      expect(diffDays(moved[0]?.date ?? to, rampEnd)).toBeGreaterThanOrEqual(10);
      const week = r.doc.weeks.find((w) => w.days.some((d) => d.id === moved[0]?.id));
      expect(week?.intent.kind).toBe('recovery');
      /* Zamenjuje kvalitet te nedelje, ne dodaje se uz njega. */
      expect(week?.days.filter((d) => d.workout?.kind === 'quality')).toHaveLength(0);
      expect(r.changes[0]?.reason).toContain('Provera forme je pomerena na');
    }
    /* Ponovljeno planiranje daje isti plan. */
    const again = replan(r.doc, state, deriveEvents(r.doc, state), data);
    expect(again.changes).toEqual([]);
  });

  it('tekst o brzim treninzima odgovara stvarnom prvom danu kvaliteta u planu', () => {
    const { start } = midPlan('2026-12-13');
    const today = '2026-12-20';
    const state = buildState(
      {
        ...facts(),
        today,
        runs: runsAsPlanned(start, '2026-12-13'),
        pauses: [{ from: '2026-12-14', to: today, reason: 'bolest' }]
      },
      EX_GOAL,
      EXAMPLE,
      undefined,
      start
    );
    const r = replan(start, state, deriveEvents(start, state), EXAMPLE);
    const first = days(r.doc).find((d) => d.date > today && isFast(d));
    const reason = r.changes.find((c) => c.scope === 'dan')?.reason ?? '';
    expect(first).toBeDefined();
    const d = first?.date ?? today;
    expect(reason).toContain(
      `prvi brzi trening je ${String(Number(d.slice(8, 10)))}. ${String(Number(d.slice(5, 7)))}.`
    );
    expect(reason).not.toMatch(/prvih \d+ dana/);
    /* Povratak: prva nedelja posle rampe ≤ poslednja puna nedelja pre pauze × 1,10, pa pravilo rasta. */
    const index = r.doc.weeks.findIndex((w) => w.start > addDays(today, 14));
    /* krug 5 (E1): merilo je poslednja PUNA nedelja gradnje pre pauze (ne rasterećenje) */
    const lastBuild = start.weeks.reduce(
      (best, w, i) => (w.start <= '2026-12-07' && w.intent.kind !== 'recovery' ? i : best),
      -1
    );
    const before = weekMin(start, lastBuild);
    expect(weekMin(r.doc, index)).toBeLessThanOrEqual(1.1 * before + 4);
    /* krug 5 (E1): posle rampe + 14 dana vraća se prvobitan plan — tada je merilo prvobitna nedelja */
    expect(weekMin(r.doc, index + 1)).toBeLessThanOrEqual(
      Math.max(
        Math.max(weekMin(r.doc, index), before) * (1 + EXAMPLE.safety.maxWeeklyRampPct) + 14,
        weekMin(start, index + 1)
      )
    );
  });
});

/* ------------------------------------------------------------------ R6, R10, R11: zaglavlje, ispis, upozorenja */

describe('R6: istina o tempu trke', () => {
  const withGoal = (targetTimeSec: number | undefined): { text: string; doc: PlanDoc } => {
    const goal: Goal = { ...EX_GOAL, ...(targetTimeSec === undefined ? {} : { targetTimeSec }) };
    const { doc, state } = make(facts(), EXAMPLE, goal);
    return { text: renderPlan(doc, state, EXAMPLE), doc };
  };
  const paceOf = (sec: number): string => {
    const s = Math.round((sec / HALF_M) * 1000);
    return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}/km`;
  };

  it('zaglavlje kaže po čemu se trenira, šta cilj traži i da li je u rasponu', () => {
    const base = withGoal(undefined);
    const { lowSec, expectedSec } = base.doc.header.form.raceDay;
    const rp = paceOf((base.doc.header.paces.RP * HALF_M) / 1000);
    expect(base.text).toContain(`Tempo trke u treninzima je tvoja današnja forma (${rp}).`);
    expect(base.text).toContain(`Očekivano vreme na dan trke`);
    expect(base.text).toContain('Tempa se ubrzavaju kad trka ili test to potvrde.');
    const easy = withGoal(expectedSec + 120);
    expect(easy.text).toContain(`traži ${paceOf(expectedSec + 120)} — dostižan je (raspon`);
    const edge = withGoal(Math.round((lowSec + expectedSec) / 2));
    expect(edge.text).toContain('— na ivici je (raspon');
    const far = withGoal(lowSec - 300);
    expect(far.text).toContain(`traži ${paceOf(lowSec - 300)} — van raspona je (raspon`);
  });

  /* R20 B4 (menja R18 stavku 1): sporiji cilj JE tempo za trku (jedan broj: cilj iz zaglavlja); brži cilj ne
     ubrzava tempo preko potvrđene forme */
  it('taktika dana trke (krug 4, S7; R20 B4): iz današnje forme, a sporiji cilj je tempo za trku', () => {
    const base = withGoal(undefined);
    const confirmed = raceTimeSec(base.doc.header.form.paceVdot, HALF_M);
    /* ovaj primer ima upozorenje „počni sporije" — tempo je oprezan, ne brži od forme */
    expect(base.text).toMatch(/Tempo za trku: \d+:\d\d\/km \(oprezno, sporija polovina raspona/);
    expect(withGoal(confirmed + 600).text).toContain(
      `Tempo za trku: ${paceOf(confirmed + 600)} (tvoj cilj`
    );
    /* brži cilj: forma ili oprezniji tempo (uz upozorenje „počni sporije"), nikad brži od forme */
    const fast = /Tempo za trku: (\d+):(\d\d)\/km \((današnja forma|oprezno)/.exec(
      withGoal(confirmed - 300).text
    );
    expect(fast).not.toBeNull();
    const fastPace = Number(fast?.[1]) * 60 + Number(fast?.[2]);
    expect(fastPace).toBeGreaterThanOrEqual(Math.round((confirmed / HALF_M) * 1000));
  });

  it('napomene trke iz podataka: zamene tempa, a za trkača po osećaju tekst bez s/km', () => {
    const data: DistanceData = {
      ...EXAMPLE,
      noteRules: [
        ...EXAMPLE.noteRules,
        { kinds: ['race'], minDurationSec: 0, text: 'trka-plan', byFeelText: 'trka-plan-osecaj' }
      ],
      texts: {
        ...EXAMPLE.texts,
        'trka-plan': 'prvih 5 km {paceFrom}–{paceTo}, zatim {pace}',
        'trka-plan-osecaj': 'prvih 5 km zadržano, zatim ravnomerno po osećaju'
      }
    };
    const paced = make(facts(), data, EX_GOAL);
    const out = renderPlan(paced.doc, paced.state, data);
    expect(out).toMatch(/napomena: prvih 5 km \d:\d\d–\d:\d\d\/km, zatim \d:\d\d\/km/);
    const feel = make(facts({ profile: { weeklyKm: 25, easyPaceSecPerKm: 400 } }), data, EX_GOAL);
    expect(feel.doc.header.paces.byFeel).toBe(true);
    const notes = renderPlan(feel.doc, feel.state, data)
      .split('\n')
      .filter((l) => l.includes('napomena:'));
    expect(notes.join('\n')).toContain('prvih 5 km zadržano, zatim ravnomerno po osećaju');
    expect(notes.join('\n')).toContain('Trku trči po osećaju');
    expect(notes.join('\n')).not.toMatch(/\/km|\{/);
    expect(renderPlan(feel.doc, feel.state, data)).toContain('Tempa još nisu pouzdana');
  });
});

describe('R10: ispis', () => {
  const { doc, state } = make(facts(), EXAMPLE, EX_GOAL);
  const text = renderPlan(doc, state, EXAMPLE);
  const lines = text.split('\n');

  it('zaglavlje kaže koji sadašnji obim plan pretpostavlja', () => {
    expect(text).toContain('Polazim od tvojih ≈ 30 km nedeljno (');
  });

  it('naslovi nedelja: bez duplog „nedelja trke"; nedelje pred trku se ne zovu „gradnja"', () => {
    const heads = lines.filter((l) => /^\d+\. NEDELJA/.test(l));
    const last = heads.at(-1) ?? '';
    expect(last.match(/nedelja trke/g)).toHaveLength(1);
    for (const head of heads) {
      const left = /do trke (\d+) nedelj/.exec(head);
      if (left !== null && Number(left[1]) <= 2) expect(head).not.toContain('gradnja');
    }
    expect(heads.some((h) => h.includes('gradnja'))).toBe(true);
  });

  it('zbir nedelje trke broji trku; udeo brzog rada kaže čega je procenat; posle trke rečenica o oporavku', () => {
    const sums = lines.filter((l) => l.startsWith('  Zbir:'));
    expect(sums.at(-1)).toMatch(/\d+ trening\w* \+ trka, brz rad \d+ % vremena trčanja/);
    for (const sum of sums.slice(0, -1)) {
      expect(sum).toMatch(/brz rad \d+ % vremena trčanja/);
      expect(sum).not.toContain('+ trka');
    }
    const race = lines.findIndex((l) => l.includes('TRKA:'));
    const after = lines.slice(race + 1).filter((l) => l.includes('napomena:'));
    expect(after.at(-1)).toMatch(/Posle trke: \d+ dana? bez brzih treninga/);
  });

  it('`povratak`: „dan posle trke" ili „posle testa", bez „trke ili testa od N min"', () => {
    const run = (effort: 'race' | 'test'): string => {
      const f = facts({
        runs: [{ id: 'x', date: '2026-11-15', distanceM: 10000, durationSec: 2760, effort }]
      });
      const w = make(f, EXAMPLE, EX_GOAL).doc.header.warnings.find((x) => x.code === 'povratak');
      return w?.problem ?? '';
    };
    expect(run('race')).toBe('Plan počinje dan posle trke (10 km za 46:00).');
    expect(run('test')).toBe('Plan počinje dan posle testa (10 km za 46:00).');
  });

  it('urađene nedelje se ispisuju kao urađene: tempo kakav je bio, ne novi tempo plana', () => {
    const today = '2026-12-06';
    const race = {
      id: 'r10',
      date: today,
      distanceM: 10000,
      durationSec: 2580,
      effort: 'race' as const
    };
    const skipped = '2026-11-28';
    const st = buildState(
      {
        ...facts(),
        today,
        runs: [...runsAsPlanned(doc, '2026-12-05', (d) => d === skipped), race]
      },
      EX_GOAL,
      EXAMPLE,
      undefined,
      doc
    );
    const r = replan(doc, st, deriveEvents(doc, st), EXAMPLE);
    expect(r.doc.header.paces.T).toBeLessThan(doc.header.paces.T);
    const out = renderPlan(r.doc, st, EXAMPLE, { changes: r.changes }).split('\n');
    const first = out.findIndex((l) => l.startsWith('1. NEDELJA'));
    const second = out.findIndex((l) => l.startsWith('2. NEDELJA'));
    const week1 = out.slice(first, second);
    const quality = week1.find((l) => l.includes('prag'));
    expect(quality).toContain('— urađeno ');
    /* Tempo u redu je stvarni prosek trčanja (sporiji od praga), ne novi tempo praga iz zaglavlja. */
    expect(quality).not.toContain(`(${String(Math.floor(r.doc.header.paces.T / 60))}:`);
    expect(week1.some((l) => l.startsWith('  Urađeno:'))).toBe(true);
    expect(week1.some((l) => l.includes('brz rad'))).toBe(false);
    expect(out.some((l) => l.includes(' — nije urađeno'))).toBe(true);
    /* Budući dani i dalje nose tempo plana. */
    expect(out.some((l) => l.includes(`/km)`) && !l.includes('urađeno'))).toBe(true);
  });

  it('promena prognoze u odnosu na prethodni ispis nosi „zašto"', () => {
    expect(text).not.toContain('nego u prethodnom ispisu');
    const moved: RunnerState = {
      ...state,
      form: {
        ...state.form,
        /* M7 (krug 14): plan primera ne računa napredak od obima (dugi 14 od 18 km) — pomera se i današnja forma */
        current: { ...state.form.current, raceTimeSec: state.form.current.raceTimeSec - 45 },
        raceDay: { ...state.form.raceDay, expectedSec: state.form.raceDay.expectedSec - 45 },
        history: [
          ...state.form.history,
          {
            date: '2026-12-01',
            signal: 'kvalitet',
            before: 44.6,
            after: 44.9,
            reason: 'Prag od 1. 12. si držao lakše nego što forma predviđa.'
          }
        ]
      }
    };
    const out = renderPlan(doc, moved, EXAMPLE);
    expect(out).toContain('Prognoza je bolja nego u prethodnom ispisu');
    /* Krug 3: rečenice iz istorije procene forme, najnovija prva, najviše 5. */
    const lines = out.split('\n');
    const at = lines.findIndex((l) => l.startsWith('Zašto je prognoza ovakva'));
    expect(lines[at + 1]).toBe('- Prag od 1. 12. si držao lakše nego što forma predviđa.');
    const silent: RunnerState = { ...moved, form: { ...moved.form, history: state.form.history } };
    expect(renderPlan(doc, silent, EXAMPLE)).toContain('Procena forme je ponovo izračunata');
    const many: RunnerState = {
      ...moved,
      form: {
        ...moved.form,
        history: Array.from({ length: 8 }, (_, i) => ({
          date: `2026-12-0${String(i + 1)}`,
          signal: 'kvalitet' as const,
          before: 44,
          after: 44.1,
          reason: `Rečenica ${String(i + 1)}.`
        }))
      }
    };
    const reasons = renderPlan(doc, many, EXAMPLE)
      .split('\n')
      .filter((l) => l.startsWith('- Rečenica'));
    expect(reasons).toEqual([8, 7, 6, 5, 4].map((i) => `- Rečenica ${String(i)}.`));
    const small: RunnerState = {
      ...state,
      form: {
        ...state.form,
        raceDay: { ...state.form.raceDay, expectedSec: state.form.raceDay.expectedSec + 15 }
      }
    };
    expect(renderPlan(doc, small, EXAMPLE)).not.toContain('nego u prethodnom ispisu');
  });
});

describe('R11: upozorenja', () => {
  const num = (value: string): number => Number(value.replace(',', '.'));

  it('predlog nikad ne nudi vrh ni dugi manji od onoga što plan već ima', () => {
    let proposals = 0;
    for (const c of grid()) {
      const { doc } = build(c.facts, c.goal);
      const ctx = paceCtxOf(doc.header);
      const costs = doc.weeks.map((w) => weekCost(w, c.goal.raceDate, ctx));
      const peakKm = Math.max(0, ...costs.map((x) => x.km));
      const longKm = Math.max(0, ...costs.map((x) => x.longKm));
      for (const w of doc.header.warnings) {
        if (!['mali-obim', 'malo-dana', 'kratak-dugi'].includes(w.code)) continue;
        const now = w.proposal.split('Za sledeću trku')[0] ?? '';
        const long = /dugi (?:tada )?(?:može da naraste |stiže )?do ([\d,]+) km/.exec(now);
        const peak = /(?:vrh tada ide|nedelja tada stiže) do ([\d,]+) km/.exec(now);
        if (long !== null) {
          expect(num(long[1] ?? '0'), `${c.name}: ${w.proposal}`).toBeGreaterThan(longKm);
          proposals += 1;
        }
        if (peak !== null) {
          expect(num(peak[1] ?? '0'), `${c.name}: ${w.proposal}`).toBeGreaterThan(peakKm);
          proposals += 1;
        }
      }
    }
    expect(proposals).toBeGreaterThan(10);
  });

  it('`obim-za-nivo`: obim ispod onoga što nivo traži → upozorenje sa predlogom iz `adequate`', () => {
    const data: DistanceData = {
      ...EXAMPLE,
      adequate: {
        ...EXAMPLE.adequate,
        minPeakWeeklyKm: 30,
        minPeakWeeklyKmByLevel: { osnovni: 70 }
      }
    };
    const fast = facts({
      availability: { runDays: [0, 1, 3, 5, 6], longDay: 6 },
      profile: { weeklyKm: 35, recentResult: { distanceM: HALF_M, timeSec: 4800 } }
    });
    const { doc } = make(fast, data, EX_GOAL);
    const w = doc.header.warnings.find((x) => x.code === 'obim-za-nivo');
    expect(w).toBeDefined();
    expect(w?.proposal).toContain('do oko 70 km');
    expect(w?.suggest?.peakWeeklyKm).toBe(70);
    expect(w?.meaning).toContain('% vremena trčanja');
    /* Dovoljan obim: nema upozorenja. Tempa po osećaju: nema upozorenja (forma nije poznata). */
    const enough = facts({
      availability: { runDays: [0, 1, 3, 5, 6], longDay: 6 },
      profile: { weeklyKm: 75, recentResult: { distanceM: HALF_M, timeSec: 4800 } }
    });
    expect(
      make(enough, data, EX_GOAL).doc.header.warnings.some((x) => x.code === 'obim-za-nivo')
    ).toBe(false);
    const feel = facts({ profile: { weeklyKm: 35, easyPaceSecPerKm: 330 } });
    expect(
      make(feel, data, EX_GOAL).doc.header.warnings.some((x) => x.code === 'obim-za-nivo')
    ).toBe(false);
  });

  it('`obim-za-nivo` i bez broja za nivo: kad plan ne može da smesti brze treninge šablona', () => {
    /* 26 km nedeljno na 6 dana uz formu 1:20: brzi trening u većini nedelja ustupa mesto laganom danu. */
    const data: DistanceData = {
      ...EXAMPLE,
      adequate: { ...EXAMPLE.adequate, minPeakWeeklyKm: 20 }
    };
    const f = facts({
      availability: { runDays: [0, 1, 2, 3, 5, 6], longDay: 6 },
      profile: { weeklyKm: 26, recentResult: { distanceM: HALF_M, timeSec: 4800 } }
    });
    const { doc } = make(f, data, EX_GOAL);
    const w = doc.header.warnings.find((x) => x.code === 'obim-za-nivo');
    expect(w?.problem).toMatch(/u \d+ od \d+ nedelja gradnje brzi trening je zamenjen laganim/);
    const ctx = paceCtxOf(doc.header);
    const peakKm = Math.max(...doc.weeks.map((x) => weekCost(x, EX_GOAL.raceDate, ctx).km));
    expect(w?.suggest?.peakWeeklyKm ?? 0).toBeGreaterThan(peakKm);
  });
});

describe('ugovor motor → forma (dodatak kruga 2)', () => {
  it('za postojeći plan procena forme dobija bazu i vrh IZ PLANA i ciljeve nedelja', () => {
    const { doc } = make(facts(), EXAMPLE, EX_GOAL);
    const seen: (Parameters<EstimateFormFn>[2] | undefined)[] = [];
    const spy: EstimateFormFn = (f, goal, planned) => {
      seen.push(planned);
      return declaredForm(f, goal, planned);
    };
    const f = { ...facts(), today: '2026-12-13', runs: runsAsPlanned(doc, '2026-12-13') };
    buildState(f, EX_GOAL, EXAMPLE, spy, doc);
    const last = seen.at(-1);
    expect(last?.baseLoad).toBe(doc.header.decisions.baseLoad);
    expect(last?.peakLoad).toBe(doc.header.decisions.peakLoad);
    expect(last?.weeks).toEqual(
      doc.weeks.map((w) => ({ start: w.start, targetLoad: w.targetLoad }))
    );
    /* Bez plana (nov plan): baza i vrh iz današnjeg stanja, bez nedelja. */
    seen.length = 0;
    buildState(facts(), EX_GOAL, EXAMPLE, spy);
    expect(seen.at(-1)?.weeks).toBeUndefined();
    expect(seen.at(-1)?.peakLoad).toBeGreaterThan(0);
  });
});
