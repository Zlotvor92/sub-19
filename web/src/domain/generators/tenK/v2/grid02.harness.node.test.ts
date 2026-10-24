/* Mreža 02 10K v2 (planovi sa rezultatom, 15 840) — zajednički kod za grid.node.test.ts i grid.<k>.full.node.test.ts.

   - BRZ nivo: svi brojevi dana, deterministički uzorak (planGridSample: svaki 11. ulaz unutar dana × nedelje; 11 je
     uzajamno prost sa 48 = VDOT × raspored × trka) + imenovani: 12 planova sa vrhom nižim od 49ad476, 108 izuzetaka
     regresije 21c03f1 (segment03.regression-exceptions.json) i 96 planova sa RACE_WEEK_SHORT u 21c03f1 (uzrok D30b).
   - PUN nivo: delovi po broju dana (`part(DAYS, k, GRID02_PARTS)`; glavni fajl = deo 1) — sve brojke celog skupa su po
     broju dana, pa deo tvrdi svoj deo tabele (tačno), a unija delova = svih 15 840 planova. */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { DAYS, type Days, type Row, statsRow } from './gridInvariants.ts';
import { type GridCase, grid02Inputs, planHashes21 } from './testInputs.ts';
import type { TenKV2Plan } from './types.ts';
import { repsOf } from './workouts.ts';
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
  CHANGED_08,
  P35_PLANS,
  p08Errors,
  sumOf
} from './level.harness.node.test.ts';

export const GRID02_PARTS = 4;
/** Brz nivo: svaki K-ti ulaz unutar (broj dana × nedelje). */
const K = 11;
const HERE = fileURLToPath(new URL('./', import.meta.url));
const BASELINE = `${HERE}segment03.baseline.json`;
const BASELINE_21 = `${HERE}segment02b.baseline.json`;
const BASELINE_49 = `${HERE}segment02.baseline.json`;
const HASHES_21 = `${HERE}segment03.plan-hashes-21c03f1.json`;
const EXCEPTIONS = `${HERE}segment03.regression-exceptions.json`;
const HASHES_81 = `${HERE}segment03b.plan-hashes-81bd351.json`;
const HASHES_B13 = `${HERE}segment04.plan-hashes-b13ca17.json`;
const EPS = 1e-9;
/** Snimanje baznih linija (TEN_K_V2_WRITE_BASELINE=1): samo ceo skup — glavni fajl uz TEST_FULL=1. */
export const WRITE = process.env['TEN_K_V2_WRITE_BASELINE'] === '1';

type Baseline = { policyVersion: string; plans: Record<string, Row> };
type Exceptions = {
  against: string;
  reasons: Record<string, string>;
  plans: Record<string, string>;
};
type Hashes21 = { against: string; plans: Record<string, [number, number, number]> };
const read = <T>(f: string): T => JSON.parse(readFileSync(f, 'utf8')) as T;
/** 06f: uzrok promene prema 21c03f1 na 7ba9717 za planove pouke 35 (segment06f.p35-plans-7ba9717.json). */
const P35_CAUSE21 = read<{ cause21: Record<string, string> }>(
  `${HERE}segment06f.p35-plans-7ba9717.json`
).cause21;

/** Broj planova po broju dana (ceo skup). */
const N: Record<Days, number> = { 3: 2640, 4: 3696, 5: 4224, 6: 5280 };
/** Vrh cilja niži od 49ad476: 12 planova, svi 3 dana (tabela po broju dana; zbir = 12). */
const LOWER_49: Record<Days, number> = { 3: 12, 4: 0, 5: 0, 6: 0 };
const LOWER_49_SET = ['d3-17w-30km-v35: 35.6 → 35.2', 'd3-18w-30km-v35: 35.6 → 35.2'];
const isLower49 = (id: string): boolean => /^d3-1[78]w-30km-v35-[ABC]-(sat|sun)$/.test(id);

/** D30a marker u NOVOM planu: RP deonica < 1000 m (10k-v2.2.1 ih nije imao, D22b). */
const rpBelow1000 = (p: TenKV2Plan): boolean =>
  p.weeks.some((w) =>
    w.days.some((d) => {
      const s = d.workout.dose?.zone === 'RP' ? d.workout.dose.structure : null;
      return !!s && repsOf(s).some((m) => m < 1000);
    })
  );

/** Ulazi koje računa brz nivo (svi dani) ili deo punog (`days`). */
export function grid02Cases(days: readonly Days[]): GridCase[] {
  const cases = days.flatMap((n) => grid02Inputs(n));
  if (FULL) return cases;
  const named = new Set([
    ...Object.keys(read<Exceptions>(EXCEPTIONS).plans),
    ...Object.entries(read<Hashes21>(HASHES_21).plans)
      .filter(([, h]) => h[2] === 1)
      .map(([id]) => id)
  ]);
  return planGridSample(cases, K, (c) => isLower49(c.id) || named.has(c.id));
}

/**
 * Describe mreže 02 za brojeve dana `days` (brz: svi, uzorak; pun: deo). `extra` dodaje it-ove samo glavnog fajla
 * (isti describe).
 */
export function describeGrid02(title: string, days: readonly Days[], extra?: () => void): void {
  describe(title, () => {
    let all: GridCase[] = [];
    let g: PlanGrid;
    let ids = new Set<string>();
    const reg: Record<
      string,
      { days: Days; h: [number, number]; rp800: boolean; capacity: boolean; rws: boolean }
    > = {};
    beforeAll(() => {
      if (WRITE && (!FULL || days.length !== DAYS.length))
        throw new Error('TEN_K_V2_WRITE_BASELINE: samo ceo skup (TEST_FULL=1, glavni fajl)');
      all = DAYS.flatMap((n) => grid02Inputs(n));
      g = runPlanGrid(grid02Cases(days), (c, plan, r) => {
        reg[c.id] = {
          days: c.days as Days,
          h: planHashes21(r),
          rp800: rpBelow1000(plan),
          capacity: plan.warnings.some((x) => x.rule === 'CAPACITY_LIMITED'),
          rws: plan.warnings.some((x) => x.rule === 'RACE_WEEK_SHORT')
        };
      });
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

    it('15 840 ulaza, 0 odbijanja, 0 grešaka validatora (BASE_PLATEAU 0)', () => {
      // Pun nivo: unija delova = ceo skup (svi fajlovi delova postoje).
      expect(missingParts(HERE, 'grid', GRID02_PARTS)).toEqual([]);
      expect(all.length).toBe(15840);
      expect(DAYS.map((n) => grid02Inputs(n).length)).toEqual([2640, 3696, 4224, 5280]);
      expect(new Set(all.map((c) => c.id)).size).toBe(15840);
      expect(g.rejected.slice(0, 20)).toEqual([]);
      expect(g.errors).toEqual({});
    });

    it('deterministički: drugo generisanje daje bajt-isti rezultat', () => {
      expect(hashesAgain(g.cases)).toEqual(g.hashes);
    });

    it('invarijante (nezavisno od validatora): sve iz 02b + T ≥ 1000 m i RP ≥ 800 m (D30a), trkačka + trka ≥ minimum (D30b), 0 testova, paceBasis result, bez RPE', () => {
      expect(summaryBad(g.bad)).toEqual({});
    });

    it('D30a: ponavljanje slota 1224 / 192 / 144 / 144 → 240 / 48 / 0 / 0 nedelja (organizator na 21c03f1: isto)', () => {
      // 10K-08 (T1): 240 / 48 / 0 / 0 → 456 / 42 / 0 / 0.
      byDays((n) => g.stats[n].repeats, [456, 42, 0, 0]);
    });

    it('D30b: RACE_WEEK_SHORT 6 + 90 → 0 (trkačka + trka 10 km ≥ minimum nedelje)', () => {
      expect(days.map((n) => g.stats[n].raceShort)).toEqual(days.map(() => 0));
      expect(Object.values(reg).filter((x) => x.rws).length).toBe(0);
    });

    it('bez promene od 21c03f1: ned 1 ispod obima samo uz 105 min, trkačka ≤ taper (lagan u km), D25, DOSE_DROPPED', () => {
      // 10K-08 (T1, lagan ≤ 0,8 × dugi): ned 1 ispod obima 330 / 660 / 264 / 264 → nove brojke; ispod obima i uz udeo D17.
      byDays((n) => g.stats[n].belowTime, [396, 0, 660, 660]);
      // 02b: ned 1 ispod obima i DOSE_DROPPED SAMO uz dugi na 105 min (nikad samo na udelu D17); 10K-08 (T1): i uz udeo.
      byDays(
        (n) => [g.stats[n].belowShare, g.stats[n].doseDroppedShare],
        [
          [132, 0],
          [1518, 168],
          [0, 0],
          [0, 0]
        ]
      );
      byDays((n) => g.stats[n].raceKmEasy, [636, 1470, 2004, 2538]);
      // 06f (pouka 35): D25 0 / 132 / 132 / 330 → 0 / 0 / 0 / 132 planova (drugi dan kvaliteta lagan, dugi raste).
      byDays((n) => g.stats[n].longShorter, [0, 0, 0, 132]);
      // 10K-08 (T1): DOSE_DROPPED 0 / 162 / 0 / 0 → 84 / 432 / 24 / 258.
      byDays((n) => g.stats[n].doseDropped, [84, 432, 24, 258]);
    });

    it('brojke po broju dana (izveštaj): CAPACITY_LIMITED, ponavljanja, vrh/start, odstupanja', () => {
      // 10k-v2.2.1: [2640, 828, 1224, 1.258, 528, 0, 48, 6], [3696, 1320, 192, 1.25, …],
      // [4224, 810, 144, 1.279, …], [5280, 732, 144, 1.25, 0, 6, 0, 90].
      const table = [
        // 10K-08 (T1): CAPACITY_LIMITED 828 / 1320 / 810 / 732 → 1056 / 2106 / 1302 / 1326, vrh/start niži, D25 (kolona 5).
        [2640, 1056, 456, 1.225, 528, 0, 48, 0],
        [3696, 2106, 42, 1.208, 0, 96, 0, 0],
        [4224, 1302, 0, 1.254, 0, 222, 0, 0],
        [5280, 1326, 0, 1.228, 0, 450, 0, 0]
      ];
      // Brz nivo: prosek vrh/start (kolona 3) nije brojka uzorka — ne poredi se (planovi uzorka su bajt-isti 81bd351).
      const row = (n: Days): number[] => statsRow(g.stats[n]);
      if (FULL) byDays(row, table);
      else
        byDays(
          (n) => row(n).filter((_, i) => i !== 3),
          table.map((r) => r.filter((_, i) => i !== 3))
        );
    });

    it('kratka priprema (D21): 8 ned BBDDSSTR, 9 ned BBDDDSSTR, tačno jedno rasterećenje (ned 4)', () => {
      for (const [id, row] of Object.entries(g.rows)) {
        if (id.includes('-8w-')) expect([row[4], row[5]], id).toEqual(['BBDDSSTR', [4]]);
        if (id.includes('-9w-')) expect([row[4], row[5]], id).toEqual(['BBDDDSSTR', [4]]);
      }
    });

    it('generisanje daje TAČNO baznu liniju segment03.baseline.json', () => {
      if (WRITE)
        writeFileSync(
          BASELINE,
          JSON.stringify({ policyVersion: '10k-v2.3.0', plans: g.rows }) + '\n'
        );
      const base = read<Baseline>(BASELINE);
      expect(base.policyVersion).toBe('10k-v2.3.0');
      expect(Object.keys(base.plans).length).toBe(15840);
      expect(Object.keys(base.plans).sort()).toEqual(all.map((c) => c.id).sort());
      logCompared('tenK.v2.segment03.baseline', Object.keys(g.rows));
      // 06f (pouka 35): planovi sa nedeljom pouke 35 na 7ba9717 se menjaju (p35.node.test.ts); ostali tačno.
      const keep = new Set([...ids].filter((id) => !P35_PLANS.has(id)));
      expect(only(g.rows, keep)).toEqual(only(base.plans, keep));
    });

    it('regresija (pouka 1): vrh cilj i vrh planirano ≥ 21c03f1 za svih 15 840; niže samo uz razlog iz fajla, koji se proverava', () => {
      const old = read<Baseline>(BASELINE_21);
      expect(old.policyVersion).toBe('10k-v2.2.1');
      expect(Object.keys(old.plans).length).toBe(15840);
      const mine = only(old.plans, ids);
      logCompared('tenK.v2.segment02b.baseline', Object.keys(mine));
      const lower: Record<string, string> = {};
      for (const [id, r0] of Object.entries(mine)) {
        const r = g.rows[id]!;
        if (r[0] >= r0[0] && r[1] >= r0[1]) continue;
        // 06f (pouka 35): vrh cilja isti ili viši, planirano u okviru zaokruživanja (p35.node.test.ts).
        if (P35_PLANS.has(id) && r[0] >= r0[0] && r0[1] - r[1] <= 0.1 + EPS) continue;
        // ROUNDING: isti vrh cilja, planirano niže u okviru tolerancije 0,1 km (druga RP struktura, D30a).
        lower[id] = r[0] < r0[0] ? 'PEAK_LOWER' : 'ROUNDING';
      }
      if (WRITE) {
        const ex = read<Exceptions>(EXCEPTIONS);
        writeFileSync(EXCEPTIONS, JSON.stringify({ ...ex, plans: lower }) + '\n');
      }
      const ex = read<Exceptions>(EXCEPTIONS);
      expect(ex.against).toBe('21c03f1');
      expect(Object.keys(ex.reasons)).toEqual(['ROUNDING']);
      expect(only(ex.plans, ids)).toEqual(lower);
      const why = Object.entries(lower).filter(([id, reason]) => {
        const [r0, r] = [old.plans[id]!, g.rows[id]!];
        return (
          reason !== 'ROUNDING' || r[0] !== r0[0] || r0[1] - r[1] > 0.1 + EPS || !reg[id]!.rp800
        );
      });
      expect(why).toEqual([]);
      const count = (n: Days): number =>
        Object.keys(lower).filter((id) => reg[id]!.days === n).length;
      byDays(count, [108, 0, 0, 0]);
      // Vrh cilja viši od 21c03f1 (D30a: druga RP struktura nosi kapacitet).
      const higher = (n: Days): number =>
        Object.entries(mine).filter(([id, r0]) => reg[id]!.days === n && g.rows[id]![0] > r0[0])
          .length;
      byDays(higher, [120, 126, 0, 0]);
    });

    it('vrh cilja niži od 49ad476: 258 → 12 (3 dana, 30 km, VDOT 35, 17–18 ned: 35,6 → 35,2)', () => {
      const old = read<Baseline>(BASELINE_49);
      expect(old.policyVersion).toBe('10k-v2.2.0');
      expect(sumOf(LOWER_49, ['3', '4', '5', '6'])).toBe(12);
      const mine = only(old.plans, ids);
      logCompared('tenK.v2.segment02.baseline', Object.keys(mine));
      const lower = Object.entries(mine)
        .filter(([id, r0]) => g.rows[id]![0] < r0[0])
        .map(([id, r0]) => `${id.replace(/-[ABC]-(sat|sun)$/, '')}: ${r0[0]} → ${g.rows[id]![0]}`);
      // Brz nivo: svih 12 je imenovano u uzorku → isto kao pun.
      expect(lower.length).toBe(sumOf(LOWER_49, days.map(String)));
      expect([...new Set(lower)]).toEqual(
        LOWER_49_SET.filter((x) => days.some((n) => x.startsWith(`d${n}-`)))
      );
    });

    it('regresija: ceo plan isti kao 21c03f1 (bez oznake verzije i podrazumevanih novih polja) ili promenjen SAMO od D30a ili D30b', () => {
      const fx = read<Hashes21>(HASHES_21);
      expect(fx.against).toBe('21c03f1');
      expect(Object.keys(fx.plans).sort()).toEqual(all.map((c) => c.id).sort());
      expect(Object.keys(reg).sort()).toEqual([...ids].sort());
      logCompared('tenK.v2.21c03f1.plans', Object.keys(reg));
      const zero = (): Record<string, number> => ({ same: 0, D30a: 0, D30b: 0, 'D30a+D30b': 0 });
      const cause: Record<Days, Record<string, number>> = {
        3: zero(),
        4: zero(),
        5: zero(),
        6: zero()
      };
      const other: string[] = [];
      for (const [id, x] of Object.entries(reg)) {
        const [h0, noRws0, rws0] = fx.plans[id]!;
        const c = cause[x.days];
        // 06f (pouka 35): uzrok na 7ba9717 (plan se menja, p35.node.test.ts).
        const p35 = P35_CAUSE21[id];
        // 10K-08: plan promenjen prema b9c4728 (T1/C11) — svoj razred (stanje b9c4728 su proverile ove regresije).
        if (CHANGED_08.gen[id]) c['10K-08'] = (c['10K-08'] ?? 0) + 1;
        else if (p35) c[p35]!++;
        // D30b uklanja samo upozorenje RACE_WEEK_SHORT; D30a daje RP deonicu < 1000 m.
        else if (x.h[0] === h0) c['same']!++;
        else if (rws0 === 1 && x.h[0] === noRws0) c['D30b']!++;
        else if (x.rp800) c[rws0 === 1 ? 'D30a+D30b' : 'D30a']!++;
        // 10K-07: plan sa uzrokom cause07 (posle undo07) — razvrstan po tome šta je 21c03f1 imao (D30b: RACE_WEEK_SHORT).
        else if (g.c07[id]) c[rws0 === 1 ? 'D30b' : 'same']!++;
        else other.push(id);
      }
      expect(other).toEqual([]);
      byDays(
        (n) => cause[n],
        [
          // 10K-08: planovi promenjeni prema b9c4728 (T1/C11) su svoj razred; ostali razvrstani kao ranije.
          { same: 708, D30a: 672, D30b: 6, 'D30a+D30b': 0, '10K-08': 1254 },
          { same: 1008, D30a: 114, D30b: 0, 'D30a+D30b': 0, '10K-08': 2574 },
          { same: 1980, D30a: 216, D30b: 0, 'D30a+D30b': 0, '10K-08': 2028 },
          { same: 3081, D30a: 54, D30b: 27, 'D30a+D30b': 0, '10K-08': 2118 }
        ],
        true
      );
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

    it('regresija 03b: ceo plan sa rezultatom bajt-isti kao 81bd351 (heš bez oznake verzije) za svih 15 840', () => {
      const fx = read<{ against: string; result: Record<string, number> }>(HASHES_81);
      expect(fx.against).toBe('81bd351');
      expect(Object.keys(fx.result).sort()).toEqual(all.map((c) => c.id).sort());
      expect(Object.keys(g.h81).sort()).toEqual([...ids].sort());
      logCompared('tenK.v2.81bd351.result', Object.keys(g.h81));
      // 06f (pouka 35): menjaju se tačno planovi sa nedeljom pouke 35 na 7ba9717; 10K-07: i planovi sa uzrokom cause07
      // (posle undo07), ostali bajt-isti.
      const no07 = (id: string): boolean => !g.c07[id];
      const changed = Object.keys(g.h81).filter((id) => g.h81[id] !== fx.result[id] && no07(id));
      expect(changed.sort()).toEqual(
        Object.keys(g.h81)
          .filter((id) => P35_PLANS.has(id) && no07(id))
          .sort()
      );
    });
    it('regresija 04: generate = construct(input, []) — ceo plan sa rezultatom bajt-isti kao b13ca17 (heš bez oznake verzije) za svih 15840', () => {
      const fx = read<{ against: string; result: Record<string, number> }>(HASHES_B13);
      expect(fx.against).toBe('b13ca17');
      expect(Object.keys(fx.result).sort()).toEqual(all.map((c) => c.id).sort());
      expect(Object.keys(g.h81).sort()).toEqual([...ids].sort());
      logCompared('tenK.v2.b13ca17.result', Object.keys(g.h81));
      // 06f (pouka 35): menjaju se tačno planovi sa nedeljom pouke 35 na 7ba9717; 10K-07: i planovi sa uzrokom cause07
      // (posle undo07), ostali bajt-isti.
      const no07 = (id: string): boolean => !g.c07[id];
      const changed = Object.keys(g.h81).filter((id) => g.h81[id] !== fx.result[id] && no07(id));
      expect(changed.sort()).toEqual(
        Object.keys(g.h81)
          .filter((id) => P35_PLANS.has(id) && no07(id))
          .sort()
      );
    });

    extra?.();
  });
}
