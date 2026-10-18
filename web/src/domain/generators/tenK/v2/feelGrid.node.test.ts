/* Mreža po osećaju (D26/D27): dana 3–6 × nedelje 8–18 × obim po D17 × lagan tempo {270, 315, 360, 405,
   450, 510} s/km × raspored A/B/C × trka sub/ned = 11 880 planova bez rezultata: 0 odbijanja, 0 grešaka
   validatora, deterministički, = bazna linija segment03-feel.baseline.json. Invarijante nezavisno od
   validatora (gridInvariants.ts): sve iz 02b + tačno 1 test u poslednjoj nedelji baze (dan Q1 ili umesto
   kvaliteta rasterećenja), paceBasis feel, E = lagan ± 15 s, RPE, bez prognoze i ocene cilja. Segment 03b
   (10k-v2.3.1): ceo plan bajt-isti kao 81bd351 (segment03b.plan-hashes-81bd351.json). */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import {
  checkPlan,
  DAYS,
  type Days,
  emptyStats,
  type GridStats,
  type Row,
  statsRow,
  summaryRow
} from './gridInvariants.ts';
import { feelGridInputs, fnv1a, planHash81 } from './testInputs.ts';
import { validatePlan } from './validate.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'segment03-feel.baseline.json');
const HASHES_81 = join(HERE, 'segment03b.plan-hashes-81bd351.json');
const HASHES_B13 = join(HERE, 'segment04.plan-hashes-b13ca17.json');
type Baseline = { policyVersion: string; plans: Record<string, Row> };

describe('mreža po osećaju: 11 880 planova (3–6 dana × 8–18 ned × 6 laganih tempa)', () => {
  const inputs = DAYS.flatMap((n) => feelGridInputs(n));
  const rows: Record<string, Row> = {};
  const hashes: number[] = [];
  const h81: Record<string, number> = {};
  const rejected: string[] = [];
  const errors: Record<string, number> = {};
  const warned: Record<string, number> = {};
  const bad: Record<string, string[]> = {};
  const stats = {} as Record<Days, GridStats>;
  for (const n of DAYS) stats[n] = emptyStats();
  for (const { id, days, input } of inputs) {
    const r = generateTenKV2(input);
    hashes.push(fnv1a(JSON.stringify(r)));
    h81[id] = planHash81(r);
    if (!r.ok) {
      rejected.push(`${id}: ${r.reasons.map((x) => x.code).join(',')}`);
      continue;
    }
    for (const v of validatePlan(r.plan))
      if (v.severity === 'error') errors[v.rule] = (errors[v.rule] ?? 0) + 1;
    for (const k of new Set(r.plan.warnings.map((w) => w.rule)))
      warned[`${days}:${k}`] = (warned[`${days}:${k}`] ?? 0) + 1;
    rows[id] = summaryRow(r.plan);
    checkPlan(id, days as Days, r.plan, bad, stats[days as Days]);
  }

  it('11 880 ulaza, 0 odbijanja, 0 grešaka validatora', () => {
    expect(inputs.length).toBe(11880);
    expect(DAYS.map((n) => feelGridInputs(n).length)).toEqual([1980, 2772, 3168, 3960]);
    expect(new Set(inputs.map((g) => g.id)).size).toBe(11880);
    expect(rejected.slice(0, 20)).toEqual([]);
    expect(errors).toEqual({});
  });

  it('deterministički: drugo generisanje daje bajt-isti rezultat', () => {
    const again = inputs.map(({ input }) => fnv1a(JSON.stringify(generateTenKV2(input))));
    expect(again).toEqual(hashes);
  });

  it('invarijante (nezavisno od validatora): sve iz 02b + tačno 1 test (poslednja nedelja baze, dan Q1 / umesto kvaliteta rasterećenja), paceBasis feel, E = lagan ± 15 s, RPE, bez prognoze', () => {
    const summaryBad = Object.fromEntries(
      Object.entries(bad).map(([k, v]) => [k, `${v.length}: ${v.slice(0, 3).join(' | ')}`])
    );
    expect(summaryBad).toEqual({});
  });

  it('D27: test u rasterećenju; dugi skraćen da lagani ostanu ≥ 3 km (TEST_DELOAD_LONG); cilj nikad podignut', () => {
    expect(
      DAYS.map((n) => [stats[n].testDeload, stats[n].testDeloadLong, stats[n].testDeloadUp])
    ).toEqual([
      [540, 144, 0],
      [756, 36, 0],
      [864, 18, 0],
      [1080, 36, 0]
    ]);
    expect(DAYS.map((n) => warned[`${n}:TEST_DELOAD_LONG`] ?? 0)).toEqual([144, 36, 18, 36]);
  });

  it('brojke po broju dana (izveštaj): CAPACITY_LIMITED, ponavljanja, vrh/start, odstupanja; ned 1 ispod obima (105 min / udeo), D25, DOSE_DROPPED (od toga udeo)', () => {
    expect(DAYS.map((n) => statsRow(stats[n]))).toEqual([
      [1980, 864, 48, 1.229, 288, 0, 36, 0],
      [2772, 1350, 36, 1.215, 0, 0, 0, 0],
      [3168, 930, 0, 1.261, 0, 0, 0, 0],
      [3960, 846, 0, 1.238, 0, 0, 0, 0]
    ]);
    expect(
      DAYS.map((n) => {
        const s = stats[n];
        return [s.belowTime, s.belowShare, s.longShorter, s.doseDropped, s.doseDroppedShare];
      })
    ).toEqual([
      [396, 0, 0, 84, 0],
      [660, 132, 78, 156, 6],
      [396, 0, 78, 0, 0],
      [396, 0, 132, 0, 0]
    ]);
  });

  it('D29: trčanje/hodanje odbijeno (svaki 40. ulaz mreže sa runWalk true)', () => {
    const sample = inputs.filter((_, i) => i % 40 === 0);
    for (const { id, input } of sample) {
      const r = generateTenKV2({ ...input, runWalk: true });
      expect(!r.ok && r.reasons.map((x) => x.code), id).toEqual(['RUN_WALK_NOT_SUPPORTED']);
    }
    expect(sample.length).toBe(297);
  });

  it('generisanje daje TAČNO baznu liniju segment03-feel.baseline.json', () => {
    if (process.env['TEN_K_V2_WRITE_BASELINE'] === '1')
      writeFileSync(BASELINE, JSON.stringify({ policyVersion: '10k-v2.3.0', plans: rows }) + '\n');
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
    expect(base.policyVersion).toBe('10k-v2.3.0');
    expect(Object.keys(base.plans).length).toBe(11880);
    expect(rows).toEqual(base.plans);
  });

  it('regresija 03b: ceo plan po osećaju bajt-isti kao 81bd351 (heš bez oznake verzije) za svih 11 880', () => {
    const fx = JSON.parse(readFileSync(HASHES_81, 'utf8')) as {
      against: string;
      feel: Record<string, number>;
    };
    expect(fx.against).toBe('81bd351');
    expect(Object.keys(fx.feel).sort()).toEqual(Object.keys(h81).sort());
    expect(Object.keys(h81).length).toBe(11880);
    expect(Object.keys(h81).filter((id) => h81[id] !== fx.feel[id])).toEqual([]);
  });
  it('regresija 04: generate = construct(input, []) — ceo plan po osećaju bajt-isti kao b13ca17 (heš bez oznake verzije) za svih 11880', () => {
    const fx = JSON.parse(readFileSync(HASHES_B13, 'utf8')) as {
      against: string;
      feel: Record<string, number>;
    };
    expect(fx.against).toBe('b13ca17');
    expect(Object.keys(fx.feel).sort()).toEqual(Object.keys(h81).sort());
    expect(Object.keys(h81).length).toBe(11880);
    expect(Object.keys(h81).filter((id) => h81[id] !== fx.feel[id])).toEqual([]);
  });
});
