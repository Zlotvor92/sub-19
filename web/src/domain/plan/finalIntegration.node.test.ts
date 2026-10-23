import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays, type IsoDate } from '../date';
import type { GenPlanState, LogEntry } from '../state';
import { matchPlanRows } from '../training/adaptation/matching';
import { resolvePlan } from './resolve';
import { getPlanRevisions, recordPlanRevision } from './versions';
import type { ReplanContext } from '@/domain/generators/select';
import type { ExecutionAnalysis } from '@/domain/generators/halfMarathon/training/execution';
import { routedEngine } from '@/test/generators';
import { preparationForPlan } from '@/domain/generators/select';

/* Stari zajednički engine je obrisan: svaka funkcija ide generatoru distance plana o kome je reč (`routedEngine`). */
const {
  buildExecutionAdjustment,
  graftFuturePlan,
  isDemanding,
  planRecalibrated,
  planWithNewGoal
} = routedEngine(5000);

interface FatigueFixture {
  today: IsoDate;
  input: { current: GenPlanState; log: Record<string, LogEntry> };
  analysis: ExecutionAnalysis;
}
const fixture = (): FatigueFixture =>
  JSON.parse(
    readFileSync(
      new URL('../../../../docs/qa/generator-ab/users/U03-event.json', import.meta.url),
      'utf8'
    )
  ) as FatigueFixture;
const view = (p: GenPlanState, ctx: ReplanContext) =>
  resolvePlan(p.weeks, { alts: ctx.alts ?? {}, moves: ctx.moves ?? {} });

describe('final integration: sequential changes cannot bypass recovery or protected history', () => {
  it.each([false, true])(
    'fatigue → goal → measured recalibration → JSON revision → restore (protected conflicts: %s)',
    (withProtectedConflicts) => {
      const e = fixture();
      const original = e.input.current;
      const ctx: ReplanContext = { log: e.input.log };
      const oldView = view(original, ctx);
      const sessions = oldView.dated.filter((d) => d.date > e.today && d.session).slice(0, 3);
      const protectedIds = new Set<string>();
      let measuredRowId: string | undefined;
      if (withProtectedConflicts) {
        const [done, measured, manual] = sessions;
        ctx.log = {
          ...ctx.log,
          [done!.id]: { status: 'done', km: 7.23, sec: 2501, runDate: e.today }
        };
        const manualBody = original.weeks.flatMap((w) => w.days).find((d) => d.id === manual!.id)!;
        manualBody.session!.overrides = { paceSec: true };
        const row = matchPlanRows(
          oldView.weeks,
          original.pred.map((r) => ({ ...r, id: r.id! }))
        ).get(measured!.id)!;
        measuredRowId = row.id;
        ctx.pred = { [row.id]: 266 };
        ctx.predLock = { [row.id]: true };
        const target = oldView.dated.find((d) => d.date === '2026-12-01')!;
        ctx.moves = { [manual!.id]: target.date, [target.id]: manual!.date };
        for (const d of sessions) protectedIds.add(d.id);
      }
      const inputStamp = JSON.stringify({ original, ctx });
      const check = (p: GenPlanState) => {
        const resolved = view(p, ctx);
        expect(p.meta!.fatigueRecovery).toMatchObject({
          start: '2026-11-26',
          end: '2026-12-07'
        });
        expect(p.meta!.athlete!.consistentWeeks).toBe(24);
        const recovery = p.meta!.fatigueRecovery!;
        const editable = resolved.dated.filter(
          (d) => d.date >= recovery.start && d.date < recovery.end && !protectedIds.has(d.id)
        );
        expect(editable.some(isDemanding)).toBe(false);
        for (const d of editable)
          expect(d.km ?? 0).toBeLessThanOrEqual(oldView.byId.get(d.id)?.km ?? 0);
        if (!withProtectedConflicts)
          for (const [start, cap] of Object.entries(recovery.weekCapsKm)) {
            const sum = editable
              .filter((d) => d.date >= start && d.date < addDays(start as IsoDate, 7))
              .reduce((n, d) => n + (d.km ?? 0), 0);
            expect(sum).toBeLessThanOrEqual(cap + 1e-8);
          }
        for (const d of oldView.dated.filter((d) => d.date <= e.today || protectedIds.has(d.id))) {
          expect(p.weeks.flatMap((w) => w.days).find((x) => x.id === d.id)).toEqual(
            original.weeks.flatMap((w) => w.days).find((x) => x.id === d.id)
          );
          expect(p.qs?.[d.id]).toEqual(original.qs?.[d.id]);
        }
        if (measuredRowId)
          expect(p.pred.find((r) => r.id === measuredRowId)).toEqual(
            original.pred.find((r) => r.id === measuredRowId)
          );
        if (withProtectedConflicts) {
          expect(resolved.byId.get(sessions[2]!.id)!.date).toBe('2026-12-01');
          expect(p.meta!.dayWarnings.join(' ')).toContain('Konflikt oporavka:');
        }
        expect(JSON.stringify({ original, ctx })).toBe(inputStamp);
      };
      const fatigue = buildExecutionAdjustment(original, e.today, e.analysis, {}, ctx);
      if ('error' in fatigue) throw new Error(fatigue.error);
      check(fatigue.result);
      const goal = planWithNewGoal(fatigue.result, 1080, e.today, ctx);
      if ('error' in goal) throw new Error(goal.error);
      check(goal);
      const recalibrated = planRecalibrated(goal, 50, e.today, ctx);
      if ('error' in recalibrated) throw new Error(recalibrated.error);
      check(recalibrated);
      /* Korak „izbor pripreme" iz starog engine-a ne postoji za 5K (`preparationForPlan` → null); lanac ide dalje od
         rekalibrisanog plana kao u aplikaciji. */
      expect(preparationForPlan(recalibrated)).toBeNull();
      const base = { result: recalibrated, summary: 'Rekalibracija' };
      const persisted = JSON.parse(
        JSON.stringify(
          recordPlanRevision(original, base.result, {
            reason: 'execution',
            date: e.today,
            summary: base.summary
          })
        )
      ) as GenPlanState;
      check(persisted);
      const snapshot = getPlanRevisions(persisted)[0]!.snapshot;
      expect(snapshot.meta!.fatigueRecovery).toBeUndefined();
      const restored = graftFuturePlan(persisted, snapshot, e.today, ctx);
      check(restored);
      expect(restored.meta!.goalSec).toBe(original.meta!.goalSec);
      expect(restored.meta!.raceDate).toBe(original.meta!.raceDate);
      expect(JSON.stringify(getPlanRevisions(persisted))).not.toContain('runDate');
    }
  );
});
