import { describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { workoutStructure } from './app/structure.ts';
import { userText } from './app/format.ts';
import { generateMarathonV2 } from './generate.ts';
import { longCap10, longKmCap10, longTimeCap10 } from './lengths.ts';
import { MARATHON_V2_POLICY as P, planRule } from './policy.ts';
import { advance, lastMpM, type QualityState, taperDoses } from './quality.ts';
import { chooseBlockKm, specificTypes } from './specific.ts';
import { inputOf } from './testInputs.ts';
import type { MarathonV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { bWeekNote } from './week.ts';
import { doseOf, longBlockWorkout, longWorkout } from './workouts.ts';

/* P2 (marathon-v2.9.0): M19 — smena nedelja A/B u specifičnoj fazi i dugi sa završnim blokom u MP (S1), dugi do
   180 min i 32 km (S2), adaptacija (S3), prikaz (S4). */

/** Profil (a) programa: 10 km 46:00, 40 km, uto/čet/sub/ned, 16 nedelja, skorašnji najduži 14 km. */
const PROFILE_A = {
  startDate: '2026-11-02',
  raceDate: '2027-02-21',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  longRunDay: 'sun',
  currentWeeklyKm: 40,
  recentResult: { distanceM: 10000, timeSec: 2760, date: '2026-10-19' },
  goalTimeSec: null,
  recentLongRunKm: 14
};
const gen = (x: unknown): MarathonV2Plan => {
  const r = generateMarathonV2(x);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const A = gen(PROFILE_A);
const long = (w: PlanWeek) => w.days.find((d) => d.role === 'long')!;
const block = (w: PlanWeek): number => long(w)?.workout.workKm.MP ?? 0;
const errors = (p: MarathonV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
const clone = (p: MarathonV2Plan): MarathonV2Plan => structuredClone(p);
const specWeeks = (p: MarathonV2Plan): PlanWeek[] =>
  p.weeks.filter((w) => w.phase === 'specific' && !w.deload);

describe('S1 (M19): smena A/B, blok MP u dugom', () => {
  it('profil (a): poslednja ne-rasteretna specifična nedelja je B, unazad smena; nedelja B bez MP treninga', () => {
    const types = specWeeks(A).map((w) => (block(w) > 0 ? 'B' : 'A'));
    expect(types.join('')).toBe('ABAB');
    for (const w of specWeeks(A)) {
      const mp = w.days.filter((d) => d.workout.kind === 'quality' && d.workout.workKm.MP > 0);
      if (block(w) > 0) {
        expect(mp).toEqual([]);
        expect(w.days.find((d) => d.weekday === 'tue')!.role).toBe('easy');
        expect(w.days.filter((d) => d.role === 'q2')).toHaveLength(1);
        expect(w.notes).toContain(bWeekNote(block(w)));
      } else expect(mp).toHaveLength(1);
    }
    // Rasterećenje, taper, trkačka: dugi lagan.
    for (const w of A.weeks.filter((x) => x.deload || x.phase === 'taper'))
      expect(block(w)).toBe(0);
    expect(errors(A)).toEqual([]);
  });

  it('profil (a): MP stimulus kroz obe vrste nedelja (O3) — MP 6 → blok 8 → MP 10 → blok 10 km (P8-G1: vrh 56 km; K3-A: dugi 25,2 km, blok ≤ 50 % dugog)', () => {
    const mp = specWeeks(A).map((w) =>
      block(w) > 0 ? block(w) : w.days.find((d) => d.role === 'q1')!.workout.dose!.doseM / 1000
    );
    expect(mp).toEqual([6, 8, 10, 10]);
    const w = specWeeks(A).at(-1)!;
    // K3-A: dugi u vrhu do 45 % nedelje (4 dana), do cilja najdužeg — 25,2 km.
    expect(long(w).workout.title).toBe(
      'Dugi 25,2 km: 15,2 km lagano + 10,0 km u maratonskom tempu'
    );
  });

  it('raspored tipova: samo redovan plan 4–6 dana (3 dana i početnik bez nedelje B)', () => {
    const frames = [9, 10, 11, 12, 13].map((index) => ({
      index,
      phase: 'specific' as const,
      deload: index === 12
    }));
    expect([...specificTypes(frames, planRule(4)!)]).toEqual([
      [13, 'B'],
      [11, 'A'],
      [10, 'B'],
      [9, 'A']
    ]);
    expect(specificTypes(frames, planRule(3)!).size).toBe(0);
    expect(specificTypes(frames, planRule(4, 'beginner')!).size).toBe(0);
    const three = gen(inputOf({ weeks: 16, km: 40, vdot: 45, days: ['tue', 'thu', 'sun'] }));
    expect(three.weeks.some((w) => block(w) > 0)).toBe(false);
  });

  it('blok: jedan nivo iznad max(poslednji blok, poslednja MP doza), ≤ 50 % dugog, ne opada', () => {
    const rule = planRule(4)!;
    const p = A.paces;
    const easy = (km: number) => longWorkout(km, p).sec;
    expect(chooseBlockKm(240, 0, 6000, rule, p, [], easy(24))).toBe(8);
    expect(chooseBlockKm(240, 8000, 10000, rule, p, [], easy(24))).toBe(12);
    // ≤ 50 % dugog: 20 km dugi → najviše 10 km.
    expect(chooseBlockKm(200, 8000, 14000, rule, p, [], easy(20))).toBe(10);
    // blok ne opada: poslednji 12 km, dugi 20 km (najviše 10 km) → nijedan nivo (nedelja A).
    expect(chooseBlockKm(200, 12000, 12000, rule, p, [], easy(20))).toBeNull();
  });

  it('poslednja MP doza = max(MP trening, blok): MP trening A i taper (M7) nastavljaju od nje', () => {
    const s0: QualityState = {
      q1: { ladder: 'MP', doseM: 10000, structure: { form: 'reps', reps: 2, repM: 5000 } },
      q2: null,
      t: 4800
    };
    const s1 = advance({ q1: null, q2: null, blockM: 16000 }, s0);
    expect(lastMpM(s1)).toBe(16000);
    expect(s1.blockM).toBe(16000);
    // N−2: ≈ 60 % od 16 km = 9,6 → 8 km (2 × 4000), umesto 6 km iz MP treninga 10 km.
    expect(doseOf(taperDoses(s1, 0, 2).mp!)).toBe(8000);
    expect(doseOf(taperDoses(s0, 0, 2).mp!)).toBe(6000);
    // Blok manji od MP treninga ne menja slot.
    expect(lastMpM(advance({ q1: null, q2: null, blockM: 8000 }, s0))).toBe(10000);
  });

  it('validator: blok van nedelje B, pogrešan nivo, MP trening u nedelji B, bez napomene → greška', () => {
    const iA = specWeeks(A)[0]!.index;
    const iB = specWeeks(A)[1]!.index;
    const inA = clone(A);
    const lA = long(inA.weeks[iA - 1]!);
    lA.workout = longBlockWorkout(lA.workout.km, 8, A.paces);
    expect(errors(inA)).toContain('LONG_BLOCK');
    const lvl = clone(A);
    const lB = long(lvl.weeks[iB - 1]!);
    lB.workout = longBlockWorkout(lB.workout.km, 10, A.paces);
    lvl.weeks[iB - 1]!.notes = lvl.weeks[iB - 1]!.notes.map((n) =>
      n === bWeekNote(8) ? bWeekNote(10) : n
    );
    expect(errors(lvl)).toContain('LONG_BLOCK');
    const note = clone(A);
    note.weeks[iB - 1]!.notes = note.weeks[iB - 1]!.notes.filter((n) => n !== bWeekNote(8));
    expect(errors(note)).toContain('LONG_BLOCK');
    const both = clone(A);
    const q1 = A.weeks[iA - 1]!.days.find((d) => d.role === 'q1')!;
    const wb = both.weeks[iB - 1]!;
    const tue = wb.days.findIndex((d) => d.weekday === 'tue');
    wb.days[tue] = { ...structuredClone(q1), date: wb.days[tue]!.date };
    expect(errors(both).length).toBeGreaterThan(0);
  });
});

describe('S2 (M13): dugi do 180 min sporim E i do 32 km; početnik 150 min', () => {
  it('plafon dugog: redovan 180 min, početnik 150 min, gornja granica 32,0 km', () => {
    const p = A.paces;
    expect(P.lengths.longMaxSec).toBe(10800);
    expect(longKmCap10()).toBe(320);
    expect(longCap10(1000, planRule(4)!, p)).toBe(Math.min(400, longTimeCap10(p, 10800), 320));
    expect(longCap10(1000, planRule(4, 'beginner')!, p)).toBe(
      Math.min(400, longTimeCap10(p, 9000), 320)
    );
  });

  it('veliki obim, brz trkač: najduži dugi tačno 32,0 km; validator LONG_KM', () => {
    const p = gen(
      inputOf({ weeks: 20, km: 90, vdot: 60, days: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'] })
    );
    const longest = Math.max(...p.weeks.map((w) => long(w)?.workout.km ?? 0));
    expect(longest).toBe(32);
    expect(errors(p)).toEqual([]);
    const m = clone(p);
    const w = m.weeks.find((x) => long(x)?.workout.km === 32)!;
    long(w).workout = longWorkout(32.5, p.paces);
    expect(errors(m)).toContain('LONG_KM');
  });
});

describe('S3 (A4, A5): adaptacija', () => {
  const iB = specWeeks(A)[1]!.index;
  const wB = A.weeks[iB - 1]!;
  const lB = long(wB);

  it('umor: RPE ≥ 7 na dugom sa blokom se ne broji kao lagan trening (lagan dugi se broji)', () => {
    const easy = wB.days.find((d) => d.role === 'easy')!;
    const asOf = wB.endDate;
    const rec = (d: typeof easy, rpe: number) => ({
      date: d.date,
      dayId: d.date,
      km: d.workout.km,
      durationSec: d.workout.sec,
      completed: true,
      rpe
    });
    const withBlock = adaptMarathonV2(A, { workouts: [rec(easy, 8), rec(lB, 8)] }, asOf);
    expect(withBlock.ok).toBe(true);
    // Nedelja posle nedelje B ostaje izgradnja (nema prinudnog rasterećenja).
    if (withBlock.ok) expect(withBlock.plan.weeks[iB]!.deload).toBe(false);
    // Isti zapisi na laganom dugom (nedelja A, posle nje nedelja izgradnje) → prinudno rasterećenje.
    const iA = specWeeks(A)[0]!.index;
    const wA = A.weeks[iA - 1]!;
    const easyA = wA.days.find((d) => d.role === 'easy')!;
    const r = adaptMarathonV2(A, { workouts: [rec(easyA, 8), rec(long(wA), 8)] }, wA.endDate);
    expect(A.weeks[iA]!.deload).toBe(false);
    expect(r.ok && r.plan.weeks[iA]!.deload).toBe(true);
  });

  it('bol: nedelja sa ograničenjima nije tip B (dugi lagan); validator LIMITS za blok na danu bola', () => {
    const asOf = wB.startDate;
    const r = adaptMarathonV2(
      A,
      {
        workouts: [{ date: asOf, km: 8, durationSec: 2880, completed: true, pain: 5 }]
      },
      asOf
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const w = r.plan.weeks[iB - 1]!;
    expect(w.limits).toBeDefined();
    expect(block(w)).toBe(0);
    const m = clone(r.plan);
    const lm = long(m.weeks[iB - 1]!);
    lm.workout = longBlockWorkout(lm.workout.km, 8, r.plan.paces);
    expect(errors(m)).toContain('LIMITS');
  });
});

describe('S4: prikaz dugog sa blokom', () => {
  it('naslov, segmenti E + MP sa tempom, tekst korisniku bez internih oznaka', () => {
    const w = specWeeks(A).at(-1)!;
    const s = workoutStructure(long(w).workout, A.paces, false);
    expect(s.title).toBe('Dugi 25,2 km: 15,2 km lagano + 10,0 km u maratonskom tempu');
    expect(s.blocks.map((b) => [b.step.kind, b.step.zone, b.step.km])).toEqual([
      ['long', 'E', 15.2],
      ['work', 'MP', 10]
    ]);
    expect(s.blocks[1]!.step.paceSec).toBe(A.paces.MP);
    expect(userText(bWeekNote(12))).toBe(
      'Specifična nedelja sa blokom: poslednjih 12,0 km dugog trčanja u maratonskom tempu; dan treninga u maratonskom tempu je lagan.'
    );
    // Po osećaju: blok nosi RPE zone MP.
    const f = longBlockWorkout(24, 12, A.paces, true);
    expect(f.rpe).toEqual(P.feel.rpe.MP);
  });
});
