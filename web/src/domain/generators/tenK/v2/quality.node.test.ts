/* D10 lestvice i strukture, D11 plafoni, D12 progresija, D16 početni nivo — nezavisne provere na
   uzorku mreže. */

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
const capOf = (zone: keyof typeof CAP, targetKm: number): number =>
  Math.floor(CAP[zone] * targetKm * 1000 + 1e-6);
const fits = (zone: keyof typeof CAP, m: number, targetKm: number): boolean =>
  m <= capOf(zone, targetKm);
const ZONE: Record<string, keyof typeof CAP> = {
  R: 'R',
  T_continuous: 'T',
  T_cruise: 'T',
  I: 'I',
  RP: 'RP'
};
/** D16 nezavisno: najviši nivo ≤ 60 % plafona zone za cilj nedelje, najmanje prvi nivo. */
const startM = (ladder: string, targetKm: number): number =>
  LADDER[ladder]!.filter((m) => m <= 0.6 * capOf(ZONE[ladder]!, targetKm) + 1e-6).pop() ??
  LADDER[ladder]![0]!;
const PYRAMID: Structure = { form: 'pyramid', repsM: [1200, 1000, 800] };

/** Nezavisno: postoji li druga struktura iste doze po pravilu D10 (T ≥ 1000 m; I do 6 ili piramida). */
function hasOther(ladder: string, doseM: number, s: Structure): boolean {
  const opts: Structure[] = [];
  const splits = (lo: number, hi: number, kMax = 5): void => {
    for (let k = 2; k <= kMax; k++)
      if (doseM % k === 0 && (doseM / k) % 100 === 0 && doseM / k >= lo && doseM / k <= hi)
        opts.push({ form: 'reps', reps: k, repM: doseM / k });
  };
  if (ladder.startsWith('T')) {
    opts.push({ form: 'continuous', km: doseM / 1000 });
    splits(1000, doseM);
  } else if (ladder === 'I') {
    splits(800, 1200, 6);
    if (doseM === 3000) opts.push(PYRAMID);
  } else if (ladder === 'RP') splits(100, doseM);
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
    // T: deonice ≥ 1000 m; kad podela ne postoji, samo kontinuirano (01b).
    expect(structuresForDose('T_continuous', 2500)).toEqual([{ form: 'continuous', km: 2.5 }]);
    expect(structuresForDose('T_continuous', 3500)).toEqual([{ form: 'continuous', km: 3.5 }]);
    expect(structuresForDose('T_continuous', 4000)).toEqual([
      { form: 'continuous', km: 4 },
      { form: 'reps', reps: 2, repM: 2000 },
      { form: 'reps', reps: 4, repM: 1000 }
    ]);
    expect(structuresForDose('T_cruise', 3000)).toEqual([
      { form: 'reps', reps: 3, repM: 1000 },
      { form: 'continuous', km: 3 },
      { form: 'reps', reps: 2, repM: 1500 }
    ]);
    expect(structuresForDose('T_cruise', 4000)).not.toContainEqual({
      form: 'reps',
      reps: 5,
      repM: 800
    });
    // I: do 6 jednakih deonica 800–1200 m ili piramida 1200 + 1000 + 800 m.
    expect(structuresForDose('I', 2000)).toEqual([{ form: 'reps', reps: 2, repM: 1000 }]);
    expect(structuresForDose('I', 2400)).toEqual([
      { form: 'reps', reps: 3, repM: 800 },
      { form: 'reps', reps: 2, repM: 1200 }
    ]);
    expect(structuresForDose('I', 3000)).toEqual([{ form: 'reps', reps: 3, repM: 1000 }, PYRAMID]);
    expect(structuresForDose('I', 4800)).toEqual([
      { form: 'reps', reps: 4, repM: 1200 },
      { form: 'reps', reps: 6, repM: 800 }
    ]);
    expect(structuresForDose('I', 6000)).toEqual([
      { form: 'reps', reps: 5, repM: 1200 },
      { form: 'reps', reps: 6, repM: 1000 }
    ]);
    expect(structuresForDose('R', 1200)).toEqual([
      { form: 'reps', reps: 6, repM: 200 },
      { form: 'reps', reps: 4, repM: 300 }
    ]);
    expect(structuresForDose('RP', 6000)).toContainEqual({ form: 'reps', reps: 2, repM: 3000 });
  });

  it('svaka T deonica ≥ 1000 m; I do 6 deonica 800–1200 m ili piramida 1200 + 1000 + 800 m', () => {
    let pyramids = 0;
    for (const p of plans)
      for (const w of p.weeks)
        for (const d of w.days) {
          const dose = d.workout.dose;
          if (!dose || dose.ladder === 'RP_sharpener') continue;
          const reps = d.workout.segments.filter((x) => x.kind === 'rep').map((x) => x.km * 1000);
          if (dose.zone === 'T')
            for (const m of reps) expect(m, `${w.index}`).toBeGreaterThanOrEqual(1000);
          if (dose.zone !== 'I') continue;
          if (dose.structure.form === 'pyramid') {
            pyramids++;
            expect(dose.structure).toEqual(PYRAMID);
            expect(reps).toEqual([1200, 1000, 800]);
          } else {
            expect(reps.length).toBeLessThanOrEqual(6);
            for (const m of reps) expect(m >= 800 && m <= 1200).toBe(true);
          }
        }
    expect(pyramids).toBeGreaterThan(0);
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

describe('D16: početni nivo', () => {
  it('prva nedelja: najviši nivo ≤ 60 % plafona zone za cilj nedelje (najmanje prvi nivo)', () => {
    let aboveFirst = 0;
    for (const p of plans) {
      const w = p.weeks[0]!;
      expect(slot(w, 'q1').doseM).toBe(startM('R', w.targetKm));
      expect(slot(w, 'q2').doseM).toBe(startM('T_continuous', w.targetKm));
      if (slot(w, 'q2').doseM > LADDER.T_continuous![0]!) aboveFirst++;
    }
    expect(aboveFirst).toBeGreaterThan(0);
  });

  it('prelaz faze: I = početni nivo; RP = najmanji nivo ≥ max(početni nivo, poslednje I) kad staje', () => {
    for (const p of plans) {
      const s = p.weeks.filter(steady);
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1]!;
        const b = s[i]!;
        if (a.phase === b.phase) continue;
        const q1 = slot(b, 'q1');
        if (q1.step === 'drop') continue;
        if (b.phase === 'development') expect(q1.doseM, `${b.index}`).toBe(startM('I', b.targetKm));
        if (b.phase === 'specific') {
          const lo = Math.max(startM('RP', b.targetKm), slot(a, 'q1').doseM);
          const want = LADDER.RP!.find((m) => m >= lo);
          if (want !== undefined && fits('RP', want, b.targetKm))
            expect(q1.doseM, `${b.index}`).toBe(want);
          else expect(q1.doseM).toBeGreaterThanOrEqual(slot(a, 'q1').doseM);
        }
      }
    }
  });
});

describe('D12: progresija', () => {
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
          // D11 ispred D12: spuštanje doze (napomena, DOSE_DROPPED) proverava validator.
          if (db.step === 'drop') {
            expect(b.notes.some((n) => n.includes('spušten sa'))).toBe(true);
            continue;
          }
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
        const dropped = slot(b, 'q1').step === 'drop' || slot(b, 'q2').step === 'drop';
        if (!dropped) expect(main(b), `${b.index}`).toBeGreaterThanOrEqual(main(a));
        expect(key(b)).not.toBe(key(a));
        if (a.phase === 'base' && b.phase === 'base') {
          const ta = slot(a, 'q2');
          const tb = slot(b, 'q2');
          // Odstupanje 01b: druga struktura ne postoji (T 2,5 / 3,5 km) → ponavljanje sa napomenom.
          const repeat =
            !hasOther(ta.ladder, ta.doseM, ta.structure) &&
            b.notes.some((n) => n.includes('ponovljen'));
          expect(tb.doseM > ta.doseM || !same(ta.structure, tb.structure) || repeat).toBe(true);
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
          if (slot(after, r).step !== 'drop')
            expect(slot(after, r).doseM).toBeGreaterThanOrEqual(slot(before, r).doseM);
      });
  });
});
