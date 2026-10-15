import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, parseIsoDate } from '../domain/date';
import { resolvePlan } from '../domain/plan';
import { adaptGeneratedPlan } from '../domain/plan/adapt';
import { getPlanRevisions } from '../domain/plan/versions';
import { migrateState, seedState, type PersistedState } from '../domain/state';
import { generatePlan } from '../domain/training/generator/generatePlan';
import { sessKm } from '../domain/training/sessions/calc';
import type { PlanGenerationInput } from '../domain/training/types';
import { hydratePersisted } from './index';
import {
  commitPlanChange,
  executionModel,
  positiveAdjustmentBlock,
  previewExecution,
  previewRestore
} from './executionActions';
import { useRecoveryStore } from './recoveryStore';
import { useTrainingStore } from './trainingStore';
import { useUIStore } from './uiStore';
import { undoAdjustments } from './raceActions';
import { refreshSessionPace } from '../domain/training/adaptation/proposal';

const TODAY = '2026-02-18';
const INPUT: PlanGenerationInput = {
  startDate: '2026-01-05',
  raceDate: '2026-08-16',
  raceDistM: 10000,
  pb: { distM: 5000, sec: 1200, date: '2026-01-01' },
  weeklyKm: 40,
  recentLongRunKm: 12,
  consistentWeeks: 12,
  qualityExperience: 'experienced',
  runDays: 4,
  quality: 2,
  intensity: 'std'
};
function state(): PersistedState {
  const s = seedState();
  const plan = adaptGeneratedPlan(generatePlan(INPUT));
  if (!plan) throw new Error('plan');
  s.genPlan = { ...plan, ulaz: INPUT };
  return s;
}
const resolved = () => {
  const t = useTrainingStore.getState();
  return resolvePlan(t.genPlan!.weeks, { moves: t.moves, alts: t.alts });
};
const ready = (days = 14) => {
  const p = previewExecution(resolved(), TODAY, {
    breakDays: days,
    weeklyKm: 40,
    recentLongRunKm: 12
  });
  if (!p.ok) throw new Error(p.reason);
  return p;
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
beforeEach(() => {
  hydratePersisted(state());
  useUIStore.setState({ today: TODAY });
});

describe('execution preview and lifecycle', () => {
  it('undoing automatic pace preserves past, completed and measured sessions', () => {
    const t = useTrainingStore.getState();
    const days = resolved().dated.filter((day) => day.session);
    const past = days.find((day) => day.date < TODAY)!;
    const done = days.find((day) => day.date > TODAY)!;
    const future = days.find((day) => day.date > done.date)!;
    let plan = t.genPlan!;
    const alts = { ...t.alts };
    for (const day of [past, done, future]) {
      plan = refreshSessionPace(plan, day.id, day.session!.paceSec - 10).genPlan;
      const adjusted = resolvePlan(plan.weeks, { alts: {}, moves: {} }).byId.get(day.id)!;
      alts[day.id] = {
        tag: day.tag!,
        km: adjusted.km!,
        desc: adjusted.desc!,
        pace: adjusted.session!.paceSec,
        paceAuto: true,
        rw: null
      };
    }
    t.patch({ genPlan: plan, alts, log: { [done.id]: { status: 'done', km: 5 } } });
    const h = history();
    expect(undoAdjustments(resolved())).toBe(1);
    expect(history()).toBe(h);
    expect(useTrainingStore.getState().alts[past.id]).toEqual(alts[past.id]);
    expect(useTrainingStore.getState().alts[done.id]).toEqual(alts[done.id]);
    expect(useTrainingStore.getState().alts[future.id]).toBeUndefined();
  });
  it('does not infer skips or a break from an empty diary, nor apply a single miss', () => {
    expect(executionModel(resolved(), TODAY).analysis.missed).toBe(0);
    expect(executionModel(resolved(), TODAY).recommendation.kind).toBe('insufficient-data');
    const day = resolved().dated.find(
      (d) => !d.rest && d.km && d.date < TODAY && d.date > '2026-02-05'
    )!;
    useTrainingStore.getState().patch({ log: { [day.id]: { status: 'skip' } } });
    expect(previewExecution(resolved(), TODAY, { weeklyKm: 40 }).ok).toBe(false);
  });

  it('preview is pure, uses future-only volume and commits one revision without touching evidence', () => {
    const old = useTrainingStore.getState().genPlan!;
    const stamp = JSON.stringify(old);
    const h = history();
    const p = ready();
    expect(JSON.stringify(useTrainingStore.getState().genPlan)).toBe(stamp);
    const first = p.changes[0]!;
    expect(first.afterKm).toBeLessThan(
      old.weeks.find((w) => w.w === first.week)!.days.reduce((sum, d) => sum + (d.km ?? 0), 0)
    );
    expect(first.qualityMinutesAfter).toBe(0);
    expect(commitPlanChange(p)).toEqual({ ok: true });
    expect(history()).toBe(h);
    expect(getPlanRevisions(useTrainingStore.getState().genPlan)).toHaveLength(1);
    for (const day of resolvePlan(old.weeks, { alts: {}, moves: {} }).dated.filter(
      (d) => d.date <= TODAY
    ))
      expect(resolved().byId.get(day.id)?.origin).toEqual(day.origin);
    expect(commitPlanChange(p).ok).toBe(false);
    expect(getPlanRevisions(useTrainingStore.getState().genPlan)).toHaveLength(1);
  });

  it.each(['log', 'pred', 'predLock', 'moves', 'alts', 'vdotLog', 't3k'] as const)(
    'rejects stale preview after %s changes',
    (field) => {
      const p = ready();
      const t = useTrainingStore.getState();
      const replacement =
        field === 'vdotLog'
          ? [{ id: 't3k-change', ts: TODAY, measured: 45, vdot: 45, prev: null, delta: null }]
          : field === 't3k'
            ? [{ id: 't3k-change', date: TODAY, sec: 700 }]
            : field === 'log'
              ? { g1d1: { status: 'done', km: 1 } }
              : field === 'alts'
                ? {
                    g1d1: {
                      tag: 'lako',
                      km: 1,
                      desc: 'Ručna izmena',
                      pace: null,
                      paceAuto: false,
                      rw: null
                    }
                  }
                : { g1d1: field === 'moves' ? '2026-02-19' : 200 };
      t.patch({ [field]: replacement });
      expect(commitPlanChange(p).ok).toBe(false);
      expect(getPlanRevisions(useTrainingStore.getState().genPlan)).toHaveLength(0);
    }
  );

  it('rejects a changed day or recovery report and forged previews', () => {
    const p = ready();
    useUIStore.setState({ today: '2026-02-19' });
    expect(commitPlanChange(p).ok).toBe(false);
    const p2 = ready();
    useRecoveryStore.getState().setPain([{ date: TODAY, pain: 5 }]);
    expect(commitPlanChange(p2).ok).toBe(false);
    const p3 = ready();
    expect(commitPlanChange({ ...p3 }).ok).toBe(false);
    p3.result.weeks[0]!.days = [];
    expect(commitPlanChange(p3)).toEqual({ ok: true });
    expect(useTrainingStore.getState().genPlan!.weeks[0]!.days.length).toBeGreaterThan(0);
  });

  it('restores only future prescription while preserving later records and measured future sessions', () => {
    const before = useTrainingStore.getState().genPlan!;
    expect(commitPlanChange(ready())).toEqual({ ok: true });
    const revision = getPlanRevisions(useTrainingStore.getState().genPlan).at(-1)!;
    const nextDay = resolved().dated.find((d) => d.date > TODAY && !d.rest && d.km)!;
    useTrainingStore
      .getState()
      .patch({ log: { [nextDay.id]: { status: 'done', km: 3, runDate: TODAY } } });
    const h = history();
    const current = resolved().byId.get(nextDay.id)!.origin;
    const p = previewRestore(revision.id, TODAY);
    if (!p.ok) throw new Error(p.reason);
    expect(commitPlanChange(p)).toEqual({ ok: true });
    expect(history()).toBe(h);
    expect(resolved().byId.get(nextDay.id)!.origin).toEqual(current);
    const sample = resolvePlan(before.weeks, { alts: {}, moves: {} }).dated.find(
      (d) => d.date > '2026-04-01' && d.session
    )!;
    expect(resolved().byId.get(sample.id)!.origin).toEqual(sample.origin);
    expect(getPlanRevisions(useTrainingStore.getState().genPlan)).toHaveLength(2);
  });

  it('confirmed longer breaks use lower bases without hidden structural mismatch', () => {
    const p7 = ready(7),
      p14 = ready(14),
      p28 = ready(28);
    expect(p7.result.meta!.athlete!.weeklyBaseKm).toBe(34);
    expect(p14.result.meta!.athlete!.weeklyBaseKm).toBe(28);
    expect(p28.result.meta!.athlete!.weeklyBaseKm).toBe(22);
    for (const p of [p7, p14, p28])
      for (const week of p.result.weeks)
        for (const day of week.days) if (day.session) expect(day.km).toBe(sessKm(day.session));
    const nearRace = addDays(parseIsoDate(INPUT.raceDate)!, -20);
    expect(previewExecution(resolved(), nearRace, { breakDays: 14, weeklyKm: 40 }).ok).toBe(false);
  });

  it('blocks faster work for reported pain, repeated high easy effort and an unconfirmed gap', () => {
    useRecoveryStore.getState().setPain([{ date: TODAY, pain: 5 }]);
    expect(positiveAdjustmentBlock(resolved(), TODAY)).toMatch(/bola/);
    useRecoveryStore.getState().setPain([]);
    const easy = resolved()
      .dated.filter((d) => d.tag === 'lako' && d.date < TODAY && d.date > '2026-02-04')
      .slice(-2);
    useTrainingStore.getState().patch({
      log: Object.fromEntries(
        easy.map((d) => [d.id, { status: 'done', km: d.km, runDate: d.date, rpe: 8 }])
      )
    });
    expect(positiveAdjustmentBlock(resolved(), TODAY)).toMatch(/napor/);
    useTrainingStore
      .getState()
      .patch({ log: { g1d1: { status: 'done', km: 5, runDate: '2026-02-01' } } });
    expect(positiveAdjustmentBlock(resolved(), TODAY)).toMatch(/novijeg/);
  });

  it('active calendar recovery blocks faster work even after high-RPE records age out', () => {
    const t = useTrainingStore.getState();
    t.patch({
      genPlan: {
        ...t.genPlan!,
        meta: {
          ...t.genPlan!.meta!,
          fatigueRecovery: {
            start: parseIsoDate('2026-02-19')!,
            end: parseIsoDate('2026-03-02')!,
            weekCapsKm: { '2026-02-23': 30 }
          }
        }
      },
      log: { g1d1: { status: 'done', km: 5, runDate: '2026-02-27', rpe: 4 } }
    });
    expect(positiveAdjustmentBlock(resolved(), '2026-03-01')).toMatch(/rasterećenje/);
    expect(positiveAdjustmentBlock(resolved(), '2026-03-02')).toBeNull();
  });

  it('v11 migration retains plan, new zones and bounded revisions; v12 export/import is stable', () => {
    commitPlanChange(ready());
    const t = useTrainingStore.getState();
    const input = {
      ...seedState(),
      v: 11,
      genPlan: t.genPlan,
      log: { g1d1: { status: 'done', km: 4 } }
    };
    const migrated = migrateState(input)!;
    expect(migrated.v).toBe(12);
    expect(migrated.genPlan).toEqual(t.genPlan);
    expect(migrated.log).toEqual(input.log);
    expect(getPlanRevisions(migrated.genPlan)).toHaveLength(1);
    expect(migrateState(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
  });
});
