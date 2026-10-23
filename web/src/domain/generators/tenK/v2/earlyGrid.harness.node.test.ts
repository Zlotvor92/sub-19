/* Mreža E 10K v2 (segment 06d, 10k-v2.5.1, N7): rana adaptacija, pred nedeljom testa i pred taperom — zajednički kod
   za earlyGrid.node.test.ts i earlyGrid.<k>.full.node.test.ts.

   Planovi (testInputs.earlyGridBases): svaki 12. ulaz mreže 01, svaki 7. mreže po osećaju (3–6 dana), svaki 3. mreže
   početnika (3–4 dana) = 3084. asOf (testInputs.earlyAsOfs): sreda i kraj nedelje 1 i, u planu sa testom, nedelje
   pre nedelje testa (≥ 2) — pauza 10 i 20 dana, bol 5 i 8, pauza 10 + bol 5, manjak, umor; kraj nedelje N − 2 — bol 8
   (taper skraćen, D23); imenovani tokovi stanja doze iz upisanih dana (EARLY_NAMED). Po toku: prihvaćen (0
   odbijanja), adaptInvariants prazno (Uslov 8: nijedan prazan trening, dugi ≥ lagan, nedelja ≥ minimum), regresija:
   tok prihvaćen na 51a924f bajt-isti (heš bez oznake verzije, segment06d.early-hashes-51a924f.json; 0 = tamo
   odbijen) osim tokova porodice 1 (prošlost = upisani dani; spisak u istom fajlu).
   06e (10k-v2.5.2, pouka 34): isti planovi sa asOf PRE STARTA (start − 1, − 3, − 6) — umor, bol 5, pauza 10, rezultat
   (testInputs.EARLY_PRE_SCENARIOS), posle svih tokova 06d; regresija prema bd07eec
   (segment06e.prestart-hashes-bd07eec.json: prihvaćeni bajt-isti; umor tamo odbijen, 0).
   06f/06g: trajne mreže ponavljanja (umor, bol, zaštićeni dani) su u repeatGrid.harness.node.test.ts.

   - BRZ nivo: deterministički uzorak (svaki K_FAST. tok 06d i svaki K_PRE. tok pre starta unutar porodice × scenario)
     + imenovani primeri N7/06d/06e.
   - PUN nivo: delovi po indeksu plana (`part`, EARLY_PARTS); glavni fajl = deo 1. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { generateTenKV2 } from './generate.ts';
import {
  at7ba,
  GRID_TIMEOUT,
  hasP37,
  missingParts,
  p35FlowErrors,
  p37FlowErrors,
  p07FlowErrors,
  p08Errors
} from './level.harness.node.test.ts';
import {
  EARLY_NAMED,
  type EarlyBase,
  type EarlyFlow,
  earlyFacts,
  earlyFlows,
  earlyGridBases,
  EARLY_06D,
  planHash06c,
  dump08,
  mark07
} from './testInputs.ts';
import type { TenKV2Facts, TenKV2Plan } from './types.ts';

export const EARLY_PARTS = 12;
const K_FAST = 60;
const K_PRE = 240;
const HERE = fileURLToPath(new URL('./', import.meta.url));
export const EARLY_HASHES = `${HERE}segment06d.early-hashes-51a924f.json`;
export const PRE_HASHES = `${HERE}segment06e.prestart-hashes-bd07eec.json`;
/** Broj planova i tokova celog skupa (06d + asOf pre starta 3084 × 3 × 4). */
export const EARLY_PLANS = 3084;
export const EARLY_TOTAL = EARLY_06D + 37008;

/** Primeri nalaza (uvek u uzorku brzog nivoa): K1 pauza 20 kraj ned 1; K2 bol 5/8 sreda ned 1; N-a bol 8 kraj ned
    N − 2; N-b umor početnika kraj ned 1; N-c/N-d (EARLY_NAMED). Primer K1 bol 5 u četvrtak ned 1 nije asOf mreže
    — poseban test u earlyGrid.node.test.ts. */
export const NAMED_FLOWS: readonly string[] = [
  'f-d5-12w-30km-e270-C-sat/w1end/pause20',
  'f-d5-8w-35km-e270-A-sat/w1wed/pain5',
  'f-d5-8w-35km-e270-A-sat/w1wed/pain8',
  '10w-25km-v30-A-sat/w8end/pain8',
  'b-d3-10w-20km-e390-A-sat/w1end/fatigue',
  ...EARLY_NAMED,
  // 06e: umor pre starta — 4 dana (T 60 %), početnik (sadržaj uvoda), 3 dana 20 km (T ne staje u plafon, D11).
  '10w-25km-v30-A-sat/start-1/fatigue',
  'b-d4-10w-18km-e330-A-sat/start-1/fatigue',
  'f-d3-8w-20km-e270-A-sat/start-3/fatigue'
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
  const named = (f: EarlyFlow): boolean => NAMED_FLOWS.includes(f.key);
  const cat = (f: EarlyFlow): string => `${f.base.family}/${f.s}`;
  return [
    ...sample(flows.slice(0, EARLY_06D), K_FAST, cat, named),
    ...sample(flows.slice(EARLY_06D), K_PRE, cat, named)
  ];
}

export interface EarlyRun {
  ok: boolean;
  bad: string[];
  hash: number;
  /** 06f: pouka 35 u rezultatu (napomena konstruktora). */
  p35: boolean;
  /** 06i: mešovita nedelja pouke 37 u rezultatu. */
  p37: boolean;
  /** 10K-07: oznaka uzroka (testInputs.mark07). */
  m07: string;
}

export function runEarly(f: EarlyFlow): EarlyRun {
  const p0 = earlyPlan(f.base);
  const facts = earlyFacts(p0, f.s, f.asOf);
  const r = adaptTenKV2(p0, facts, f.asOf);
  if (!r.ok)
    return {
      ok: false,
      bad: [`${f.key}: ${JSON.stringify(r).slice(0, 400)}`],
      hash: 0,
      p35: false,
      p37: false,
      m07: ''
    };
  const bad = adaptInvariants(p0, r.plan, f.asOf, facts as unknown as TenKV2Facts).map(
    (v) => `${f.key}: ${v}`
  );
  dump08('early', f.key, r);
  return {
    ok: true,
    bad,
    hash: planHash06c(r),
    p35: JSON.stringify(r).includes('Pouka 35:'),
    p37: hasP37(r),
    m07: mark07(r)
  };
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
/** 06e: heševi tokova pre starta na bd07eec (redni broj − EARLY_06D; 0 = odbijen). */
let preHashes: { against: string; hashes: number[] } | null = null;
export const earlyPreHashes = (): { against: string; hashes: number[] } =>
  (preHashes ??= JSON.parse(readFileSync(PRE_HASHES, 'utf8')) as {
    against: string;
    hashes: number[];
  });
/** Heš toka u referenci (06d: 51a924f; pre starta: bd07eec); 0 = tamo odbijen. */
const refHash = (f: EarlyFlow): number =>
  f.n < EARLY_06D ? earlyHashes().hashes[f.n]! : earlyPreHashes().hashes[f.n - EARLY_06D]!;
/** 06f (pouka 35): heš toka u stanju 7ba9717 (fixture) — starije regresije porede njega. */
const hash7ba = (f: EarlyFlow, h: number): number => at7ba('early', f.key, h);

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
      expect(earlyHashes().hashes.length).toBe(EARLY_06D);
      expect(earlyPreHashes().against).toBe('bd07eec');
      expect(earlyPreHashes().hashes.length).toBe(all.length - EARLY_06D);
      const keys = new Set(all.map((f) => f.key));
      expect(NAMED_FLOWS.filter((k) => !keys.has(k))).toEqual([]);
      if (FULL) expect(missingParts(HERE, 'earlyGrid', EARLY_PARTS)).toEqual([]);
      else expect(flows.length).toBeGreaterThan(1000);
    });

    it('0 odbijanja i adaptInvariants prazno (Uslov 8)', () => {
      expect(res.filter((r) => !r.ok).length).toBe(0);
      expect(res.flatMap((r) => r.bad)).toEqual([]);
    });

    it('06f (10k-v2.6.0): prema 7ba9717 menjaju se tačno tokovi sa poukom 35 (nedelja u rezultatu ili bazni plan)', () => {
      const runs = flows.map((f, i) => ({
        key: f.key,
        id: f.base.id,
        hash: res[i]!.hash,
        res: res[i]!.p35 ? 'Pouka 35:' : null
      }));
      expect(p35FlowErrors('early', runs).slice(0, 10)).toEqual([]);
    });

    it('06i (10k-v2.8.0): prema 46e72eb menjaju se tačno tokovi sa mešovitom nedeljom pouke 37', () => {
      const runs = flows.map((f, i) => ({
        key: f.key,
        hash: res[i]!.hash,
        res: res[i]!.p37 ? 'Mešovita nedelja (pouka 37)' : null,
        m07: res[i]!.m07
      }));
      expect(p37FlowErrors('early', runs).slice(0, 10)).toEqual([]);
      // 10K-07: tokovi koje 10k-v2.9.0 menja (fixture, uzrok).
      expect(p07FlowErrors('early', runs).slice(0, 10)).toEqual([]);
      // 10K-08: tokovi koje 10k-v2.10.0 menja prema b9c4728 (fixture).
      expect(p08Errors('early', runs).slice(0, 10)).toEqual([]);
    });

    it('regresija: tok prihvaćen na 51a924f (pre starta: bd07eec) bajt-isti (heš bez oznake verzije), osim porodice 1 i A5 u uvodu (ti se menjaju)', () => {
      const h = earlyHashes();
      const fam = new Set([...h.family1, ...h.introA5]);
      const accepted = flows.map((f, i) => [f, res[i]!] as const).filter(([f]) => refHash(f) !== 0);
      const changed = accepted
        .filter(([f, r]) => refHash(f) !== hash7ba(f, r.hash))
        .map(([f]) => f.key);
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
