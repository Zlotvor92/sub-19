/* H10 lestvice i druga struktura (pouka 11), H11 plafon (pouka 10), H12 progresija (pouke 3, 12), H5/H7
   doza rasterećenja i tapera, H14 oporavci. */

import { describe, expect, it } from 'vitest';
import { pacesFromVdot } from './paces.ts';
import { HM_V2_POLICY as P, planRule } from './policy.ts';
import {
  capM,
  carries,
  deloadDose,
  deloadSlot,
  INITIAL_QUALITY,
  ladderFor,
  pickBuild,
  pickSlot,
  startLevel,
  taperDoses
} from './quality.ts';
import type { LadderId, Structure } from './types.ts';
import { doseOf, ladderLevels, recoveryOf, structuresForDose, zoneOf } from './workouts.ts';

const p45 = pacesFromVdot(45);
const R3 = planRule(3, 'regular')!;
const R4 = planRule(4, 'regular')!;
const fmt = (s: Structure): string =>
  s.form === 'continuous'
    ? `${s.km} kont`
    : s.form === 'reps'
      ? `${s.reps}x${s.repM}`
      : s.repsM.join('+');
const LADDERS: LadderId[] = ['R', 'T_continuous', 'T_cruise', 'I', 'RP'];

describe('H10 lestvice po fazi i druga struktura (pouka 11)', () => {
  it('baza R + T kont., razvoj I + T cruise, specifično RP + T cruise', () => {
    expect(
      ['base', 'development', 'specific'].map((f) => [
        ladderFor(f as never, 'q1'),
        ladderFor(f as never, 'q2')
      ])
    ).toEqual([
      ['R', 'T_continuous'],
      ['I', 'T_cruise'],
      ['RP', 'T_cruise']
    ]);
  });

  it('3 dana (H15): jedan kvalitet T kont. → T cruise → RP, bez I i R', () => {
    expect(['base', 'development', 'specific'].map((f) => ladderFor(f as never, 'q1', 1))).toEqual([
      'T_continuous',
      'T_cruise',
      'RP'
    ]);
    const w = pickBuild(INITIAL_QUALITY, 'base', 30, p45, R3)!;
    expect([fmt(w.q1!.structure), w.q2]).toEqual(['2 kont', null]);
    expect(deloadSlot(1)).toBe('q1');
    expect(deloadSlot(2)).toBe('q2');
  });

  it('T: kontinuirano ili 2–5 deonica ≥ 1000 m (100 m, pa 50 m); RP: deonice ≥ 2000 m ili kontinuirano ≤ 10 km', () => {
    expect(structuresForDose('T_continuous', 2500).map(fmt)).toEqual(['2.5 kont', '2x1250']);
    expect(structuresForDose('T_continuous', 4000).map(fmt)).toEqual([
      '4 kont',
      '2x2000',
      '4x1000'
    ]);
    expect(structuresForDose('T_cruise', 2000).map(fmt)).toEqual(['2 kont', '2x1000']);
    expect(structuresForDose('RP', 5000).map(fmt)).toEqual(['2x2500', '5 kont']);
    expect(structuresForDose('RP', 9000).map(fmt)).toEqual(['3x3000', '2x4500', '9 kont']);
    expect(structuresForDose('RP', 12000).map(fmt)).toEqual([
      '3x4000',
      '2x6000',
      '4x3000',
      '5x2400'
    ]);
    expect(structuresForDose('I', 3000).map(fmt)).toEqual(['3x1000', '1200+1000+800']);
    expect(structuresForDose('I', 2400).map(fmt)).toEqual(['3x800', '2x1200']);
    // Pouka 27: jednake deonice bez druge strukture → piramida korak 200 m, isti zbir.
    expect(structuresForDose('I', 2000).map(fmt)).toEqual(['2x1000', '800+1200']);
    expect(structuresForDose('I', 5000).map(fmt)).toEqual(['5x1000', '800+1000+1200+1200+800']);
    expect(structuresForDose('R', 1200).map(fmt)).toEqual(['6x200', '4x300', '3x400']);
    // Najmanja deonica po zoni: T ≥ 1000, RP ≥ 2000, I 800–1200 m.
    for (const l of LADDERS)
      for (const lv of ladderLevels(l))
        for (const s of structuresForDose(l, doseOf(lv))) {
          expect(doseOf(s)).toBe(doseOf(lv));
          const reps = s.form === 'reps' ? [s.repM] : s.form === 'pyramid' ? [...s.repsM] : [];
          const min =
            zoneOf(l) === 'T' ? 1000 : zoneOf(l) === 'RP' ? 2000 : zoneOf(l) === 'I' ? 800 : 200;
          for (const m of reps) expect(m, `${l} ${fmt(s)}`).toBeGreaterThanOrEqual(min);
          if (l === 'RP' && s.form === 'continuous') expect(s.km).toBeLessThanOrEqual(10);
        }
  });
});

describe('H11 plafon (pouka 10)', () => {
  it('najniži nivo svake lestvice staje u plafon pri najmanjem obimu reda (30 km)', () => {
    for (const l of LADDERS)
      expect(doseOf(ladderLevels(l)[0]!), l).toBeLessThanOrEqual(capM(zoneOf(l), 30));
  });

  it('najmanja T doza rasterećenja (2,0 km) staje u plafon pri 0,8 × 30 km; RP 2 × 2000 m tapera pri 0,7 × vrh ≥ 0,7 × 38,1', () => {
    expect(2000).toBeLessThanOrEqual(capM('T', 0.8 * 30));
    expect(4000).toBeLessThanOrEqual(capM('RP', 26.7));
    expect(4000).toBeGreaterThan(capM('RP', 26.6));
  });
});

describe('H12 progresija', () => {
  it('početni nivo = najviši ≤ 60 % plafona, najmanje prvi nivo', () => {
    expect(fmt(startLevel('T_continuous', 40)!)).toBe('2 kont'); // 60 % od 4000 = 2400 → 2,0
    expect(fmt(startLevel('T_continuous', 60)!)).toBe('3 kont'); // 3600 → 3,0
    expect(fmt(startLevel('RP', 60)!)).toBe('2x2500'); // 60 % od 9000 = 5400
    expect(fmt(startLevel('I', 30)!)).toBe('2x1000'); // 1440 < prvi nivo → prvi nivo
    expect(startLevel('RP', 20)).toBeNull();
  });

  it('sledeći nivo ako staje (≤ 1 nivo), inače ista doza druge strukture, inače ponavljanje', () => {
    const prev = {
      ladder: 'T_continuous' as const,
      doseM: 3000,
      structure: { form: 'continuous', km: 3 } as Structure
    };
    const next = pickSlot(prev, 'T_continuous', 50, p45)!;
    expect([next.step, next.doseM]).toEqual(['next', 4000]);
    const alt = pickSlot(prev, 'T_continuous', 35, p45)!; // plafon 3500 < 4000
    expect([alt.step, alt.doseM, fmt(alt.structure)]).toEqual(['alt', 3000, '2x1500']); // najbliža po km rada + oporavka
    const iPrev = {
      ladder: 'I' as const,
      doseM: 2000,
      structure: { form: 'reps', reps: 2, repM: 1000 } as Structure
    };
    // Pouka 27 (HI5): plafon I 2320 < 2400, jednake deonice 2,0 km nemaju drugu podelu → piramida, pa nazad.
    const pyr = pickSlot(iPrev, 'I', 29, p45)!;
    expect([pyr.step, pyr.doseM, fmt(pyr.structure)]).toEqual(['alt', 2000, '800+1200']);
    const back = pickSlot({ ladder: 'I', doseM: 2000, structure: pyr.structure }, 'I', 29, p45)!;
    expect(fmt(back.structure)).toBe('2x1000');
  });

  it('prelazi: T cruise ≥ poslednje T kontinuirano; RP ≥ max(početni nivo, poslednje I; 3 dana poslednje T)', () => {
    expect(carries('T_continuous', 'T_cruise')).toBe(true);
    expect(carries('I', 'RP')).toBe(true);
    expect(carries('T_cruise', 'RP')).toBe(true);
    expect(carries('R', 'I')).toBe(false);
    expect(carries('R', 'T_continuous')).toBe(false);
    // HI6: 3 dana, T cruise 6,0 km → RP ≥ 6,0 km (početni nivo RP pri 45 km je 4,0 km).
    const rp3 = pickSlot(
      { ladder: 'T_cruise', doseM: 6000, structure: { form: 'reps', reps: 4, repM: 1500 } },
      'RP',
      45,
      p45,
      false,
      true
    )!;
    expect([rp3.step, rp3.doseM]).toEqual(['transition', 6000]);
    // HI6: prelaz T kont. → T cruise koji bi ponovio istu strukturu (4 × 1000 m) kod jednog slota ide
    // pravilom iste lestvice (druga struktura); sa dva slota ostaje prelaz (4–6 dana bez promene).
    const prev4 = {
      ladder: 'T_continuous' as const,
      doseM: 4000,
      structure: { form: 'reps', reps: 4, repM: 1000 } as Structure
    };
    const one = pickSlot(prev4, 'T_cruise', 43, p45, false, true)!;
    const two = pickSlot(prev4, 'T_cruise', 43, p45)!;
    expect([one.step, one.doseM, fmt(one.structure)]).toEqual(['alt', 4000, '2x2000']);
    expect([two.step, two.doseM, fmt(two.structure)]).toEqual(['transition', 4000, '4x1000']);
    const t = pickSlot(
      { ladder: 'T_continuous', doseM: 4000, structure: { form: 'continuous', km: 4 } },
      'T_cruise',
      50,
      p45
    )!;
    expect([t.step, t.doseM]).toEqual(['transition', 4000]);
    const rp = pickSlot(
      { ladder: 'I', doseM: 4800, structure: { form: 'reps', reps: 4, repM: 1200 } },
      'RP',
      50,
      p45
    )!;
    expect(rp.doseM).toBe(5000);
    const rpStart = pickSlot(
      { ladder: 'I', doseM: 2000, structure: { form: 'reps', reps: 2, repM: 1000 } },
      'RP',
      60,
      p45
    )!;
    expect(rpStart.doseM).toBe(5000); // početni nivo 60 km (≤ 5400) > poslednje I
  });

  it('pouka 12: doza pada samo uz allowDrop (druga pretraga, nedelja ograničena kapacitetom)', () => {
    const prev = {
      ladder: 'T_continuous' as const,
      doseM: 5000,
      structure: { form: 'continuous', km: 5 } as Structure
    };
    expect(pickSlot(prev, 'T_continuous', 45, p45)).toBeNull();
    const d = pickSlot(prev, 'T_continuous', 45, p45, true)!;
    expect([d.step, d.doseM]).toEqual(['drop', 4000]);
  });

  it('prva nedelja izgradnje: oba slota na početnom nivou', () => {
    const w = pickBuild(INITIAL_QUALITY, 'base', 40, p45, R4)!;
    expect([fmt(w.q1!.structure), fmt(w.q2!.structure)]).toEqual(['6x200', '2 kont']);
  });
});

describe('H5/H7 doza rasterećenja i tapera (HI4)', () => {
  it('rasterećenje: T ≈ 60 % poslednje T doze, nivo naniže, min 2,0 km (baza kontinuirano, inače 2 × 1000 m)', () => {
    const s = (ladder: LadderId, doseM: number, structure: Structure) => ({
      q1: null,
      q2: { ladder, doseM, structure },
      t: 0
    });
    expect(
      fmt(deloadDose(s('T_continuous', 3000, { form: 'continuous', km: 3 }), 'base', R4).structure)
    ).toBe('2 kont');
    expect(
      fmt(deloadDose(s('T_continuous', 5000, { form: 'continuous', km: 5 }), 'base', R4).structure)
    ).toBe('3 kont');
    expect(
      fmt(
        deloadDose(s('T_cruise', 3200, { form: 'reps', reps: 2, repM: 1600 }), 'development', R4)
          .structure
      )
    ).toBe('2x1000');
    expect(
      fmt(
        deloadDose(s('T_cruise', 8000, { form: 'reps', reps: 5, repM: 1600 }), 'specific', R4)
          .structure
      )
    ).toBe('3x1600');
  });

  it('taper: RP i T ≈ 60 % poslednje doze (min 2 × 2000 m, 2,0 km)', () => {
    const t = taperDoses({
      q1: { ladder: 'RP', doseM: 10000, structure: { form: 'reps', reps: 2, repM: 5000 } },
      q2: { ladder: 'T_cruise', doseM: 6400, structure: { form: 'reps', reps: 4, repM: 1600 } },
      t: 6400
    });
    expect([t.q1.doseM, fmt(t.q2!.structure)]).toEqual([6000, '2x1600']); // 0,6 × 6400 = 3840 → 3200
    const lo = taperDoses({
      q1: { ladder: 'RP', doseM: 5000, structure: { form: 'reps', reps: 2, repM: 2500 } },
      q2: { ladder: 'T_cruise', doseM: 3000, structure: { form: 'reps', reps: 3, repM: 1000 } },
      t: 3000
    });
    expect([fmt(lo.q1.structure), fmt(lo.q2!.structure)]).toEqual(['2x2000', '2x1000']);
  });

  it('HI6 (3 dana): rasterećenje T ≈ 60 % poslednje doze jedinog slota (Q1); taper samo RP', () => {
    const rp = {
      q1: {
        ladder: 'RP' as const,
        doseM: 8000,
        structure: { form: 'reps', reps: 2, repM: 4000 } as Structure
      },
      q2: null,
      t: 0
    };
    // 0,6 × 8000 = 4800 → T cruise 3 × 1600 (specifično).
    expect(fmt(deloadDose(rp, 'specific', R3).structure)).toBe('3x1600');
    const t = taperDoses(rp, 1);
    expect([t.q1.doseM, t.q2]).toEqual([4000, null]);
  });
});

describe('H14 oporavci', () => {
  it('R isti metraž; I 1:1 naniže na 15 s, max 4:00; T cruise 60/90 s; RP 90/120 s; oštrenje 120 s', () => {
    expect(recoveryOf('R', 300, p45)).toEqual({ m: 300 });
    expect(recoveryOf('I', 800, p45)).toEqual({ sec: 195 }); // 800 × 256 s/km = 204,8 → 195
    expect(recoveryOf('I', 1200, p45)).toEqual({ sec: 240 });
    expect(recoveryOf('T_cruise', 1600, p45)).toEqual({ sec: P.workout.tCruiseRecovery[0]!.sec });
    expect(recoveryOf('T_cruise', 3000, p45)).toEqual({ sec: 90 });
    expect(recoveryOf('RP', 3000, p45)).toEqual({ sec: 90 });
    expect(recoveryOf('RP', 4000, p45)).toEqual({ sec: 120 });
    expect(recoveryOf('RP_sharpener', 2000, p45)).toEqual({ sec: 120 });
  });
});
