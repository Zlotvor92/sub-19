/* MAR-08c (test alat; marathon-v2.5.1 bez promene domena): adaptInvariants „ograničenje: doza raste" je skupljao najveću
   dosadašnju dozu po zoni samo iz NEmešovitih nedelja — upisane doze mešovitih nedelja (pouka 29) su ispadale, pa je
   ograničena nedelja poređena sa starijom, manjom dozom. Primer organizatora d3-15w-45km-v30-C-sat: over120 (sreda
   ned 2) → + 7 pauza 20; upisano T 2000 → 3000 → 4000 (ned 2–3 mešovite), ned 5 „jedan kvalitet" T cruise 2400 — doza
   pada, invarijanta je prijavljivala rast (poređenje sa 2000). Na 78292d4 test pada. */

import { expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { factsOf, gridInputs } from './testInputs.ts';
import type { AdaptResult, MarathonV2Facts } from './types.ts';

const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};

it('mešovite nedelje ulaze u najveću dosadašnju dozu: ograničena ned 5 (T 2400 posle upisanih 3000/4000) nije rast', () => {
  const g = generateMarathonV2(gridInputs().find((x) => x.id === 'd3-15w-45km-v30-C-sat')!.input);
  if (!g.ok) throw new Error('generator');
  const p = g.plan;
  let at = p.weeks[1]!.startDate;
  while (new Date(at + 'T00:00:00Z').getUTCDay() !== 3) at = addDays(at, 1);
  const r1 = ok(adaptMarathonV2(p, factsOf(p, 'over120', at), at));
  const at2 = addDays(at, 7);
  const f2 = factsOf(r1.plan, 'pause20', at2) as MarathonV2Facts;
  const r = ok(adaptMarathonV2(r1.plan, f2, at2));
  const w5 = r.plan.weeks[4]!;
  expect(w5.limits?.quality).toBe('one');
  const t = (i: number) =>
    r.plan.weeks[i - 1]!.days.filter((d) => d.workout.dose?.zone === 'T').map(
      (d) => d.workout.dose!.doseM
    );
  // MAR-11 (T1): plan se menja (lagani ≤ 0,8 × dugi) — ned 3 T 3000; ograničena ned 5 = ≈ 60 % najveće upisane
  // (3000 → najmanje 2000 m), nije rast.
  expect([t(2), t(3), t(5)]).toEqual([[3000], [3000], [2000]]);
  expect(r.plan.adaptation!.mixedWeeks).toEqual(expect.arrayContaining([2, 3]));
  expect(adaptInvariants(r1.plan, r.plan, at2, f2)).toEqual([]);
});
