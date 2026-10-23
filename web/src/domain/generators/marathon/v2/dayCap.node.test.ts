/* MAR-04b (marathon-v2.3.1): pouka 32 za sve zone — plafon zone je jedna funkcija sa dva člana: M11 udeo i
   najveća doza čiji dan (WU + rad + oporavci + CD, džog metrima sporim E) traje ≤ dugi iste nedelje; najniži nivo
   zone izuzet (upozorenje LONG_SHORTER_THAN_QUALITY). Važi u izgradnji, rasterećenju i taperu (MP tapera ≥ 2 × 3000 m,
   M7a). Planovi su iz merenja na bd07eec (marathon-v2.3.0), gde svaki ima dan iznad najnižeg nivoa duži od dugog
   (artifacts/segment-04b) — na bd07eec ovaj fajl pada. Provera trajanja je nezavisna od konstruktora (čita plan). */

import { describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { generateMarathonV2 } from './generate.ts';
import { overLong } from './grid.harness.node.test.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import { addDays } from './dates.ts';
import {
  beginnerInputs,
  chainFacts,
  denseInputs,
  earlyFacts,
  earlyGridBases,
  factsOf,
  feelInputs,
  gridInputs,
  recentInputs
} from './testInputs.ts';
import { validatePlan } from './validate.ts';
import { doseOf } from './workouts.ts';

/** Cilj nedelje 1 na bd07eec (m-base, artifacts/segment-04b). */
const W1: Record<string, number> = {
  'dense-d6-50km-v77.5': 50,
  'recent-d4-16w-35km-v70-B-r6': 30.4,
  'recent-d3-16w-50km-v70-A-r8': 28.5,
  'recent-d5-16w-50km-v70-C-r10': 50,
  'd4-21w-55km-v45-A-sat': 55,
  'feel-d4-21w-55km-e270-A': 55
};

const CASES: [string, () => { id: string; input: Record<string, unknown> }[]][] = [
  ['dense-d6-50km-v77.5', denseInputs], // izgradnja T, ned 1 (pouka 9)
  ['recent-d4-16w-35km-v70-B-r6', recentInputs], // izgradnja R
  ['recent-d3-16w-50km-v70-A-r8', recentInputs], // izgradnja T, 3 dana
  ['recent-d5-16w-50km-v70-C-r10', recentInputs], // rasterećenje T
  ['d4-21w-55km-v45-A-sat', gridInputs], // taper MP
  ['feel-d4-21w-55km-e270-A', feelInputs] // taper MP, po osećaju
];

describe('pouka 32 za sve zone (MAR-04b): dan iznad najnižeg nivoa nikad duži od dugog', () => {
  for (const [id, list] of CASES)
    it(id, () => {
      const c = list().find((x) => x.id === id)!;
      const r = generateMarathonV2(c.input);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(overLong(r.plan).above).toEqual([]);
      // Pouka 9: drugi član menja dozu, ne cilj nedelje 1 (ciljevi kao na bd07eec, artifacts/segment-04b).
      expect(r.plan.weeks[0]!.targetKm).toBe(W1[id]);
    });

  it('izuzetak najnižeg nivoa: T 2,0 km duži od dugog ostaje uz LONG_SHORTER_THAN_QUALITY; viši nivo se ne uzima', () => {
    const c = recentInputs().find((x) => x.id === 'recent-d3-16w-50km-v70-A-r8')!;
    const r = generateMarathonV2(c.input);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    // bd07eec: ned 2 T 3000 m (45 > 41 min).
    expect(r.plan.weeks[1]!.days.find((d) => d.role === 'q1')!.workout.dose!.doseM).toBe(2000);
    expect(overLong(r.plan).lowest.length).toBeGreaterThan(0);
    expect(r.plan.warnings.some((v) => v.rule === 'LONG_SHORTER_THAN_QUALITY')).toBe(true);
  });

  it('rasterećenje: T spušten ispod ≈ 60 % uz napomenu (pouka 32)', () => {
    const c = recentInputs().find((x) => x.id === 'recent-d5-16w-50km-v70-C-r10')!;
    const r = generateMarathonV2(c.input);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    const w4 = r.plan.weeks[3]!;
    expect(w4.deload).toBe(true);
    expect(
      w4.notes.some((n) => n.includes('T 2,0 km umesto 3,0 km') && n.includes('pouka 32'))
    ).toBe(true);
  });

  it('taper: MP spušten po lestvici, ne ispod 2 × 3000 m (M7a), uz napomenu', () => {
    const c = gridInputs().find((x) => x.id === 'd4-21w-55km-v45-A-sat')!;
    const r = generateMarathonV2(c.input);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    const t = r.plan.weeks.filter((w) => w.phase === 'taper');
    const mp = t.flatMap((w) => w.days.map((d) => d.workout.dose).filter((d) => d?.zone === 'MP'));
    expect(mp.every((d) => d!.doseM >= doseOf(P.taper.mpMin))).toBe(true);
    expect(t.some((w) => w.notes.some((n) => n.includes('pouka 32')))).toBe(true);
  });
});

describe('IDENTICAL_WEEKS uz pouku 32 (odluka organizatora MAR-04b, sudar 1)', () => {
  const base = earlyGridBases(182, 78, 42).find((b) => b.id === 'beg-d4-16w-25km-e330-A')!;
  const p0 = generateMarathonV2(base.input);
  if (!p0.ok) throw new Error('plan');
  const asOf = '2026-11-22';
  const facts = earlyFacts(p0.plan, 'pause10pain5', asOf);

  it('najniži nivo (T 1,5 km), bez druge strukture, sledeći nivo ne staje u trajanje dugog → upozorenje', () => {
    const r = adaptMarathonV2(p0.plan, facts, asOf);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    expect(r.plan.warnings.some((v) => v.rule === 'IDENTICAL_WEEKS' && v.week === 6)).toBe(true);
  });

  it('negativno: kad sledeći nivo staje (veći cilj nedelje → duži dugi iste nedelje), isto ponavljanje je greška', () => {
    const r = adaptMarathonV2(p0.plan, facts, asOf);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    const weeks = r.plan.weeks.map((w) => (w.index !== 6 ? w : { ...w, targetKm: 40 }));
    const v = validatePlan({ ...r.plan, weeks });
    expect(v.some((x) => x.rule === 'IDENTICAL_WEEKS' && x.severity === 'error')).toBe(true);
  });

  it("T 2,0 km (nije najniži): 2 × 1000 m duže od dugog, 3,0 km iznad M11 → upozorenje; kad druga struktura staje → greška (uslov 2')", () => {
    const c = beginnerInputs().find((x) => x.id === 'beg-d4-22w-30km-e450-B')!;
    const g = generateMarathonV2(c.input);
    if (!g.ok) throw new Error('plan');
    const a1 = '2026-12-06';
    const r1 = adaptMarathonV2(g.plan, factsOf(g.plan, 'chain', a1), a1);
    if (!r1.ok) throw new Error(JSON.stringify(r1.reasons));
    const a2 = addDays(a1, 7);
    const r = adaptMarathonV2(r1.plan, chainFacts(r1.plan, a2), a2);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    const w7 = r.plan.weeks[6]!;
    expect(w7.notes.some((n) => n.includes('bi bila duža od dugog (pouka 32)'))).toBe(true);
    expect(r.plan.warnings.some((v) => v.rule === 'IDENTICAL_WEEKS' && v.week === 7)).toBe(true);
    // Veći cilj → duži dugi: 2 × 1000 m staje, 3,0 km i dalje iznad M11 (10 % od 25 km) → greška.
    const weeks = r.plan.weeks.map((w) => (w.index !== 7 ? w : { ...w, targetKm: 25 }));
    const v = validatePlan({ ...r.plan, weeks });
    expect(v.some((x) => x.rule === 'IDENTICAL_WEEKS' && x.severity === 'error')).toBe(true);
  });
});
