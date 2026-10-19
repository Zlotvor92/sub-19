import { describe, expect, it } from 'vitest';
import { pacesFromVdot } from './paces.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import {
  advance,
  capM,
  carries,
  deloadSlot,
  ladderFor,
  otherStructure,
  pickBuild,
  pickDeload,
  pickSlot,
  pickTaper,
  startLevel,
  taperDoses,
  type QualityState
} from './quality.ts';
import type { Structure } from './types.ts';
import { doseOf, pyramidOf, recoveryOf, structuresForDose, warmupCooldown } from './workouts.ts';

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

  it('M15 3 dana: jedan kvalitet T kont. → T cruise → MP, bez I i R; rasterećenje na danu Q1', () => {
    expect(
      (['base', 'development', 'specific'] as const).map((ph) => ladderFor(ph, 'q1', 1))
    ).toEqual(['T_continuous', 'T_cruise', 'MP']);
    expect([deloadSlot(1), deloadSlot(2)]).toEqual(['q1', 'q2']);
    expect(carries('T_cruise', 'MP')).toBe(true);
    const b = pickBuild({ q1: null, q2: null, t: 0 }, 'base', 30, p, 1)!;
    expect([b.q1.ladder, b.q2]).toEqual(['T_continuous', null]);
    // MP ≥ poslednje T (3 dana): T cruise 6,4 km → MP 8,0 km (prvi nivo ≥ 6,4 km u plafonu 20 %).
    const s = pickBuild(
      { q1: slot('T_cruise', reps(4, 1600)), q2: null, t: 6400 },
      'specific',
      45,
      p,
      1
    )!;
    expect([s.q1.ladder, s.q1.doseM, s.q2]).toEqual(['MP', 8000, null]);
  });

  it('M12 3 dana: prelaz T kont. → T cruise koji bi dao isti trening ide pravilom iste lestvice', () => {
    // Poslednje T kont. kao 3 × 1000 (druga struktura 3,0 km) — T cruise nivo 3 × 1000 bio bi isti trening.
    const prev = slot('T_continuous', reps(3, 1000));
    const one = pickSlot(prev, 'T_cruise', 50, p, false, true)!;
    expect(one.structure).not.toEqual(reps(3, 1000));
    expect(one.step).toBe('next');
    // 4–6 dana (Q1 menja nedelju): prelaz po pravilu.
    expect(pickSlot(prev, 'T_cruise', 50, p)!.structure).toEqual(reps(3, 1000));
  });

  it('M10a (pouka 27): I 5000 = 800-1000-1200-1200-800 (bez druge strukture jednakih deonica); naizmenično sa 5 × 1000', () => {
    const pyr = { form: 'pyramid' as const, repsM: [800, 1000, 1200, 1200, 800] };
    expect(pyramidOf(5000, 800, 1200, 200, 6)).toEqual(pyr);
    expect(structuresForDose('I', 5000)).toEqual([reps(5, 1000), pyr]);
    expect(otherStructure('I', 5000, reps(5, 1000), p)).toEqual(pyr);
    expect(otherStructure('I', 5000, pyr, p)).toEqual(reps(5, 1000));
    // Doze koje već imaju drugu strukturu — bez nove piramide; I 2000 piramidu nema.
    expect(structuresForDose('I', 4000)).toEqual([reps(4, 1000), reps(5, 800)]);
    expect(structuresForDose('I', 6000)).toEqual([reps(5, 1200), reps(6, 1000)]);
    expect(pyramidOf(2000, 800, 1200, 200, 6)).toBeNull();
    // Zbir uvek = doza, deonice u opsegu zone, korak 200 m.
    for (let d = 2400; d <= 7200; d += 200) {
      const x = pyramidOf(d, 800, 1200, 200, 6);
      if (!x || x.form !== 'pyramid') continue;
      expect(
        x.repsM.reduce((a, m) => a + m, 0),
        `${d}`
      ).toBe(d);
      expect(
        x.repsM.every((m) => m >= 800 && m <= 1200 && m % 200 === 0),
        `${d}`
      ).toBe(true);
    }
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
    q2: slot('T_cruise', reps(4, 1600)),
    t: 6400
  };

  it('rasterećenje: T ≈ 60 % poslednje T doze (nivo naniže), min 2,0 km; staje u plafon', () => {
    const d = pickDeload(st, 'specific', 50)!;
    expect(d.doseM).toBe(3000); // 0,6 × 6400 = 3840 → 3 × 1000
    const low = pickDeload({ q1: null, q2: slot('T_continuous', cont(3)), t: 3000 }, 'base', 40)!;
    expect([low.doseM, low.structure]).toEqual([2000, cont(2)]);
    const dev = pickDeload(
      { q1: null, q2: slot('T_cruise', reps(2, 1200)), t: 2400 },
      'development',
      40
    )!;
    expect([dev.doseM, dev.structure]).toEqual([2000, cont(2)]);
    expect(pickDeload(st, 'specific', 25)).toBeNull();
    // 3 dana u specifičnoj fazi: jedini slot je MP — T se meri od poslednjeg T iz izgradnje (t).
    const three = pickDeload({ q1: slot('MP', reps(2, 4000)), q2: null, t: 4800 }, 'specific', 40)!;
    expect(three.doseM).toBe(2400); // 0,6 × 4800 = 2880 → 2 × 1200
  });

  it('advance: t = poslednja doza u zoni T (4 dana = slot Q2; 3 dana u specifičnoj fazi ostaje T iz razvoja)', () => {
    const four = advance(pickBuild({ q1: null, q2: null, t: 0 }, 'base', 45, p, 2)!, {
      q1: null,
      q2: null,
      t: 0
    });
    expect(four.t).toBe(four.q2!.doseM);
    const prev: QualityState = { q1: slot('T_cruise', reps(4, 1600)), q2: null, t: 6400 };
    const three = advance(pickBuild(prev, 'specific', 45, p, 1)!, prev);
    expect([three.q1!.ladder, three.t]).toEqual(['MP', 6400]);
  });

  it('taper N−2: MP i T ≈ 60 %; N−1: MP ≈ 50 %, bez T; min MP 2 × 3000 m, T 2,0 km', () => {
    expect(taperDoses(st, 0, 2)).toEqual({ mp: reps(2, 3000), t: reps(3, 1000) });
    const big: QualityState = {
      q1: slot('MP', cont(16)),
      q2: slot('T_cruise', reps(3, 3200)),
      t: 9600
    };
    expect(taperDoses(big, 0, 2)).toEqual({ mp: reps(2, 4000), t: reps(3, 1600) });
    expect(taperDoses(big, 1, 2)).toEqual({ mp: reps(2, 4000), t: null });
    // 3 dana: samo MP (jedan kvalitet).
    expect(taperDoses(big, 0, 1)).toEqual({ mp: reps(2, 4000), t: null });
    const small: QualityState = {
      q1: slot('MP', reps(2, 3000)),
      q2: slot('T_cruise', reps(2, 1200)),
      t: 2400
    };
    expect(taperDoses(small, 1, 2)).toEqual({ mp: reps(2, 3000), t: null });
    expect(doseOf(taperDoses(small, 0, 2).t!)).toBe(2000);
  });

  it('M7a: MP tapera je doza M7 i kad je iznad plafona 20 %; T po pravilu mora stati u plafon, relax: T otpada', () => {
    const small: QualityState = {
      q1: slot('MP', reps(2, 3000)),
      q2: slot('T_cruise', reps(2, 1200)),
      t: 2400
    };
    expect(pickTaper(small, 1, 29.8, 2)!.mp.doseM).toBe(6000);
    expect(pickTaper(small, 1, 29.8, 2)!.t).toBeNull();
    // T 2,0 km > plafon 10 % pri 19 km: po pravilu null, relax bez T (MP ostaje).
    expect(pickTaper(small, 0, 19, 2)).toBeNull();
    const r = pickTaper(small, 0, 19, 2, true)!;
    expect([r.mp.doseM, r.t]).toEqual([6000, null]);
    expect(pickTaper(small, 0, 30, 2)!.t!.doseM).toBe(2000);
    // 3 dana: po pravilu bez T i pri malom cilju.
    expect(pickTaper(small, 0, 19, 1)!.t).toBeNull();
  });
});
