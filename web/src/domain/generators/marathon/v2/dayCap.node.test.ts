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
import {
  denseInputs,
  earlyFacts,
  earlyGridBases,
  feelInputs,
  gridInputs,
  recentInputs
} from './testInputs.ts';
import { validatePlan } from './validate.ts';
import { doseOf } from './workouts.ts';

/** Cilj nedelje 1 na bd07eec (m-base, artifacts/segment-04b). */
const W1: Record<string, number> = {
  'dense-d6-50km-v77.5': 50,
  // MAR-11 (T1): lagani ≤ 0,8 × dugi (dugi na plafonu skoka) — ned 1 niža; 3 dana 16 ned r 8 → RECENT_LONG_TOO_SHORT,
  // zamena 12 ned.
  'recent-d4-16w-35km-v70-B-r6': 29,
  'recent-d3-12w-50km-v70-A-r8': 26.7,
  'recent-d5-16w-50km-v70-C-r10': 50,
  'd4-21w-55km-v45-A-sat': 55,
  'feel-d4-21w-55km-e270-A': 55
};

const CASES: [string, () => { id: string; input: Record<string, unknown> }[]][] = [
  ['dense-d6-50km-v77.5', denseInputs], // izgradnja T, ned 1 (pouka 9)
  ['recent-d4-16w-35km-v70-B-r6', recentInputs], // izgradnja R
  ['recent-d3-12w-50km-v70-A-r8', recentInputs], // izgradnja T, 3 dana
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
    const c = recentInputs().find((x) => x.id === 'recent-d3-12w-50km-v70-A-r8')!;
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

  it('taper: MP spušten po lestvici, ispod 2 × 3000 m samo skraćen do trajanja dugog (M7a, MAR-11 T2), uz napomenu', () => {
    const c = gridInputs().find((x) => x.id === 'd4-21w-55km-v45-A-sat')!;
    const r = generateMarathonV2(c.input);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    const t = r.plan.weeks.filter((w) => w.phase === 'taper');
    // MAR-11 (T2): ispod 2 × 3000 m samo skraćen kontinuirani blok, dan MP ≤ dugi iste nedelje.
    for (const w of t) {
      const d = w.days.find((x) => x.workout.dose?.zone === 'MP')!;
      const L = w.days.find((x) => x.role === 'long')!;
      expect(d.workout.sec).toBeLessThanOrEqual(L.workout.sec);
      if (d.workout.dose!.doseM < doseOf(P.taper.mpMin))
        expect(d.workout.dose!.structure.form).toBe('continuous');
    }
    expect(t.some((w) => w.notes.some((n) => n.includes('pouka 32')))).toBe(true);
  });
});

describe('IDENTICAL_WEEKS uz pouku 32 (odluka organizatora MAR-04b, sudar 1)', () => {
  const base = earlyGridBases(182, 78, 42).find((b) => b.id === 'beg-d4-16w-25km-e330-A')!;
  const p0 = generateMarathonV2(base.input);
  if (!p0.ok) throw new Error('plan');
  const asOf = '2026-11-22';
  const facts = earlyFacts(p0.plan, 'pause10pain5', asOf);

  // MAR-11 (T1): lagani ≤ 0,8 × dugi — dugi je duži, sledeći nivo staje: ponavljanje doze iz MAR-04b ovde više ne
  // nastaje (pretraga rane mreže početnika, 0 tokova sa IDENTICAL_WEEKS); validator i dalje obara ponavljanje.
  it('MAR-11: tok pauza 10 + bol 5 — doza raste, bez IDENTICAL_WEEKS, validator čist', () => {
    const r = adaptMarathonV2(p0.plan, facts, asOf);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    expect(r.plan.warnings.some((v) => v.rule === 'IDENTICAL_WEEKS')).toBe(false);
    expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
  });

  it('negativno: isti kvalitet kao prethodna nedelja izgradnje bez napomene ponavljanja je greška', () => {
    const r = adaptMarathonV2(p0.plan, facts, asOf);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    const q = (i: number) => r.plan.weeks[i - 1]!.days.find((d) => d.role === 'q1');
    const [a5, a7] = [q(5)!, q(7)!];
    const weeks = r.plan.weeks.map((w) =>
      w.index !== 7
        ? w
        : { ...w, days: w.days.map((d) => (d === a7 ? { ...d, workout: a5.workout } : d)) }
    );
    const v = validatePlan({ ...r.plan, weeks });
    expect(v.some((x) => x.rule === 'IDENTICAL_WEEKS' && x.severity === 'error')).toBe(true);
  });
});
