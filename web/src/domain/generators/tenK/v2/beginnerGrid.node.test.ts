/* Mreža početnika (D28): dana 3/4 × nedelje 10–18 × obim (3 dana: 15/20/25/30; 4 dana: 18/22/26/30/35) ×
   {po osećaju lagan 330/390/450/510, rezultat VDOT 30/35/40} × raspored A/B/C × trka sub/ned = 3402 plana:
   0 odbijanja, 0 grešaka validatora, deterministički, = bazna linija segment03b-beginner.baseline.json
   (10k-v2.3.1). Invarijante nezavisno od validatora (gridInvariants.ts): sve iz 02b + ned 1–2 bez
   kvaliteta, ≤ 1 kvalitet nedeljno, bez I/R, rast ≤ max(5 %, 1,0 km) i ≤ 2,0 km, dugi ≤ 90 min, vrh ≤
   start × 1,3; D31 T kontinuirano od 1,5 km kad lestvica faze ne staje (rasterećenje i taper min 1,5 km);
   D32 nijedan test.

   Nivo testova: brz — deterministički uzorak (svaki 5. ulaz unutar dana × nedelje; 5 je uzajamno prost sa 42 = tempo ×
   raspored × trka), brojke celog skupa kvalitativno (level.harness.node.test.ts › expectCounts); pun — svih 3402. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, logCompared } from '@/test/level';
import { expectByDays, expectCounts, GRID_TIMEOUT } from './level.harness.node.test.ts';
import {
  hashesAgain,
  only,
  type PlanGrid,
  planGridSample,
  runPlanGrid,
  summaryBad
} from './planGrid.harness.node.test.ts';
import { generateTenKV2 } from './generate.ts';
import { type Row, statsRow } from './gridInvariants.ts';
import { beginnerGridInputs, type GridCase } from './testInputs.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'segment03b-beginner.baseline.json');
const HASHES_B13 = join(HERE, 'segment04.plan-hashes-b13ca17.json');
const DAYS = [3, 4] as const;
type Baseline = { policyVersion: string; plans: Record<string, Row> };
/** Brz nivo: svaki K-ti ulaz unutar (broj dana × nedelje). */
const K = 5;

describe('mreža početnika: 3402 plana (3/4 dana × 10–18 ned × po osećaju / sa rezultatom)', () => {
  let inputs: GridCase[] = [];
  let g: PlanGrid;
  let ids = new Set<string>();
  const basis: Record<string, number> = {};
  const noQuality: string[] = [];
  beforeAll(() => {
    inputs = DAYS.flatMap((n) => beginnerGridInputs(n));
    g = runPlanGrid(FULL ? inputs : planGridSample(inputs, K), (c, plan) => {
      basis[plan.paceBasis] = (basis[plan.paceBasis] ?? 0) + 1;
      if (plan.warnings.some((w) => w.rule === 'BUILD_NO_QUALITY')) noQuality.push(c.id);
    });
    ids = new Set(g.cases.map((c) => c.id));
  }, GRID_TIMEOUT);
  const byDays = (get: (n: 3 | 4) => unknown, table: readonly unknown[]): void =>
    expectByDays(DAYS, DAYS, get, table);

  it('3402 ulaza, 0 odbijanja, 0 grešaka validatora; po osećaju 1944, sa rezultatom 1458', () => {
    expect(inputs.length).toBe(3402);
    expect(DAYS.map((n) => beginnerGridInputs(n).length)).toEqual([1512, 1890]);
    expect(new Set(inputs.map((c) => c.id)).size).toBe(3402);
    expect(g.rejected.slice(0, 20)).toEqual([]);
    expect(g.errors).toEqual({});
    expectCounts(basis, { feel: 1944, result: 1458 }, { got: g.cases.length, full: 3402 });
  });

  it('deterministički: drugo generisanje daje bajt-isti rezultat', () => {
    expect(hashesAgain(g.cases)).toEqual(g.hashes);
  });

  it('invarijante (nezavisno od validatora): sve iz 02b + uvod bez kvaliteta, ≤ 1 kvalitet, bez I/R, rast ≤ 5 % (min 1,0, ≤ 2,0 km), dugi ≤ 90 min, vrh ≤ 1,3 × start; D31 lestvica/T kontinuirano/rasterećenje/taper; D32 bez testa', () => {
    expect(summaryBad(g.bad)).toEqual({});
  });

  it('D31: posle uvoda nijedna nedelja izgradnje bez kvaliteta (81bd351: 2670 / 1050 nedelja u 378 / 378 planova) i nijedan plan bez kvaliteta od nedelje 3 do trke (81bd351: 378 / 0)', () => {
    expect(DAYS.map((n) => [g.stats[n].buildNoQualityPlans, g.stats[n].buildNoQuality])).toEqual([
      [0, 0],
      [0, 0]
    ]);
    expect(DAYS.map((n) => g.warned[`${n}:BUILD_NO_QUALITY`] ?? 0)).toEqual([0, 0]);
    expect(noQuality).toEqual([]);
    expect(DAYS.map((n) => g.stats[n].noQualityPlans)).toEqual([0, 0]);
  });

  it('D31: T kontinuirano umesto lestvice faze (nedelje), taper sa T (planova); rasterećenje / taper bez kvaliteta (81bd351: 1200 / 774 i 1116 / 378)', () => {
    byDays(
      (n) => [g.stats[n].beginnerT, g.stats[n].taperT],
      [
        [2184, 432],
        [1050, 378]
      ]
    );
    byDays(
      (n) => [g.stats[n].deloadNoQuality, g.stats[n].taperNone],
      [
        [462, 378],
        [192, 0]
      ]
    );
  });

  it('D32: nijedan test; bez skraćenog dugog i cilja naviše u rasterećenju (81bd351: test 864 / 1080, dugi < 4 km 72 / 90, naviše 72 / 72)', () => {
    expect(DAYS.map((n) => g.stats[n].tests)).toEqual([0, 0]);
    expect(
      DAYS.map((n) => [g.stats[n].testDeload, g.stats[n].testDeloadLong, g.stats[n].testDeloadUp])
    ).toEqual([
      [0, 0, 0],
      [0, 0, 0]
    ]);
    expect(DAYS.map((n) => g.stats[n].deloadLongBelow4)).toEqual([0, 0]);
    expect(DAYS.map((n) => g.warned[`${n}:TEST_DELOAD_LONG`] ?? 0)).toEqual([0, 0]);
  });

  it('brojke po broju dana (izveštaj): CAPACITY_LIMITED, ponavljanja, vrh/start, odstupanja; ned 1 ispod obima, D25, DOSE_DROPPED', () => {
    // 81bd351: [1512, 588, 192, 1.229, 1200, 0, 774, 0], [1890, 324, 240, 1.281, 1116, 0, 378, 0].
    const table = [
      [1512, 588, 2580, 1.227, 462, 0, 378, 0],
      [1890, 324, 168, 1.28, 192, 0, 0, 0]
    ];
    // Brz nivo: prosek vrh/start (kolona 3) nije brojka uzorka — ne poredi se (planovi uzorka su bajt-isti b13ca17).
    const row = (n: 3 | 4): number[] => statsRow(g.stats[n]);
    if (FULL) byDays(row, table);
    else
      byDays(
        (n) => row(n).filter((_, i) => i !== 3),
        table.map((r) => r.filter((_, i) => i !== 3))
      );
    expect(
      DAYS.map((n) => {
        const s = g.stats[n];
        return [s.belowTime, s.belowShare, s.longShorter, s.doseDropped, s.doseDroppedShare];
      })
    ).toEqual([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0]
    ]);
  });

  it('D29: trčanje/hodanje odbijeno (svaki 20. ulaz mreže sa runWalk true)', () => {
    const sample = inputs.filter((_, i) => i % 20 === 0);
    for (const { id, input } of sample) {
      const r = generateTenKV2({ ...input, runWalk: true });
      expect(!r.ok && r.reasons.map((x) => x.code), id).toEqual(['RUN_WALK_NOT_SUPPORTED']);
    }
    expect(sample.length).toBe(171);
  });

  it('generisanje daje TAČNO baznu liniju segment03b-beginner.baseline.json', () => {
    if (process.env['TEN_K_V2_WRITE_BASELINE'] === '1') {
      if (!FULL) throw new Error('TEN_K_V2_WRITE_BASELINE: samo ceo skup (TEST_FULL=1)');
      writeFileSync(
        BASELINE,
        JSON.stringify({ policyVersion: '10k-v2.3.1', plans: g.rows }) + '\n'
      );
    }
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
    expect(base.policyVersion).toBe('10k-v2.3.1');
    expect(Object.keys(base.plans).length).toBe(3402);
    expect(Object.keys(base.plans).sort()).toEqual(inputs.map((c) => c.id).sort());
    logCompared('tenK.v2.segment03b-beginner.baseline', Object.keys(g.rows));
    expect(g.rows).toEqual(only(base.plans, ids));
  });
  it('regresija 04: generate = construct(input, []) — ceo plan početnika bajt-isti kao b13ca17 (heš bez oznake verzije) za svih 3402', () => {
    const fx = JSON.parse(readFileSync(HASHES_B13, 'utf8')) as {
      against: string;
      beginner: Record<string, number>;
    };
    expect(fx.against).toBe('b13ca17');
    expect(Object.keys(fx.beginner).sort()).toEqual(inputs.map((c) => c.id).sort());
    expect(Object.keys(g.h81).sort()).toEqual([...ids].sort());
    logCompared('tenK.v2.b13ca17.beginner', Object.keys(g.h81));
    expect(Object.keys(g.h81).filter((id) => g.h81[id] !== fx.beginner[id])).toEqual([]);
  });
});
