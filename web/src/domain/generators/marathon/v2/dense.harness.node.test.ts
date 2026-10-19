/* Zajednički kod guste mreže nedelje 1 (dense.node.test.ts i dense.<k>.full.node.test.ts); bez testova. */

import { beforeAll, describe, expect, it } from 'vitest';
import { generateMarathonV2 } from './generate.ts';
import { invariants } from './grid.harness.node.test.ts';
import { longTimeCap10 } from './lengths.ts';
import { denseInputs, type GridInput } from './testInputs.ts';

export const DENSE_PARTS = 8;
export const DENSE: readonly GridInput[] = denseInputs();

/** K1 = 0 i invarijante; K2: ned 1 ispod trenutnog obima — svaki put uz dugi na 150 min (pouka 9). */
export function describeDense(title: string, inputs: readonly GridInput[]): void {
  describe(title, () => {
    const rejected: string[] = [];
    const bad: string[] = [];
    let below = 0;
    let belowNoCap = 0;
    beforeAll(() => {
      for (const g of inputs) {
        const r = generateMarathonV2(g.input);
        if (!r.ok) {
          rejected.push(`${g.id}: ${r.reasons.map((x) => x.message).join('; ')}`);
          continue;
        }
        bad.push(...invariants(g.id, r.plan));
        const w1 = r.plan.weeks[0]!;
        if (w1.targetKm < r.plan.startKm) {
          below++;
          const l = w1.days.find((d) => d.role === 'long')!.workout.km;
          if (Math.round(l * 10) !== longTimeCap10(r.plan.paces)) belowNoCap++;
        }
      }
    }, 600_000);

    it('K1: 0 odbijanja i 0 grešaka validatora', () => {
      expect(inputs.length).toBeGreaterThan(0);
      expect(rejected.slice(0, 10)).toEqual([]);
    });

    it('invarijante: 0 prekršaja; K2 ned 1 < obim samo uz dugi na 150 min', () => {
      expect(bad.slice(0, 10)).toEqual([]);
      expect(belowNoCap).toBe(0);
      expect(below).toBeLessThan(inputs.length);
    });
  });
}
