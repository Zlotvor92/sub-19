/* W1 (marathon-v2.15.0; nalog vlasnika 11. 11. 2026, briefs/W1-bilo-koja-duzina-plana.md): plan za bilo koji broj
   nedelja. Mreža W1 — osnovni profili (testInputs.w1Profiles: redovan sa rezultatom, po osećaju, početnik; 3–6 dana;
   najmanji i najveći obim) × N. Invarijante su NEZAVISNE od validatora (računaju se iz plana i politike). Pun nivo:
   sve dužine kratkog plana. */

import { describe, expect, it } from 'vitest';
import { FULL } from '@/test/level';
import { generateMarathonV2 } from './generate.ts';
import { MARATHON_V2_POLICY as P, planRule } from './policy.ts';
import { inputOf, w1Profiles, type W1Profile } from './testInputs.ts';
import type { MarathonV2Plan } from './types.ts';

const PROFILES = w1Profiles();
const minOf = (p: W1Profile): number =>
  p.experience === 'beginner' ? P.beginner.weeksMin : P.input.weeksMin;
const planOf = (p: W1Profile, weeks: number): MarathonV2Plan => {
  const r = generateMarathonV2(inputOf({ ...p, weeks }));
  if (!r.ok) throw new Error(`${p.id} N=${weeks}: ${r.reasons.map((x) => x.message).join(' | ')}`);
  return r.plan;
};

/** AGENTS.md uslov 8 + W1: plan postoji, trkačka je poslednja, nema nedelje ispod minimuma M15 (osim trkačke), nema
    praznog treninga, dugi ≥ lagan u svakoj nedelji. */
function usable(p: W1Profile, plan: MarathonV2Plan): string[] {
  const out: string[] = [];
  const rule = planRule(p.days.length, p.experience ?? 'regular')!;
  const ws = plan.weeks;
  if (ws[ws.length - 1]!.phase !== 'race') out.push('trkačka nije poslednja');
  if (ws.filter((w) => w.phase === 'race').length !== 1) out.push('nije tačno jedna trkačka');
  for (const w of ws) {
    if (w.phase !== 'race' && w.plannedKm < rule.weekMinKm - 0.05)
      out.push(`ned ${w.index}: ${w.plannedKm} < ${rule.weekMinKm} km`);
    for (const d of w.days)
      if (!(d.workout.km > 0) || !(d.workout.sec > 0)) out.push(`ned ${w.index}: prazan ${d.date}`);
    const long = w.days.find((d) => d.role === 'long');
    if (long)
      for (const d of w.days)
        if (d.role === 'easy' && d.workout.km > long.workout.km + 1e-9)
          out.push(`ned ${w.index}: lagan ${d.workout.km} > dugi ${long.workout.km}`);
  }
  return out;
}

describe('W1-A kratak plan (1 ≤ N < MIN)', () => {
  const Ns = (p: W1Profile): number[] =>
    FULL ? Array.from({ length: minOf(p) - 1 }, (_, i) => i + 1) : [1, 2, 3, minOf(p) - 1];

  it('plan se pravi; faze = poslednjih N nedelja plana od MIN nedelja; upotrebljiv; nedelje 1–2 bez rasterećenja', () => {
    let n = 0;
    for (const p of PROFILES) {
      const std = planOf(p, minOf(p)).weeks.map((w) => w.phase);
      for (const N of Ns(p)) {
        const plan = planOf(p, N);
        n++;
        expect(plan.weeks.length).toBe(N);
        expect(
          plan.weeks.map((w) => w.phase),
          `${p.id} N=${N}`
        ).toEqual(std.slice(std.length - N));
        expect(usable(p, plan), `${p.id} N=${N}`).toEqual([]);
        expect(
          plan.weeks.filter((w) => w.deload && w.index <= 2).map((w) => w.index),
          `${p.id} N=${N}`
        ).toEqual([]);
        // Obim i doze unapred: nedelja 1 izgradnje = trenutni obim (osim najbližeg izvodljivog naniže, M6).
        const w1 = plan.weeks[0]!;
        if (w1.phase !== 'taper' && w1.phase !== 'race')
          expect(w1.targetKm, `${p.id} N=${N}`).toBeLessThanOrEqual(p.km);
      }
    }
    expect(n).toBeGreaterThan(0);
  });

  it('N = 1 samo trkačka nedelja, N = 2 taper + trkačka; početnik bez uvoda kad je odsečen', () => {
    for (const p of PROFILES) {
      expect(planOf(p, 1).weeks.map((w) => w.phase)).toEqual(['race']);
      expect(planOf(p, 2).weeks.map((w) => w.phase)).toEqual(['taper', 'race']);
    }
    const beg = PROFILES.find((p) => p.experience === 'beginner')!;
    const intro = (plan: MarathonV2Plan): number[] =>
      plan.weeks.filter((w) => w.notes.some((x) => x.startsWith('Uvod (M17)'))).map((w) => w.index);
    expect(intro(planOf(beg, 15))).toEqual([1]);
    expect(intro(planOf(beg, 14))).toEqual([]);
    expect(intro(planOf(beg, 16))).toEqual([1, 2]);
  });
});

describe('W1-B dug plan (MAX < N ≤ 52)', () => {
  const MAX = P.input.weeksMax;
  const Ns = FULL
    ? [MAX + 1, MAX + 2, MAX + 3, MAX + 4, MAX + 5, MAX + 8, MAX + 15, 52]
    : [MAX + 1, 52];

  it('prvih N − MAX nedelja osnovna priprema (baza, bez kvaliteta, trenutni obim, svaka 4. rasterećenje); ostatak = plan od MAX nedelja', () => {
    for (const p of PROFILES) {
      const std = planOf(p, MAX).weeks;
      const rule = planRule(p.days.length, p.experience ?? 'regular')!;
      for (const N of Ns) {
        const plan = planOf(p, N);
        const k = N - MAX;
        expect(plan.weeks.length).toBe(N);
        expect(usable(p, plan), `${p.id} N=${N}`).toEqual([]);
        for (const w of plan.weeks.slice(0, k)) {
          const at = `${p.id} N=${N} ned ${w.index}`;
          expect(w.phase, at).toBe('base');
          expect(w.deload, at).toBe(w.index % 4 === 0);
          expect(
            w.days.filter((d) => d.workout.kind === 'quality' || d.role === 'test'),
            at
          ).toEqual([]);
          expect(w.targetKm, at).toBe(
            w.deload ? Math.max(Math.round(8 * p.km) / 10, rule.weekMinKm) : p.km
          );
          expect(w.days.filter((d) => d.workout.title.includes('ubrzanja')).length, at).toBe(1);
        }
        // Standardni deo kreće od istog trenutnog obima: faze, rasterećenja, test i ciljevi kao plan od MAX nedelja.
        const tail = plan.weeks
          .slice(k)
          .map((w) => [w.phase, w.deload, w.test ?? false, w.targetKm]);
        expect(tail, `${p.id} N=${N}`).toEqual(
          std.map((w) => [w.phase, w.deload, w.test ?? false, w.targetKm])
        );
      }
    }
  });
});
