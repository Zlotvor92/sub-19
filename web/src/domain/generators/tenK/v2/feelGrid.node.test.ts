/* Mreža po osećaju (D26/D27): dana 3–6 × nedelje 8–18 × obim po D17 × lagan tempo {270, 315, 360, 405,
   450, 510} s/km × raspored A/B/C × trka sub/ned = 11 880 planova bez rezultata: 0 odbijanja, 0 grešaka
   validatora, deterministički, = bazna linija segment03-feel.baseline.json. Invarijante nezavisno od
   validatora (gridInvariants.ts): sve iz 02b + tačno 1 test u poslednjoj nedelji baze (dan Q1 ili umesto
   kvaliteta rasterećenja), paceBasis feel, E = lagan ± 15 s, RPE, bez prognoze i ocene cilja. Segment 03b
   (10k-v2.3.1): ceo plan bajt-isti kao 81bd351 (segment03b.plan-hashes-81bd351.json).

   Nivo testova (feelGrid.harness.node.test.ts): brz — uzorak svih brojeva dana; pun — deo 1 (3 dana), delovi 2…4
   (4, 5, 6 dana): feelGrid.<k>.full.node.test.ts. Snimanje bazne linije (TEN_K_V2_WRITE_BASELINE=1) samo uz
   TEST_FULL=1 i samo ovaj fajl (ceo skup). */

import { expect, it } from 'vitest';
import { FULL, part } from '@/test/level';
import { describeFeelGrid, FEEL_PARTS, WRITE } from './feelGrid.harness.node.test.ts';
import { generateTenKV2 } from './generate.ts';
import { DAYS } from './gridInvariants.ts';
import { feelGridInputs } from './testInputs.ts';

describeFeelGrid(
  'mreža po osećaju: 11 880 planova (3–6 dana × 8–18 ned × 6 laganih tempa)',
  FULL && !WRITE ? part(DAYS, 1, FEEL_PARTS) : DAYS,
  () => {
    it('D29: trčanje/hodanje odbijeno (svaki 40. ulaz mreže sa runWalk true)', () => {
      const sample = DAYS.flatMap((n) => feelGridInputs(n)).filter((_, i) => i % 40 === 0);
      for (const { id, input } of sample) {
        const r = generateTenKV2({ ...input, runWalk: true });
        expect(!r.ok && r.reasons.map((x) => x.code), id).toEqual(['RUN_WALK_NOT_SUPPORTED']);
      }
      expect(sample.length).toBe(297);
    });
  }
);
