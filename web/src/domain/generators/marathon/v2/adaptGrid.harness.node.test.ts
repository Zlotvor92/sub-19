/* Zajednički kod mreže 04 (MASTER § 3, M18; adaptGrid.node.test.ts i adaptGrid.2.full.node.test.ts); bez testova.
   30 baznih planova (3–6 dana × rezultat/osećaj × 12/16/20 ned + početnik 4/5 dana × 16/20/24 ned) × asOf (ned 1
   sreda i kraj, kraj ned 2, sredina, pre testa, pre rasterećenja, pre N−2 i N−1, sreda N−2) × 17 scenarija; bol 5 i
   bol 8 u SVAKOM danu nedelje asOf-a. Po toku: prihvaćen (K1: 0 odbijanja i grešaka validatora), adaptInvariants
   prazno (nezavisno), bez činjenica bajt-isti budući deo, uslov scenarija primenjen. */

import { beforeAll, describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import {
  type AdaptBase,
  adaptBases,
  type AdaptCase,
  adaptCases,
  chainFacts,
  factsOf
} from './testInputs.ts';
import type { AdaptResult, MarathonV2Facts, MarathonV2Plan } from './types.ts';

export const ADAPT_PARTS = 2;
export const ADAPT_TIMEOUT = 600_000;
export const BASES: readonly AdaptBase[] = adaptBases();

const plans = new Map<string, MarathonV2Plan>();
export const planOf = (id: string): MarathonV2Plan => {
  let p = plans.get(id);
  if (!p) {
    const r = generateMarathonV2(BASES.find((b) => b.id === id)!.input);
    if (!r.ok) throw new Error(`${id}: ${JSON.stringify(r.reasons)}`);
    p = r.plan;
    plans.set(id, p);
  }
  return p;
};

export const casesOf = (bases: readonly AdaptBase[]): AdaptCase[] =>
  bases.flatMap((b) => adaptCases(b.id, planOf(b.id)));

/** Tok: adaptacija (lanac: drugi korak manjak nedelju kasnije); `before` = plan pre poslednjeg koraka. */
export function runCase(c: AdaptCase): {
  r: AdaptResult;
  before: MarathonV2Plan;
  at: string;
  facts: MarathonV2Facts;
} {
  const p0 = planOf(c.id);
  let facts = factsOf(p0, c.s, c.asOf) as MarathonV2Facts;
  let r = adaptMarathonV2(p0, facts, c.asOf);
  let before = p0;
  let at = c.asOf;
  if (r.ok && c.s === 'chain') {
    [before, at] = [r.plan, addDays(c.asOf, 7)];
    facts = chainFacts(r.plan, at);
    r = adaptMarathonV2(r.plan, facts, at);
  }
  return { r, before, at, facts };
}

/** Uslov koji scenario mora da primeni (kad ga plan dozvoljava): pauza i bol uvek. */
const MUST: Partial<Record<AdaptCase['s'], string>> = {
  pause20: 'PAUSE',
  pause35: 'PAUSE',
  pain5: 'PAIN',
  pain8: 'PAIN',
  painPause: 'PAIN'
};

export function describeAdaptGrid(title: string, pick: () => AdaptCase[]): void {
  describe(title, () => {
    let cases: AdaptCase[] = [];
    const rejected: string[] = [];
    const bad: string[] = [];
    const notSame: string[] = [];
    const missing: string[] = [];
    const wrong: string[] = [];
    beforeAll(() => {
      cases = pick();
      for (const c of cases) {
        const { r, before, at, facts } = runCase(c);
        if (!r.ok) {
          rejected.push(
            `${c.key}: ${r.reasons
              .map((x) => x.message)
              .join(' | ')
              .slice(0, 300)}`
          );
          continue;
        }
        const inv = adaptInvariants(before, r.plan, at, facts);
        if (inv.length > 0) bad.push(`${c.key}: ${inv.join('; ')}`);
        if (c.s === 'none' || c.s === 'incomplete')
          if (JSON.stringify(r.plan.weeks) !== JSON.stringify(before.weeks)) notSame.push(c.key);
        const must = MUST[c.s];
        if (must && !r.reasons.some((x) => x.condition === must && x.applied)) missing.push(c.key);
        // Nepotpun zapis ≠ pauza (A10); 100 % izvršenja ne menja obim.
        if (
          (c.s === 'incomplete' || c.s === 'done100') &&
          r.reasons.some((x) => x.applied && ['PAUSE', 'UNDER_EXECUTION'].includes(x.condition))
        )
          wrong.push(c.key);
      }
    }, ADAPT_TIMEOUT);
    it('K1: 0 odbijanja i grešaka validatora', () => {
      expect(cases.length).toBeGreaterThan(0);
      expect(rejected.slice(0, 10)).toEqual([]);
    });
    it('adaptInvariants prazno (prošlost, km > 0, dugi ≥ lagan, minimum, bol, A17, taper, MP ≤ dugi, M13a, A8)', () => {
      expect(bad.slice(0, 10)).toEqual([]);
    });
    it('bez činjenica i uz nepotpun zapis: nedelje bajt-iste (pouka 16, A10)', () => {
      expect(notSame).toEqual([]);
    });
    it('pauza i bol uvek primenjeni; nepotpun zapis i 100 % bez smanjenja (pouka 7)', () => {
      expect(missing).toEqual([]);
      expect(wrong).toEqual([]);
    });
  });
}
