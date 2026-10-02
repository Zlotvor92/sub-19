/* D2 (docs/ENGINE_CHANGES.md): tempo rasta OBIMA (`volIntensity`) je odvojen od tempa napretka FORME (`intensity`).
   Stari generator je koristio JEDAN izbor za oba. Izostavljen `volIntensity` mora davati TAČNO isti plan kao pre
   (planovi već u bazi nemaju to polje) — to drži i golden-master otisak, a ovde je dokazano po distancama. */

import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../../date';
import type { Intensity, PlanGenerationInput, TrainingPlan } from '../types';
import { generatePlan } from './generatePlan';

const START = parseIsoDate('2026-10-05') as IsoDate;
const INTENSITIES: readonly Intensity[] = ['kons', 'std', 'agr'];

const mk = (extra: Partial<PlanGenerationInput> = {}): PlanGenerationInput => ({
  startDate: START,
  raceDate: addDays(START, 24 * 7 + 6),
  raceDistM: 5000,
  pb: { distM: 5000, sec: 1237 },
  weeklyKm: 40,
  runDays: 5,
  quality: 2,
  intensity: 'std',
  trainedRecently: true,
  ...extra
});
const plan = (extra: Partial<PlanGenerationInput> = {}): TrainingPlan => {
  const p = generatePlan(mk(extra));
  if ('error' in p) throw new Error(p.error);
  return p;
};
const vols = (p: TrainingPlan): number[] => p.weeks.map((w) => w.vol);

describe('volIntensity: izostavljen = isto kao intensity', () => {
  const DISTS: ReadonlyArray<[number, number, number, number]> = [
    [5000, 1237, 40, 24],
    [10000, 2600, 40, 28],
    [21097.5, 5400, 45, 30],
    [42195, 12600, 50, 36]
  ];
  for (const [raceDistM, sec, weeklyKm, weeks] of DISTS) {
    it(`${raceDistM} m: plan bez polja je identičan planu sa volIntensity = intensity`, () => {
      for (const intensity of INTENSITIES) {
        const base = {
          raceDistM,
          pb: { distM: raceDistM, sec },
          weeklyKm,
          intensity,
          raceDate: addDays(START, weeks * 7 + 6)
        };
        expect(plan({ ...base, volIntensity: intensity }), `${raceDistM} ${intensity}`).toEqual(
          plan(base)
        );
      }
    });
  }
});

describe('volIntensity: menja obim, ne menja procenu forme', () => {
  const by = (v: Intensity): TrainingPlan => plan({ intensity: 'std', volIntensity: v });

  it('procena (VDOT, predviđeno vreme, tempo trke) ne zavisi od tempa rasta obima', () => {
    const ref = by('std').meta;
    for (const v of INTENSITIES) {
      const m = by(v).meta;
      expect([m.vdot0, m.vdotGoal, m.predictedSec, m.racePace], `volIntensity=${v}`).toEqual([
        ref.vdot0,
        ref.vdotGoal,
        ref.predictedSec,
        ref.racePace
      ]);
    }
  });

  it('brži rast obima = više kilometara u fazi izgradnje (kons ≤ std ≤ agr, a razlika postoji)', () => {
    const k = vols(by('kons'));
    const s = vols(by('std'));
    const a = vols(by('agr'));
    const build = 8; // posle toga sva tri stižu do istog vrhunca
    const sum = (x: number[]): number => x.slice(0, build).reduce((t, n) => t + n, 0);
    expect(sum(k)).toBeLessThan(sum(s));
    expect(sum(s)).toBeLessThan(sum(a));
  });

  it('vrhunac plana je odredište distance, ne izbor tempa — na 5K su svi isti (±0,5 km)', () => {
    const peaks = INTENSITIES.map((v) => Math.max(...vols(by(v))));
    expect(Math.max(...peaks) - Math.min(...peaks)).toBeLessThan(0.5);
  });

  it('obrnuto: tempo napretka forme NE menja plan obima (preostala sprega preko vremenskih plafona ≤ 0,5 km po nedelji — D1)', () => {
    const ref = vols(plan({ intensity: 'std', volIntensity: 'std' }));
    for (const intensity of INTENSITIES) {
      const v = vols(plan({ intensity, volIntensity: 'std' }));
      v.forEach((x, i) =>
        expect(
          Math.abs(x - (ref[i] as number)),
          `${intensity} nedelja ${i + 1}`
        ).toBeLessThanOrEqual(0.5)
      );
    }
  });

  it('tempo napretka i dalje određuje formu: agr ima viši cilj od kons', () => {
    const lo = plan({ intensity: 'kons', volIntensity: 'std' }).meta;
    const hi = plan({ intensity: 'agr', volIntensity: 'std' }).meta;
    expect(hi.vdotGoal).toBeGreaterThan(lo.vdotGoal);
    expect(hi.predictedSec).toBeLessThan(lo.predictedSec);
  });
});

describe('volIntensity: validacija', () => {
  it('nepoznata vrednost je greška, ne NaN', () => {
    for (const bad of ['xx', '', 1, null, true]) {
      const r = generatePlan(mk({ volIntensity: bad as unknown as Intensity }));
      expect('error' in r, String(bad)).toBe(true);
    }
  });
  it('izostavljen je dozvoljen', () => {
    expect('error' in generatePlan(mk())).toBe(false);
  });
});
