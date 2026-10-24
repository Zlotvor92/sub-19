/* Zajednički kod mreže skorašnjeg najdužeg trka (recent.node.test.ts i recent.<k>.full.node.test.ts); bez testova. */

import { beforeAll, describe, expect, it } from 'vitest';
import { generateMarathonV2 } from './generate.ts';
import { invariants } from './grid.harness.node.test.ts';
import { recentInputs, type GridInput } from './testInputs.ts';

export const RECENT_PARTS = 3;
export const RECENT: readonly GridInput[] = recentInputs();

/** M13a: odbijanje samo RECENT_LONG_TOO_SHORT (pouka 6) i samo pri kratkom r; prihvaćeni planovi bez
    prekršaja invarijanti (uključujući skok dugog ≤ 10 %). */
/** T7 i F3: skorašnji najduži > nedeljni obim ili < nedeljni obim / 7 (nemoguć unos). */
const implausibleOf = (g: GridInput): boolean => {
  const r = g.input['recentLongRunKm'] as number;
  const km = g.input['currentWeeklyKm'] as number;
  return r > km || r * 7 < km;
};

export function describeRecent(title: string, inputs: readonly GridInput[]): void {
  describe(title, () => {
    const other: string[] = [];
    const tooShort: number[] = [];
    const bad: string[] = [];
    let implausible = 0;
    beforeAll(() => {
      for (const g of inputs) {
        const r = generateMarathonV2(g.input);
        if (r.ok) bad.push(...invariants(g.id, r.plan));
        else if (r.reasons.length === 1 && r.reasons[0]!.code === 'RECENT_LONG_TOO_SHORT')
          tooShort.push(g.input['recentLongRunKm'] as number);
        // MAR-11 (T7): skorašnji najduži > trenutni nedeljni obim → odbijanje (proveri unos); F3: i kraći od
        // nedeljnog obima / 7.
        else if (
          r.reasons.length === 1 &&
          r.reasons[0]!.code === 'RECENT_LONG_INVALID' &&
          implausibleOf(g)
        )
          implausible++;
        else other.push(`${g.id}: ${r.reasons.map((x) => x.message).join('; ')}`);
      }
    }, 600_000);

    it('K1: nijedno drugo odbijanje ni greška validatora; RECENT_LONG_TOO_SHORT samo pri r ≤ 8 km', () => {
      expect(other.slice(0, 10)).toEqual([]);
      expect(Math.max(0, ...tooShort)).toBeLessThanOrEqual(8);
      expect(implausible).toBe(inputs.filter(implausibleOf).length);
    });

    it('invarijante (skok dugog ≤ max(1,1 m; m + 1), Uslov 8, …): 0 prekršaja', () => {
      expect(bad.slice(0, 10)).toEqual([]);
    });
  });
}
