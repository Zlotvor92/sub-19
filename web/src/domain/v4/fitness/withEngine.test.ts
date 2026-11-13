/* INTEGRACIJA (krug 3, QA1): motor + prava procena forme, dan za danom kroz ceo plan. Trkač (a) radi tačno po
   planu, (b) preskače svaki peti trening, (c) radi i proveru forme iz plana — upisanu kao jednu aktivnost sa
   zagrevanjem, pa sa krugom rada. Bez izuzetaka, stabilno, prognoza se ne pogoršava bez razloga (R12). */
import { describe, expect, it } from 'vitest';
import { addDays } from '../engine/dates';
import {
  buildState,
  deriveEvents,
  guard,
  paceCtxOf,
  plan,
  replan,
  summarize
} from '../engine/index';
import { hm } from '../distances/hm/index';
import { factsOf, PROFILES } from '../distances/hm/testdata/profiles';
import { SYNTHETIC } from '../engine/testdata/synthetic';
import type {
  DistanceData,
  Goal,
  PlanDay,
  PlanDoc,
  Run,
  RunnerFacts,
  RunnerState
} from '../engine/types';
import { raceTimeSec } from '../engine/vdot';
import { estimateForm } from './estimate';

const TODAY = '2026-11-15';
const GOAL: Goal = { distanceId: SYNTHETIC.id, raceDate: '2027-02-07' };
const FACTS: RunnerFacts = {
  today: TODAY,
  availability: { runDays: [1, 3, 5, 6], longDay: 6 },
  profile: { weeklyKm: 40, recentResult: { distanceM: 10000, timeSec: 2760 }, yearsRunning: 3 },
  runs: [],
  pauses: [],
  pain: []
};
const template = SYNTHETIC.templates[1];
if (template === undefined) throw new Error('nema šablona');
/** Provera forme (test 3 km) u drugoj nedelji tela. */
const WITH_TEST: DistanceData = {
  ...SYNTHETIC,
  templates: [
    {
      ...template,
      body: template.body.map((p, pi) => ({
        ...p,
        cycle: p.cycle.map((w, i) =>
          pi === 0 && i === 1
            ? { ...w, stimuli: [{ stimulus: 'test' }, { stimulus: 'ubrzanja' }] }
            : w
        )
      }))
    }
  ]
};

const days = (doc: PlanDoc): PlanDay[] => doc.weeks.flatMap((w) => w.days);

interface Sim {
  start: RunnerState;
  end: RunnerState;
  doc: PlanDoc;
  first: PlanDoc;
  changes: number;
  worst: number;
  kinds: Set<string>;
}

/** Simulacija: svaki dan se upiše trčanje tog dana (ako ga `runOf` da), izvedu događaji i ponovo planira. */
function simulate(
  data: DistanceData,
  runOf: (day: PlanDay, doc: PlanDoc, index: number) => Run | null
): Sim {
  const start = buildState(FACTS, GOAL, data, estimateForm);
  const made = plan(start, GOAL, data);
  if (!made.ok) throw new Error('plan odbijen');
  let doc = made.doc;
  let state = start;
  const runs: Run[] = [];
  const kinds = new Set<string>();
  let changes = 0;
  let worst = 0;
  let index = 0;
  for (let today = addDays(TODAY, 1); today < GOAL.raceDate; today = addDays(today, 1)) {
    const day = days(doc).find((d) => d.date === today);
    if (day !== undefined && day.workout !== null) {
      const run = runOf(day, doc, index);
      index += 1;
      if (run !== null) runs.push(run);
    }
    state = buildState({ ...FACTS, today, runs: [...runs] }, GOAL, data, estimateForm, doc);
    const events = deriveEvents(doc, state);
    for (const e of events) kinds.add(e.kind);
    const result = replan(doc, state, events, data);
    changes += result.changes.length;
    doc = result.doc;
    /* Stabilnost: bez novih događaja isti dokument. */
    expect(replan(doc, state, deriveEvents(doc, state), data).doc, today).toBe(doc);
    worst = Math.max(worst, state.form.raceDay.expectedSec - start.form.raceDay.expectedSec);
  }
  return { start, end: state, doc, first: made.doc, changes, worst, kinds };
}

function asPlanned(day: PlanDay, doc: PlanDoc): Run {
  const cost = summarize(day.workout, paceCtxOf(doc.header));
  return {
    id: `run-${day.id}`,
    date: day.date,
    distanceM: Math.round(cost.distanceM),
    durationSec: Math.round(cost.durationSec),
    dayId: day.id
  };
}

const NEVER = ['doza-plafon', 'dugi-plafon', 'prazan', 'trka', 'nema-treninga', 'dan-pred-trku'];
const clean = (sim: Sim, data: DistanceData): string[] =>
  guard(sim.doc, sim.end, data)
    .filter((f) => NEVER.includes(f.check))
    .map((f) => f.check);

describe('nov plan bez istorije trčanja', () => {
  it('istorija procene nema rečenicu o „neodrađenoj nedelji" pre prvog trčanja', () => {
    const state = buildState(FACTS, GOAL, SYNTHETIC, estimateForm);
    expect(state.form.history.map((h) => h.signal)).toEqual(['izjava']);
    for (const h of state.form.history) expect(h.reason).not.toContain('odrađena je oko 0 %');
  });
});

describe('motor + procena forme, dan za danom kroz ceo plan', () => {
  it('trkač radi tačno po planu: plan se ne menja, prognoza se ne pogoršava (R12)', () => {
    const sim = simulate(SYNTHETIC, (day, doc) => asPlanned(day, doc));
    expect(days(sim.doc).map((d) => JSON.stringify(d.workout))).toEqual(
      days(sim.first).map((d) => JSON.stringify(d.workout))
    );
    expect([...sim.kinds].filter((k) => k !== 'form-update')).toEqual([]);
    expect(sim.worst).toBeLessThanOrEqual(20);
    expect(sim.end.form.raceDay.expectedSec).toBeLessThanOrEqual(
      sim.start.form.raceDay.expectedSec + 20
    );
    expect(clean(sim, SYNTHETIC)).toEqual([]);
  });

  it('trkač preskače svaki peti trening: bez izuzetaka, jedna trka, plan ostaje upotrebljiv', () => {
    const sim = simulate(SYNTHETIC, (day, doc, i) => (i % 5 === 4 ? null : asPlanned(day, doc)));
    expect(sim.kinds.has('missed')).toBe(true);
    expect(
      days(sim.doc)
        .filter((d) => d.workout?.kind === 'race')
        .map((d) => d.date)
    ).toEqual([GOAL.raceDate]);
    expect(clean(sim, SYNTHETIC)).toEqual([]);
    /* Propušteni treninzi ne popravljaju prognozu preko polazne. */
    expect(sim.end.form.raceDay.expectedSec).toBeGreaterThanOrEqual(sim.start.form.raceDay.lowSec);
  });

  it('provera forme upisana kao jedna aktivnost sa zagrevanjem ne obara formu ni tempa (K1)', () => {
    const sim = simulate(WITH_TEST, (day, doc) =>
      day.workout?.kind === 'test'
        ? { ...asPlanned(day, doc), effort: 'test' }
        : asPlanned(day, doc)
    );
    expect(days(sim.first).some((d) => d.workout?.kind === 'test')).toBe(true);
    expect(sim.kinds.has('result')).toBe(true);
    expect(sim.end.form.current.vdot).toBeGreaterThanOrEqual(sim.start.form.current.vdot - 0.3);
    expect(sim.doc.header.paces.T).toBeLessThanOrEqual(sim.first.header.paces.T + 2);
    const note = sim.end.form.history.find((h) => h.ignored === true);
    expect(note?.reason).toContain('Upiši vreme na 3 km');
    expect(clean(sim, WITH_TEST)).toEqual([]);
  });

  it('ista provera sa krugom rada (bolji rezultat) ubrzava tempa, a plan ostaje stabilan', () => {
    const sim = simulate(WITH_TEST, (day, doc) => {
      const run = asPlanned(day, doc);
      if (day.workout?.kind !== 'test') return run;
      /* 3 km se prenosi na cilj 8 km uz umanjenje β·ln(8/3) (F4-K2; β ≤ 3,5): rezultat je i posle prenosa bolji za 2 */
      const sec = Math.round(
        raceTimeSec(doc.header.form.paceVdot + 2 + 3.5 * Math.log(8000 / 3000), 3000)
      );
      return {
        ...run,
        effort: 'test',
        laps: [
          { role: 'other', distanceM: 2500, durationSec: 900 },
          { role: 'work', distanceM: 3000, durationSec: sec },
          { role: 'other', distanceM: run.distanceM - 5500, durationSec: 600 }
        ]
      };
    });
    expect(sim.kinds.has('result')).toBe(true);
    expect(sim.doc.header.paces.T).toBeLessThan(sim.first.header.paces.T);
    expect(sim.end.form.current.vdot).toBeGreaterThan(sim.start.form.current.vdot + 0.5);
    expect(clean(sim, WITH_TEST)).toEqual([]);
  });
});

describe('R9 nad PRAVIM podacima polumaratona: bolest 7 dana, provera forme u prozoru povratka', () => {
  const show = (iso: string): string =>
    `${String(Number(iso.slice(8, 10)))}. ${String(Number(iso.slice(5, 7)))}.`;
  const isFast = (d: PlanDay): boolean =>
    d.workout !== null &&
    d.workout.kind !== 'race' &&
    (d.workout.kind === 'quality' || d.workout.kind === 'test' || d.workout.workSec > 0);

  it('test u pauzi ili rampi se pomera; tekst promene navodi datume koji stoje u planu (svi profili)', () => {
    let moved = 0;
    let checked = 0;
    for (const p of PROFILES) {
      const goal = p.goal;
      const base = factsOf(p);
      const state0 = buildState(base, goal, hm, estimateForm);
      const made = plan(state0, goal, hm);
      if (!made.ok) throw new Error(`plan odbijen: ${p.id}`);
      const start = made.doc;
      for (const test of days(start).filter((d) => d.workout?.kind === 'test')) {
        /* Bolest 7 dana koja se završava 10 dana pre provere forme: provera pada u rampu (14 dana). */
        const to = addDays(test.date, -10);
        const from = addDays(to, -6);
        if (from <= start.header.startDate) continue;
        const ctx = paceCtxOf(start.header);
        const runs: Run[] = days(start)
          .filter((d) => d.workout !== null && d.date < from)
          .map((d) => {
            const cost = summarize(d.workout, ctx);
            return {
              id: `run-${d.id}`,
              date: d.date,
              distanceM: Math.round(cost.distanceM),
              durationSec: Math.round(cost.durationSec),
              dayId: d.id
            };
          });
        const state = buildState(
          { ...base, today: to, runs, pauses: [{ from, to, reason: 'bolest' }] },
          goal,
          hm,
          estimateForm,
          start
        );
        const r = replan(start, state, deriveEvents(start, state), hm);
        const rampEnd = addDays(to, 14);
        const name = `${p.id} test ${test.date}`;
        for (const d of days(r.doc)) {
          if (d.date > to && d.date <= rampEnd) {
            expect(d.workout?.kind === 'test', `${name}: ${d.date}`).toBe(false);
          }
        }
        const reason = r.changes.find((c) => c.scope === 'dan')?.reason ?? '';
        const firstFast = days(r.doc).find((d) => d.date > to && isFast(d));
        if (firstFast !== undefined) {
          expect(reason, name).toContain(`prvi brzi trening je ${show(firstFast.date)}`);
        }
        const at = /Provera forme je pomerena na (\d+\. \d+\.)/.exec(reason);
        if (at !== null) {
          const target = days(r.doc).find(
            (d) => d.date > rampEnd && d.workout?.kind === 'test' && show(d.date) === at[1]
          );
          expect(target, name).toBeDefined();
          moved += 1;
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(moved).toBeGreaterThan(0);
  });
});
