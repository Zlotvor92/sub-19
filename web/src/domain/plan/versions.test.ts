import { describe, expect, it } from 'vitest';
import {
  isValidGenPlan,
  migrateState,
  seedState,
  SCHEMA_VERSION,
  type GenPlanState
} from '../state';
import { getPlanRevisions, recordPlanRevision, type PlanRevisionDetails } from './versions';

const details: PlanRevisionDetails = {
  reason: 'execution',
  date: '2026-10-11',
  summary: 'Smanjen budući obim posle propuštenih treninga.'
};
const plan = (km = 8): GenPlanState => ({
  weeks: [
    {
      w: 1,
      start: '2026-10-05',
      deload: false,
      focus: 'Baza',
      days: [{ id: 'g1d1', dow: 0, tag: 'lako', km, desc: 'Lako' }]
    }
  ],
  pred: [{ id: 'g1_0', w: 1, l: 'Tempo', q: 3, pt: 300, p5k: 1400 }],
  qs: { g1d1: [300] },
  ulaz: { weeklyKm: 30, futureInput: { allowed: ['nested'] } },
  futurePlanField: { nested: { retained: true } }
});

describe('plan revisions: independent plan-only history', () => {
  it('legacy plans need no migration; null and corrupt history produce no revisions', () => {
    expect(getPlanRevisions(plan())).toEqual([]);
    for (const bad of [null, undefined, [], 'history', { planRevisions: {} }])
      expect(getPlanRevisions(bad)).toEqual([]);
  });

  it('records the previous prescription, keeps generated prediction rows and after extensions', () => {
    const before = plan(8);
    const after = plan(5);
    const result = recordPlanRevision(before, after, details);
    const [revision] = getPlanRevisions(result);
    expect(result.weeks[0]?.days[0]?.km).toBe(5);
    expect(revision?.snapshot.weeks[0]?.days[0]?.km).toBe(8);
    expect(revision?.snapshot.pred).toEqual(before.pred);
    expect(revision?.snapshot.ulaz).toEqual(before.ulaz);
    expect(result['futurePlanField']).toEqual(after['futurePlanField']);
    expect(revision).toMatchObject(details);
  });

  it('never snapshots execution maps, measured values, credentials or recursively stored history', () => {
    const before = {
      ...plan(),
      log: { g1d1: { status: 'done', sec: 1200 } },
      predLock: { g1_0: true },
      strava: { access_token: 'secret' },
      icu: { token: 'secret' },
      planRevisions: 'corrupt'
    };
    const current = recordPlanRevision(before, plan(), details);
    const snapshot = getPlanRevisions(current)[0]?.snapshot;
    expect(snapshot && Object.keys(snapshot).sort()).toEqual(['pred', 'qs', 'ulaz', 'weeks']);
    expect(JSON.stringify(snapshot)).not.toContain('secret');
    expect(snapshot?.['planRevisions']).toBeUndefined();
    expect(snapshot?.['planRevisionCounter']).toBeUndefined();
  });

  it('does not mutate inputs or share nested references with history previews', () => {
    const before = plan(8);
    const after = plan(5);
    const beforeJson = JSON.stringify(before);
    const afterJson = JSON.stringify(after);
    const result = recordPlanRevision(before, after, details);
    result.weeks[0]!.days[0]!.desc = 'Changed result';
    const revision = getPlanRevisions(result)[0]!;
    revision.snapshot.weeks[0]!.days[0]!.desc = 'Changed preview';
    expect(getPlanRevisions(result)[0]?.snapshot.weeks[0]?.days[0]?.desc).toBe('Lako');
    expect(JSON.stringify(before)).toBe(beforeJson);
    expect(JSON.stringify(after)).toBe(afterJson);
    expect(result['futurePlanField']).not.toBe(after['futurePlanField']);
  });

  it('keeps the last five previous plans, with stable IDs even for changes on the same date', () => {
    let current = plan(1);
    for (let i = 2; i <= 9; i++) current = recordPlanRevision(current, plan(i), details);
    const revisions = getPlanRevisions(current);
    expect(revisions.map((r) => r.snapshot.weeks[0]?.days[0]?.km)).toEqual([4, 5, 6, 7, 8]);
    expect(new Set(revisions.map((r) => r.id)).size).toBe(5);
    expect(current['planRevisionCounter']).toBe(8);
    expect(recordPlanRevision(plan(1), plan(2), details)).toEqual(
      recordPlanRevision(plan(1), plan(2), details)
    );
  });

  it('keeps earlier metadata unchanged when the reason/date/summary of another revision differ', () => {
    const first = recordPlanRevision(plan(8), plan(7), details);
    const earlier = getPlanRevisions(first)[0];
    const next = recordPlanRevision(first, plan(6), {
      reason: 'restore',
      date: '2026-10-12',
      summary: 'Vraćen budući deo ranije verzije.'
    });
    expect(getPlanRevisions(next)[0]).toEqual(earlier);
    expect(getPlanRevisions(first)).toHaveLength(1);
  });

  it('round-trips through canonical persisted JSON without changing the schema or extra fields', () => {
    const genPlan = recordPlanRevision(plan(8), plan(5), details);
    const state = { ...seedState(), genPlan, futureState: { preserved: true } };
    const parsed: unknown = JSON.parse(JSON.stringify(state));
    const migrated = migrateState(parsed);
    expect(migrated?.v).toBe(SCHEMA_VERSION);
    expect(migrated?.['futureState']).toEqual({ preserved: true });
    expect(isValidGenPlan(migrated?.genPlan)).toBe(true);
    expect(getPlanRevisions(migrated?.genPlan)).toEqual(getPlanRevisions(genPlan));
  });

  it('ignores malformed entries independently and deduplicates IDs', () => {
    const valid = getPlanRevisions(recordPlanRevision(plan(), plan(), details))[0]!;
    const invalid: unknown[] = [
      null,
      { ...valid, reason: 'unknown' },
      { ...valid, date: '2026-02-31' },
      { ...valid, id: 'invalid-id' },
      { ...valid, summary: '' },
      { ...valid, snapshot: { weeks: [], pred: [] } },
      { ...valid, snapshot: { ...valid.snapshot, pred: 'bad' } }
    ];
    const current = { ...plan(), planRevisions: [valid, ...invalid, valid] };
    expect(getPlanRevisions(current)).toEqual([valid]);
    const next = recordPlanRevision(current, plan(6), details);
    expect(getPlanRevisions(next)).toHaveLength(2);
  });

  it('rejects oversized or deeply corrupted snapshots, with a bounded scan of history', () => {
    const valid = getPlanRevisions(recordPlanRevision(plan(), plan(), details))[0]!;
    let deep: unknown = {};
    for (let i = 0; i < 100; i++) deep = { nested: deep };
    const huge = {
      ...valid,
      snapshot: { ...valid.snapshot, ulaz: { text: 'x'.repeat(300_000) } }
    };
    const corrupt = { ...valid, snapshot: { ...valid.snapshot, ulaz: deep } };
    expect(getPlanRevisions({ ...plan(), planRevisions: [valid, huge, corrupt] })).toEqual([valid]);
    expect(
      getPlanRevisions({ ...plan(), planRevisions: new Array<unknown>(1001).fill(valid) })
    ).toEqual([]);
    expect(
      getPlanRevisions({ ...plan(), planRevisions: [valid, ...new Array<unknown>(20).fill(null)] })
    ).toEqual([]);
  });

  it('does not evaluate getters in corrupt stored metadata or snapshots', () => {
    let reads = 0;
    const valid = getPlanRevisions(recordPlanRevision(plan(), plan(), details))[0]!;
    const corrupt = { ...valid };
    Object.defineProperty(corrupt, 'summary', {
      get() {
        reads++;
        return 'Unexpected getter';
      }
    });
    const snapshot = { ...valid.snapshot };
    Object.defineProperty(snapshot, 'ulaz', {
      get() {
        reads++;
        return {};
      }
    });
    expect(
      getPlanRevisions({ ...plan(), planRevisions: [corrupt, { ...valid, snapshot }] })
    ).toEqual([]);
    expect(reads).toBe(0);
  });

  it('rebuilds the counter from accepted history when a backup has a corrupt counter', () => {
    const previous = recordPlanRevision(plan(), plan(), details);
    for (const counter of [-10, '100', Infinity, 1.5, 1e20]) {
      const current = { ...previous, planRevisionCounter: counter };
      const result = recordPlanRevision(current, plan(), details);
      expect(result['planRevisionCounter']).toBe(2);
      expect(getPlanRevisions(result)[1]?.id).toMatch(/^r2-/);
    }
  });

  it('invalid caller dates and descriptions fail before mutation; invalid prior plans cannot be restored', () => {
    const before = plan();
    const json = JSON.stringify(before);
    expect(() => recordPlanRevision(before, plan(), { ...details, date: '2026-02-31' })).toThrow();
    expect(() =>
      recordPlanRevision(before, plan(), { ...details, summary: 'x'.repeat(501) })
    ).toThrow();
    expect(JSON.stringify(before)).toBe(json);
    const next = recordPlanRevision({ weeks: [], pred: [] }, plan(), details);
    expect(getPlanRevisions(next)).toEqual([]);
    expect(next.weeks).toEqual(plan().weeks);
  });
});
