/* Zajednički kod mreže 02 (glavni fajl grid.node.test.ts i delovi punog nivoa grid.<k>.full.node.test.ts).
   Ime *.harness.node.test.ts: test kod (izolacija, tsconfig), vitest ga ne skuplja. */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { generateHmV2 } from './generate.ts';
import { checkPlan, emptyStats, type GridStats, rollingBinds } from './gridInvariants.ts';
import { type GridInput, planHash, planHashNorm } from './testInputs.ts';

const DIR = dirname(fileURLToPath(import.meta.url));
export const BASELINE = join(DIR, 'segment02.baseline.json');
/** HM-01 (3979237): vrh, najduži dugi, heš plana (mreža 01 = 4 dana mreže 02, id bez `d4-`). */
const BASELINE_01 = join(DIR, 'segment01.baseline.json');
/** HM-01 (3979237): normalizovani heš (testInputs.planHashNorm), artifacts/segment-02/norm-hashes-3979237.ts. */
const NORM_01 = join(DIR, 'segment01.norm-hashes-3979237.json');
export const WRITE = process.env['HM_V2_WRITE_BASELINE'] === '1';
export const GRID_PARTS = 4;
/** HM-04 A (pouka 32, hm-v2.2.1): planovi mreža 02, r (`r-…`), 03 po osećaju i početnik koji su na 5e09a02
    imali bar jednu nedelju sa kvalitetnim danom (ili danom testa) dužim od dugog — JEDINI koji smeju da se
    promene prema baznim linijama (docs/hm-v2/artifacts/segment-03b/measure-32.ts i compare-32.ts). */
export const OVER_LONG = new Set(
  JSON.parse(readFileSync(join(DIR, 'segment03b.over-long-5e09a02.json'), 'utf8')) as string[]
);

/** HM-07 (hm-v2.4.0, Faza 4a): planovi čiji se rezultat menja prema f4b257d, sa klasom — a pouka 35, b pod RP (N6),
    d samo napomene/upozorenja (N9, N10.1, N11); mreže 02, 03 i pouke 28 (`r-`). Izvor:
    docs/hm-v2/artifacts/segment-07/regress.ts, compare.ts, changed07.ts. */
export const CHANGED_07 = new Map(
  Object.entries(
    JSON.parse(readFileSync(join(DIR, 'segment07.changed-f4b257d.json'), 'utf8')) as Record<
      string,
      string
    >
  )
);
/** HM-09 (hm-v2.7.0): planovi čiji se rezultat menja prema c13c258, sa klasom — a taper/trkačka nedelja (pouka 35
    u taperu), d samo tekst napomena (uvod početnika, napomena tapera „najmanja doza"). Izvor:
    docs/hm-v2/artifacts/segment-09/changed09.ts. */
export const CHANGED_09 = new Map(
  Object.entries(
    JSON.parse(readFileSync(join(DIR, 'segment09.changed-c13c258.json'), 'utf8')) as Record<
      string,
      string
    >
  )
);
/** HM-10 (hm-v2.8.0, krug T): planovi čiji se rezultat menja prema b9c4728, sa klasom — l T1 (lagan ≤ 0,8 × dugi,
    ≥ 20 min; manje laganih dana; spuštena nedelja i posledice), m T1 (lagan na granici 20 min), r T1 → odbijanje
    RECENT_LONG_TOO_SHORT sa pragom, p T7 (skorašnji najduži > nedeljni obim), d samo tekst, x drugo (3 plana, u
    izveštaju). Izvor: docs/hm-v2/artifacts/segment-10/changed10.ts. */
export const CHANGED_10 = new Map(
  Object.entries(
    JSON.parse(readFileSync(join(DIR, 'segment10.changed-b9c4728.json'), 'utf8')) as Record<
      string,
      string
    >
  )
);
/** Plan sme da se promeni prema baznim linijama: HM-04 A (pouka 32), HM-07, HM-09 ili HM-10. */
export const mayChange = (id: string): boolean =>
  OVER_LONG.has(id) || CHANGED_07.has(id) || CHANGED_09.has(id) || CHANGED_10.has(id);
/** HM-10 (T1): vrh sme da padne — namerno manji obim kad lagani ne staju u granice T1. */
export const mayLower = (id: string): boolean => ['l', 'm', 'x'].includes(CHANGED_10.get(id) ?? '');

/** Red bazne linije: vrh cilja, najduži dugi, heš celog plana bez oznake verzije (regresija sledećeg segmenta). */
export type BaselineRow = [peakKm: number, longestKm: number, hash: string];

interface Result {
  rejected: string[];
  errors: string[];
  bad: Record<string, string[]>;
  st: Record<number, GridStats>;
  rows: Record<string, BaselineRow>;
  norm: Record<string, string>;
  /** Pouka 28 seče dugi u planu (nezavisna provera). */
  rolling: Set<string>;
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
    st: {},
    rows: {},
    norm: {},
    rolling: new Set(),
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
    if (g.days === 4) out.norm[g.id] = planHashNorm(r.plan);
    if (rollingBinds(r.plan)) out.rolling.add(g.id);
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

/** Mreža 02 nad `inputs` (uzorak brzog nivoa ili deo punog). */
export function describeGrid(name: string, inputs: readonly GridInput[], extra?: () => void): void {
  describe(name, () => {
    let res: Result;
    beforeAll(() => {
      res = run(inputs, (_, i) => FULL || i % 4 === 0);
    }, 120_000);

    it('K1: 0 odbijanja i 0 grešaka validatora (ulazi u opsegu H1/H15)', () => {
      expect(inputs.length).toBeGreaterThan(0);
      expect(res.rejected).toEqual([]);
      expect(res.errors).toEqual([]);
    });

    it('nezavisne invarijante (Uslov 8, pouke 1–5, 9, 12, 28; H13 24 km; H15 po danima): 0 prekršaja', () => {
      expect(res.bad).toEqual({});
    });

    it('K2 (pouka 9, HI8): nedelja 1 ispod obima samo uz dugi na apsolutnom plafonu; K3 i K5 nula', () => {
      for (const s of Object.values(res.st)) {
        expect(s.week1BelowNotTime).toBe(0);
        expect(s.buildNoQuality).toBe(0);
        expect([s.raceOverTaper, s.dropOutsideCapacity, s.hardAdjacent, s.longBelowEasy]).toEqual([
          0, 0, 0, 0
        ]);
      }
      expect(Object.values(res.st).reduce((a, s) => a + s.plans, 0)).toBe(inputs.length);
    });

    it('determinizam: dva generisanja bajt-isto', () => {
      expect(res.nondeterministic).toEqual([]);
    });

    it('regresija 4 dana prema HM-01 (3979237): menja se samo plan sa dugim > 24 km ili gde pouka 28 seče dugi; vrh ne pada (K4 0)', () => {
      const base = JSON.parse(readFileSync(BASELINE_01, 'utf8')) as Record<string, BaselineRow>;
      const norm = JSON.parse(readFileSync(NORM_01, 'utf8')) as Record<string, string>;
      const other: string[] = [];
      const lower: string[] = [];
      let changed = 0;
      for (const g of inputs.filter((x) => x.days === 4)) {
        const id = g.id.slice(3);
        const old = base[id]!;
        const now = res.rows[g.id]!;
        if (now[0] < old[0] && !mayLower(g.id)) lower.push(`${g.id}: ${old[0]} → ${now[0]}`);
        if (res.norm[g.id] === norm[id]) continue;
        changed++;
        // Dozvoljeni uzroci promene: dugi > 24 km u HM-01, sada na 24 km (prompt HM-02, tačka 2); kotrljajuća
        // granica pouke 28 seče dugi (odluka organizatora posle MAR-02); HM-04 A: plan je imao kvalitetni dan
        // duži od dugog (pouka 32).
        if (!((old[1] > 24 && now[1] === 24) || res.rolling.has(g.id) || mayChange(g.id)))
          other.push(`${g.id}: ${old[1]} → ${now[1]}`);
      }
      expect(other).toEqual([]);
      expect(lower).toEqual([]);
      expect(changed).toBeGreaterThan(0);
      // Svaki plan sa dugim > 24 km ili pouke 28 (van pouke 32) i dalje promenjen kao u HM-02.
      expect(
        inputs.filter(
          (x) =>
            x.days === 4 &&
            !mayChange(x.id) &&
            (base[x.id.slice(3)]![1] > 24 || res.rolling.has(x.id)) &&
            res.norm[x.id] === norm[x.id.slice(3)]
        )
      ).toEqual([]);
    });

    it('= bazna linija segment02.baseline.json (vrh, najduži dugi, heš plana)', () => {
      if (WRITE) {
        writeFileSync(BASELINE, `${JSON.stringify(res.rows, null, 2)}\n`);
        return;
      }
      const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, BaselineRow>;
      // HM-04 A: menja se samo plan sa kvalitetnim danom dužim od dugog na 5e09a02 (OVER_LONG); HM-07: plan iz
      // CHANGED_07 (pouka 35, N6, upozorenja); vrh ne pada.
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
