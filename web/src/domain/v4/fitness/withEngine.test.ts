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
      const sec = Math.round(raceTimeSec(doc.header.form.paceVdot + 2, 3000));
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
