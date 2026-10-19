/* HM v2 Faza 4a tačka 12 (MASTER pouka 36): umor je vezan za ZAPISE — isti zapisi umora poslati ponovo asOf + 1 … + 7
   ne prave novo rasterećenje i traka (pouka 20, newLimits) ih ne vidi kao novo. Trajna mreža: svaki 3. plan rane mreže
   (earlyGridBases) × asOf sreda i kraj nedelje 1 … N − 3 × ponovo + 1 … + 7 dana. Brz nivo: svaki 9. tok; pun: deo
   1/2 ovde, deo 2 u fatigueRepeat.2.full.node.test.ts. Izmereno na f4b257d (final-check/fatigue-repeat.ts HM end):
   708/777 tokova sa drugim rasterećenjem; posle 0. */

import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { adaptHmV2 } from './adapt.ts';
import { factsOf } from './adaptInputs.ts';
import { basePlan, earlyGridBases } from './adaptGrid.harness.node.test.ts';
import { addDays } from './dates.ts';
import type { HmV2Plan } from './types.ts';

const wedOf = (start: string): string => {
  let d = start;
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 3) d = addDays(d, 1);
  return d;
};
const deloads = (p: HmV2Plan): number => p.weeks.filter((w) => w.deload).length;

interface Flow {
  key: string;
  plan: HmV2Plan;
  asOf: string;
}
const flows = (): Flow[] =>
  earlyGridBases()
    .filter((_, i) => i % 3 === 0)
    .flatMap((b) => {
      const p = basePlan(b);
      return p.weeks.slice(0, Math.max(0, p.weeks.length - 3)).flatMap((w) => [
        { key: `${b.id}/w${w.index}wed`, plan: p, asOf: wedOf(w.startDate) },
        { key: `${b.id}/w${w.index}end`, plan: p, asOf: w.endDate }
      ]);
    });

export function describeFatigueRepeat(index: number, parts: number): void {
  describe(`pouka 36: isti zapisi umora ponovo (asOf + 1 … + 7) — 0 novih rasterećenja (deo ${index}/${parts})`, () => {
    const bad: string[] = [];
    let n = 0;
    let applied = 0;
    beforeAll(() => {
      for (const f of FULL ? part(flows(), index, parts) : sample(flows(), 9)) {
        const facts = factsOf(f.plan, 'fatigue', f.asOf);
        const r1 = adaptHmV2(f.plan, facts, f.asOf);
        if (!r1.ok) {
          bad.push(`${f.key}: odbijen prvi`);
          continue;
        }
        if (r1.plan.adaptation!.steps.at(-1)!.deload) applied++;
        for (let d = 1; d <= 7; d++) {
          const at = addDays(f.asOf, d);
          if (at >= f.plan.input.raceDate) break;
          n++;
          const r2 = adaptHmV2(r1.plan, facts, at);
          if (!r2.ok) bad.push(`${f.key}+${d}: odbijen`);
          else if (deloads(r2.plan) > deloads(r1.plan))
            bad.push(`${f.key}+${d}: novo rasterećenje`);
          else if (r2.newLimits.some((x) => x.startsWith('deload:')))
            bad.push(`${f.key}+${d}: traka vidi umor kao nov`);
        }
      }
    }, 300_000);

    it('0 novih rasterećenja, 0 odbijanja, traka bez ponovljenog umora', () => {
      expect(n).toBeGreaterThan(100);
      expect(applied).toBeGreaterThan(10);
      expect(bad).toEqual([]);
    });
  });
}

describeFatigueRepeat(1, 2);
