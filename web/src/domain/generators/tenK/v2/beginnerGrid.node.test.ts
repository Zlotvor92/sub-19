/* Mreža početnika (D28): dana 3/4 × nedelje 10–18 × obim (3 dana: 15/20/25/30; 4 dana: 18/22/26/30/35) ×
   {po osećaju lagan 330/390/450/510, rezultat VDOT 30/35/40} × raspored A/B/C × trka sub/ned = 3402 plana:
   0 odbijanja, 0 grešaka validatora, deterministički, = bazna linija segment03-beginner.baseline.json.
   Invarijante nezavisno od validatora (gridInvariants.ts): sve iz 02b + ned 1–2 bez kvaliteta, ≤ 1 kvalitet
   nedeljno, bez I/R, rast ≤ max(5 %, 1,0 km) i ≤ 2,0 km, dugi ≤ 90 min, vrh ≤ start × 1,3; po osećaju tačno
   1 test (D27), sa rezultatom nijedan. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import {
  checkPlan,
  type Days,
  emptyStats,
  type GridStats,
  type Row,
  statsRow,
  summaryRow
} from './gridInvariants.ts';
import { beginnerGridInputs, fnv1a } from './testInputs.ts';
import { validatePlan } from './validate.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'segment03-beginner.baseline.json');
const DAYS = [3, 4] as const;
type Baseline = { policyVersion: string; plans: Record<string, Row> };

describe('mreža početnika: 3402 plana (3/4 dana × 10–18 ned × po osećaju / sa rezultatom)', () => {
  const inputs = DAYS.flatMap((n) => beginnerGridInputs(n));
  const rows: Record<string, Row> = {};
  const hashes: number[] = [];
  const rejected: string[] = [];
  const errors: Record<string, number> = {};
  const warned: Record<string, number> = {};
  const bad: Record<string, string[]> = {};
  const stats = {} as Record<Days, GridStats>;
  for (const n of DAYS) stats[n] = emptyStats();
  const basis: Record<string, number> = {};
  const noQuality: string[] = [];
  for (const { id, days, input } of inputs) {
    const r = generateTenKV2(input);
    hashes.push(fnv1a(JSON.stringify(r)));
    if (!r.ok) {
      rejected.push(`${id}: ${r.reasons.map((x) => x.code).join(',')}`);
      continue;
    }
    for (const v of validatePlan(r.plan))
      if (v.severity === 'error') errors[v.rule] = (errors[v.rule] ?? 0) + 1;
    for (const k of new Set(r.plan.warnings.map((w) => w.rule)))
      warned[`${days}:${k}`] = (warned[`${days}:${k}`] ?? 0) + 1;
    basis[r.plan.paceBasis] = (basis[r.plan.paceBasis] ?? 0) + 1;
    if (r.plan.warnings.some((w) => w.rule === 'BUILD_NO_QUALITY')) noQuality.push(id);
    rows[id] = summaryRow(r.plan);
    checkPlan(id, days as Days, r.plan, bad, stats[days as Days]);
  }

  it('3402 ulaza, 0 odbijanja, 0 grešaka validatora; po osećaju 1944, sa rezultatom 1458', () => {
    expect(inputs.length).toBe(3402);
    expect(DAYS.map((n) => beginnerGridInputs(n).length)).toEqual([1512, 1890]);
    expect(new Set(inputs.map((g) => g.id)).size).toBe(3402);
    expect(rejected.slice(0, 20)).toEqual([]);
    expect(errors).toEqual({});
    expect(basis).toEqual({ feel: 1944, result: 1458 });
  });

  it('deterministički: drugo generisanje daje bajt-isti rezultat', () => {
    const again = inputs.map(({ input }) => fnv1a(JSON.stringify(generateTenKV2(input))));
    expect(again).toEqual(hashes);
  });

  it('invarijante (nezavisno od validatora): sve iz 02b + uvod bez kvaliteta, ≤ 1 kvalitet, bez I/R, rast ≤ 5 % (min 1,0, ≤ 2,0 km), dugi ≤ 90 min, vrh ≤ 1,3 × start, test samo po osećaju', () => {
    const summaryBad = Object.fromEntries(
      Object.entries(bad).map(([k, v]) => [k, `${v.length}: ${v.slice(0, 3).join(' | ')}`])
    );
    expect(summaryBad).toEqual({});
  });

  it('D28 odstupanje: nedelje izgradnje bez kvaliteta (BUILD_NO_QUALITY) samo kad ni prvi nivo ne staje u plafon — 3 dana 15 km i 4 dana 18 km', () => {
    expect(DAYS.map((n) => [stats[n].buildNoQualityPlans, stats[n].buildNoQuality])).toEqual([
      [378, 2670],
      [378, 1050]
    ]);
    expect(DAYS.map((n) => warned[`${n}:BUILD_NO_QUALITY`] ?? 0)).toEqual([378, 378]);
    expect([
      ...new Set(noQuality.map((id) => id.replace(/^b-(d\d)-\d+w-(\d+km)-.*$/, '$1-$2')))
    ]).toEqual(['d3-15km', 'd4-18km']);
  });

  it('D27 u planu početnika po osećaju: test u rasterećenju, dugi skraćen, cilj rasterećenja podignut ispod poslednje izgradnje', () => {
    expect(
      DAYS.map((n) => [stats[n].testDeload, stats[n].testDeloadLong, stats[n].testDeloadUp])
    ).toEqual([
      [288, 162, 72],
      [360, 162, 72]
    ]);
  });

  it('brojke po broju dana (izveštaj): CAPACITY_LIMITED, ponavljanja, vrh/start, odstupanja; ned 1 ispod obima, D25, DOSE_DROPPED', () => {
    expect(DAYS.map((n) => statsRow(stats[n]))).toEqual([
      [1512, 588, 192, 1.229, 1200, 0, 774, 0],
      [1890, 324, 240, 1.281, 1116, 0, 378, 0]
    ]);
    expect(
      DAYS.map((n) => {
        const s = stats[n];
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

  it('generisanje daje TAČNO baznu liniju segment03-beginner.baseline.json', () => {
    if (process.env['TEN_K_V2_WRITE_BASELINE'] === '1')
      writeFileSync(BASELINE, JSON.stringify({ policyVersion: '10k-v2.3.0', plans: rows }) + '\n');
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
    expect(base.policyVersion).toBe('10k-v2.3.0');
    expect(Object.keys(base.plans).length).toBe(3402);
    expect(rows).toEqual(base.plans);
  });
});
