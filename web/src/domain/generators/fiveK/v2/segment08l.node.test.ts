/* Segment 08l (5k-v2.10.4): broj nedelje u porukama jezgra na planu cilja predaje (3i za 5K). Plan cilja nosi nedelje
   izvora ispred (app/handoffTarget.ts, prefiks), pa je nedelja v2 `i` u kalendaru nedelja `offset + i`. Ulaz jezgra
   `weekOffset` (podrazumevano 0) i JEDNA funkcija `input.weekLabel` za svaku poruku sa brojem nedelje.
   Nezavisna provera: isti ulaz i iste činjenice sa pomakom K i bez njega → svaka poruka (napomene plana i nedelja,
   upozorenja, razlozi adaptacije, odbijanja) sa pomakom = ista poruka bez pomaka u kojoj je svaki broj posle reči
   „nedelja/nedelje/nedelji…" uvećan za K. */

import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { adaptFiveKV2 } from './adapt.ts';
import { generateFiveKV2 } from './generate.ts';
import { weekLabel } from './input.ts';
import {
  EARLY_SCENARIOS,
  earlyAsOfs,
  earlyFacts,
  earlyGridBases,
  type EarlyPlan
} from './testInputs.ts';
import type { FiveKV2Plan } from './types.ts';

const K = 7;
/** Broj posle reči „nedelj…" je redni broj nedelje (ne km: „Trkačka nedelja 12.5 km"; ne broj: „12 nedelja", „prva nedelja 1 kvalitet"). */
const WEEK_NO = /([Nn]edelj[a-z]*) (\d+)(?!\d|[.,]\d| km| kvalitet)/g;
const shift = (s: string): string =>
  s.replace(WEEK_NO, (_, w: string, n: string) => `${w} ${Number(n) + K}`);
const numbered = (s: string): boolean => new RegExp(WEEK_NO.source).test(s);

type R = { ok: boolean } & Record<string, unknown>;
function messages(r: R): string[] {
  if (!r.ok) {
    const x = r as unknown as {
      reasons: { message: string }[];
      violations?: { message: string }[];
    };
    return [...x.reasons.map((y) => y.message), ...(x.violations ?? []).map((y) => y.message)];
  }
  const x = r as unknown as {
    plan: FiveKV2Plan;
    reasons?: { message: string }[];
  };
  return [
    ...x.plan.notes,
    ...x.plan.weeks.flatMap((w) => w.notes),
    ...x.plan.warnings.map((v) => v.message),
    ...(x.reasons ?? []).map((y) => y.message)
  ];
}

function compare(id: string, input: Record<string, unknown>): { bad: string[]; numbered: number } {
  const out = { bad: [] as string[], numbered: 0 };
  const g0 = generateFiveKV2(input);
  const g1 = generateFiveKV2({ ...input, weekOffset: K });
  const check = (key: string, a: R, b: R): void => {
    const ma = messages(a);
    const mb = messages(b);
    out.numbered += ma.filter(numbered).length;
    if (ma.length !== mb.length) out.bad.push(`${key}: broj poruka ${ma.length} ≠ ${mb.length}`);
    else
      ma.forEach((m, i) => {
        if (shift(m) !== mb[i]) out.bad.push(`${key}: „${mb[i]}" ≠ „${shift(m)}"`);
      });
  };
  check(`${id}/gen`, g0, g1);
  if (!g0.ok || !g1.ok || 'planType' in g0.plan || 'planType' in g1.plan) return out;
  const p0 = g0.plan;
  const p1 = g1.plan;
  for (const { tag, asOf } of earlyAsOfs(p0 as unknown as EarlyPlan))
    for (const s of EARLY_SCENARIOS) {
      const f = earlyFacts(p0 as unknown as EarlyPlan, s, asOf);
      check(`${id}/${tag}/${s}`, adaptFiveKV2(p0, f, asOf), adaptFiveKV2(p1, f, asOf));
    }
  return out;
}

describe('08l broj nedelje u porukama jezgra (weekOffset, input.weekLabel)', () => {
  it('weekLabel: bez pomaka isti broj, sa pomakom + pomak', () => {
    expect([weekLabel(3), weekLabel(3, undefined), weekLabel(3, 0), weekLabel(3, K)]).toEqual([
      3,
      3,
      3,
      3 + K
    ]);
  });

  const all = earlyGridBases();
  const bases = FULL ? all.filter((_, i) => i % 18 === 0) : all.filter((_, i) => i % 64 === 0);
  it(`${bases.length} planova (R/F/B) × asOf rane mreže × 17 scenarija: sve poruke sa „nedelj…" na planu sa pomakom ${K} imaju broj + ${K}`, () => {
    const st = bases.map((b) => compare(b.id, b.input));
    expect(st.flatMap((s) => s.bad).slice(0, 10)).toEqual([]);
    expect(st.reduce((a, s) => a + s.numbered, 0)).toBeGreaterThan(0);
  }, 300_000);

  it('bez pomaka (weekOffset izostavljen) generator i adaptacija bajt-isti kao do sada (ulaz bez polja)', () => {
    const b = all[0]!;
    const g = generateFiveKV2(b.input);
    if (!g.ok) throw new Error('generate');
    expect('weekOffset' in g.plan.input).toBe(false);
    const g0 = generateFiveKV2({ ...b.input, weekOffset: 0 });
    expect(JSON.stringify(g0)).toBe(JSON.stringify(g));
  });
});
