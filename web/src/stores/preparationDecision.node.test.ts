import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { resolvePlan } from '../domain/plan';
import type { ReplanContext } from '../domain/plan/future';
import { getPlanRevisions } from '../domain/plan/versions';
import { seedState, type GenPlanState, type PersistedState } from '../domain/state';
import { hydratePersisted } from './index';
import {
  commitPlanChange,
  previewExecution,
  previewPreparationChoice,
  previewRestore,
  storedPreparationDecision
} from './executionActions';
import { useTrainingStore } from './trainingStore';
import { useUIStore } from './uiStore';

const resolved = () => {
  const t = useTrainingStore.getState();
  return resolvePlan(t.genPlan!.weeks, { moves: t.moves, alts: t.alts });
};
const history = () => {
  const t = useTrainingStore.getState();
  return JSON.stringify({
    log: t.log,
    pred: t.pred,
    predLock: t.predLock,
    moves: t.moves,
    vdotLog: t.vdotLog,
    t3k: t.t3k
  });
};

/* The locked U08 event in the real store: HM in 8 weeks after a confirmed 14-day break. */
describe('U08 preparation decision lifecycle', () => {
  const doc = JSON.parse(
    readFileSync(
      new URL('../../../docs/qa/generator-ab/users/U08-event.json', import.meta.url),
      'utf8'
    )
  ) as {
    event: {
      today: string;
      input: { current: GenPlanState; context: ReplanContext; options: Record<string, number> };
    };
  };
  const ev = doc.event;
  const U08_TODAY = ev.today;
  beforeEach(() => {
    const s = seedState();
    const ctx = ev.input.context;
    s.genPlan = structuredClone(ev.input.current);
    s.log = structuredClone(ctx.log) as PersistedState['log'];
    s.pred = structuredClone(ctx.pred) as PersistedState['pred'];
    s.predLock = structuredClone(ctx.predLock) as PersistedState['predLock'];
    hydratePersisted(s);
    useUIStore.setState({ today: U08_TODAY });
  });
  const options = () => ({ breakDays: 14, weeklyKm: 55, recentLongRunKm: 16 });

  it('rejection offers options; base preview, apply, actual run and restore keep every record', () => {
    const original = structuredClone(useTrainingStore.getState().genPlan!);
    const rejected = previewExecution(resolved(), U08_TODAY, options());
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.reason).toContain('Datum trke nije automatski pomeren');
    expect(rejected.decision!.options.map((o) => o.id)).toEqual([
      'extend',
      'shorter-10000',
      'base'
    ]);
    expect(useTrainingStore.getState().genPlan).toEqual(original);

    const h = history();
    const p = previewPreparationChoice(resolved(), U08_TODAY, options(), { kind: 'base' });
    if (!p.ok) throw new Error(p.reason);
    expect(p.change).toEqual({
      from: { raceDate: '2027-01-17', raceDistM: 21097.5, goalSec: 5700 },
      to: { raceDate: '2027-01-17', raceDistM: 21097.5, goalSec: null }
    });
    expect(p.changes[0]!.qualityMinutesAfter).toBe(0);
    expect(useTrainingStore.getState().genPlan).toEqual(original);
    expect(commitPlanChange(p)).toEqual({ ok: true });
    expect(history()).toBe(h);
    const revisions = getPlanRevisions(useTrainingStore.getState().genPlan);
    expect(revisions.map((r) => [r.reason, r.summary])).toEqual([
      ['execution', 'Povratni/bazni režim do 17.01.2027., bez vremenskog cilja']
    ]);
    for (const day of resolvePlan(original.weeks, { alts: {}, moves: {} }).dated.filter(
      (d) => d.date <= U08_TODAY
    ))
      expect(resolved().byId.get(day.id)?.origin).toEqual(day.origin);

    // Actual run entered after apply survives restore with its own km/min and effective date.
    const next = resolved().dated.find((d) => d.date > U08_TODAY && !d.rest && d.km)!;
    useTrainingStore.getState().patch({
      log: {
        ...useTrainingStore.getState().log,
        [next.id]: { status: 'done', km: 6.2, sec: 2040, runDate: next.date }
      }
    });
    const afterRun = history();
    const kept = resolved().byId.get(next.id)!.origin;
    const restore = previewRestore(revisions[0]!.id, U08_TODAY);
    if (!restore.ok) throw new Error(restore.reason);
    expect(commitPlanChange(restore)).toEqual({ ok: true });
    expect(history()).toBe(afterRun);
    expect(useTrainingStore.getState().log[next.id]).toMatchObject({ km: 6.2, sec: 2040 });
    expect(resolved().byId.get(next.id)!.origin).toEqual(kept);
    const oldView = resolvePlan(original.weeks, { alts: {}, moves: {} });
    const restored = oldView.dated.find((d) => d.date === '2026-11-29')!;
    expect(resolved().byId.get(restored.id)!.km).toBe(restored.km);
    expect(useTrainingStore.getState().genPlan!.meta!.goalSec).toBe(5700);
  });

  it('extend preview changes the race date only after apply; a stale preview is refused', () => {
    const rejected = previewExecution(resolved(), U08_TODAY, options());
    if (rejected.ok) throw new Error('expected rejection');
    const extend = rejected.decision!.options.find((o) => o.id === 'extend')!;
    const p = previewPreparationChoice(resolved(), U08_TODAY, options(), extend.choice);
    if (!p.ok) throw new Error(p.reason);
    expect(p.reason).toBe('goal');
    expect(useTrainingStore.getState().genPlan!.meta!.raceDate).toBe('2027-01-17');
    useTrainingStore.getState().patch({ moves: { g9d1: '2026-12-08' } });
    expect(commitPlanChange(p).ok).toBe(false);
    expect(useTrainingStore.getState().genPlan!.meta!.raceDate).toBe('2027-01-17');
    const again = previewPreparationChoice(resolved(), U08_TODAY, options(), extend.choice);
    if (!again.ok) throw new Error(again.reason);
    expect(commitPlanChange(again)).toEqual({ ok: true });
    expect(useTrainingStore.getState().genPlan!.meta!.raceDate).toBe('2027-02-21');
    expect(useTrainingStore.getState().moves).toEqual({ g9d1: '2026-12-08' });
  });

  it('a stored limited plan offers decisions without new execution input', () => {
    expect(storedPreparationDecision(U08_TODAY)).toBeNull();
    const p = previewExecution(resolved(), U08_TODAY, options());
    if (p.ok) throw new Error('expected rejection');
    const base = previewPreparationChoice(resolved(), U08_TODAY, options(), { kind: 'base' });
    if (!base.ok) throw new Error(base.reason);
    expect(commitPlanChange(base)).toEqual({ ok: true });
    // Continuation from base mode stays reachable from the stored plan, without re-entering the break.
    const stored = storedPreparationDecision(U08_TODAY)!;
    expect(stored.options.map((o) => o.id)).toEqual(['extend', 'shorter-10000']);
    expect(stored.options[0]!.raceDate).toBe('2027-02-21');
    const later = previewPreparationChoice(resolved(), U08_TODAY, null, stored.options[0]!.choice);
    if (!later.ok) throw new Error(later.reason);
    expect(later.change!.to.raceDate).toBe('2027-02-21');
    // The goal was removed by the explicit base decision; extending does not invent a new one.
    expect(later.change!.to.goalSec).toBeNull();
  });
});
