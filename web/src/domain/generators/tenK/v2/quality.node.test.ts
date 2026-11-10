/* D10/D22/D30 lestvice i strukture, D11 plafoni, D12 progresija, D16 početni nivo, D18 jedan kvalitet (3 dana)
   — nezavisne provere na uzorku mreže 02 (3/4/5/6 dana). */

import { beforeAll, describe, expect, it } from 'vitest';
import { GRID_TIMEOUT } from './level.harness.node.test.ts';
import { generateTenKV2 } from './generate.ts';
import { ladderFor } from './quality.ts';
import { P35_DROP } from './week.ts';
import { grid02Inputs } from './testInputs.ts';
import type { Dose, Phase, PlanWeek, Structure, TenKV2Plan } from './types.ts';
import { structuresForDose } from './workouts.ts';

/** Uzorak mreže 02 (svaki 8. ulaz po broju dana); odbijeni ulazi se beleže (test ispod). */
const rejected: string[] = [];
const plans: TenKV2Plan[] = [];
// Uzorak se generiše u beforeAll (ne pri učitavanju fajla), v. level.harness.node.test.ts.
beforeAll(() => {
  for (const n of [3, 4, 5, 6] as const)
    for (const { id, input } of grid02Inputs(n).filter((_, i) => i % 8 === 1)) {
      const r = generateTenKV2(input);
      if (r.ok) plans.push(r.plan);
      else rejected.push(`${id}: ${r.reasons.map((x) => x.code).join(',')}`);
    }
}, GRID_TIMEOUT);
const one = (p: TenKV2Plan): boolean => p.input.runDays.length === 3;

it('uzorak mreže 02 se generiše bez odbijanja', () => {
  expect(rejected).toEqual([]);
  expect(plans.length).toBe(1980);
});
const steady = (w: PlanWeek): boolean =>
  !w.deload && (w.phase === 'base' || w.phase === 'development' || w.phase === 'specific');
/** 06f (pouka 35): nedelja izgradnje sa drugim danom kvaliteta laganim (napomena week.ts). */
const p35 = (w: PlanWeek): boolean => w.notes.some((n) => n.startsWith(P35_DROP));
/** D27/D35: nedelja testa (test na danu Q1 umesto kvaliteta). */
const hasTest = (w: PlanWeek): boolean => w.days.some((d) => d.role === 'test');
const slot = (w: PlanWeek, r: 'q1' | 'q2'): Dose | undefined =>
  w.days.find((d) => d.role === r)?.workout.dose ?? undefined;
const same = (a: Structure, b: Structure): boolean => JSON.stringify(a) === JSON.stringify(b);
/** D34: nedelja B (specifična, Q2 = I održavanja; samo 4–6 dana). */
const isB = (w: PlanWeek): boolean => w.phase === 'specific' && slot(w, 'q2')?.ladder === 'I';

/** Lestvice iz odluke D10 (m u zoni). */
const LADDER: Record<string, number[]> = {
  R: [1200, 1600, 1800, 2000, 2400],
  T_continuous: [2000, 2500, 3000, 3500, 4000, 4500, 5000],
  T_cruise: [2000, 2400, 3000, 3600, 4000, 4800, 5000, 6000, 6400, 8000],
  I: [2000, 2400, 3000, 3600, 4000, 4800, 5000, 6000],
  /* D33 (10k-v2.11.0): do 8,0 km. */
  RP: [2400, 3000, 4000, 4500, 5000, 6000, 6400, 8000]
};
/** D11; D33: RP 10 % ispod 40 km cilja, 15 % od 40 km. */
const CAP = { R: 0.05, I: 0.08, T: 0.1, RP: 0.1 } as const;
/** P8 G2 (D40): prvi nivo lestvice zone — plafon nije ispod njega (R 6 × 200, I 2 × 1000, T 2,0 km, RP 2 × 1200 m). */
const FIRST: Record<keyof typeof CAP, number> = { R: 1200, I: 2000, T: 2000, RP: 2400 };
const capOf = (zone: keyof typeof CAP, targetKm: number): number =>
  Math.max(
    Math.floor((zone === 'RP' && targetKm >= 40 - 1e-9 ? 0.15 : CAP[zone]) * targetKm * 1000 + 1e-6),
    FIRST[zone]
  );
const fits = (zone: keyof typeof CAP, m: number, targetKm: number): boolean =>
  m <= capOf(zone, targetKm);
const ZONE: Record<string, keyof typeof CAP> = {
  R: 'R',
  T_continuous: 'T',
  T_cruise: 'T',
  I: 'I',
  RP: 'RP'
};
/** D16 nezavisno: najviši nivo ≤ 60 % plafona zone za cilj nedelje, najmanje prvi nivo; D37 (P5 F4): T i I 80 %. */
const START_SHARE = { R: 0.6, I: 0.8, T: 0.8, RP: 0.6 } as const;
const startM = (ladder: string, targetKm: number): number =>
  LADDER[ladder]!.filter(
    (m) => m <= START_SHARE[ZONE[ladder]!] * capOf(ZONE[ladder]!, targetKm) + 1e-6
  ).pop() ?? LADDER[ladder]![0]!;
const PYRAMID: Structure = { form: 'pyramid', repsM: [1200, 1000, 800] };

/** Nezavisno: postoji li druga struktura iste doze po pravilu D10/D22/D30 (T ≥ 1000 m i RP ≥ 800 m,
    deljivo sa 100 m, a bez takve podele sa 50 m — T i kontinuirano; I do 6 ili piramida; R 200/300/400 m). */
function hasOther(ladder: string, doseM: number, s: Structure): boolean {
  const opts: Structure[] = [];
  const splits = (lo: number, hi: number, kMax = 5, round = 100): Structure[] => {
    const out: Structure[] = [];
    for (let k = 2; k <= kMax; k++)
      if (doseM % k === 0 && (doseM / k) % round === 0 && doseM / k >= lo && doseM / k <= hi)
        out.push({ form: 'reps', reps: k, repM: doseM / k });
    return out;
  };
  if (ladder.startsWith('T') || ladder === 'RP') {
    if (ladder !== 'RP') opts.push({ form: 'continuous', km: doseM / 1000 });
    const lo = ladder === 'RP' ? 800 : 1000;
    const s100 = splits(lo, doseM);
    opts.push(...(s100.length > 0 ? s100 : splits(lo, doseM, 5, 50)));
  } else if (ladder === 'I') {
    opts.push(...splits(800, 1200, 6));
    if (doseM === 3000) opts.push(PYRAMID);
  } else
    for (const r of [200, 300, 400])
      if (doseM % r === 0) opts.push({ form: 'reps', reps: doseM / r, repM: r });
  return opts.some((o) => !same(o, s));
}

const SLOT: Record<Phase, [string[], string[]]> = {
  base: [['R'], ['T_continuous', 'T_cruise']],
  development: [['I'], ['T_cruise', 'T_continuous']],
  specific: [['RP'], ['T_cruise', 'T_continuous']],
  taper: [[], []],
  race: [[], []]
};
/** D18: 3 dana — jedan slot. */
const SLOT_ONE: Record<Phase, string[]> = {
  base: ['T_continuous', 'T_cruise'],
  development: ['T_cruise', 'T_continuous'],
  specific: ['RP'],
  taper: [],
  race: []
};

describe('D10/D22/D30: lestvice i strukture', () => {
  it('ista doza druge strukture po pravilu (tačne podele; T 50 m samo bez podele na 100 m; R 400 m)', () => {
    // D22: T deonice ≥ 1000 m deljive sa 50 m kad podela na 100 m ne postoji (primeri iz odluke).
    expect(structuresForDose('T_continuous', 2500)).toEqual([
      { form: 'continuous', km: 2.5 },
      { form: 'reps', reps: 2, repM: 1250 }
    ]);
    expect(structuresForDose('T_continuous', 3500)).toEqual([
      { form: 'continuous', km: 3.5 },
      { form: 'reps', reps: 2, repM: 1750 }
    ]);
    expect(structuresForDose('T_continuous', 4500)).toEqual([
      { form: 'continuous', km: 4.5 },
      { form: 'reps', reps: 3, repM: 1500 }
    ]);
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
    // I: do 6 jednakih deonica 800–1200 m ili piramida 1200 + 1000 + 800 m (bez 50 m).
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
    // D22: R deonice 200 / 300 / 400 m.
    expect(structuresForDose('R', 1200)).toEqual([
      { form: 'reps', reps: 6, repM: 200 },
      { form: 'reps', reps: 4, repM: 300 },
      { form: 'reps', reps: 3, repM: 400 }
    ]);
    expect(structuresForDose('R', 1600)).toEqual([
      { form: 'reps', reps: 8, repM: 200 },
      { form: 'reps', reps: 4, repM: 400 }
    ]);
    expect(structuresForDose('R', 2000)).toEqual([
      { form: 'reps', reps: 10, repM: 200 },
      { form: 'reps', reps: 5, repM: 400 }
    ]);
    // D30a: RP deonice ≥ 800 m (T ostaje ≥ 1000 m), 50 m kad podele na 100 m nema (bez kontinuiranog).
    // 10k-v2.2.1 (D22b, ≥ 1000 m): 2,4 km samo 2 × 1200, 4,5 km samo 3 × 1500 m (ponavljanje slota).
    expect(structuresForDose('RP', 2500)).toEqual([{ form: 'reps', reps: 2, repM: 1250 }]);
    expect(structuresForDose('RP', 3500)).toEqual([{ form: 'reps', reps: 2, repM: 1750 }]);
    expect(structuresForDose('RP', 2400)).toEqual([
      { form: 'reps', reps: 2, repM: 1200 },
      { form: 'reps', reps: 3, repM: 800 }
    ]);
    expect(structuresForDose('RP', 3000)).toEqual([
      { form: 'reps', reps: 3, repM: 1000 },
      { form: 'reps', reps: 2, repM: 1500 }
    ]);
    expect(structuresForDose('RP', 4500)).toEqual([
      { form: 'reps', reps: 3, repM: 1500 },
      { form: 'reps', reps: 5, repM: 900 }
    ]);
    expect(structuresForDose('RP', 4000)).toEqual([
      { form: 'reps', reps: 4, repM: 1000 },
      { form: 'reps', reps: 2, repM: 2000 },
      { form: 'reps', reps: 5, repM: 800 }
    ]);
    expect(structuresForDose('RP', 6000)).toContainEqual({ form: 'reps', reps: 2, repM: 3000 });
    // T bez promene: 4,0 km nema 5 × 800 m.
    expect(structuresForDose('T_cruise', 4000)).not.toContainEqual({
      form: 'reps',
      reps: 5,
      repM: 800
    });
    for (const m of [2000, 2400, 2500, 3000, 3500, 3600, 4000, 4500, 4800, 5000, 6000])
      for (const s of structuresForDose('RP', m)) {
        expect(s.form, `${m}`).toBe('reps');
        if (s.form === 'reps') expect(s.repM, `${m}`).toBeGreaterThanOrEqual(800);
      }
  });

  it('svaka T deonica ≥ 1000 m i RP ≥ 800 m (deljiva sa 50 m, D22/D30); I do 6 deonica 800–1200 m ili piramida; R 200/300/400 m', () => {
    let pyramids = 0;
    let t50 = 0;
    let rp50 = 0;
    let rp800 = 0;
    let r400 = 0;
    for (const p of plans)
      for (const w of p.weeks)
        for (const d of w.days) {
          const dose = d.workout.dose;
          if (!dose || dose.ladder === 'RP_sharpener') continue;
          const reps = d.workout.segments
            .filter((x) => x.kind === 'rep')
            .map((x) => Math.round(x.km * 1000));
          if (dose.zone === 'T' || dose.zone === 'RP')
            for (const m of reps) {
              expect(m, `${w.index} ${dose.zone}`).toBeGreaterThanOrEqual(
                dose.zone === 'T' ? 1000 : 800
              );
              expect(m % 50).toBe(0);
              if (m % 100 !== 0 && dose.zone === 'T') t50++;
              if (m % 100 !== 0 && dose.zone === 'RP') rp50++;
              if (m < 1000 && dose.zone === 'RP') rp800++;
            }
          if (dose.zone === 'R')
            for (const m of reps) {
              expect([200, 300, 400]).toContain(m);
              if (m === 400) r400++;
            }
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
    expect(t50).toBeGreaterThan(0);
    expect(rp50).toBeGreaterThan(0);
    expect(rp800).toBeGreaterThan(0);
    expect(r400).toBeGreaterThan(0);
  });

  it('kvalitet po fazama: 4–6 dana Q1 R/I/RP + Q2 T; 3 dana (D18) jedan slot T kont. / T cruise / RP', () => {
    for (const p of plans)
      for (const w of p.weeks.filter(steady)) {
        // D35 (P5 F1): kontrolni test umesto Q1 (3 dana: umesto jedinog kvaliteta).
        if (hasTest(w)) {
          expect(slot(w, 'q1')).toBeUndefined();
          if (one(p) || p35(w)) continue;
          expect(SLOT[w.phase][1]).toContain(slot(w, 'q2')!.ladder);
          continue;
        }
        if (one(p)) {
          expect(SLOT_ONE[w.phase]).toContain(slot(w, 'q1')!.ladder);
          expect(slot(w, 'q2')).toBeUndefined();
          continue;
        }
        const [q1, q2] = SLOT[w.phase];
        expect(q1).toContain(slot(w, 'q1')!.ladder);
        if (p35(w)) expect(slot(w, 'q2')).toBeUndefined();
        // D34: specifična nedelja B — Q2 I održavanja.
        else if (!isB(w)) expect(q2).toContain(slot(w, 'q2')!.ladder);
      }
  });
});

describe('D18: 3 dana — jedan kvalitet', () => {
  it('lestvica po fazi (baza T kont., razvoj T cruise, specifično RP)', () => {
    expect(
      ['base', 'development', 'specific'].map((ph) => ladderFor(ph as Phase, 'q1', 1))
    ).toEqual(['T_continuous', 'T_cruise', 'RP']);
  });

  it('tačno 1 kvalitet u nedelji izgradnje, bez I i R ni u jednoj nedelji; taper samo RP', () => {
    const p3 = plans.filter(one);
    expect(p3.length).toBe(330);
    for (const p of p3)
      for (const w of p.weeks) {
        const q = w.days.filter((d) => d.workout.kind === 'quality');
        for (const d of q) expect(['I', 'R']).not.toContain(d.workout.dose!.zone);
        if (steady(w)) expect(q.length + (hasTest(w) ? 1 : 0)).toBe(1);
        if (w.phase === 'taper' && q.length > 0) {
          expect(q.length).toBe(1);
          expect(q[0]!.workout.dose!.zone).toBe('RP');
        }
      }
  });

  it('prelazi: T cruise ≥ poslednje T kontinuirano; RP ≥ max(D16, poslednje T) kad staje u plafon', () => {
    let rp = 0;
    for (const p of plans.filter(one)) {
      // D35: nedelja testa nema doze; lanac jedinog slota preskače je.
      const s = p.weeks.filter((w) => steady(w) && !hasTest(w));
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1]!;
        const b = s[i]!;
        if (a.phase === b.phase) continue;
        const da = slot(a, 'q1')!;
        const db = slot(b, 'q1')!;
        expect(db.doseM, `${b.index}`).toBeGreaterThanOrEqual(da.doseM);
        if (b.phase === 'specific') {
          rp++;
          const want = LADDER.RP!.find((m) => m >= Math.max(startM('RP', b.targetKm), da.doseM));
          if (want !== undefined && fits('RP', want, b.targetKm)) expect(db.doseM).toBe(want);
        }
      }
    }
    expect(rp).toBeGreaterThan(0);
  });
});

describe('D11: jedan plafon po zoni, po treningu', () => {
  it('R ≤ 5 %, I ≤ 8 %, T ≤ 10 %, RP ≤ 10 % (cilj ≥ 40 km: 15 %, D33) ciljnog obima (nedelje 1..N−1)', () => {
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
      if (one(p)) {
        expect(slot(w, 'q1')!.doseM).toBe(startM('T_continuous', w.targetKm));
        continue;
      }
      expect(slot(w, 'q1')!.doseM).toBe(startM('R', w.targetKm));
      // 06f (pouka 35): Q2 nedelje 1 lagan — početni nivo Q2 proverava prva nedelja koja ga ima (validator D16).
      if (p35(w)) continue;
      // D37 (P-b): niži nivo (najmanje po 60 %) kad bi nivo po 80 % stvorio nedelju pouke 35 (2 dana kvaliteta ostaju).
      const q2 = slot(w, 'q2')!.doseM;
      const s60 =
        LADDER.T_continuous!.filter((m) => m <= 0.6 * capOf('T', w.targetKm) + 1e-6).pop() ??
        LADDER.T_continuous![0]!;
      if (q2 !== startM('T_continuous', w.targetKm)) {
        expect(q2).toBeGreaterThanOrEqual(s60);
        expect(q2).toBeLessThan(startM('T_continuous', w.targetKm));
      }
      if (slot(w, 'q2')!.doseM > LADDER.T_continuous![0]!) aboveFirst++;
    }
    expect(aboveFirst).toBeGreaterThan(0);
  });

  it('prelaz faze (4–6 dana): I = početni nivo; RP = najmanji nivo ≥ max(početni nivo, poslednje I) kad staje', () => {
    for (const p of plans.filter((x) => !one(x))) {
      // D35: nedelja testa nema Q1; prelaz Q1 se poredi sa poslednjom nedeljom koja ga ima.
      const s = p.weeks.filter((w) => steady(w) && !hasTest(w));
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1]!;
        const b = s[i]!;
        if (a.phase === b.phase) continue;
        const q1 = slot(b, 'q1')!;
        if (q1.step === 'drop') continue;
        if (b.phase === 'development') expect(q1.doseM, `${b.index}`).toBe(startM('I', b.targetKm));
        if (b.phase === 'specific') {
          const lo = Math.max(startM('RP', b.targetKm), slot(a, 'q1')!.doseM);
          const want = LADDER.RP!.find((m) => m >= lo);
          if (want !== undefined && fits('RP', want, b.targetKm))
            expect(q1.doseM, `${b.index}`).toBe(want);
          else expect(q1.doseM).toBeGreaterThanOrEqual(slot(a, 'q1')!.doseM);
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
          // D34: Q2 nedelje B (I održavanja) nije deo lanca T slota; T se poredi sa poslednjom nedeljom bez I na Q2.
          if (r === 'q2' && isB(b)) continue;
          const da =
            r === 'q2'
              ? slot(
                  s
                    .slice(0, i)
                    .filter((x) => !isB(x))
                    .pop() ?? a,
                  r
                )
              : slot(a, r);
          const db = slot(b, r);
          if (!da || !db) continue;
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

  it('glavna doza (T + I + RP) ne opada; nema identičnih uzastopnih nedelja (osim ponavljanja jedinog slota); baza bez platoa (tvrdo, D22)', () => {
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
    let plateauChecks = 0;
    for (const p of plans) {
      const s = p.weeks.filter(steady);
      const tSlot = one(p) ? 'q1' : 'q2';
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1]!;
        const b = s[i]!;
        // 06f (pouka 35): nedelja sa drugim danom kvaliteta laganim sme imati manju glavnu dozu; ima jedan slot.
        const dropped = slot(b, 'q1')?.step === 'drop' || slot(b, 'q2')?.step === 'drop' || p35(b);
        // D34: specifična faza 4–6 dana — poređenje unutar tipa (A sa poslednjom A ili nedeljom pre specifične faze, B sa
        // poslednjom B; prva B se ne poredi).
        const prev = s.slice(0, i);
        const ref =
          one(p) || b.phase !== 'specific'
            ? a
            : isB(b)
              ? prev.filter((x) => x.phase === 'specific' && isB(x)).pop()
              : (prev.filter((x) => x.phase === 'specific' && !isB(x)).pop() ??
                prev.filter((x) => x.phase !== 'specific').pop());
        // D27/D35: nedelja testa se ne poredi; kao referenca važi samo kad je u njoj spušten slot (P5, O1), inače
        // poslednja nedelja pre nje.
        const dropT = (x: PlanWeek): boolean => slot(x, 'q2')?.step === 'drop';
        const refT =
          ref && hasTest(ref) && !dropT(ref)
            ? s
                .slice(0, s.indexOf(ref))
                .filter((x) => !hasTest(x))
                .pop()
            : ref;
        if (!dropped && refT && !hasTest(b))
          expect(main(b), `${b.index}`).toBeGreaterThanOrEqual(main(refT));
        if (key(b) === key(a)) {
          // Odstupanje D12: samo 3 dana (ili nedelja pouke 35), jedini slot bez druge strukture (napomena).
          expect(one(p) || p35(b)).toBe(true);
          expect(slot(b, 'q1')!.step).toBe('repeat');
        }
        if (a.phase === 'base' && b.phase === 'base' && slot(a, tSlot) && slot(b, tSlot)) {
          const ta = slot(a, tSlot)!;
          const tb = slot(b, tSlot)!;
          plateauChecks++;
          expect(tb.doseM > ta.doseM || !same(ta.structure, tb.structure), `${b.index}`).toBe(true);
        }
      }
    }
    expect(plateauChecks).toBeGreaterThan(1000);
  });

  it('posle rasterećenja lestvica se nastavlja (ne vraća se)', () => {
    for (const p of plans)
      p.weeks.forEach((w, i) => {
        if (!w.deload) return;
        const before = p.weeks.slice(0, i).filter(steady).pop()!;
        const after = p.weeks.slice(i + 1).find(steady);
        if (!after || after.phase !== before.phase) return;
        for (const r of ['q1', 'q2'] as const) {
          // D34: T slot (Q2) se poredi bez nedelja B.
          if (r === 'q2' && isB(after)) continue;
          const b0 =
            r === 'q2'
              ? p.weeks
                  .slice(0, i)
                  .filter((x) => steady(x) && !isB(x))
                  .pop()
              : before;
          const da = b0 ? slot(b0, r) : undefined;
          const db = slot(after, r);
          if (da && db && db.step !== 'drop') expect(db.doseM).toBeGreaterThanOrEqual(da.doseM);
        }
      });
  });
});

describe('D34: održavanje I u specifičnoj fazi (4–6 dana)', () => {
  it('smena A/B (prva A; A umesto B samo uz napomenu); I održavanja = najveća I doza, u plafonu I (inače najviši nivo koji staje)', () => {
    let b = 0;
    for (const p of plans.filter((x) => !one(x))) {
      let last: 'A' | 'B' | null = null;
      let maxI = 0;
      for (const w of p.weeks.filter(steady)) {
        if (w.phase === 'specific') {
          const want: 'A' | 'B' = last === 'A' ? 'B' : 'A';
          const got: 'A' | 'B' = isB(w) ? 'B' : 'A';
          if (got !== want) {
            expect(want, `${w.index}`).toBe('B');
            expect(w.notes.some((n) => n.startsWith('Nedelja B ne staje'))).toBe(true);
          }
          if (got === 'B') {
            b++;
            // Nedelja B: cilj najviše 3,0 km ispod cilja po pravilu (odluka organizatora posle STOP 9c0fa49).
            expect(w.targetKm, `${w.index}`).toBeGreaterThanOrEqual(w.nominalKm - 3 - 1e-9);
            const cap = capOf('I', w.targetKm);
            const iWant = maxI <= cap ? maxI : LADDER.I!.filter((m) => m <= cap).pop();
            expect(slot(w, 'q2')!.doseM, `${w.index}`).toBe(iWant);
          }
          last = got;
        }
        for (const r of ['q1', 'q2'] as const)
          if (slot(w, r)?.ladder === 'I') maxI = Math.max(maxI, slot(w, r)!.doseM);
      }
    }
    expect(b).toBeGreaterThan(100);
  });
});
