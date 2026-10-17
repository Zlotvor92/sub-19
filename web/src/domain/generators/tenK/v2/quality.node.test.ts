/* D10 lestvice i strukture, D11 plafoni, D12 progresija — nezavisne provere na uzorku mreže. */

import { describe, expect, it } from 'vitest';
import { generateTenKV2 } from './generate.ts';
import { gridInputs } from './testInputs.ts';
import type { Dose, Phase, PlanWeek, Structure, TenKV2Plan } from './types.ts';
import { structuresForDose } from './workouts.ts';

/** Uzorak mreže; odbijeni ulazi se beleže (test ispod), ostali testovi rade nad planovima. */
const rejected: string[] = [];
const plans: TenKV2Plan[] = gridInputs()
  .filter((_, i) => i % 4 === 1)
  .flatMap(({ id, input }) => {
    const r = generateTenKV2(input);
    if (r.ok) return [r.plan];
    rejected.push(`${id}: ${r.reasons.map((x) => x.code).join(',')}`);
    return [];
  });

it('uzorak mreže se generiše bez odbijanja', () => {
  expect(rejected).toEqual([]);
  expect(plans.length).toBeGreaterThan(500);
});
const steady = (w: PlanWeek): boolean =>
  !w.deload && (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific');
const slot = (w: PlanWeek, r: 'q1' | 'q2'): Dose => w.days.find((d) => d.role === r)!.workout.dose!;
const same = (a: Structure, b: Structure): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Lestvice iz odluke D10 (m u zoni). */
const LADDER: Record<string, number[]> = {
  R: [1200, 1600, 1800, 2000, 2400],
  T_continuous: [2000, 2500, 3000, 3500, 4000, 4500, 5000],
  T_cruise: [2000, 2400, 3000, 3600, 4000, 4800, 5000, 6000, 6400, 8000],
  I: [2000, 2400, 3000, 3600, 4000, 4800, 5000, 6000],
  RP: [2400, 3000, 4000, 4500, 5000, 6000]
};
const CAP = { R: 0.05, I: 0.08, T: 0.1, RP: 0.1 } as const;
const fits = (zone: keyof typeof CAP, m: number, targetKm: number): boolean =>
  m <= Math.floor(CAP[zone] * targetKm * 1000 + 1e-6);

/** Nezavisno: postoji li druga struktura iste doze po pravilu D10. */
function hasOther(ladder: string, doseM: number, s: Structure): boolean {
  const opts: Structure[] = [];
  const splits = (lo: number, hi: number): void => {
    for (let k = 2; k <= 5; k++)
      if (doseM % k === 0 && (doseM / k) % 100 === 0 && doseM / k >= lo && doseM / k <= hi)
        opts.push({ form: 'reps', reps: k, repM: doseM / k });
  };
  if (ladder.startsWith('T')) {
    opts.push({ form: 'continuous', km: doseM / 1000 });
    splits(100, doseM);
  } else if (ladder === 'I') splits(800, 1200);
  else if (ladder === 'RP') splits(100, doseM);
  else
    for (const r of [200, 300])
      if (doseM % r === 0) opts.push({ form: 'reps', reps: doseM / r, repM: r });
  return opts.some((o) => !same(o, s));
}

const SLOT: Record<Phase, [string, string[]]> = {
  base: ['R', ['T_continuous', 'T_cruise']],
  development: ['I', ['T_cruise', 'T_continuous']],
  specific: ['RP', ['T_cruise', 'T_continuous']],
  taper: ['', []],
  race: ['', []]
};

describe('D10: lestvice i strukture', () => {
  it('ista doza druge strukture po pravilu (tačne podele)', () => {
    expect(structuresForDose('T_continuous', 2500)).toEqual([
      { form: 'continuous', km: 2.5 },
      { form: 'reps', reps: 5, repM: 500 }
    ]);
    expect(structuresForDose('T_cruise', 3000)[0]).toEqual({ form: 'reps', reps: 3, repM: 1000 });
    expect(structuresForDose('T_cruise', 3000)).toContainEqual({ form: 'continuous', km: 3 });
    expect(structuresForDose('I', 2400)).toEqual([
      { form: 'reps', reps: 3, repM: 800 },
      { form: 'reps', reps: 2, repM: 1200 }
    ]);
    expect(structuresForDose('I', 3000)).toEqual([{ form: 'reps', reps: 3, repM: 1000 }]);
    expect(structuresForDose('R', 1200)).toEqual([
      { form: 'reps', reps: 6, repM: 200 },
      { form: 'reps', reps: 4, repM: 300 }
    ]);
    expect(structuresForDose('RP', 6000)).toContainEqual({ form: 'reps', reps: 2, repM: 3000 });
  });

  it('kvalitet po fazama: baza R + T kont., razvoj I + T cruise, specifično RP + T cruise', () => {
    for (const p of plans)
      for (const w of p.weeks.filter(steady)) {
        const [q1, q2] = SLOT[w.phase];
        expect(slot(w, 'q1').ladder).toBe(q1);
        expect(q2).toContain(slot(w, 'q2').ladder);
      }
  });
});

describe('D11: jedan plafon po zoni, po treningu', () => {
  it('R ≤ 5 %, I ≤ 8 %, T ≤ 10 %, RP ≤ 10 % ciljnog obima (nedelje 1..N−1)', () => {
    for (const p of plans)
      for (const w of p.weeks.filter((x) => x.phase !== 'race'))
        for (const d of w.days)
          for (const z of ['R', 'I', 'T', 'RP'] as const)
            expect(
              fits(z, Math.round(d.workout.workKm[z] * 1000), w.targetKm),
              `${w.index} ${z}`
            ).toBe(true);
  });
});

describe('D12: progresija', () => {
  it('prva nedelja: prvi nivo obe lestvice', () => {
    for (const p of plans) {
      const w = p.weeks[0]!;
      expect(slot(w, 'q1').doseM).toBe(LADDER.R![0]);
      expect(slot(w, 'q2').doseM).toBe(LADDER.T_continuous![0]);
    }
  });

  it('po slotu: sledeći nivo ako staje u plafon (≤ 1 nivo), inače ista doza druge strukture; doza ne pada', () => {
    let alt = 0;
    let repeat = 0;
    for (const p of plans) {
      const s = p.weeks.filter(steady);
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1]!;
        const b = s[i]!;
        for (const r of ['q1', 'q2'] as const) {
          const da = slot(a, r);
          const db = slot(b, r);
          if (da.ladder !== db.ladder) {
            if (db.ladder === 'T_cruise' && da.ladder === 'T_continuous')
              expect(db.doseM).toBeGreaterThanOrEqual(da.doseM);
            if (db.ladder === 'RP') expect(db.doseM).toBeGreaterThanOrEqual(da.doseM);
            continue;
          }
          const next = LADDER[db.ladder]!.find((m) => m > da.doseM);
          const nextFits = next !== undefined && fits(db.zone, next, b.targetKm);
          if (nextFits) expect(db.doseM, `${b.index} ${r}`).toBe(next);
          else {
            expect(db.doseM, `${b.index} ${r}`).toBe(da.doseM);
            if (hasOther(db.ladder, da.doseM, da.structure)) {
              expect(same(da.structure, db.structure), `${b.index} ${r}`).toBe(false);
              alt++;
            } else {
              expect(same(da.structure, db.structure)).toBe(true);
              expect(b.notes.some((n) => n.includes('ponovljen'))).toBe(true);
              repeat++;
            }
          }
        }
      }
    }
    expect(alt).toBeGreaterThan(0);
    expect(repeat).toBeGreaterThan(0);
  });

  it('glavna doza (T + I + RP) ne opada; nema identičnih uzastopnih ne-rasteretnih nedelja; baza bez platoa', () => {
    const main = (w: PlanWeek): number =>
      w.days.reduce(
        (a, d) =>
          a + Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP) * 1000),
        0
      );
    const key = (w: PlanWeek): string =>
      JSON.stringify(
        w.days.filter((d) => d.workout.kind === 'quality').map((d) => d.workout.blocks)
      );
    for (const p of plans) {
      const s = p.weeks.filter(steady);
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1]!;
        const b = s[i]!;
        expect(main(b), `${b.index}`).toBeGreaterThanOrEqual(main(a));
        expect(key(b)).not.toBe(key(a));
        if (a.phase === 'base' && b.phase === 'base') {
          const ta = slot(a, 'q2');
          const tb = slot(b, 'q2');
          expect(tb.doseM > ta.doseM || !same(ta.structure, tb.structure)).toBe(true);
        }
      }
    }
  });

  it('posle rasterećenja lestvica se nastavlja (ne vraća se)', () => {
    for (const p of plans)
      p.weeks.forEach((w, i) => {
        if (!w.deload) return;
        const before = p.weeks.slice(0, i).filter(steady).pop()!;
        const after = p.weeks.slice(i + 1).find(steady);
        if (!after || after.phase !== before.phase) return;
        for (const r of ['q1', 'q2'] as const)
          expect(slot(after, r).doseM).toBeGreaterThanOrEqual(slot(before, r).doseM);
      });
  });
});
