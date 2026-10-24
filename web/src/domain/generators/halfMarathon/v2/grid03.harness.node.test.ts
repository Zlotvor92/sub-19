/* Zajednički kod mreže 03 (HM-03): po osećaju (feelGrid.node.test.ts + delovi punog nivoa
   feelGrid.<k>.full.node.test.ts) i početnik (beginnerGrid.node.test.ts). Ime *.harness.node.test.ts: test kod
   (izolacija, tsconfig), vitest ga ne skuplja. Bazne linije: segment03-feel.baseline.json,
   segment03-beginner.baseline.json (pišu se samo uz TEST_FULL=1 i HM_V2_WRITE_BASELINE=1 nad celim skupom). */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { generateHmV2 } from './generate.ts';
import { mayChange, mayLower } from './grid.harness.node.test.ts';
import { checkPlan, emptyStats, type GridStats } from './gridInvariants.ts';
import { type Grid03Input, planHash } from './testInputs.ts';

const DIR = dirname(fileURLToPath(import.meta.url));
export const WRITE = process.env['HM_V2_WRITE_BASELINE'] === '1';
export const FEEL_PARTS = 3;

/** Red bazne linije: vrh cilja, najduži dugi, heš celog plana bez oznake verzije. */
export type BaselineRow = [peakKm: number, longestKm: number, hash: string];

interface Result {
  rejected: string[];
  errors: string[];
  bad: Record<string, string[]>;
  st: Record<number, GridStats>;
  rows: Record<string, BaselineRow>;
  nondeterministic: string[];
}

function run(inputs: readonly Grid03Input[], determinism: (i: number) => boolean): Result {
  const out: Result = {
    rejected: [],
    errors: [],
    bad: {},
    st: {},
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
    checkPlan(g.id, r.plan, out.bad, (out.st[g.days] ??= emptyStats()));
    const hash = planHash(r.plan);
    const longest = Math.max(
      ...r.plan.weeks.flatMap((w) =>
        w.days.filter((d) => d.role === 'long').map((d) => d.workout.km)
      )
    );
    out.rows[g.id] = [r.plan.peakKm, longest, hash];
    if (determinism(i)) {
      const again = generateHmV2(g.input);
      if (!again.ok || JSON.stringify(again.plan) !== JSON.stringify(r.plan))
        out.nondeterministic.push(g.id);
    }
  });
  return out;
}

/** Mreža 03 nad `inputs` (uzorak brzog nivoa ili deo punog). `kind` bira baznu liniju. */
export function describeGrid03(
  name: string,
  kind: 'feel' | 'beginner',
  inputs: readonly Grid03Input[],
  extra?: () => void
): void {
  const baseline = join(DIR, `segment03-${kind}.baseline.json`);
  describe(name, () => {
    let res: Result;
    beforeAll(() => {
      res = run(inputs, (i) => FULL || i % 4 === 0);
    }, 120_000);

    it('K1: 0 odbijanja i 0 grešaka validatora', () => {
      expect(inputs.length).toBeGreaterThan(0);
      expect(res.rejected).toEqual([]);
      expect(res.errors).toEqual([]);
    });

    it('nezavisne invarijante (H16 po osećaju i test, H17 početnik, Uslov 8, pouke 1–5, 9, 12, 28): 0 prekršaja', () => {
      expect(res.bad).toEqual({});
    });

    it('K2 (pouka 9): nedelja 1 ispod obima samo uz dugi na apsolutnom plafonu; K3 i K5 nula', () => {
      for (const s of Object.values(res.st)) {
        expect(s.week1BelowNotTime).toBe(0);
        expect(s.buildNoQuality).toBe(0);
        expect([s.raceOverTaper, s.dropOutsideCapacity, s.hardAdjacent, s.longBelowEasy]).toEqual([
          0, 0, 0, 0
        ]);
      }
    });

    it('determinizam: dva generisanja bajt-isto', () => {
      expect(res.nondeterministic).toEqual([]);
    });

    it(`= bazna linija segment03-${kind}.baseline.json (vrh, najduži dugi, heš plana)`, () => {
      if (WRITE) {
        writeFileSync(baseline, `${JSON.stringify(res.rows, null, 2)}\n`);
        return;
      }
      const base = JSON.parse(readFileSync(baseline, 'utf8')) as Record<string, BaselineRow>;
      // HM-04 A (OVER_LONG) i HM-07 (CHANGED_07): menjaju se samo planovi sa spiska izuzetaka; vrh ne pada.
      const changed = inputs.filter(
        (g) => JSON.stringify(res.rows[g.id]) !== JSON.stringify(base[g.id])
      );
      expect(changed.filter((g) => !mayChange(g.id)).map((g) => g.id)).toEqual([]);
      expect(
        changed
          .filter((g) => res.rows[g.id]![0] < base[g.id]![0] && !mayLower(g.id))
          .map((g) => g.id)
      ).toEqual([]);
    });

    extra?.();
  });
}
