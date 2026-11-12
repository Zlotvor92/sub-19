import { describe, expect, it } from 'vitest';
import { guard, plan, renderPlan, buildState } from './index';
import { SYNTHETIC } from './testdata/synthetic';
import type { Goal, RunnerFacts } from './types';

describe('plan nad sintetičkom distancom', () => {
  const facts: RunnerFacts = {
    today: '2026-11-15',
    availability: { runDays: [1, 3, 5, 6], longDay: 6 },
    profile: { weeklyKm: 30, recentResult: { distanceM: 21097.5, timeSec: 6060 } },
    runs: [],
    pauses: [],
    pain: []
  };
  const goal: Goal = { distanceId: 'syn8', raceDate: '2027-01-24' };
  const state = buildState(facts, goal, SYNTHETIC);
  const result = plan(state, goal, SYNTHETIC);

  it('daje plan od 10 nedelja bez nalaza čuvara', () => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.doc.weeks).toHaveLength(10);
    expect(guard(result.doc, state, SYNTHETIC)).toEqual([]);
    expect(renderPlan(result.doc, state, SYNTHETIC)).toContain('TRKA');
  });
});
