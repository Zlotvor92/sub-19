/* 10K v2 06i (10k-v2.8.0, organizator K3, pouke 23, 33, 34, 36): trajna mreža lanca pre starta — zajednički kod za
   prestartChain.node.test.ts (deo 1) i prestartChain.<k>.full.node.test.ts. Planovi mreže E (pun: svaki STRIDE.full.,
   brz: svaki STRIDE.fast.); korak 1 asOf start − 1 (bol 8, bol 5, umor, pauza 20); korak 2 u nedelji 1 (sreda i kraj),
   svih 17 scenarija, činjenice kumulativne (kao final-check pre-lib.mergeFacts). Po toku: 0 odbijanja, adaptInvariants
   prazno. Na 46e72eb (organizator, prestart-chain.ts 10K): 836/43 656 WEEK_INFEASIBLE (nedelja 2 rasterećenje bez
   reference: bol 8 → umor 194, umor → umor 642). */

import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part } from '@/test/level';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays, weekdayOf } from './dates.ts';
import { earlyPlan } from './earlyGrid.harness.node.test.ts';
import { GRID_TIMEOUT, missingParts } from './level.harness.node.test.ts';
import { earlyGridBases, factsOf, SCENARIOS } from './testInputs.ts';
import { fileURLToPath } from 'node:url';

export const PRESTART_PARTS = 4;
const HERE = fileURLToPath(new URL('./', import.meta.url));
const STRIDE = { full: 32, fast: 240 } as const;
export const STEP1 = ['pain8', 'pain5', 'fatigue', 'pause20'] as const;

type F = Record<string, unknown>;
/** Kumulativne činjenice (kao final-check pre-lib.mergeFacts): zapis istog datuma iz drugog koraka zamenjuje prvi. */
export function mergeFacts(a: F, b: F): F {
  type W = { date: string };
  const wa = (a['workouts'] as W[] | undefined) ?? [];
  const wb = (b['workouts'] as W[] | undefined) ?? [];
  const dates = new Set(wb.map((w) => w.date));
  const workouts = [...wa.filter((w) => !dates.has(w.date)), ...wb];
  const results = [...((a['results'] as unknown[]) ?? []), ...((b['results'] as unknown[]) ?? [])];
  const breaks = [...((a['breaks'] as unknown[]) ?? []), ...((b['breaks'] as unknown[]) ?? [])];
  const locked = (b['lockedDayIds'] ?? a['lockedDayIds']) as string[] | undefined;
  const coverage = b['coverage'] ?? a['coverage'];
  return {
    ...(workouts.length ? { workouts } : {}),
    ...(results.length ? { results } : {}),
    ...(breaks.length ? { breaks } : {}),
    ...(locked ? { lockedDayIds: locked } : {}),
    ...(coverage ? { coverage } : {})
  };
}

export function describePrestartChain(title: string, partIndex: number): void {
  describe(title, () => {
    let n = 0;
    const bad: string[] = [];
    beforeAll(() => {
      const xs = earlyGridBases().filter((_, i) => i % (FULL ? STRIDE.full : STRIDE.fast) === 0);
      for (const b of FULL ? part(xs, partIndex, PRESTART_PARTS) : xs) {
        const p0 = earlyPlan(b);
        const at1 = addDays(p0.input.startDate, -1);
        let wed = p0.weeks[0]!.startDate;
        while (weekdayOf(wed) !== 'wed') wed = addDays(wed, 1);
        for (const s1 of STEP1) {
          const f1 = factsOf(p0, s1, at1);
          const r1 = adaptTenKV2(p0, f1, at1);
          if (!r1.ok) {
            bad.push(`${b.id}/${s1}: korak 1 odbijen`);
            continue;
          }
          for (const at2 of [wed, p0.weeks[0]!.endDate])
            for (const s2 of SCENARIOS) {
              const f2 = mergeFacts(f1, factsOf(r1.plan, s2, at2));
              const r2 = adaptTenKV2(r1.plan, f2, at2);
              n++;
              const key = `${b.id}/${s1}@${at1}→${s2}@${at2}`;
              if (!r2.ok) bad.push(`${key}: ${r2.reasons[0]!.message.slice(0, 120)}`);
              else
                for (const v of adaptInvariants(r1.plan, r2.plan, at2, f2))
                  bad.push(`${key}: ${v}`);
            }
        }
      }
    }, GRID_TIMEOUT);

    it('pun nivo: svi delovi postoje; lanac pre starta → nedelja 1: 0 odbijanja, adaptInvariants prazno', () => {
      if (FULL && partIndex === 1)
        expect(missingParts(HERE, 'prestartChain', PRESTART_PARTS)).toEqual([]);
      expect(n).toBeGreaterThan(FULL ? 3000 : 1000);
      expect(bad.slice(0, 10)).toEqual([]);
    });
  });
}
