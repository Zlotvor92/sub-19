/* HM-08b trajne mreže — zajednički kod brzog nivoa (segment08b.node.test.ts) i delova punog nivoa
   (segment08b.{2…8}.full.node.test.ts):
   - K3: lanac od dva koraka sa kumulativnim činjenicama — korak 1 pre starta (start − 1: bol 8, bol 5, umor, pauza 20),
     korak 2 u nedelji 1 (sreda i kraj: bol 8, bol 5, umor, pauza 10, pauza 20) → 0 odbijanja, adaptInvariants prazno.
   - K1 (pouka 38): zaključan dan testa × {pauza 10, pauza 20, umor, bol 5, bol 8}, asOf test − 14 … test − 1 → 0 odbijanja,
     najviše jedan test u planu.
   Pun nivo: K3 svaki 4. plan rane mreže, K1 svaki 2. plan sa testom; delovi ≤ ~40 s lokalno. */

import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { adaptHmV2 } from './adapt.ts';
import { factsOf, earlyFacts } from './adaptInputs.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { basePlan, earlyGridBases } from './adaptGrid.harness.node.test.ts';
import { addDays, weekdayOf } from './dates.ts';
import type { AdaptResult, HmV2Plan } from './types.ts';

type Facts = Record<string, unknown>;
const arr = (f: Facts, k: string): unknown[] => (f[k] as unknown[] | undefined) ?? [];

/** Kumulativne činjenice (dnevnik aplikacije koji raste): treninzi po datumu (drugi ima prednost), pauze i
    rezultati se nadovezuju, zaključani i pokrivenost iz drugog (kao final-check pre-lib.mergeFacts). */
export function mergeFacts(a: Facts, b: Facts): Facts {
  type W = { date: string };
  const wb = arr(b, 'workouts') as W[];
  const dates = new Set(wb.map((x) => x.date));
  return {
    workouts: [...(arr(a, 'workouts') as W[]).filter((x) => !dates.has(x.date)), ...wb],
    breaks: [...arr(a, 'breaks'), ...arr(b, 'breaks')],
    results: [...arr(a, 'results'), ...arr(b, 'results')],
    ...((b['lockedDayIds'] ?? a['lockedDayIds'])
      ? { lockedDayIds: b['lockedDayIds'] ?? a['lockedDayIds'] }
      : {}),
    ...((b['coverage'] ?? a['coverage']) ? { coverage: b['coverage'] ?? a['coverage'] } : {})
  };
}

export const codes = (r: AdaptResult): string =>
  r.ok ? '' : r.reasons.map((x) => `${x.code} ${x.message.slice(0, 120)}`).join(' | ');
const wedOf = (p: HmV2Plan, i: number): string => {
  let d = p.weeks[i - 1]!.startDate;
  while (weekdayOf(d) !== 'wed') d = addDays(d, 1);
  return d;
};
const tests = (p: HmV2Plan): number =>
  p.weeks.reduce((a, w) => a + w.days.filter((d) => d.role === 'test').length, 0);

const S1 = ['pain8', 'pain5', 'fatigue', 'pause20'] as const;
const S2 = ['pain8', 'pain5', 'fatigue', 'pause10', 'pause20'] as const;
const K1S = ['pause10', 'pause20', 'fatigue', 'pain5', 'pain8'] as const;
const PARTS = 8;

export function describeSegment08bNet(index: number): void {
  describe(`HM-08b trajne mreže: K3 lanac pre starta, K1 zaključan test (deo ${index}/${PARTS})`, () => {
    const bad: string[] = [];
    const n = { k3: 0, k1: 0 };
    beforeAll(() => {
      const bases = earlyGridBases();
      // K3: korak 1 pre starta, korak 2 u nedelji 1, činjenice kumulativne.
      for (const b of FULL ? part(sample(bases, 4), index, PARTS) : sample(bases, 40)) {
        const p = basePlan(b);
        const at1 = addDays(p.input.startDate, -1);
        for (const s1 of S1) {
          const f1 = factsOf(p, s1, at1) as Facts;
          const r1 = adaptHmV2(p, f1, at1);
          if (!r1.ok) {
            bad.push(`${b.id}/${s1}: odbijen ${codes(r1)}`);
            continue;
          }
          for (const at2 of [wedOf(p, 1), p.weeks[0]!.endDate])
            for (const s2 of S2) {
              n.k3++;
              const f2 = mergeFacts(f1, earlyFacts(r1.plan, s2, at2));
              const r2 = adaptHmV2(r1.plan, f2, at2);
              const key = `${b.id}/${s1}→${s2}@${at2}`;
              if (!r2.ok) bad.push(`${key}: odbijen ${codes(r2)}`);
              else
                for (const v of adaptInvariants(r1.plan, r2.plan, at2, f2))
                  bad.push(`${key}: ${v}`);
            }
        }
      }
      // K1: zaključan dan testa.
      const withTest = bases.filter((b) => basePlan(b).weeks.some((w) => w.test));
      for (const b of FULL ? part(sample(withTest, 2), index, PARTS) : sample(withTest, 20)) {
        const p = basePlan(b);
        const td = p.weeks.flatMap((w) => w.days).find((d) => d.role === 'test')!.date;
        for (let k = 14; k >= 1; k--) {
          if (!FULL && k !== 1 && k !== 7) continue;
          const at = addDays(td, -k);
          if (at < p.input.startDate) continue;
          for (const s of K1S) {
            n.k1++;
            const facts = { ...(factsOf(p, s, at) as Facts), lockedDayIds: [td] };
            const r = adaptHmV2(p, facts, at);
            const key = `${b.id}/test ${td}/${s}@${at}`;
            if (!r.ok) bad.push(`${key}: odbijen ${codes(r)}`);
            else {
              if (tests(r.plan) > 1) bad.push(`${key}: ${tests(r.plan)} testa`);
              for (const v of adaptInvariants(p, r.plan, at, facts)) bad.push(`${key}: ${v}`);
            }
          }
        }
      }
    }, 600_000);
    it('0 odbijanja, adaptInvariants prazno, najviše jedan test', () => {
      expect(bad.slice(0, 10)).toEqual([]);
      expect(n.k3 + n.k1).toBeGreaterThan(0);
    });
  });
}
