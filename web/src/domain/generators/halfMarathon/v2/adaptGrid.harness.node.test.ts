/* HM v2 Segment 04: zajednički kod mreža adaptacije (ime *.harness.node.test.ts: test kod, vitest ga ne skuplja).
   - Mreža 04 (MASTER § 3, grid04.node.test.ts): 33 bazna plana (adaptInputs.adaptBases) × asOf mreže 04 × 17
     scenarija (+ drugi korak lanca) + bol 5 i 8 na svaki dan nedelje 2 i nedelje sredine plana.
   - Rana i srednja adaptacija (pouka 23, earlyGrid.node.test.ts): svaki 400. plan mreže 02, svaki 80. po osećaju,
     svaki 40. početnika × asOf (pre starta − 1, − 3, − 6; sreda i kraj ned 1, sreda svake nedelje 2…N − 1, kraj
     nedelje pre svake posebne nedelje) × pauza 10/20, bol 5/8, pauza 10 + bol 5, manjak, umor.
   Po toku: prihvaćen (0 odbijanja, validator bez greške na upisanom planu), adaptInvariants prazno (Uslov 8).
   BRZ nivo: deterministički uzorak (svaki K-ti tok unutar scenarija); PUN: delovi po indeksu baznog plana. */

import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { adaptHmV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import {
  type AdaptBase,
  adaptBases,
  asOfs04,
  chainSecond,
  EARLY_SCENARIOS,
  earlyAsOfs,
  earlyBases,
  earlyFacts,
  factsOf,
  painFacts,
  SCENARIOS
} from './adaptInputs.ts';
import { addDays } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import type { HmV2Plan } from './types.ts';

export const GRID_TIMEOUT = 900_000;
const DIR = dirname(fileURLToPath(import.meta.url));

export interface Flow {
  key: string;
  base: AdaptBase;
  /** Kategorija uzorka brzog nivoa. */
  cat: string;
  asOf: string;
  facts: (p: HmV2Plan) => Record<string, unknown>;
  /** Drugi korak lanca (asOf + 7). */
  chain?: boolean;
}

const plans = new Map<string, HmV2Plan>();
export function basePlan(b: AdaptBase): HmV2Plan {
  let p = plans.get(b.id);
  if (!p) {
    const r = generateHmV2(b.input);
    if (!r.ok) throw new Error(`${b.id}: ${JSON.stringify(r.reasons)}`);
    plans.set(b.id, (p = r.plan));
  }
  return p;
}

/** Tokovi mreže 04. */
export function grid04Flows(bases: readonly AdaptBase[] = adaptBases()): Flow[] {
  const out: Flow[] = [];
  for (const base of bases) {
    const p = basePlan(base);
    for (const a of asOfs04(p))
      for (const s of SCENARIOS)
        out.push({
          key: `${base.id}/${a.tag}/${s}`,
          base,
          cat: s,
          asOf: a.asOf,
          facts: (q) => factsOf(q, s, a.asOf),
          chain: s === 'chain'
        });
    const mid = Math.ceil(p.weeks.length / 2);
    for (const wi of [...new Set([2, mid])])
      for (let k = 0; k < 7; k++) {
        const at = addDays(p.weeks[wi - 1]!.startDate, k);
        for (const level of [5, 8])
          out.push({
            key: `${base.id}/w${wi}d${k}/pain${level}`,
            base,
            cat: `painDay${level}`,
            asOf: at,
            facts: () => painFacts(at, level)
          });
      }
  }
  return out;
}

/** Planovi rane mreže (pouka 23). */
export const EARLY_STEP = { r: 400, f: 80, b: 40 };
export const earlyGridBases = (): AdaptBase[] => earlyBases(EARLY_STEP);

/** Tokovi rane i srednje adaptacije. */
export function earlyFlows(bases: readonly AdaptBase[] = earlyGridBases()): Flow[] {
  const out: Flow[] = [];
  for (const base of bases) {
    const p = basePlan(base);
    for (const a of earlyAsOfs(p))
      for (const s of EARLY_SCENARIOS)
        out.push({
          key: `${base.id}/${a.tag}/${s}`,
          base,
          cat: s,
          asOf: a.asOf,
          facts: (q) => earlyFacts(q, s, a.asOf)
        });
  }
  return out;
}

export interface FlowRun {
  key: string;
  bad: string[];
  json: string;
}

/** Jedan tok: adaptacija (+ drugi korak lanca), odbijanje ili prekršaji invarijanti kao `bad`. */
export function runFlow(f: Flow): FlowRun {
  const p0 = basePlan(f.base);
  const steps: [HmV2Plan, Record<string, unknown>, string][] = [[p0, f.facts(p0), f.asOf]];
  const bad: string[] = [];
  let json = '';
  for (let i = 0; i < steps.length; i++) {
    const [pl, facts, at] = steps[i]!;
    const r = adaptHmV2(pl, facts, at);
    json += JSON.stringify(r);
    if (!r.ok) {
      bad.push(`${f.key}${i ? '/2' : ''}: ${JSON.stringify(r.reasons).slice(0, 300)}`);
      break;
    }
    for (const v of adaptInvariants(pl, r.plan, at, facts))
      bad.push(`${f.key}${i ? '/2' : ''}: ${v}`);
    const at2 = addDays(at, 7);
    if (f.chain && i === 0 && at2 < p0.input.raceDate)
      steps.push([r.plan, chainSecond(p0, at2), at2]);
  }
  return { key: f.key, bad, json };
}

/** Pun nivo: svi delovi `<name>.<k>.full.node.test.ts` (k = 2…parts) postoje. */
export function missingParts(name: string, parts: number): number[] {
  const files = new Set(readdirSync(DIR));
  return Array.from({ length: parts - 1 }, (_, i) => i + 2).filter(
    (k) => !files.has(`${name}.${k}.full.node.test.ts`)
  );
}

/** Describe mreže adaptacije: brz nivo — uzorak `k` unutar kategorije; pun — deo `partIndex`/`parts` po planu. */
export function describeAdaptGrid(
  title: string,
  name: string,
  all: () => Flow[],
  bases: () => AdaptBase[],
  partIndex: number,
  parts: number,
  k: number,
  expected: { plans: number; flows: number }
): void {
  describe(title, () => {
    let flows: Flow[] = [];
    let res: FlowRun[] = [];
    beforeAll(() => {
      const xs = all();
      if (FULL) {
        const ids = new Set(part(bases(), partIndex, parts).map((b) => b.id));
        flows = xs.filter((f) => ids.has(f.base.id));
      } else flows = sample(xs, k, (f) => f.cat);
      res = flows.map(runFlow);
    }, GRID_TIMEOUT);

    it('ceo skup: broj planova i tokova; pun nivo — svi delovi postoje', () => {
      expect(bases().length).toBe(expected.plans);
      expect(all().length).toBe(expected.flows);
      if (FULL) expect(missingParts(name, parts)).toEqual([]);
      else expect(flows.length).toBeGreaterThan(expected.flows / k - 50);
    });

    it('0 odbijanja (validator na upisanom planu) i adaptInvariants prazno (Uslov 8)', () => {
      expect(res.flatMap((r) => r.bad)).toEqual([]);
    });

    it('deterministički: drugi poziv = isti JSON (A14)', () => {
      for (const f of flows.filter((_, i) => i % 25 === 0))
        expect(runFlow(f).json, f.key).toBe(res[flows.indexOf(f)]!.json);
    });
  });
}
