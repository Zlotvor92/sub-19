import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate } from '../date';
import type { ResolvedDay, ResolvedPlan } from '../plan/types';
import type { LogEntry } from '../state/types';
import * as fiveK_training_execution from '@/domain/generators/fiveK/training/execution';
import * as tenK_training_execution from '@/domain/generators/tenK/training/execution';
import * as halfMarathon_training_execution from '@/domain/generators/halfMarathon/training/execution';
import * as marathon_training_execution from '@/domain/generators/marathon/training/execution';

/* Isti test nad kopijom svakog generatora (svaki generator ima sopstvenu implementaciju). */
const COPIES = [
  [
    '5K',
    {
      analyzeExecution: fiveK_training_execution.analyzeExecution,
      recommendExecution: fiveK_training_execution.recommendExecution
    }
  ],
  [
    '10K',
    {
      analyzeExecution: tenK_training_execution.analyzeExecution,
      recommendExecution: tenK_training_execution.recommendExecution
    }
  ],
  [
    'HM',
    {
      analyzeExecution: halfMarathon_training_execution.analyzeExecution,
      recommendExecution: halfMarathon_training_execution.recommendExecution
    }
  ],
  [
    'maraton',
    {
      analyzeExecution: marathon_training_execution.analyzeExecution,
      recommendExecution: marathon_training_execution.recommendExecution
    }
  ]
] as const;

describe.each(COPIES)('%s kopija', (_copy, { analyzeExecution, recommendExecution }) => {
  function planFixture(): ResolvedPlan {
    const start = parseIsoDate('2026-09-07')!;
    const dated: ResolvedDay[] = [];
    for (let week = 0; week < 5; week++) {
      for (let dow = 0; dow < 7; dow++) {
        const date = addDays(start, week * 7 + dow);
        const rest = ![0, 2, 4, 6].includes(dow);
        dated.push({
          id: `w${week}d${dow}`,
          w: week + 1,
          weekStart: addDays(start, week * 7),
          dow,
          origDate: date,
          date,
          tag: rest ? 'odmor' : dow === 6 ? 'lr' : 'lako',
          rest,
          km: rest ? null : dow === 6 ? 10 : 5,
          desc: null,
          runWalk: undefined,
          snaga: false,
          session: undefined,
          mlr: false,
          test: false,
          origin: {
            tag: rest ? 'odmor' : 'lako',
            rest,
            km: rest ? null : 5,
            desc: null,
            runWalk: undefined
          }
        });
      }
    }
    return {
      dated,
      byId: new Map(dated.map((day) => [day.id, day])),
      byDate: new Map(dated.map((day) => [day.date, day])),
      weeks: [],
      trainingDays: 20
    };
  }
  const today = '2026-10-07';
  function completedWeeks(plan: ResolvedPlan, volumes: number[]): Record<string, LogEntry> {
    return Object.fromEntries(
      plan.dated
        .filter((day) => !day.rest && day.w <= volumes.length)
        .map((day) => [
          day.id,
          volumes[day.w - 1] === 0
            ? { status: 'skip' }
            : { status: 'done', km: volumes[day.w - 1]! / 4 }
        ])
    );
  }

  describe('execution evidence, not prescribed distance', () => {
    it('keeps absent/pending records unknown and does not fabricate pause or distance', () => {
      const result = analyzeExecution({
        plan: planFixture(),
        log: { w3d0: { status: 'pending' } },
        today
      });
      expect(result.actualKm).toBe(0);
      expect(result.completed).toBe(0);
      expect(result.missed).toBe(0);
      expect(result.unknown).toBeGreaterThan(0);
      expect(result.lastRunDate).toBeNull();
      expect(result.recentWeeklyKm).toBeNull();
      expect(recommendExecution(result).kind).toBe('insufficient-data');
    });
    it('done without km confirms status and last run, but never the planned volume', () => {
      const result = analyzeExecution({
        plan: planFixture(),
        log: { w4d0: { status: 'done' } },
        today
      });
      expect(result.completed).toBe(1);
      expect(result.actualKm).toBe(0);
      expect(result.volumeCoverage).toBe(0);
      expect(result.statusCoverage).toBeGreaterThan(0);
      expect(result.lastRunDate).toBe('2026-10-05');
      expect(result.reasons.join(' ')).toContain('bez kilometara');
    });
    it('uses actual date precedence including moved days and accounts for the real calendar week', () => {
      const plan = planFixture();
      const day = plan.byId.get('w1d0')!;
      day.date = parseIsoDate('2026-09-17')!;
      const result = analyzeExecution({
        plan,
        log: { [day.id]: { status: 'done', km: 9, runDate: '2026-09-24', ts: '2026-09-21' } },
        today
      });
      expect(result.actualKm).toBe(9);
      expect(result.completeWeeks[1]?.actualKm).toBe(0);
      expect(result.completeWeeks[2]?.actualKm).toBe(9);
      expect(result.lastRunDate).toBe('2026-09-24');
    });
    it('rejects future/invalid dates and invalid distances without substituting plan km', () => {
      const result = analyzeExecution({
        plan: planFixture(),
        log: {
          w3d0: { status: 'done', km: 10, runDate: '2026-10-08', ts: '2026-09-28' },
          w3d2: { status: 'done', km: 10, runDate: '2026-02-31' },
          w3d4: { status: 'done', km: Number.NaN },
          w3d6: { status: 'done', km: -5 },
          w4d0: { status: 'done', km: Number.POSITIVE_INFINITY }
        },
        today
      });
      expect(result.actualKm).toBe(0);
      expect(result.completed).toBe(3);
      expect(result.volumeCoverage).toBe(0);
    });
    it('accepts timestamps and uses the effective planned date only when actual dates are absent', () => {
      const result = analyzeExecution({
        plan: planFixture(),
        log: {
          w3d0: { status: 'done', km: 4, ts: '2026-09-29T15:00:00Z' },
          w3d4: { status: 'done', km: 7 }
        },
        today
      });
      expect(result.actualKm).toBe(11);
      expect(result.lastRunDate).toBe('2026-10-02');
    });
    it('counts orphaned actual records and outside-plan load once per matching date', () => {
      const result = analyzeExecution({
        plan: planFixture(),
        log: {
          oldVersionDay: { status: 'done', km: 8, runDate: '2026-10-01' }
        },
        extras: { '2026-10-01': 8, '2026-10-03': 6, bad: 4, '2026-10-09': 10 },
        today
      });
      expect(result.actualKm).toBe(14);
      expect(result.lastRunDate).toBe('2026-10-03');
    });
    it('uses median full weeks and excludes the current partial week from weekly base', () => {
      const plan = planFixture();
      const log = completedWeeks(plan, [20, 24, 80, 28]);
      log['w4d0'] = { status: 'done', km: 90 };
      const result = analyzeExecution({ plan, log, today });
      expect(result.completeWeeks.map((week) => week.actualKm)).toEqual([20, 24, 80, 28]);
      expect(result.recentWeeklyKm).toBe(26);
      expect(result.lastPositiveWeeklyKm).toBe(28);
    });
    it('does not restore pre-break load after an explicitly skipped whole week', () => {
      const plan = planFixture();
      const result = analyzeExecution({ plan, log: completedWeeks(plan, [40, 40, 0, 0]), today });
      expect(result.recentWeeklyKm).toBe(0);
      expect(result.lastPositiveWeeklyKm).toBe(40);
      expect(recommendExecution(result)).toMatchObject({
        kind: 'return',
        actionable: false,
        requiresConfirmation: true
      });
      expect(recommendExecution(result).weeklyKm).toBeUndefined();
    });
    it('does not call three skips plus one unknown a confirmed zero-load week', () => {
      const plan = planFixture();
      const log = completedWeeks(plan, [20, 24, 28]);
      log['w3d0'] = { status: 'skip' };
      log['w3d2'] = { status: 'skip' };
      log['w3d4'] = { status: 'skip' };
      const result = analyzeExecution({ plan, log, today });
      expect(result.completeWeeks[3]?.volumeCoverage).toBe(0.75);
      expect(result.recentWeeklyKm).toBe(24);
      expect(result.reasons.join(' ')).not.toContain('prekida oslonac');
    });
    it('uses a repeated actual LR on distinct dates and excludes an isolated outlier', () => {
      const result = analyzeExecution({
        plan: planFixture(),
        log: {
          x: { status: 'done', km: 35, runDate: '2026-09-26' },
          y: { status: 'done', km: 11, runDate: '2026-09-27' },
          z: { status: 'done', km: 7, runDate: '2026-09-28' }
        },
        today
      });
      expect(result.recentLongRunKm).toBe(11);
      const sameDate = analyzeExecution({
        plan: planFixture(),
        log: {
          x: { status: 'done', km: 35, runDate: '2026-09-26' },
          y: { status: 'done', km: 30, runDate: '2026-09-26' }
        },
        today
      });
      expect(sameDate.recentLongRunKm).toBeNull();
    });
    it.each([7, 14, 28])(
      'requests context at %i days since last logged run without claiming inactivity',
      (days) => {
        const result = analyzeExecution({
          plan: planFixture(),
          log: {
            x: { status: 'done', km: 6, runDate: addDays(parseIsoDate(today)!, -days) }
          },
          today
        });
        expect(recommendExecution(result)).toMatchObject({
          kind: 'return',
          breakDays: days,
          actionable: false,
          requiresConfirmation: true
        });
      }
    );
    it('does not regenerate for one miss; repeated misses need a credible base', () => {
      const plan = planFixture();
      const log = completedWeeks(plan, [24, 24, 24, 24]);
      log['w4d0'] = { status: 'done', km: 6 };
      log['w3d6'] = { status: 'skip' };
      expect(recommendExecution(analyzeExecution({ plan, log, today })).kind).toBe('single-miss');
      log['w3d4'] = { status: 'skip' };
      expect(recommendExecution(analyzeExecution({ plan, log, today }))).toMatchObject({
        kind: 'reduce',
        actionable: true,
        weeklyKm: 24
      });
      expect(
        recommendExecution(
          analyzeExecution({
            plan,
            log: { w3d4: { status: 'skip' }, w3d6: { status: 'skip' } },
            today
          })
        ).kind
      ).toBe('insufficient-data');
    });
    it('identifies persistent under-execution even when every run is marked done', () => {
      const plan = planFixture();
      const log = completedWeeks(plan, [12, 12, 12, 12]);
      log['w4d0'] = { status: 'done', km: 3 };
      const result = analyzeExecution({ plan, log, today });
      expect(result.missed).toBe(0);
      expect(result.lowerVolumeWeeks).toBe(4);
      expect(result.recentWeeklyKm).toBe(12);
      expect(recommendExecution(result)).toMatchObject({
        kind: 'reduce',
        weeklyKm: 12,
        actionable: true
      });
    });

    it('flags repeated high easy RPE but not expected hard interval effort', () => {
      const plan = planFixture();
      const log = completedWeeks(plan, [24, 24, 24, 24]);
      log['w3d0'] = { status: 'done', km: 6, rpe: 8 };
      log['w3d2'] = { status: 'done', km: 6, rpe: 9 };
      expect(recommendExecution(analyzeExecution({ plan, log, today })).kind).toBe('reduce');
      plan.byId.get('w3d0')!.tag = 'int';
      plan.byId.get('w3d2')!.tag = 'tempo';
      expect(analyzeExecution({ plan, log, today }).easyHighRpeCount).toBe(0);
    });
  });
});
