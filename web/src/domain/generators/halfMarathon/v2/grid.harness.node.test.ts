/* Zajednički kod mreže 01 (glavni fajl grid.node.test.ts i delovi punog nivoa grid.<k>.full.node.test.ts).
   Ime *.harness.node.test.ts: test kod (izolacija, tsconfig), vitest ga ne skuplja. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { generateHmV2 } from './generate.ts';
import { checkPlan, emptyStats, type GridStats } from './gridInvariants.ts';
import { type GridInput, planHash } from './testInputs.ts';

const DIR = dirname(fileURLToPath(import.meta.url));
export const BASELINE = join(DIR, 'segment01.baseline.json');
export const WRITE = process.env['HM_V2_WRITE_BASELINE'] === '1';
export const GRID_PARTS = 2;

/** Red bazne linije: vrh cilja, najduži dugi, heš celog plana bez oznake verzije (regresija sledećeg segmenta). */
export type BaselineRow = [peakKm: number, longestKm: number, hash: string];

interface Result {
  rejected: string[];
  errors: string[];
  bad: Record<string, string[]>;
  st: GridStats;
  rows: Record<string, BaselineRow>;
  nondeterministic: string[];
}

function run(
  inputs: readonly GridInput[],
  determinism: (g: GridInput, i: number) => boolean
): Result {
  const out: Result = {
    rejected: [],
    errors: [],
    bad: {},
    st: emptyStats(),
    rows: {},
    nondeterministic: []
  };
  inputs.forEach((g, i) => {
    const r = generateHmV2(g.input);
    if (!r.ok) {
      out.rejected.push(`${g.id}: ${r.reasons.map((x) => x.message).join(' | ')}`);
      return;
    }
    for (const v of r.plan.warnings)
      if (v.severity === 'error') out.errors.push(`${g.id}: ${v.rule}`);
    checkPlan(g.id, r.plan, out.bad, out.st);
    const hash = planHash(r.plan);
    const longest = Math.max(
      ...r.plan.weeks.flatMap((w) =>
        w.days.filter((d) => d.role === 'long').map((d) => d.workout.km)
      )
    );
    out.rows[g.id] = [r.plan.peakKm, longest, hash];
    if (determinism(g, i)) {
      const again = generateHmV2(g.input);
      if (
        !again.ok ||
        planHash(again.plan) !== hash ||
        JSON.stringify(again.plan) !== JSON.stringify(r.plan)
      )
        out.nondeterministic.push(g.id);
    }
  });
  return out;
}

/** Mreža 01 nad `inputs` (uzorak brzog nivoa ili deo punog). */
export function describeGrid(name: string, inputs: readonly GridInput[], extra?: () => void): void {
  describe(name, () => {
    let res: Result;
    beforeAll(() => {
      res = run(inputs, (_, i) => FULL || i % 4 === 0);
    }, 120_000);

    it('K1: 0 odbijanja i 0 grešaka validatora (ulazi u opsegu H1)', () => {
      expect(inputs.length).toBeGreaterThan(0);
      expect(res.rejected).toEqual([]);
      expect(res.errors).toEqual([]);
    });

    it('nezavisne invarijante (Uslov 8, pouke 1–5, 9, 12): 0 prekršaja', () => {
      expect(res.bad).toEqual({});
    });

    it('K2 (pouka 9): nedelja 1 ispod trenutnog obima samo uz dugi na 150 min; K3 i K5 nula', () => {
      const s = res.st;
      expect(s.week1BelowNotTime).toBe(0);
      expect(s.buildNoQuality).toBe(0);
      expect([s.raceOverTaper, s.dropOutsideCapacity, s.hardAdjacent, s.longBelowEasy]).toEqual([
        0, 0, 0, 0
      ]);
      expect(s.plans).toBe(inputs.length);
    });

    it('determinizam: dva generisanja bajt-isto', () => {
      expect(res.nondeterministic).toEqual([]);
    });

    it('= bazna linija segment01.baseline.json (vrh, najduži dugi, heš plana)', () => {
      if (WRITE) {
        writeFileSync(BASELINE, `${JSON.stringify(res.rows, null, 2)}\n`);
        return;
      }
      const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, BaselineRow>;
      const want = Object.fromEntries(inputs.map((g) => [g.id, base[g.id]]));
      expect(res.rows).toEqual(want);
    });

    extra?.();
  });
}
