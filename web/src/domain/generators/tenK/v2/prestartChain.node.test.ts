/* 10K v2 06i (10k-v2.8.0, organizator K3): lanac pre starta → nedelja 1. Primer d3-8w-20km-v30-A-sat: umor
   asOf 2026-10-31 (start − 1: nedelja 1 prinudno rasterećenje), pa umor 2026-11-04 (zapisi u nedelji 1) — na 46e72eb
   WEEK_INFEASIBLE (nedelja 2 rasterećenje bez reference). Sada: rasterećenje je već u planu (pouka 36), nedelja 2
   izgradnja; bol 8 pre starta pa umor u nedelji 1 → rasterećenje nedelje 2 sa referencom nedelje 1 generatora bez
   činjenica (pouke 33 i 34). Mreža: prestartChain.harness.node.test.ts. */

import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from './adapt.ts';
import { generateTenKV2 } from './generate.ts';
import { describePrestartChain, mergeFacts } from './prestartChain.harness.node.test.ts';
import { factsOf, grid02Inputs } from './testInputs.ts';

describePrestartChain(
  'mreža K3: lanac pre starta (bol 8/5, umor, pauza 20) → nedelja 1, svih 17 scenarija',
  1
);

describe('K3: primer d3-8w-20km-v30-A-sat', () => {
  const g = generateTenKV2(grid02Inputs(3).find((x) => x.id === 'd3-8w-20km-v30-A-sat')!.input);
  if (!g.ok) throw new Error('d3-8w-20km-v30-A-sat');
  const p0 = g.plan;
  const step = (s1: 'fatigue' | 'pain8', at2: string) => {
    const f1 = factsOf(p0, s1, '2026-10-31');
    const r1 = adaptTenKV2(p0, f1, '2026-10-31');
    if (!r1.ok) throw new Error('korak 1');
    const r2 = adaptTenKV2(r1.plan, mergeFacts(f1, factsOf(r1.plan, 'fatigue', at2)), at2);
    if (!r2.ok) throw new Error(JSON.stringify(r2.reasons));
    return r2;
  };
  it('umor → umor 2026-11-04: nedelja 1 ostaje rasterećenje, nedelja 2 izgradnja (bez drugog rasterećenja), umor „već u planu"', () => {
    const r = step('fatigue', '2026-11-04');
    expect(r.plan.weeks.slice(0, 2).map((w) => w.deload)).toEqual([true, false]);
    expect(r.reasons.find((x) => x.condition === 'FATIGUE')!.applied).toBe(false);
  });
  it.each(['2026-11-04', '2026-11-07'])(
    'bol 8 → umor %s: nedelja 2 rasterećenje izvodljivo (referenca nedelja 1 generatora)',
    (at2) => {
      const r = step('pain8', at2);
      expect(r.plan.weeks[1]!.deload).toBe(true);
      expect(r.plan.adaptation!.steps.at(-1)!.preStart).toBeDefined();
    }
  );
});
