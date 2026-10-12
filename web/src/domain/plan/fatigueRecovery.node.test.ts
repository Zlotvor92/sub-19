import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from '../date';
import type { GenPlanState, LogEntry } from '../state';
import { generatePlan } from '../training/generator/generatePlan';
import type { PlanGenerationInput } from '../training/types';
import type { ExecutionAnalysis } from '../training/execution';
import { matchPlanRows } from '../training/adaptation/matching';
import { buildExecutionAdjustment, type ExecutionAdjustmentOptions } from './executionAdjustment';
import { executionBasis } from './executionAdjustment';
import { buildPreparationChoice } from './preparationDecision';
import { isDemanding } from './finalize';
import type { ReplanContext } from './future';
import { planRecalibrated, planWithNewGoal } from './replan';
import { resolvePlan } from './resolve';

type Event = {
  today: IsoDate;
  input: {
    current: GenPlanState;
    log?: Record<string, LogEntry>;
    context?: ReplanContext;
    options: ExecutionAdjustmentOptions;
  };
  analysis: ExecutionAnalysis;
};
function fixture(id = 'U03'): Event {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../docs/qa/generator-ab/users/${id}-event.json`, import.meta.url),
      'utf8'
    )
  ) as Event;
}
function execute(e: Event, context = e.input.context ?? { log: e.input.log }) {
  const built = buildExecutionAdjustment(
    e.input.current,
    e.today,
    e.analysis,
    e.input.options,
    context
  );
  if ('error' in built) throw new Error(built.error);
  return built;
}
const view = (p: GenPlanState, ctx: ReplanContext = {}) =>
  resolvePlan(p.weeks, { alts: ctx.alts ?? {}, moves: ctx.moves ?? {} });

describe('historical continuity and immediate fatigue recovery', () => {
  it('U03 retains 24 weeks and immediate deload without increasing volume/quality', () => {
    const e = fixture();
    const stamp = JSON.stringify(e);
    const { result, summary, notes } = execute(e);
    expect(result.ulaz).toMatchObject({ consistentWeeks: 24, breakWeeks: 0 });
    expect(result.meta!.athlete).toMatchObject({
      consistentWeeks: 24,
      currentReadiness: 'fatigued'
    });
    expect(result.meta!.dayWarnings.join(' ')).not.toMatch(
      /Nema potvrđenog kontinuiteta|posle pauze/i
    );
    expect(summary).toContain('visokog napora');
    expect(notes.join(' ')).toContain('Deload se ne odlaže');
    const before = e.input.current.weeks.find((w) => w.w === 8)!;
    const after = result.weeks.find((w) => w.w === 8)!;
    expect(before.deload).toBe(true);
    expect(after.deload).toBe(true);
    expect(after.days.reduce((n, d) => n + (d.km ?? 0), 0)).toBeLessThanOrEqual(
      before.days.reduce((n, d) => n + (d.km ?? 0), 0)
    );
    const window = result.meta!.fatigueRecovery!;
    expect(window).toMatchObject({ start: '2026-11-26', end: '2026-12-07' });
    const upcoming = view(result).dated.filter(
      (d) => d.date >= window.start && d.date < window.end
    );
    expect(upcoming.some(isDemanding)).toBe(false);
    const originalByDate = new Map(view(e.input.current).dated.map((d) => [d.date, d]));
    for (const d of upcoming)
      expect(d.km ?? 0).toBeLessThanOrEqual(originalByDate.get(d.date)?.km ?? 0);
    for (const [start, cap] of Object.entries(window.weekCapsKm)) {
      const km = upcoming
        .filter((d) => d.date >= start && d.date < addDays(start as IsoDate, 7))
        .reduce((n, d) => n + (d.km ?? 0), 0);
      expect(km).toBeLessThanOrEqual(cap + 1e-8);
    }
    for (const d of view(e.input.current).dated.filter((d) => d.date <= e.today))
      expect(view(result).byId.get(d.id)!.origin).toEqual(d.origin);
    expect(JSON.stringify(e)).toBe(stamp);
  });
  it.each(['U02', 'U07'])('%s lower execution is not a break and retains continuity', (id) => {
    const e = fixture(id);
    const { result, summary, notes } = execute(e);
    expect((result.ulaz as PlanGenerationInput).consistentWeeks).toBe(
      (e.input.current.ulaz as PlanGenerationInput).consistentWeeks
    );
    expect(result.meta!.athlete!.currentReadiness).toBe('reduced-volume');
    expect(result.meta!.athlete!.qualityReadiness).not.toBe('returning');
    expect(result.meta!.dayWarnings.join(' ')).not.toMatch(/posle pauze/i);
    expect(notes.join(' ')).toContain('bez pretpostavke pauze');
    expect(summary).toContain('manjem izvršenom obimu');
    expect(result.meta!.fatigueRecovery).toBeUndefined();
  });
  it('goal change and recalibration retain the active recovery guard and historical continuity', () => {
    const e = fixture();
    const ctx = { log: e.input.log };
    const { result } = execute(e);
    const changed = planWithNewGoal(result, 1080, e.today, ctx);
    const recal = planRecalibrated(result, 50, e.today, ctx);
    for (const p of [changed, recal]) {
      if ('error' in p) throw new Error(p.error);
      expect(p.ulaz.consistentWeeks).toBe(24);
      expect(p.meta.fatigueRecovery).toEqual(result.meta!.fatigueRecovery);
      expect(
        view(p)
          .dated.filter((d) => d.date > e.today && d.date < '2026-12-07')
          .some(isDemanding)
      ).toBe(false);
      expect(p.weeks.find((w) => w.w === 8)!.deload).toBe(true);
    }
  });
  it('an unprotected session moved into recovery is guarded by its effective date', () => {
    const e = fixture();
    const oldView = view(e.input.current);
    const source = oldView.dated.find((d) => d.date > '2026-12-14' && d.session)!;
    const target = oldView.dated.find((d) => d.date === '2026-12-02')!;
    const ctx = { log: e.input.log, moves: { [source.id]: target.date, [target.id]: source.date } };
    const { result } = execute(e, ctx);
    const changed = view(result, ctx).byId.get(source.id)!;
    expect(changed.date).toBe(target.date);
    expect(isDemanding(changed)).toBe(false);
    expect(result.meta!.fatigueRecovery).toBeDefined();
  });
  it('unknown continuity stays unknown; fatigue does not invent a historical base', () => {
    const e = fixture();
    delete (e.input.current.ulaz as PlanGenerationInput).consistentWeeks;
    const { result } = execute(e);
    expect((result.ulaz as PlanGenerationInput).consistentWeeks).toBeUndefined();
    expect(result.meta!.athlete!.consistentWeeks).toBeNull();
  });
  it('a historical break followed by established continuity is not a new return; temporary fatigue can expire', () => {
    const e = fixture();
    const original = e.input.current.ulaz as PlanGenerationInput;
    const resumed = generatePlan({ ...original, breakWeeks: 2 });
    if ('error' in resumed) throw new Error(resumed.error);
    expect(resumed.meta.athlete!.qualityReadiness).toBe('experienced');
    const expired = generatePlan({
      ...original,
      currentReadiness: { reason: 'fatigued', until: original.startDate as IsoDate }
    });
    if ('error' in expired) throw new Error(expired.error);
    expect(expired.meta.athlete!.qualityReadiness).toBe('experienced');
    expect(expired.meta.athlete!.currentReadiness).toBeUndefined();
    expect(
      generatePlan({
        ...original,
        currentReadiness: { reason: 'fatigued', until: 'bad' as IsoDate }
      })
    ).toHaveProperty('error');
  });
  it('a preparation choice keeps immediate recovery and does not turn reduced execution into a break', () => {
    const e = fixture();
    const basis = executionBasis(e.input.current, e.today, e.analysis, e.input.options);
    if ('error' in basis) throw new Error(basis.error);
    for (const choice of [
      { kind: 'base' } as const,
      { kind: 'extend', raceDate: '2027-02-21' as IsoDate } as const
    ]) {
      const built = buildPreparationChoice(e.input.current, e.today, basis, choice, {
        log: e.input.log
      });
      if ('error' in built) throw new Error(built.error);
      expect(built.result.meta!.fatigueRecovery).toBeDefined();
      expect(
        view(built.result)
          .dated.filter((d) => d.date > e.today && d.date < '2026-12-07')
          .some(isDemanding)
      ).toBe(false);
    }
  });
  it('a goal change after the calendar period clears temporary fatigue without erasing its history', () => {
    const e = fixture();
    const { result } = execute(e);
    const changed = planWithNewGoal(result, 1080, '2026-12-07' as IsoDate, { log: e.input.log });
    if ('error' in changed) throw new Error(changed.error);
    expect(changed.ulaz.currentReadiness).toBeUndefined();
    expect(changed.ulaz.consistentWeeks).toBe(24);
    expect(changed.meta.athlete!.currentReadiness).toBeUndefined();
    expect(changed.meta.athlete!.qualityReadiness).toBe('experienced');
    expect(changed.meta.fatigueRecovery).toEqual(result.meta!.fatigueRecovery);
  });
  it('confirmed break retains history while separately selecting return readiness', () => {
    const e = fixture();
    e.input.options = { breakDays: 14, weeklyKm: 50, recentLongRunKm: 15 };
    const { result, summary } = execute(e);
    expect(result.meta!.athlete).toMatchObject({
      consistentWeeks: 24,
      currentReadiness: 'returning',
      qualityReadiness: 'returning',
      breakWeeks: 2
    });
    expect(summary).toContain('pauze');
  });
  it('done, actual km/min, effective dates, manual and measured future records survive with explicit conflicts', () => {
    const e = fixture();
    const p = e.input.current;
    const sessions = view(p)
      .dated.filter((d) => d.date > e.today && d.session)
      .slice(0, 3);
    const [done, measured, manual] = sessions;
    const manualStored = p.weeks.flatMap((w) => w.days).find((d) => d.id === manual!.id)!;
    manualStored.session!.overrides = { paceSec: true };
    const rows = matchPlanRows(
      view(p).weeks,
      p.pred.map((r) => ({ ...r, id: r.id! }))
    );
    const row = rows.get(measured!.id)!;
    const ctx: ReplanContext = {
      log: {
        ...e.input.log,
        [done!.id]: { status: 'done', km: 7.23, sec: 2501, runDate: e.today }
      },
      pred: { [row.id]: 266 },
      predLock: { [row.id]: true },
      moves: {
        [manual!.id]: '2026-12-01',
        [view(p).dated.find((d) => d.date === '2026-12-01')!.id]: manual!.date
      }
    };
    const stamp = JSON.stringify({ p, ctx });
    const { result } = execute(e, ctx);
    for (const d of sessions) {
      expect(result.weeks.flatMap((w) => w.days).find((x) => x.id === d.id)).toEqual(
        p.weeks.flatMap((w) => w.days).find((x) => x.id === d.id)
      );
      expect(result.qs?.[d.id]).toEqual(p.qs?.[d.id]);
    }
    expect(result.pred.find((r) => r.id === row.id)).toEqual(row);
    expect(view(result, ctx).byId.get(manual!.id)!.date).toBe('2026-12-01');
    expect(result.meta!.dayWarnings.join(' ')).toContain('Konflikt oporavka:');
    expect(JSON.stringify({ p, ctx })).toBe(stamp);
  });
});
