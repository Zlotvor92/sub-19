/* MAR-04b (marathon-v2.3.1): N1 — umor sa asOf PRE STARTA (pouka 34): nedelja 1 je prinudno rasterećenje =
   0,8 × planirana nedelja 1 (sadržaj rasterećenja; početnik: sadržaj uvoda), referenca (poslednja izgradnja,
   poslednji dugi, doza, L za M13a) = nedelja 1 generatora bez činjenica; nedelja 2 = planirana nedelja 1 (bez
   rasta), dalje po rasporedu. Na bd07eec 100 % tokova odbijeno (WEEK_INFEASIBLE, a uz skorašnji najduži pogrešno
   RECENT_LONG_TOO_SHORT). N2 — BASE_PLATEAU posle nedelje testa (pouka 23: konstruktor sastavi, validator odbije). */

import { describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import {
  beginnerInputs,
  earlyFacts,
  factsOf,
  feelInputs,
  gridInputs,
  PRE_START_SCENARIOS,
  recentInputs
} from './testInputs.ts';
import type { MarathonV2Facts, MarathonV2Plan } from './types.ts';

const BASES = [
  gridInputs()[0]!, // 3 dana, rezultat
  gridInputs()[7000]!,
  gridInputs()[15000]!,
  feelInputs()[1000]!,
  beginnerInputs()[100]!, // uvod (pouka 31)
  recentInputs().find((x) => x.id === 'recent-d3-24w-30km-v30-C-r26')! // N1 organizatora
];

const planOf = (input: Record<string, unknown>): MarathonV2Plan => {
  const r = generateMarathonV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const work = (w: MarathonV2Plan['weeks'][number]) =>
  w.days.map((d) => [d.role, d.workout.km, d.workout.title]);

describe('N1: umor pre starta (pouka 34)', () => {
  for (const b of BASES)
    for (const back of [1, 3, 6])
      it(`${b.id}, asOf start − ${back}`, () => {
        const p = planOf(b.input);
        const asOf = addDays(p.input.startDate, -back);
        const facts = earlyFacts(p, 'fatigue', asOf);
        const r = adaptMarathonV2(p, facts, asOf);
        if (!r.ok) throw new Error(JSON.stringify(r.reasons));
        expect(adaptInvariants(p, r.plan, asOf, facts as MarathonV2Facts)).toEqual([]);
        const [w1, w2, w3] = r.plan.weeks;
        const g1 = p.weeks[0]!;
        // Referenca = nedelja 1 generatora (cilj, dugi, poslednja T doza).
        const step = r.plan.adaptation!.steps.at(-1)!;
        const long = g1.days.find((d) => d.role === 'long')!.workout.km;
        expect(step.preStart).toMatchObject({ targetKm: g1.targetKm, longKm: long });
        // Ned 1: prinudno rasterećenje 0,8 × planirana ned 1 (cilj po pravilu; izvodljiv samo naniže).
        expect(w1!.deload).toBe(true);
        expect(w1!.nominalKm).toBe(Math.round(0.8 * g1.targetKm * 10) / 10);
        expect(w1!.targetKm).toBeLessThanOrEqual(w1!.nominalKm);
        expect(w1!.days.find((d) => d.role === 'long')!.workout.km).toBeLessThanOrEqual(
          Math.floor(0.8 * long * 10) / 10
        );
        const intro = p.input.experience === 'beginner';
        expect(w1!.days.filter((d) => d.workout.kind === 'quality')).toHaveLength(intro ? 0 : 1);
        // Ned 2 = planirana ned 1 (cilj i treninzi), ned 3 = planirana ned 2 (bez rasta, dalje po rasporedu).
        expect([w2!.targetKm, w2!.deload]).toEqual([g1.targetKm, false]);
        expect(work(w2!)).toEqual(work(g1));
        expect(w3!.targetKm).toBe(p.weeks[1]!.targetKm);
        expect(r.reasons.some((x) => x.condition === 'FATIGUE' && x.applied)).toBe(true);
      });

  it('bol 5/8, pauza 10 i rezultat pre starta: prihvaćeni (i bez reference)', () => {
    for (const b of BASES) {
      const p = planOf(b.input);
      for (const s of PRE_START_SCENARIOS) {
        const asOf = addDays(p.input.startDate, -3);
        const r = adaptMarathonV2(p, earlyFacts(p, s, asOf), asOf);
        expect(r.ok ? 'ok' : `${b.id}/${s}: ${JSON.stringify(r.reasons)}`).toBe('ok');
        if (r.ok && s !== 'fatigue')
          expect(r.plan.adaptation!.steps.at(-1)!.preStart).toBeUndefined();
      }
    }
  });
});

describe('N2: BASE_PLATEAU posle nedelje testa (pouka 23)', () => {
  it('feel-d4-24w-45km-e270-B, pauza 35 sreda ned 2 (nov start): prihvaćen; T slot preko nedelje testa menja strukturu', () => {
    const p = planOf(feelInputs().find((x) => x.id === 'feel-d4-24w-45km-e270-B')!.input);
    const asOf = '2026-11-11';
    const r = adaptMarathonV2(p, factsOf(p, 'pause35', asOf), asOf);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    const t = r.plan.weeks.find((w) => w.test)!;
    const tAt = (i: number) => r.plan.weeks[i - 1]!.days.find((d) => d.role === 'q2')?.workout.dose;
    // Test zamenjuje samo Q1: T slot nedelje testa je stvarni kvalitet i progresija ide preko njega.
    // MAR-11 (C11): kad bi uz test i Q2 neki dan bio duži od dugog, Q2 nedelje testa je lagan (pouka 35).
    if (t.notes.some((n) => n.startsWith('Q2: dan kvaliteta je lagan')))
      expect(tAt(t.index)).toBeUndefined();
    else {
      expect(tAt(t.index)).toBeDefined();
      expect(tAt(t.index + 1)!.structure).not.toEqual(tAt(t.index)!.structure);
    }
  });
});
