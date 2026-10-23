/* Segment 08j (5k-v2.10.2): K9 — drugi korak adaptacije posle koraka SMANJENJA (pauza, izvršenje) je odbijan
   (organizator two-step.ts 5K 30 30 20: new 3 624 / 75 072, cum 3 696 — VOLUME_RESET, VOLUME_GROWTH, VOLUME_PEAK).
   Uzrok: volume.adaptVolume je za kasniji korak bez cilja ponovo gradio nedelju sa ciljem RANIJEG koraka od
   generatora (validator: resetKm drži cilj koraka). Plus idempotentnost: kontrolno trčanje koje ne staje otpada prvo
   samo (generate.construct), pa ista adaptacija na kasniji asOf daje isti plan. */

import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays, mustDay } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { earlyFacts, earlyGridInputs, type EarlyPlan, type EarlyScenario } from './testInputs.ts';
import type { FiveKV2Plan, PlanWeek } from './types.ts';

const S = JSON.stringify;
const planOf = (id: string): FiveKV2Plan => {
  const g = generateFiveKV2(earlyGridInputs().find((x) => x.id === id)!.input);
  if (!g.ok) throw new Error(id);
  return g.plan as FiveKV2Plan;
};
const first = (id: string, s: EarlyScenario, at: string) => {
  const p = planOf(id);
  const f1 = earlyFacts(p as unknown as EarlyPlan, s, at);
  const r1 = adaptFiveKV2(p, f1, at);
  if (!r1.ok) throw new Error(JSON.stringify(r1.reasons));
  return { p, f1, r1 };
};
const targets = (q: FiveKV2Plan): number[] => q.weeks.map((w) => w.targetKm);
const after = (q: FiveKV2Plan, at: string): PlanWeek[] =>
  q.weeks.filter((w) => mustDay(w.startDate) > mustDay(at));

describe('08j K9 — drugi korak posle smanjenja', () => {
  it('r-d3-6w-16km-v32-1: manjak (sreda ned 2) → + 3 bez činjenica → prihvaćen, cilj koraka 14,8 ostaje', () => {
    const { r1 } = first('r-d3-6w-16km-v32-1', 'under50', '2026-11-11');
    const r2 = adaptFiveKV2(r1.plan, {}, '2026-11-14');
    if (!r2.ok) throw new Error(S(r2.violations));
    expect(targets(r2.plan)).toEqual(targets(r1.plan));
    expect(r2.plan.weeks[2]!.targetKm).toBe(14.8);
  });

  it('r-d5-8w-25km-v32-1: pauza 35 (sreda ned 4) → + 3 bez činjenica → prihvaćen (bez VOLUME_PEAK)', () => {
    const { r1 } = first('r-d5-8w-25km-v32-1', 'pause35', '2026-11-25');
    const r2 = adaptFiveKV2(r1.plan, {}, '2026-11-28');
    if (!r2.ok) throw new Error(S(r2.violations));
    expect(targets(r2.plan)).toEqual(targets(r1.plan));
  });

  it('idempotentnost f-d3-16w-12km-e420-0: iste činjenice manjka ponovo + 3 → isti plan posle asOf (test otpada sam)', () => {
    const { f1, r1 } = first('f-d3-16w-12km-e420-0', 'under50', '2026-11-09');
    const at2 = addDays('2026-11-09', 3);
    const r2 = adaptFiveKV2(r1.plan, f1, at2);
    if (!r2.ok) throw new Error(S(r2.violations));
    const shape = (ws: PlanWeek[]) => S(ws.map((w) => [w.targetKm, w.deload, w.test, w.days]));
    expect(shape(after(r2.plan, at2))).toBe(shape(after(r1.plan, at2)));
    expect(
      r1.plan.weeks[2]!.notes.some((n) => n.includes('kontrolno trčanje ne staje u obim'))
    ).toBe(true);
  });
});
