/* Zajednički kod trajne mreže rane i srednje adaptacije (pouka 23, kao 10K E/N7; earlyGrid.node.test.ts i delovi
   punog nivoa earlyGrid.<k>.full.node.test.ts); bez testova (vitest ga ne skuplja, v. vitest.config.ts). Planovi:
   svaki 182. ulaz mreže 02, svaki 78. po osećaju, svaki 42. početnika; asOf: sreda i kraj ned 1, sreda svake
   nedelje 2 … N − 1, kraj nedelje pre svake posebne nedelje (test, rasterećenje, N−2, N−1); scenariji pauza 10/20,
   bol 5/8, pauza 10 + bol 5, manjak, umor. Po toku: prihvaćen (K1 = 0) i adaptInvariants prazno (nezavisno od
   validatora). */

import { beforeAll, describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { generateMarathonV2 } from './generate.ts';
import {
  type AdaptBase,
  EARLY_SCENARIOS,
  earlyAsOfs,
  earlyFacts,
  earlyGridBases,
  type EarlyScenario
} from './testInputs.ts';
import type { MarathonV2Plan } from './types.ts';

export const EARLY_PARTS = 4;
export const EARLY_TIMEOUT = 600_000;

export interface EarlyFlow {
  key: string;
  base: AdaptBase;
  asOf: string;
  s: EarlyScenario;
}

const plans = new Map<string, MarathonV2Plan>();
export const planOf = (b: AdaptBase): MarathonV2Plan => {
  let p = plans.get(b.id);
  if (!p) {
    const r = generateMarathonV2(b.input);
    if (!r.ok) throw new Error(`${b.id}: ${JSON.stringify(r.reasons)}`);
    p = r.plan;
    plans.set(b.id, p);
  }
  return p;
};

export const EARLY_BASES: readonly AdaptBase[] = earlyGridBases(182, 78, 42);

/** Tokovi mreže za date planove (redosled: plan, asOf, scenario). */
export function earlyFlows(bases: readonly AdaptBase[]): EarlyFlow[] {
  const out: EarlyFlow[] = [];
  for (const base of bases)
    for (const a of earlyAsOfs(planOf(base)))
      for (const s of EARLY_SCENARIOS)
        out.push({ key: `${base.id}/${a.tag}/${s}`, base, asOf: a.asOf, s });
  return out;
}

/** Jedan tok: null = prihvaćen i invarijante važe; inače opis. */
export function runFlow(f: EarlyFlow): string | null {
  const p = planOf(f.base);
  const facts = earlyFacts(p, f.s, f.asOf);
  const r = adaptMarathonV2(p, facts, f.asOf);
  if (!r.ok)
    return `${f.key}: odbijeno ${r.reasons
      .map((x) => x.message)
      .join(' | ')
      .slice(0, 300)}`;
  const bad = adaptInvariants(p, r.plan, f.asOf, facts);
  return bad.length > 0 ? `${f.key}: ${bad.join('; ')}` : null;
}

export function describeEarly(title: string, pick: () => EarlyFlow[]): void {
  describe(title, () => {
    let flows: EarlyFlow[] = [];
    const bad: string[] = [];
    beforeAll(() => {
      flows = pick();
      for (const f of flows) {
        const x = runFlow(f);
        if (x) bad.push(x);
      }
    }, EARLY_TIMEOUT);
    it('0 odbijanja i adaptInvariants prazno (K1, Uslov 8, pouka 23)', () => {
      expect(flows.length).toBeGreaterThan(0);
      expect(bad.slice(0, 20)).toEqual([]);
      expect(bad).toHaveLength(0);
    });
  });
}
