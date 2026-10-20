/* Segment 08h (5k-v2.8.1) — trajne mreže (odluke organizatora 1–2) nad planovima uzorka Faze 4a
   (testInputs.earlyGridBases). Nezavisno od konstrukcije:
   - ZAŠTIĆEN DAN: nov rezultat (faster/slower/test5k) na kraju nedelje k + zaključan prvi dan kvaliteta nedelje k + 1,
     k = 1 … N − 2 → 0 odbijanja, zaključan dan bajt-isti. (Urađen dan posle asOf u 5K nije činjenica:
     checkFacts ga odbija — ADAPT_FACT_AFTER_AS_OF.)
   - UMOR (pouka 36): zapisi umora pet i ned nedelje k − 1 (RPE 8), asOf svaki dan od nedelje k − 1 do četvrtka k (oba
     zapisa u prozoru od 7 dana) → isto rasterećenje i isti ciljevi svih nedelja (k = 2 … N − 2).
   BRZ nivo: BRZ_PLANOVI (segment08g.harness); PUN: svi planovi uzorka (segment08h.2.full.node.test.ts). */

import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { adaptFiveKV2 } from './adapt.ts';
import { addDays } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { BRZ_PLANOVI } from './segment08g.harness.node.test.ts';
import { earlyFacts, earlyGridBases, type EarlyPlan } from './testInputs.ts';
import type { AdaptResult, FiveKV2Plan } from './types.ts';

export const GRID_TIMEOUT = 300_000;
const S = JSON.stringify;
const errOf = (key: string, r: AdaptResult): string =>
  r.ok
    ? ''
    : `${key}: odbijeno ${
        r.violations
          .filter((v) => v.severity === 'error')
          .map((v) => v.rule)
          .join('+') || r.reasons.map((x) => x.code).join('+')
      }`;

export function lockedResultBad(id: string, input: Record<string, unknown>): string[] {
  const g = generateFiveKV2(input);
  if (!g.ok) throw new Error(id);
  const p = g.plan as FiveKV2Plan;
  const bad: string[] = [];
  for (let k = 1; k <= p.weeks.length - 2; k++) {
    const at = p.weeks[k - 1]!.endDate;
    const q = p.weeks[k]!.days.find((d) => d.workout.kind === 'quality');
    if (!q) continue;
    for (const s of ['faster', 'slower', 'test5k'] as const) {
      const key = `${id}/k${k}/${s}`;
      const r = adaptFiveKV2(
        p,
        { ...earlyFacts(p as unknown as EarlyPlan, s, at), lockedDayIds: [q.date] },
        at
      );
      if (!r.ok) bad.push(errOf(key, r));
      else if (S(r.plan.weeks[k]!.days.find((d) => d.date === q.date)) !== S(q))
        bad.push(`${key}: zaključan dan promenjen`);
    }
  }
  return bad;
}

export function fatigueDaysBad(id: string, input: Record<string, unknown>): string[] {
  const g = generateFiveKV2(input);
  if (!g.ok) throw new Error(id);
  const p = g.plan as FiveKV2Plan;
  const bad: string[] = [];
  for (let k = 2; k <= p.weeks.length - 2; k++) {
    const prev = p.weeks[k - 2]!;
    const sun = prev.endDate;
    const rec = (date: string) => ({ date, km: 6, durationSec: 2400, completed: true, rpe: 8 });
    const facts = { workouts: [rec(addDays(sun, -2)), rec(sun)] };
    let ref: string | null = null;
    for (let d = 0; d <= 4; d++) {
      const at = addDays(sun, d);
      const r = adaptFiveKV2(p, facts, at);
      if (!r.ok) {
        bad.push(errOf(`${id}/k${k}/+${d}`, r));
        continue;
      }
      const shape = S(r.plan.weeks.map((w) => [w.deload, w.targetKm]));
      if (ref === null) ref = shape;
      else if (shape !== ref)
        bad.push(`${id}/k${k}/+${d}: drugo rasterećenje/ciljevi nego asOf nedelja`);
    }
  }
  return bad;
}

export function describe08h(label: string, part: 1 | 2): void {
  const all = earlyGridBases();
  const bases = FULL
    ? all.filter((_, i) => i % 2 === part - 1)
    : all.filter((b) => BRZ_PLANOVI.includes(b.id));
  describe(label, () => {
    it(
      `${bases.length} planova: nov rezultat + zaključan Q1 sledeće nedelje → 0 odbijanja, dan bajt-isti`,
      () => {
        expect(bases.flatMap((b) => lockedResultBad(b.id, b.input)).slice(0, 10)).toEqual([]);
      },
      GRID_TIMEOUT
    );
    it(
      `${bases.length} planova: zapisi umora pet/ned nedelje k − 1, asOf ned … čet → isto rasterećenje (pouka 36)`,
      () => {
        expect(bases.flatMap((b) => fatigueDaysBad(b.id, b.input)).slice(0, 10)).toEqual([]);
      },
      GRID_TIMEOUT
    );
  });
}
