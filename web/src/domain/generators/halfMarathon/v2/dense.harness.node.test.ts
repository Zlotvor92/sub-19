/* Zajednički kod guste mreže nedelje 1 (dense.node.test.ts i delovi punog nivoa dense.<k>.full.node.test.ts). */

import { beforeAll, describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { checkPlan, emptyStats, type GridStats } from './gridInvariants.ts';
import type { denseWeek1Inputs } from './testInputs.ts';

export const DENSE_PARTS = 3;

/** Gusta mreža (K1 = 0 za ceo opseg obima i VDOT-a; pouka 9): ceo plan + nezavisne invarijante. */
export function describeDense(name: string, inputs: ReturnType<typeof denseWeek1Inputs>): void {
  describe(name, () => {
    const rejected: string[] = [];
    const bad: Record<string, string[]> = {};
    let st: GridStats = emptyStats();
    beforeAll(() => {
      st = emptyStats();
      for (const g of inputs) {
        const r = generateHmV2(g.input);
        if (!r.ok) rejected.push(`${g.id}: ${r.reasons.map((x) => x.message).join(' | ')}`);
        else checkPlan(g.id, r.plan, bad, st);
      }
    }, 120_000);

    it('K1: 0 odbijanja; invarijante 0; K2: nedelja 1 ispod obima samo uz dugi na 150 min', () => {
      expect(inputs.length).toBeGreaterThan(0);
      expect(rejected).toEqual([]);
      expect(bad).toEqual({});
      expect(st.week1BelowNotTime).toBe(0);
      expect([
        st.buildNoQuality,
        st.raceOverTaper,
        st.dropOutsideCapacity,
        st.hardAdjacent
      ]).toEqual([0, 0, 0, 0]);
    });
  });
}
