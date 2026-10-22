/* Segment 08j (5k-v2.10.2) — trajna mreža K9: dva koraka adaptacije, prvi je SMANJENJE (manjak, više od plana, pauza
   10/20/35, lanac, bol + pauza), drugi bilo koji od 17 scenarija na asOf + 3 i + 7 nad planom posle prvog koraka, u dva
   oblika: new (samo nove činjenice) i cum (činjenice prvog + nove, kao dnevnik aplikacije; obrazac final-check
   pre-lib.mergeFacts, kopiran). Nezavisno od konstrukcije:
   - 0 odbijanja;
   - idempotentnost: isti činjenice prvog koraka ponovo (cum + 'none') → ciljevi, rasterećenja, test i dani nedelja
     posle drugog asOf isti kao posle prvog koraka.
   BRZ nivo: 2 plana; PUN: svaki 4. plan uzorka (testInputs.earlyGridBases) u 4 dela
   (segment08j.grid.node.test.ts deo 1, segment08j.{2,3,4}.full.node.test.ts). */

import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays, mustDay } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import {
  EARLY_SCENARIOS,
  earlyFacts,
  earlyGridBases,
  type EarlyPlan,
  type EarlyScenario
} from './testInputs.ts';
import type { AdaptResult, FiveKV2Plan, PlanWeek } from './types.ts';

export const GRID_TIMEOUT = 300_000;
const S = JSON.stringify;
export const REDUCTIONS: readonly EarlyScenario[] = [
  'under50',
  'over120',
  'pause10',
  'pause20',
  'pause35',
  'chain',
  'painPause'
];

type Facts = Record<string, unknown>;
/** Spajanje činjenica dva koraka (kopija final-check/pre-lib.mergeFacts). */
export function mergeFacts(a: Facts, b: Facts): Facts {
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

const errOf = (key: string, r: AdaptResult): string =>
  r.ok
    ? ''
    : `${key}: odbijeno ${
        r.violations
          .filter((v) => v.severity === 'error')
          .map((v) => `${v.rule} ${v.message}`)
          .join('+') || r.reasons.map((x) => x.code).join('+')
      }`;
const shape = (ws: readonly PlanWeek[]): string =>
  S(ws.map((w) => [w.targetKm, w.deload, w.test, w.days]));

export interface TwoStepStats {
  bad: string[];
  flows: number;
  idem: number;
  /** Prvi korak je stvarno smanjenje (korak sa reduced: true) — inače mreža ne proverava K9. */
  reduced: number;
}

/** Tokovi dva koraka jednog plana; `bi` bira prvi asOf (sreda ned 2, kraj ned 3, sreda ⌊N/2⌋, kraj N − 4). */
export function twoStepBad(
  id: string,
  input: Record<string, unknown>,
  bi: number,
  s2s: readonly EarlyScenario[] = EARLY_SCENARIOS
): TwoStepStats {
  const g = generateFiveKV2(input);
  if (!g.ok) throw new Error(id);
  const p = g.plan as FiveKV2Plan;
  const N = p.weeks.length;
  const wed = (w: PlanWeek): string => addDays(w.startDate, 2);
  const ats = [
    wed(p.weeks[1]!),
    p.weeks[2]!.endDate,
    wed(p.weeks[Math.floor(N / 2) - 1]!),
    p.weeks[N - 5]!.endDate
  ];
  const at = ats[bi % ats.length]!;
  const st: TwoStepStats = { bad: [], flows: 0, idem: 0, reduced: 0 };
  for (const s1 of REDUCTIONS) {
    const f1 = earlyFacts(p as unknown as EarlyPlan, s1, at);
    const r1 = adaptFiveKV2(p, f1, at);
    if (!r1.ok) {
      st.bad.push(errOf(`${id}/${s1}`, r1));
      continue;
    }
    if (r1.plan.adaptation!.steps.some((x) => x.reduced === true)) st.reduced++;
    for (const off of [3, 7]) {
      const at2 = addDays(at, off);
      if (at2 >= p.input.raceDate) continue;
      const after = (q: FiveKV2Plan): PlanWeek[] =>
        q.weeks.filter((w) => mustDay(w.startDate) > mustDay(at2));
      const same = adaptFiveKV2(r1.plan, f1, at2);
      st.flows++;
      if (!same.ok) st.bad.push(errOf(`${id}/${s1}→+${off}/isti`, same));
      else if (shape(after(same.plan)) !== shape(after(r1.plan)))
        st.bad.push(`${id}/${s1}→+${off}/isti: plan posle asOf nije isti (idempotentnost)`);
      else st.idem++;
      for (const s2 of s2s) {
        const f2 = earlyFacts(r1.plan as unknown as EarlyPlan, s2, at2);
        for (const [form, f] of [
          ['new', f2],
          ['cum', mergeFacts(f1, f2)]
        ] as const) {
          const r2 = adaptFiveKV2(r1.plan, f, at2);
          st.flows++;
          if (!r2.ok) st.bad.push(errOf(`${form} ${id}/${s1}→+${off}/${s2}`, r2));
        }
      }
    }
  }
  return st;
}

export function describe08j(label: string, part: 1 | 2 | 3 | 4): void {
  const all = earlyGridBases()
    .map((b, i) => ({ b, i }))
    .filter(({ i }) => i % 4 === 0);
  // BRZ: prva 2 plana uzorka (deterministički).
  const picked = FULL ? all.filter((_, k) => k % 4 === part - 1) : all.slice(0, 2);
  describe(label, () => {
    it(
      `${picked.length} planova: smanjenje → 17 scenarija (+3/+7, new/cum) → 0 odbijanja; iste činjenice ponovo → isti plan`,
      () => {
        const st = picked.map(({ b, i }) => twoStepBad(b.id, b.input, i));
        expect(st.flatMap((s) => s.bad).slice(0, 10)).toEqual([]);
        expect(st.reduce((a, s) => a + s.idem, 0)).toBeGreaterThan(0);
        expect(st.reduce((a, s) => a + s.reduced, 0)).toBeGreaterThan(0);
      },
      GRID_TIMEOUT
    );
  });
}
