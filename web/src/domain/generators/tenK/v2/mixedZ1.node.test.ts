import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from './adapt.ts';
import { generateTenKV2 } from './generate.ts';
import { factsOf, grid02Inputs } from './testInputs.ts';
import { validatePlan } from './validate.ts';

/* 10K-07 Z1 (odluka organizatora, dopuna pouke 37): u mešovitoj nedelji kvalitet NE otpada kad je jedini uzrok viška
   upisani višak zaštićenih dana i planirano sa zadržanim kvalitetom ≤ 1,10 × cilj — kvalitet ostaje, lagani na
   minimumu, upozorenje MIXED_OVER_TARGET. Ulaz iz merenja (consistency/mixed-drop.ts 10K 97): d3-18w-20km-v50-A-sun,
   over120 (urađeno 120 %), asOf 2026-11-10 (utorak ned 2): pre — Q1 6,84 km otpada (lagan 5,8 km), višak ≈ 4,8 %. */

describe('10K-07 Z1: upisani višak ne obara kvalitet mešovite nedelje', () => {
  it('d3-18w-20km-v50-A-sun over120 asOf 2026-11-10: Q1 ostaje, MIXED_OVER_TARGET, plan prolazi validator', () => {
    const c = grid02Inputs(3).find((x) => x.id === 'd3-18w-20km-v50-A-sun')!;
    const g = generateTenKV2(c.input);
    if (!g.ok) throw new Error('generate');
    const at = '2026-11-10';
    const r = adaptTenKV2(g.plan, factsOf(g.plan, 'over120', at), at);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    const w = r.plan.weeks[1]!;
    const q = w.days.filter((d) => d.date > at && d.workout.kind === 'quality');
    expect(q.map((d) => d.date)).toEqual(['2026-11-12']);
    expect(w.notes.some((n) => n.includes('(više od planiranog)'))).toBe(true);
    expect(r.plan.warnings.some((v) => v.rule === 'MIXED_OVER_TARGET' && v.week === 2)).toBe(true);
    expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
    expect((w.keptKm ?? 0) + q.reduce((a, d) => a + d.workout.km, 0)).toBeLessThanOrEqual(
      1.1 * w.targetKm
    );
  });
});
