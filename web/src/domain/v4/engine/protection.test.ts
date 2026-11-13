import { describe, expect, it } from 'vitest';
import { addDays } from './dates';
import { canonical, replan } from './index';
import { advance, build, facts, goalAt, HALF_M, runsAsPlanned } from './testdata/helpers';
import { SYNTHETIC } from './testdata/synthetic';
import type { PlanDay, PlanDoc, PlanEvent, Run, RunnerState } from './types';

/* Plan u 4. nedelji: prošlost urađena; u budućnosti jedan ručno izmenjen dan, jedan zaključan i jedan unapred urađen. */
const TODAY = '2026-12-09';
const MANUAL = '2026-12-12';
const LOCKED = '2026-12-17';
const DONE_AHEAD = '2026-12-19';

function scenario(): { doc: PlanDoc; state: RunnerState; b: ReturnType<typeof build> } {
  const b = build(facts(), goalAt('2027-01-24'));
  const edit = (day: PlanDay): PlanDay => {
    if (day.date === MANUAL) {
      return {
        ...day,
        origin: 'manual',
        base: day.workout,
        workout: {
          kind: 'other',
          stimulus: null,
          workSec: 0,
          steps: [
            { role: 'steady', target: { type: 'effort', rpe: 3 }, extent: { durationSec: 2400 } }
          ],
          text: 'bicikl 40 min'
        }
      };
    }
    return day.date === LOCKED ? { ...day, locked: true } : day;
  };
  const doc: PlanDoc = {
    ...b.doc,
    weeks: b.doc.weeks.map((w) => ({ ...w, days: w.days.map(edit) }))
  };
  const ahead = doc.weeks.flatMap((w) => w.days).find((d) => d.date === DONE_AHEAD);
  const early: Run = {
    id: 'unapred',
    date: TODAY,
    distanceM: 5000,
    durationSec: 1800,
    dayId: ahead?.id ?? ''
  };
  const race: Run = {
    id: 'test-5k',
    date: TODAY,
    distanceM: 5000,
    durationSec: 1290,
    effort: 'test'
  };
  const state = advance(b, TODAY, {
    runs: [...runsAsPlanned(doc, '2026-12-08', (d) => d === '2026-12-06'), early, race]
  });
  return { doc, state, b };
}

const days = (doc: PlanDoc): PlanDay[] => doc.weeks.flatMap((w) => w.days);

const EVENTS: PlanEvent[] = [
  { id: `result:${TODAY}:test-5k`, date: TODAY, kind: 'result', runId: 'test-5k' },
  { id: 'missed:2026-12-06:w3d6', date: '2026-12-06', kind: 'missed', dayId: 'w3d6' },
  {
    id: 'pause:2026-12-03:2026-12-09',
    date: TODAY,
    kind: 'pause',
    from: '2026-12-03',
    to: TODAY,
    reason: 'bolest'
  },
  {
    id: 'pause:2026-11-24:2026-12-09',
    date: TODAY,
    kind: 'pause',
    from: '2026-11-24',
    to: TODAY,
    reason: 'povreda'
  },
  { id: `pain:${TODAY}:2`, date: TODAY, kind: 'pain', level: 2 },
  { id: `pain:${TODAY}:5`, date: TODAY, kind: 'pain', level: 5 },
  { id: `pain:${TODAY}:8`, date: TODAY, kind: 'pain', level: 8 },
  { id: `fatigue:${TODAY}`, date: TODAY, kind: 'fatigue', source: 'trkac' },
  { id: `manual-edit:${TODAY}:w4d5`, date: TODAY, kind: 'manual-edit', dayId: 'w4d5' },
  {
    id: `goal-change:${TODAY}:vreme`,
    date: TODAY,
    kind: 'goal-change',
    goal: goalAt('2027-01-24', { targetTimeSec: 2000 })
  },
  {
    id: `goal-change:${TODAY}:datum`,
    date: TODAY,
    kind: 'goal-change',
    goal: goalAt('2027-02-14')
  },
  {
    id: `goal-change:${TODAY}:ranije`,
    date: TODAY,
    kind: 'goal-change',
    goal: goalAt('2027-01-10')
  },
  {
    id: `availability-change:${TODAY}`,
    date: TODAY,
    kind: 'availability-change',
    availability: { runDays: [0, 2, 4, 6], longDay: 6 }
  },
  { id: `form-update:${TODAY}`, date: TODAY, kind: 'form-update', vdot: 46 },
  { id: `none:${TODAY}`, date: TODAY, kind: 'none' }
];

describe('zaštita (SPEC § 1.2, § 6.4)', () => {
  const { doc, state } = scenario();
  const original = new Map(days(doc).map((d) => [d.date, canonical(d)] as const));
  const doneIds = new Set(state.runs.flatMap((r) => (r.dayId === undefined ? [] : [r.dayId])));

  it.each(EVENTS.map((e) => [e.id, e] as const))(
    '%s ne dira prošlo, urađeno, ručno, zaključano ni dan trke',
    (_id, event) => {
      const result = replan(doc, state, [event], SYNTHETIC);
      const raceDate = result.doc.header.goal.raceDate;
      for (const day of days(result.doc)) {
        const before = original.get(day.date);
        const untouchable =
          day.date <= TODAY || day.date === MANUAL || day.date === LOCKED || doneIds.has(day.id);
        if (untouchable) expect(canonical(day), `${event.id} ${day.date}`).toBe(before);
      }
      const races = days(result.doc).filter((d) => d.workout?.kind === 'race');
      expect(races.map((d) => d.date)).toEqual([raceDate]);
      for (const change of result.changes) {
        if (change.scope !== 'dan') continue;
        const changed = days(result.doc).find((d) => d.id === change.dayId);
        expect(
          changed !== undefined && changed.date > TODAY,
          `${event.id} ${String(change.dayId)}`
        ).toBe(true);
        expect(change.reason.length).toBeGreaterThan(20);
      }
      if (result.changes.length === 0) expect(result.doc).toBe(doc);
      else expect(result.doc.header.appliedEvents).toContain(event.id);
    }
  );

  it('događaji koji moraju da promene plan ga stvarno menjaju', () => {
    const changing = [
      'result',
      'pause',
      'pain',
      'fatigue',
      'goal-change',
      'availability-change',
      'form-update'
    ];
    for (const event of EVENTS.filter(
      (e) => changing.includes(e.kind) && e.id !== `pain:${TODAY}:2`
    )) {
      expect(replan(doc, state, [event], SYNTHETIC).changes.length, event.id).toBeGreaterThan(0);
    }
  });

  it('svi događaji odjednom: zaštićeni dani i dalje netaknuti', () => {
    const result = replan(doc, state, EVENTS, SYNTHETIC);
    for (const day of days(result.doc)) {
      if (day.date <= TODAY || day.date === MANUAL || day.date === LOCKED || doneIds.has(day.id)) {
        expect(canonical(day), day.date).toBe(original.get(day.date));
      }
    }
    expect(new Set(result.changes.map((c) => c.eventId)).size).toBeGreaterThan(3);
  });

  it('zaštićen plan (lični plan vlasnika) se ne menja ni na jedan događaj', () => {
    const guarded: PlanDoc = { ...doc, header: { ...doc.header, protected: true } };
    for (const event of EVENTS) {
      const result = replan(guarded, state, [event], SYNTHETIC);
      expect(result.doc, event.id).toBe(guarded);
      expect(result.changes, event.id).toEqual([]);
    }
  });

  /* krug 6 (R1): sledeći dugi ne postaje kraći od prvobitnog — propušten dugi se ne nadoknađuje skraćivanjem; trkač
     dobija rečenicu, plan ostaje isti */
  it('ključan propušten trening: sledeći dugi ostaje kako je planiran (ne kraći), trkač dobija rečenicu', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    const missedDate = '2026-11-29';
    const today = '2026-12-01';
    const st = advance(b, today, { runs: runsAsPlanned(b.doc, today, (d) => d === missedDate) });
    const missed = days(b.doc).find((d) => d.date === missedDate);
    const event: PlanEvent = {
      id: `missed:${missedDate}:${missed?.id ?? ''}`,
      date: missedDate,
      kind: 'missed',
      dayId: missed?.id ?? ''
    };
    const result = replan(b.doc, st, [event], SYNTHETIC);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]?.what).toBe('obavestenje');
    const next = days(result.doc).find((d) => d.date === addDays(missedDate, 7));
    const before = days(b.doc).find((d) => d.date === addDays(missedDate, 7));
    expect(next?.workout?.text).toBe(before?.workout?.text);
    expect(result.changes[0]?.reason).toContain('ne nadoknađuje skraćivanjem');
  });

  it('rezultat testa menja tempa odmah kad je razlika ≥ 0,3 VDOT', () => {
    const b = build(facts(), goalAt('2027-01-24'));
    const run: Run = {
      id: 'brz',
      date: '2026-12-09',
      distanceM: HALF_M,
      durationSec: 5880,
      effort: 'race'
    };
    const st = advance(b, '2026-12-09', { runs: [...runsAsPlanned(b.doc, '2026-12-08'), run] });
    const event: PlanEvent = {
      id: 'result:2026-12-09:brz',
      date: '2026-12-09',
      kind: 'result',
      runId: 'brz'
    };
    const result = replan(b.doc, st, [event], SYNTHETIC);
    expect(result.doc.header.paces.T).toBeLessThan(b.doc.header.paces.T);
    expect(result.changes.some((c) => c.what === 'tempa')).toBe(true);
    expect(result.doc.header.form.start).toEqual(b.doc.header.form.start);
  });
});
