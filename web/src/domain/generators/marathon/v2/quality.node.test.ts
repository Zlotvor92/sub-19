import { describe, expect, it } from 'vitest';
import { pacesFromVdot } from './paces.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import {
  capM,
  carries,
  ladderFor,
  pickDeload,
  pickSlot,
  pickTaper,
  startLevel,
  taperDoses,
  type QualityState
} from './quality.ts';
import type { Structure } from './types.ts';
import { doseOf, recoveryOf, structuresForDose, warmupCooldown } from './workouts.ts';

/* M10 lestvice i druga struktura, M11 plafon, M12 progresija, M5/M7 doza rasterećenja i tapera, M14. */

const p = pacesFromVdot(45, 45);
const reps = (n: number, m: number): Structure => ({ form: 'reps', reps: n, repM: m });
const cont = (km: number): Structure => ({ form: 'continuous', km });
const slot = (ladder: Parameters<typeof pickSlot>[1], s: Structure) => ({
  ladder,
  doseM: doseOf(s),
  structure: s
});

describe('M10 lestvice po fazi i druga struktura (pouka 11)', () => {
  it('baza R + T kont.; razvoj I + T cruise; specifično MP + T cruise', () => {
    expect([ladderFor('base', 'q1'), ladderFor('base', 'q2')]).toEqual(['R', 'T_continuous']);
    expect([ladderFor('development', 'q1'), ladderFor('development', 'q2')]).toEqual([
      'I',
      'T_cruise'
    ]);
    expect([ladderFor('specific', 'q1'), ladderFor('specific', 'q2')]).toEqual(['MP', 'T_cruise']);
  });

  it('MP: deonice ≥ 3000 m (100 m, pa 50 m) ili kontinuirano do 16 km', () => {
    expect(structuresForDose('MP', 6000)).toEqual([reps(2, 3000), cont(6)]);
    expect(structuresForDose('MP', 12000)).toEqual([
      cont(12),
      reps(2, 6000),
      reps(3, 4000),
      reps(4, 3000)
    ]);
    expect(structuresForDose('MP', 16000)).toEqual([
      cont(16),
      reps(2, 8000),
      reps(4, 4000),
      reps(5, 3200)
    ]);
    for (const s of P.ladders.MP)
      for (const x of structuresForDose('MP', doseOf(s))) {
        if (x.form === 'reps') expect(x.repM).toBeGreaterThanOrEqual(3000);
        if (x.form === 'continuous') expect(x.km).toBeLessThanOrEqual(16);
        expect(x.form).not.toBe('pyramid');
      }
  });

  it('T: kontinuirano ↔ deonice ≥ 1000 m (50 m kad podele na 100 m nema); I 800–1200 m ili piramida; R 200/300/400 m', () => {
    expect(structuresForDose('T_continuous', 2000)).toEqual([cont(2), reps(2, 1000)]);
    expect(structuresForDose('T_cruise', 2400)).toEqual([reps(2, 1200), cont(2.4)]);
    expect(structuresForDose('T_continuous', 5000)).toEqual([
      cont(5),
      reps(2, 2500),
      reps(5, 1000)
    ]);
    expect(structuresForDose('T_cruise', 3500)).toEqual([cont(3.5), reps(2, 1750)]);
    expect(structuresForDose('I', 2000)).toEqual([reps(2, 1000)]);
    expect(structuresForDose('I', 3000)).toEqual([
      reps(3, 1000),
      { form: 'pyramid', repsM: [1200, 1000, 800] }
    ]);
    expect(structuresForDose('R', 1200)).toEqual([reps(6, 200), reps(4, 300), reps(3, 400)]);
  });

  it('M14 oporavci: R isti metraž; I 1:1 (15 s naniže, max 4:00); T 60 s (≤ 1600 m) / 90 s; MP 90 s (≤ 4000 m) / 120 s', () => {
    expect(recoveryOf('R', 300, p)).toEqual({ m: 300 });
    expect(recoveryOf('I', 800, p)).toEqual({ sec: Math.floor((0.8 * p.I) / 15) * 15 });
    expect(recoveryOf('I', 1200, p)).toEqual({ sec: 240 });
    expect(recoveryOf('T_cruise', 1600, p)).toEqual({ sec: 60 });
    expect(recoveryOf('T_cruise', 3200, p)).toEqual({ sec: 90 });
    expect(recoveryOf('MP', 4000, p)).toEqual({ sec: 90 });
    expect(recoveryOf('MP', 5000, p)).toEqual({ sec: 120 });
    expect(recoveryOf('MP_sharpener', 2000, p)).toEqual({ sec: 120 });
  });

  it('M14 WU/CD po pojasu trenutnog obima: < 50 km 15/10; 50–69,9 20/15; ≥ 70 25/15', () => {
    expect(warmupCooldown(49.9)).toEqual({ warmupSec: 900, cooldownSec: 600 });
    expect(warmupCooldown(50)).toEqual({ warmupSec: 1200, cooldownSec: 900 });
    expect(warmupCooldown(69.9)).toEqual({ warmupSec: 1200, cooldownSec: 900 });
    expect(warmupCooldown(70)).toEqual({ warmupSec: 1500, cooldownSec: 900 });
  });
});

describe('M11 plafon i M12 progresija', () => {
  it('plafon po treningu: R 5 %, I 8 %, T 10 %, MP 20 % ciljnog obima', () => {
    expect(capM('R', 40)).toBe(2000);
    expect(capM('I', 40)).toBe(3200);
    expect(capM('T', 40)).toBe(4000);
    expect(capM('MP', 40)).toBe(8000);
    expect(capM('MP', 29.8)).toBe(5960);
  });

  it('početni nivo = najviši nivo ≤ 60 % plafona (najmanje prvi nivo)', () => {
    // 60 km: T plafon 6,0 → 60 % = 3,6 → T kont. 3,0; MP plafon 12,0 → 7,2 → 2 × 3000.
    expect(startLevel('T_continuous', 60)).toEqual(cont(3));
    expect(startLevel('MP', 60)).toEqual(reps(2, 3000));
    expect(startLevel('MP', 80)).toEqual(reps(2, 4000));
    expect(startLevel('T_continuous', 35)).toEqual(cont(2));
    expect(startLevel('MP', 29)).toBeNull();
  });

  it('sledeći nivo kad staje; inače ista doza druge strukture; bez nje ponavljanje', () => {
    const next = pickSlot(slot('T_continuous', cont(2)), 'T_continuous', 40, p)!;
    expect([next.step, next.doseM]).toEqual(['next', 3000]);
    const alt = pickSlot(slot('T_continuous', cont(4)), 'T_continuous', 45, p)!;
    expect([alt.step, alt.structure]).toEqual(['alt', reps(2, 2000)]);
    const rep = pickSlot(slot('I', reps(2, 1000)), 'I', 35, p)!;
    expect([rep.step, rep.structure]).toEqual(['repeat', reps(2, 1000)]);
  });

  it('prelazi: T cruise ≥ poslednje T kont.; MP ≥ max(početni, poslednje I); I posle R od početnog nivoa', () => {
    expect(carries('T_continuous', 'T_cruise')).toBe(true);
    expect(carries('I', 'MP')).toBe(true);
    expect(carries('R', 'I')).toBe(false);
    const tc = pickSlot(slot('T_continuous', cont(4)), 'T_cruise', 55, p)!;
    expect(tc.doseM).toBe(4800);
    const mp = pickSlot(slot('I', reps(5, 1200)), 'MP', 60, p)!;
    expect(mp.doseM).toBe(6000);
    const mp2 = pickSlot(slot('I', reps(3, 1000)), 'MP', 80, p)!;
    expect(mp2.doseM).toBe(8000);
    const i = pickSlot(slot('R', reps(8, 200)), 'I', 65, p)!;
    expect([i.step, i.doseM]).toEqual(['transition', 3000]);
  });

  it('M11 ispred M12: doza van plafona pada samo uz allowDrop, na najviši nivo u plafonu', () => {
    expect(pickSlot(slot('MP', cont(12)), 'MP', 50, p)).toBeNull();
    const d = pickSlot(slot('MP', cont(12)), 'MP', 50, p, true)!;
    expect([d.step, d.doseM]).toEqual(['drop', 10000]);
  });
});

describe('M5 rasterećenje i M7 taper', () => {
  const st: QualityState = {
    q1: slot('MP', cont(12)),
    q2: slot('T_cruise', reps(4, 1600))
  };

  it('rasterećenje: T ≈ 60 % poslednje T doze (nivo naniže), min 2,0 km; staje u plafon', () => {
    const d = pickDeload(st, 'specific', 50)!;
    expect(d.doseM).toBe(3000); // 0,6 × 6400 = 3840 → 3 × 1000
    const low = pickDeload({ q1: null, q2: slot('T_continuous', cont(3)) }, 'base', 40)!;
    expect([low.doseM, low.structure]).toEqual([2000, cont(2)]);
    const dev = pickDeload({ q1: null, q2: slot('T_cruise', reps(2, 1200)) }, 'development', 40)!;
    expect([dev.doseM, dev.structure]).toEqual([2000, cont(2)]);
    expect(pickDeload(st, 'specific', 25)).toBeNull();
  });

  it('taper N−2: MP i T ≈ 60 %; N−1: MP ≈ 50 %, bez T; min MP 2 × 3000 m, T 2,0 km', () => {
    expect(taperDoses(st, 0)).toEqual({ mp: reps(2, 3000), t: reps(3, 1000) });
    const big: QualityState = { q1: slot('MP', cont(16)), q2: slot('T_cruise', reps(3, 3200)) };
    expect(taperDoses(big, 0)).toEqual({ mp: reps(2, 4000), t: reps(3, 1600) });
    expect(taperDoses(big, 1)).toEqual({ mp: reps(2, 4000), t: null });
    const small: QualityState = {
      q1: slot('MP', reps(2, 3000)),
      q2: slot('T_cruise', reps(2, 1200))
    };
    expect(taperDoses(small, 1)).toEqual({ mp: reps(2, 3000), t: null });
    expect(doseOf(taperDoses(small, 0).t!)).toBe(2000);
  });

  it('M7a: MP tapera je doza M7 i kad je iznad plafona 20 %; T po pravilu mora stati u plafon, relax: T otpada', () => {
    const small: QualityState = {
      q1: slot('MP', reps(2, 3000)),
      q2: slot('T_cruise', reps(2, 1200))
    };
    expect(pickTaper(small, 1, 29.8)!.mp.doseM).toBe(6000);
    expect(pickTaper(small, 1, 29.8)!.t).toBeNull();
    // T 2,0 km > plafon 10 % pri 19 km: po pravilu null, relax bez T (MP ostaje).
    expect(pickTaper(small, 0, 19)).toBeNull();
    const r = pickTaper(small, 0, 19, true)!;
    expect([r.mp.doseM, r.t]).toEqual([6000, null]);
    expect(pickTaper(small, 0, 30)!.t!.doseM).toBe(2000);
  });
});
