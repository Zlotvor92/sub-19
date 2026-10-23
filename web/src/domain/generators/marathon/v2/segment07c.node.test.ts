/* MAR-07c (marathon-v2.4.2; pouke 23, 36): umor sa asOf na dan testa plana po osećaju. Prinudno rasterećenje
   (pouka 36) pada na tekuću nedelju testa; test na danu Q1 (= asOf) je zaštićen (≤ asOf), a okvir rasterećenja nosi
   dan testa na T slotu (posle asOf) — konstruktor je test premeštao u sledeću nedelju izgradnje i plan je imao dva
   testa (validator: TEST, A13/M17). Na a869e21 (marathon-v2.4.1) prvi test pada. */

import { describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { factsOf, feelInputs } from './testInputs.ts';
import type { AdaptResult, MarathonV2Facts, MarathonV2Plan } from './types.ts';

const planOf = (id: string): MarathonV2Plan => {
  const r = generateMarathonV2(feelInputs().find((x) => x.id === id)!.input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const testDays = (p: MarathonV2Plan): string[] =>
  p.weeks.flatMap((w) => w.days.filter((d) => d.role === 'test').map((d) => d.date));

describe('MAR-07c: umor, asOf = dan testa (ponedeljak nedelje testa)', () => {
  const p = planOf('feel-d5-18w-40km-e450-C');
  const tw = p.weeks.find((w) => w.test)!;
  const at = tw.startDate;

  it('primer organizatora: test je zaštićen (≤ asOf) i ostaje jedini; ostatak nedelje je rasterećenje', () => {
    expect(testDays(p)).toEqual([at]);
    const f = factsOf(p, 'fatigue', at) as MarathonV2Facts;
    const r = ok(adaptMarathonV2(p, f, at));
    expect(testDays(r.plan)).toEqual([at]);
    expect(r.plan.weeks[tw.index - 1]!.deload).toBe(true);
    expect(r.reasons.some((x) => x.condition === 'TEST_MOVED')).toBe(false);
    expect(adaptInvariants(p, r.plan, at, f)).toEqual([]);
  });

  it('kontrola: asOf dan ranije (test posle asOf) → test se i dalje premešta u sledeću nedelju izgradnje (A13)', () => {
    const at0 = addDays(at, -1);
    const r = ok(adaptMarathonV2(p, factsOf(p, 'fatigue', at0), at0));
    expect(r.plan.weeks[tw.index - 1]!.deload).toBe(true);
    const t = testDays(r.plan);
    expect(t).toHaveLength(1);
    expect(t[0]! > tw.endDate).toBe(true);
    expect(r.reasons.some((x) => x.condition === 'TEST_MOVED')).toBe(true);
  });
});
