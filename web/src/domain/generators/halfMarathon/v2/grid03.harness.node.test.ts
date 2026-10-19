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
import { checkPlan, emptyStats, type GridStats } from './gridInvariants.ts';
import { type Grid03Input, planHash } from './testInputs.ts';

const DIR = dirname(fileURLToPath(import.meta.url));
export const WRITE = process.env['HM_V2_WRITE_BASELINE'] === '1';
export const FEEL_PARTS = 3;

/** Red bazne linije: vrh cilja, najduži dugi, heš celog plana bez oznake verzije. */
export type BaselineRow = [peakKm: number, longestKm: number, hash: string];

/**
 * ZAUSTAVLJENO (docs/hm-v2/reports/SEGMENT-03-STOP.md): početnik pri najmanjem obimu — prvo rasterećenje
 * (0,8 × cilja) ne nosi dugi 0,8 × poslednjeg + lagane ≥ 4 km (H5 × H13 × H17). Izmereno na mreži početnika:
 * 426 / 1890 odbijanja WEEK_INFEASIBLE u prvoj rasteretnoj nedelji — 4 dana 20 km i 5 dana 25 km (svi tempi),
 * 4 dana 25 km uz lagan 5:30 i VDOT 40 (13–20 ned). Test do odluke organizatora dozvoljava TAČNO ova odbijanja.
 */
export function stopRejection(g: Grid03Input): boolean {
  return (
    (g.days === 4 && g.km === 20) ||
    (g.days === 5 && g.km === 25) ||
    (g.days === 4 && g.km === 25 && g.weeks > 12 && (g.easy === 330 || g.vdot === 40))
  );
}

interface Result {
  rejected: string[];
  stopRejected: string[];
  errors: string[];
  bad: Record<string, string[]>;
  st: Record<number, GridStats>;
  rows: Record<string, BaselineRow>;
  nondeterministic: string[];
}

function run(
  inputs: readonly Grid03Input[],
  determinism: (i: number) => boolean,
  stop: (g: Grid03Input) => boolean
): Result {
  const out: Result = {
    rejected: [],
    stopRejected: [],
    errors: [],
    bad: {},
    st: {},
    rows: {},
    nondeterministic: []
  };
  inputs.forEach((g, i) => {
    const r = generateHmV2(g.input);
    if (!r.ok) {
      const first = r.reasons[0]!;
      if (stop(g) && first.code === 'WEEK_INFEASIBLE') out.stopRejected.push(g.id);
      else out.rejected.push(`${g.id}: ${r.reasons.map((x) => x.message).join(' | ')}`);
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

/** Mreža 03 nad `inputs` (uzorak brzog nivoa ili deo punog). `kind` bira baznu liniju i dozvoljena
    odbijanja (početnik: samo sudar iz stopRejection). */
export function describeGrid03(
  name: string,
  kind: 'feel' | 'beginner',
  inputs: readonly Grid03Input[],
  extra?: () => void
): void {
  const baseline = join(DIR, `segment03-${kind}.baseline.json`);
  const stop = kind === 'beginner' ? stopRejection : () => false;
  describe(name, () => {
    let res: Result;
    beforeAll(() => {
      res = run(inputs, (i) => FULL || i % 4 === 0, stop);
    }, 120_000);

    it('K1: 0 odbijanja van sudara i 0 grešaka validatora', () => {
      expect(inputs.length).toBeGreaterThan(0);
      expect(res.rejected).toEqual([]);
      expect(res.errors).toEqual([]);
      // Sudar (početnik): odbijeni su TAČNO ulazi iz stopRejection, nijedan drugi.
      expect(res.stopRejected).toEqual(inputs.filter(stop).map((g) => g.id));
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
      const want = Object.fromEntries(
        inputs.filter((g) => !stop(g)).map((g) => [g.id, base[g.id]])
      );
      expect(res.rows).toEqual(want);
    });

    extra?.();
  });
}
