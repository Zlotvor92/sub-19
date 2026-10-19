/* Mreža E 10K v2 (segment 06d, 10k-v2.5.1, N7): rana adaptacija, pred nedeljom testa i pred taperom — zajednički kod
   za earlyGrid.node.test.ts i earlyGrid.<k>.full.node.test.ts.

   Planovi (testInputs.earlyGridBases): svaki 12. ulaz mreže 01, svaki 7. mreže po osećaju (3–6 dana), svaki 3. mreže
   početnika (3–4 dana) = 3084. asOf (testInputs.earlyAsOfs): sreda i kraj nedelje 1 i, u planu sa testom, nedelje
   pre nedelje testa (≥ 2) — pauza 10 i 20 dana, bol 5 i 8, pauza 10 + bol 5, manjak, umor; kraj nedelje N − 2 — bol 8
   (taper skraćen, D23); imenovani tokovi stanja doze iz upisanih dana (EARLY_NAMED). Po toku: prihvaćen (0
   odbijanja), adaptInvariants prazno (Uslov 8: nijedan prazan trening, dugi ≥ lagan, nedelja ≥ minimum), regresija:
   tok prihvaćen na 51a924f bajt-isti (heš bez oznake verzije, segment06d.early-hashes-51a924f.json; 0 = tamo
   odbijen) osim tokova porodice 1 (prošlost = upisani dani; spisak u istom fajlu).

   - BRZ nivo: deterministički uzorak (svaki K_FAST. tok unutar porodice × scenario) + imenovani primeri N7/06d.
   - PUN nivo: delovi po indeksu plana (`part`, EARLY_PARTS); glavni fajl = deo 1. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { generateTenKV2 } from './generate.ts';
import { GRID_TIMEOUT, missingParts } from './level.harness.node.test.ts';
import {
  EARLY_NAMED,
  type EarlyBase,
  type EarlyFlow,
  earlyFacts,
  earlyFlows,
  earlyGridBases,
  planHash06c
} from './testInputs.ts';
import type { TenKV2Facts, TenKV2Plan } from './types.ts';

export const EARLY_PARTS = 4;
const K_FAST = 60;
const HERE = fileURLToPath(new URL('./', import.meta.url));
export const EARLY_HASHES = `${HERE}segment06d.early-hashes-51a924f.json`;
/** Broj planova i tokova celog skupa. */
export const EARLY_PLANS = 3084;
export const EARLY_TOTAL = 65699;

/** Primeri nalaza (uvek u uzorku brzog nivoa): K1 pauza 20 kraj ned 1; K2 bol 5/8 sreda ned 1; N-a bol 8 kraj ned
    N − 2; N-b umor početnika kraj ned 1; N-c/N-d (EARLY_NAMED). Primer K1 bol 5 u četvrtak ned 1 nije asOf mreže
    — poseban test u earlyGrid.node.test.ts. */
export const NAMED_FLOWS: readonly string[] = [
  'f-d5-12w-30km-e270-C-sat/w1end/pause20',
  'f-d5-8w-35km-e270-A-sat/w1wed/pain5',
  'f-d5-8w-35km-e270-A-sat/w1wed/pain8',
  '10w-25km-v30-A-sat/w8end/pain8',
  'b-d3-10w-20km-e390-A-sat/w1end/fatigue',
  ...EARLY_NAMED
];

const plans = new Map<string, TenKV2Plan>();
export function earlyPlan(b: EarlyBase): TenKV2Plan {
  let x = plans.get(b.id);
  if (!x) {
    const r = generateTenKV2(b.input);
    if (!r.ok) throw new Error(`${b.id}: ${JSON.stringify(r.reasons)}`);
    plans.set(b.id, (x = r.plan));
  }
  return x;
}

let allFlows: EarlyFlow[] | null = null;
export const earlyAll = (): EarlyFlow[] => (allFlows ??= earlyFlows(earlyPlan));

/** Tokovi brzog nivoa (uzorak) ili dela punog (planovi `part`). */
export function earlyCases(partIndex: number): EarlyFlow[] {
  const flows = earlyAll();
  if (FULL) {
    const ids = new Set(part(earlyGridBases(), partIndex, EARLY_PARTS).map((p) => p.id));
    return flows.filter((f) => ids.has(f.base.id));
  }
  return sample(
    flows,
    K_FAST,
    (f) => `${f.base.family}/${f.s}`,
    (f) => NAMED_FLOWS.includes(f.key)
  );
}

export interface EarlyRun {
  ok: boolean;
  bad: string[];
  hash: number;
}

export function runEarly(f: EarlyFlow): EarlyRun {
  const p0 = earlyPlan(f.base);
  const facts = earlyFacts(p0, f.s, f.asOf);
  const r = adaptTenKV2(p0, facts, f.asOf);
  if (!r.ok) return { ok: false, bad: [`${f.key}: ${JSON.stringify(r).slice(0, 400)}`], hash: 0 };
  const bad = adaptInvariants(p0, r.plan, f.asOf, facts as unknown as TenKV2Facts).map(
    (v) => `${f.key}: ${v}`
  );
  return { ok: true, bad, hash: planHash06c(r) };
}

interface EarlyHashes {
  against: string;
  /** Heš po rednom broju toka; 0 = tok odbijen na 51a924f. */
  hashes: number[];
  /** Tokovi porodice 1 (prošlost = upisani dani): prihvaćeni na 51a924f, menjaju se. */
  family1: string[];
  /** A5 u uvodu početnika (N-b): prihvaćeni na 51a924f sa ciljem spuštenim ispod 0,8 × (kvalitet nije stao),
      sada 0,8 × bez kvaliteta. */
  introA5: string[];
}
let hashes: EarlyHashes | null = null;
export const earlyHashes = (): EarlyHashes =>
  (hashes ??= JSON.parse(readFileSync(EARLY_HASHES, 'utf8')) as EarlyHashes);

/** Describe mreže E (brz: uzorak; pun: deo `partIndex`). */
export function describeEarlyGrid(title: string, partIndex: number): void {
  describe(title, () => {
    let flows: EarlyFlow[] = [];
    let res: EarlyRun[] = [];
    beforeAll(() => {
      flows = earlyCases(partIndex);
      res = flows.map(runEarly);
    }, GRID_TIMEOUT);

    it('ceo skup: planovi i tokovi; imenovani primeri u skupu; pun nivo — svi delovi postoje', () => {
      const all = earlyAll();
      expect(new Set(all.map((f) => f.base.id)).size).toBe(EARLY_PLANS);
      expect(all.length).toBe(EARLY_TOTAL);
      expect(earlyHashes().against).toBe('51a924f');
      expect(earlyHashes().hashes.length).toBe(all.length);
      const keys = new Set(all.map((f) => f.key));
      expect(NAMED_FLOWS.filter((k) => !keys.has(k))).toEqual([]);
      if (FULL) expect(missingParts(HERE, 'earlyGrid', EARLY_PARTS)).toEqual([]);
      else expect(flows.length).toBeGreaterThan(1000);
    });

    it('0 odbijanja i adaptInvariants prazno (Uslov 8)', () => {
      expect(res.filter((r) => !r.ok).length).toBe(0);
      expect(res.flatMap((r) => r.bad)).toEqual([]);
    });

    it('regresija: tok prihvaćen na 51a924f bajt-isti (heš bez oznake verzije), osim porodice 1 i A5 u uvodu (ti se menjaju)', () => {
      const h = earlyHashes();
      const fam = new Set([...h.family1, ...h.introA5]);
      const accepted = flows
        .map((f, i) => [f, res[i]!] as const)
        .filter(([f]) => h.hashes[f.n] !== 0);
      const changed = accepted.filter(([f, r]) => h.hashes[f.n] !== r.hash).map(([f]) => f.key);
      expect(changed.filter((k) => !fam.has(k))).toEqual([]);
      expect(changed.filter((k) => fam.has(k)).sort()).toEqual(
        accepted
          .map(([f]) => f.key)
          .filter((k) => fam.has(k))
          .sort()
      );
    });
  });
}
