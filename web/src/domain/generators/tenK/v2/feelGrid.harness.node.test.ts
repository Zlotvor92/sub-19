/* Mreža po osećaju 10K v2 (11 880 planova bez rezultata) — zajednički kod za feelGrid.node.test.ts i
   feelGrid.<k>.full.node.test.ts.

   - BRZ nivo: svi brojevi dana, deterministički uzorak (planGridSample: svaki 11. ulaz unutar dana × nedelje; 11 je
     uzajamno prost sa 36 = lagan tempo × raspored × trka); mreža nema imenovanih ulaza (izuzetaka po ulazu).
   - PUN nivo: delovi po broju dana (`part(DAYS, k, FEEL_PARTS)`; glavni fajl = deo 1) — sve brojke celog skupa su po
     broju dana, pa deo tvrdi svoj deo tabele (tačno), a unija delova = svih 11 880 planova. */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { DAYS, type Days, type Row, statsRow } from './gridInvariants.ts';
import { feelGridInputs, type GridCase } from './testInputs.ts';
import { FULL, logCompared } from '@/test/level';
import {
  hashesAgain,
  only,
  type PlanGrid,
  planGridSample,
  runPlanGrid,
  summaryBad
} from './planGrid.harness.node.test.ts';
import {
  expectByDays,
  GRID_TIMEOUT,
  missingParts,
  P35_PLANS,
  p08Errors
} from './level.harness.node.test.ts';

export const FEEL_PARTS = 4;
/** Brz nivo: svaki K-ti ulaz unutar (broj dana × nedelje). */
const K = 11;
const HERE = fileURLToPath(new URL('./', import.meta.url));
const BASELINE = `${HERE}segment03-feel.baseline.json`;
const HASHES_81 = `${HERE}segment03b.plan-hashes-81bd351.json`;
const HASHES_B13 = `${HERE}segment04.plan-hashes-b13ca17.json`;
/** Snimanje bazne linije (TEN_K_V2_WRITE_BASELINE=1): samo ceo skup — glavni fajl uz TEST_FULL=1. */
export const WRITE = process.env['TEN_K_V2_WRITE_BASELINE'] === '1';
type Baseline = { policyVersion: string; plans: Record<string, Row> };
const read = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T;
/** Broj planova po broju dana (ceo skup). */
const N: Record<Days, number> = { 3: 1980, 4: 2772, 5: 3168, 6: 3960 };

/** Ulazi koje računa brz nivo (uzorak) ili deo punog (`days`). */
export function feelCases(days: readonly Days[]): GridCase[] {
  const cases = days.flatMap((n) => feelGridInputs(n));
  return FULL ? cases : planGridSample(cases, K);
}

/** Describe mreže po osećaju za brojeve dana `days`; `extra` dodaje it-ove samo glavnog fajla (isti describe). */
export function describeFeelGrid(title: string, days: readonly Days[], extra?: () => void): void {
  describe(title, () => {
    let all: GridCase[] = [];
    let g: PlanGrid;
    let ids = new Set<string>();
    beforeAll(() => {
      if (WRITE && (!FULL || days.length !== DAYS.length))
        throw new Error('TEN_K_V2_WRITE_BASELINE: samo ceo skup (TEST_FULL=1, glavni fajl)');
      all = DAYS.flatMap((n) => feelGridInputs(n));
      g = runPlanGrid(feelCases(days));
      ids = new Set(g.cases.map((c) => c.id));
    }, GRID_TIMEOUT);
    /** `plans`: brojke su broj planova (brz nivo: „svi" ostaju svi, ≤ uzorak). */
    const byDays = (get: (n: Days) => unknown, table: readonly unknown[], plans = false): void =>
      expectByDays(
        DAYS,
        days,
        get,
        table,
        plans ? (n) => ({ got: g.stats[n].plans, full: N[n] }) : undefined
      );

    it('11 880 ulaza, 0 odbijanja, 0 grešaka validatora', () => {
      // Pun nivo: unija delova = ceo skup (svi fajlovi delova postoje).
      expect(missingParts(HERE, 'feelGrid', FEEL_PARTS)).toEqual([]);
      expect(all.length).toBe(11880);
      expect(DAYS.map((n) => feelGridInputs(n).length)).toEqual([1980, 2772, 3168, 3960]);
      expect(new Set(all.map((c) => c.id)).size).toBe(11880);
      expect(g.rejected.slice(0, 20)).toEqual([]);
      expect(g.errors).toEqual({});
    });

    it('deterministički: drugo generisanje daje bajt-isti rezultat', () => {
      expect(hashesAgain(g.cases)).toEqual(g.hashes);
    });

    it('invarijante (nezavisno od validatora): sve iz 02b + tačno 1 test (poslednja nedelja baze, dan Q1 / umesto kvaliteta rasterećenja), paceBasis feel, E = lagan ± 15 s, RPE, bez prognoze', () => {
      expect(summaryBad(g.bad)).toEqual({});
    });

    it('D27: test u rasterećenju; dugi skraćen da lagani ostanu ≥ 3 km (TEST_DELOAD_LONG); cilj nikad podignut', () => {
      byDays(
        (n) => [g.stats[n].testDeload, g.stats[n].testDeloadLong, g.stats[n].testDeloadUp],
        [
          // 10K-08 (T1): duži dugi izgradnje (za stvaran broj laganih dana) → češće skraćen dugi rasterećenja sa testom.
          // P8 (10k-v2.13.0, G1 sporiji rast dugog, G6): 144 / 72 / 36 / 36 → 144 / 114 / 18 / 36.
          [540, 144, 0],
          [756, 114, 0],
          [864, 18, 0],
          [1080, 36, 0]
        ]
      );
      byDays((n) => g.warned[`${n}:TEST_DELOAD_LONG`] ?? 0, [144, 114, 18, 36]);
    });

    it('brojke po broju dana (izveštaj): CAPACITY_LIMITED, ponavljanja, vrh/start, odstupanja; ned 1 ispod obima (105 min / udeo), D25, DOSE_DROPPED (od toga udeo)', () => {
      const table = [
        // 10K-08 (T1): CAPACITY_LIMITED 864 / 1350 / 930 / 846 → 1128 / 2046 / 1398 / 1404, vrh/start niži.
        // P3 (10k-v2.11.0, D33/D34): CAPACITY_LIMITED 1128 / 2046 / 1398 / 1404 → 1122 / 2010 / 1398 / 1362, taper samo RP
        // 0 / 18 / 18 / 180 → 0 / 18 / 54 / 216, vrh/start.
        // P5 (10k-v2.12.0, D36/D37): CAPACITY_LIMITED 1122 / 2010 / 1398 / 1362 → 1104 / 1884 / 1314 / 1266, ponavljanja
        // (kolona 2) 384 / 96 / 0 / 0 → 384 / 96 / 126 / 240, taper samo RP 0 / 18 / 54 / 216 → 0 / 18 / 54 / 252, vrh/start.
        // P8 (10k-v2.13.0, G1–G8): CAPACITY_LIMITED 1104 / 1884 / 1314 / 1266 → 1014 / 2160 / 1224 / 1116, ponavljanja
        // 384 / 96 / 126 / 240 → 432 / 342 / 132 / 240, vrh/start 1,188 / 1,163 / 1,237 / 1,216 → 1,164 / 1,098 / 1,163 / 1,102
        // (G1a), rasterećenje bez kvaliteta 288 → 0 i taper bez kvaliteta 36 → 0 (G2), taper samo RP 0 / 18 / 54 / 252 →
        // 0 / 84 / 120 / 312.
        // P9b (10k-v2.14.0, D52: planovi od 9–11 nedelja dobijaju test u prvoj nedelji razvoja ≥ 4): CAPACITY_LIMITED
        // 1014 / 2160 / 1224 / 1116 → 1014 / 2166 / 1230 / 1104, ponavljanja 432 / 342 → 456 / 288 (3 / 4 dana), vrh/start
        // 1,164 / 1,098 → 1,169 / 1,097, taper samo RP 84 / 120 / 312 → 84 / 114 / 306.
        // K3-A (10k-v2.15.0, opseg rada I/RP): CAPACITY_LIMITED 2166 / 1230 → 2004 / 1194 (4 / 5 dana), ponavljanja
        // 288 / 132 / 240 → 546 / 288 / 426 (I 5 × 1000 m nema drugu strukturu), vrh/start 1,097 → 1,099, taper samo RP
        // 84 / 114 / 306 → 90 / 258 / 372 (veći RP specifične faze).
        [1980, 1014, 456, 1.169, 0, 0, 0, 0],
        [2772, 2004, 546, 1.099, 0, 90, 0, 0],
        [3168, 1194, 288, 1.163, 0, 258, 0, 0],
        [3960, 1104, 426, 1.102, 0, 372, 0, 0]
      ];
      // Brz nivo: prosek vrh/start (kolona 3) nije brojka uzorka — ne poredi se (planovi uzorka su bajt-isti 81bd351).
      const row = (n: Days): number[] => statsRow(g.stats[n]);
      if (FULL) byDays(row, table);
      else
        byDays(
          (n) => row(n).filter((_, i) => i !== 3),
          table.map((r) => r.filter((_, i) => i !== 3))
        );
      byDays(
        (n) => {
          const s = g.stats[n];
          return [s.belowTime, s.belowShare, s.longShorter, s.doseDropped, s.doseDroppedShare];
        },
        // 06f (pouka 35): D25 (kolona 3) 0 / 78 / 78 / 132 → 0 / 36 / 24 / 78 planova. 10K-07 (F3): D25 obuhvata i dan
        // testa → 144 / 228 / 204 / 294.
        [
          // 10K-08 (T1): ned 1 ispod obima i uz udeo D17 (lagan ≤ 0,8 × dugi).
          // P3 (10k-v2.11.0, D33): DOSE_DROPPED (kolona 4) 84 / 276 / 42 / 0 → 84 / 258 / 0 / 0.
          // P5 (D37): ned 1 ispod obima (udeo) 1518 → 1386 (4 d), 660 → 594 (5 d); DOSE_DROPPED 258 / 0 / 0 → 444 / 210 / 72.
          // P8 (G6 lagan ≤ 0,70 × dugi za 4+ dana, G1, G4): ned 1 ispod obima (udeo) 1386 → 1782 (4 d), uz 105 min 594 → 858
          // (5 d), 792 → 1056 (6 d); DOSE_DROPPED 84 / 444 / 210 / 72 → 96 / 672 / 0 / 0.
          // P9b (D52, test u prvoj nedelji razvoja planova od 9–11 nedelja): DOSE_DROPPED 96 / 672 → 84 / 588 (3 / 4 dana),
          // od toga udeo (4 dana) 444 → 378.
          // K3-A (10k-v2.15.0): DOSE_DROPPED (4 dana) 588 → 522, od toga udeo 378 → 354; D25 (6 dana) 264 → 342.
          [462, 132, 114, 84, 0],
          [0, 1782, 270, 522, 354],
          [858, 0, 144, 0, 0],
          [1056, 0, 342, 0, 0]
        ]
      );
    });

    it('generisanje daje TAČNO baznu liniju segment03-feel.baseline.json', () => {
      if (WRITE)
        writeFileSync(
          BASELINE,
          JSON.stringify({ policyVersion: '10k-v2.3.0', plans: g.rows }) + '\n'
        );
      const base = read<Baseline>(BASELINE);
      expect(base.policyVersion).toBe('10k-v2.3.0');
      expect(Object.keys(base.plans).length).toBe(11880);
      expect(Object.keys(base.plans).sort()).toEqual(all.map((c) => c.id).sort());
      logCompared('tenK.v2.segment03-feel.baseline', Object.keys(g.rows));
      // 06f (pouka 35): planovi sa nedeljom pouke 35 na 7ba9717 se menjaju (p35.node.test.ts); ostali tačno.
      const keep = new Set([...ids].filter((id) => !P35_PLANS.has(id)));
      expect(only(g.rows, keep)).toEqual(only(base.plans, keep));
    });

    it('10K-08: planovi promenjeni prema b9c4728 (segment08.changed-b9c4728.json) imaju drugi heš; ostale porede starije regresije', () => {
      expect(
        p08Errors(
          'gen',
          Object.entries(g.h81now).map(([key, hash]) => ({ key, hash })),
          true
        ).slice(0, 10)
      ).toEqual([]);
    });

    it('regresija 03b: ceo plan po osećaju bajt-isti kao 81bd351 (heš bez oznake verzije) za svih 11 880', () => {
      const fx = read<{ against: string; feel: Record<string, number> }>(HASHES_81);
      expect(fx.against).toBe('81bd351');
      expect(Object.keys(fx.feel).sort()).toEqual(all.map((c) => c.id).sort());
      expect(Object.keys(g.h81).sort()).toEqual([...ids].sort());
      logCompared('tenK.v2.81bd351.feel', Object.keys(g.h81));
      // 06f (pouka 35): menjaju se tačno planovi sa nedeljom pouke 35 na 7ba9717; 10K-07: i planovi sa uzrokom cause07
      // (posle undo07), ostali bajt-isti.
      const no07 = (id: string): boolean => !g.c07[id];
      expect(Object.keys(g.h81).filter((id) => g.h81[id] !== fx.feel[id] && no07(id))).toEqual(
        Object.keys(g.h81).filter((id) => P35_PLANS.has(id) && no07(id))
      );
    });
    it('regresija 04: generate = construct(input, []) — ceo plan po osećaju bajt-isti kao b13ca17 (heš bez oznake verzije) za svih 11880', () => {
      const fx = read<{ against: string; feel: Record<string, number> }>(HASHES_B13);
      expect(fx.against).toBe('b13ca17');
      expect(Object.keys(fx.feel).sort()).toEqual(all.map((c) => c.id).sort());
      expect(Object.keys(g.h81).sort()).toEqual([...ids].sort());
      logCompared('tenK.v2.b13ca17.feel', Object.keys(g.h81));
      // 06f (pouka 35): menjaju se tačno planovi sa nedeljom pouke 35 na 7ba9717; 10K-07: i planovi sa uzrokom cause07
      // (posle undo07), ostali bajt-isti.
      const no07 = (id: string): boolean => !g.c07[id];
      expect(Object.keys(g.h81).filter((id) => g.h81[id] !== fx.feel[id] && no07(id))).toEqual(
        Object.keys(g.h81).filter((id) => P35_PLANS.has(id) && no07(id))
      );
    });

    extra?.();
  });
}
