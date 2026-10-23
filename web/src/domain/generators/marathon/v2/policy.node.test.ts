import { describe, expect, it } from 'vitest';
import {
  BEGINNER_DAYS_COUNTS,
  dayRule,
  MARATHON_V2_POLICY as P,
  planRule,
  RUN_DAYS_COUNTS
} from './policy.ts';
import type { Structure } from './types.ts';
import { doseOf } from './workouts.ts';

/* Brojevi M1–M17 (MASTER-HM-MARATHON.md § 5) i pouke 27–28 zakucani: izmena broja mora da obori test i ide kroz
   DECISIONS. */

describe('politika maraton v2 (M1–M17, M7a, M10a, M13a)', () => {
  it('oznaka politike (Uslov 6)', () => {
    expect(P.id).toBe('marathon-v2');
    expect(P.version).toBe('marathon-v2.7.0');
  });

  it('DECISIONS: M1–M18, M7a, M10a (piramida, pouka 27), M13a (skorašnji dugi, pouka 28), A1–A15 i A17 (adaptacija, M18), svaka sa pravilom, mestom i obrazloženjem', () => {
    const ids = Array.from({ length: 17 }, (_, i) => `M${i + 1}`);
    ids.splice(13, 0, 'M13a');
    ids.splice(10, 0, 'M10a');
    ids.splice(7, 0, 'M7a');
    ids.push('M18', ...Array.from({ length: 15 }, (_, i) => `A${i + 1}`), 'A17');
    // MAR-07 (Faza 4a): N1, pouka 35 (N5), pouka 36, N8, N9, N10.4–N10.7, N11; MAR-07b A11b; MAR-07c A13b; MAR-08 A11c; MAR-08b A13c, K3, K4; MAR-09; MAR-10; MAR-11.
    ids.push(
      'N1',
      'N5',
      'P36',
      'N8',
      'N9',
      'N10.4',
      'N10.5',
      'N10.6',
      'N10.7',
      'N11',
      'A11b',
      'A13b',
      'A11c',
      'A13c',
      'K3',
      'K4',
      'MAR-09',
      'MAR-10',
      'MAR-11'
    );
    expect(P.DECISIONS.map((d) => d.id)).toEqual(ids);
    for (const d of P.DECISIONS) {
      expect(d.rule.length, d.id).toBeGreaterThan(40);
      expect(d.place.length, d.id).toBeGreaterThan(5);
      expect(d.rationale.length, d.id).toBeGreaterThan(40);
    }
  });

  it('M1 opseg ulaza i M15 tabela 3/4/5/6 dana; 1/2/7 dana van tabele', () => {
    expect(P.input).toEqual({
      weeksMin: 12,
      weeksMax: 24,
      resultMaxAgeDays: 84,
      resultDistancesM: [5000, 10000, 21097.5, 42195],
      shortResultM: 5000,
      vdotMin: 30,
      vdotMax: 80,
      recentLongMinKm: 5,
      recentLongMaxKm: 42
    });
    expect(RUN_DAYS_COUNTS).toEqual([3, 4, 5, 6]);
    const row = (
      quality: number,
      easy: number,
      kmMin: number,
      kmMax: number,
      peakMaxKm: number,
      longMaxShare: number,
      weekMinKm: number
    ) => ({ quality, easy, kmMin, kmMax, peakMaxKm, longMaxShare, weekMinKm });
    expect(dayRule(3)).toEqual(row(1, 1, 30, 50, 60, 0.5, 15));
    expect(dayRule(4)).toEqual(row(2, 1, 35, 65, 80, 0.4, 20));
    expect(dayRule(5)).toEqual(row(2, 2, 40, 85, 100, 0.35, 25));
    expect(dayRule(6)).toEqual(row(2, 3, 50, 110, 120, 0.32, 30));
    for (const n of [0, 1, 2, 7]) expect(dayRule(n)).toBeNull();
    // Broj dana = kvaliteti + lagani + dugi.
    for (const n of RUN_DAYS_COUNTS) expect(P.days[n].quality + P.days[n].easy + 1).toBe(n);
  });

  it('M2 zone i korekcija obima za MP; M3 pragovi cilja', () => {
    expect(P.paces).toEqual({
      eFractionFast: 0.7,
      eFractionSlow: 0.62,
      tFraction: 0.88,
      iFraction: 0.975,
      rFraction: 1.05,
      raceDistanceM: 42195,
      mpCorrection: [
        { fromKm: 0, vdot: -2 },
        { fromKm: 40, vdot: -1 },
        { fromKm: 60, vdot: 0 }
      ]
    });
    expect(P.goal).toEqual({ realisticPerWeek: 0.08, ambitiousPerWeek: 0.16 });
  });

  it('M4 faze, M5 rasterećenje, M6 obim', () => {
    expect(P.phases).toEqual({
      specific: [
        { fromBuild: 0, weeks: 4 },
        { fromBuild: 13, weeks: 5 },
        { fromBuild: 17, weeks: 6 }
      ],
      taperWeeks: 2,
      raceWeeks: 1
    });
    expect(P.deload).toEqual({
      maxBuildRun: 3,
      exceptionRun: 4,
      firstAllowedWeek: 3,
      factor: 0.8,
      tShare: 0.6,
      tMinKm: 2,
      longFactor: 0.8
    });
    expect(P.volume).toEqual({
      growth: 0.06,
      growthMinKm: 1,
      growthMaxKm: 5,
      peakFactor: 1.5,
      peakAddKm: 30
    });
  });

  it('M7 taper i M8 trkačka nedelja', () => {
    expect(P.taper).toEqual({
      weeks: [
        { factor: 0.8, mpShare: 0.6, tShare: 0.6, longFactor: 0.65 },
        { factor: 0.6, mpShare: 0.5, tShare: null, longFactor: 0.45 }
      ],
      mpMin: { form: 'reps', reps: 2, repM: 3000 },
      mpShortMinKm: 1,
      tMinKm: 2
    });
    expect(P.raceWeek).toEqual({
      maxRunDays: 5,
      sharpener: { reps: 2, repM: 2000, recoverySec: 120 },
      sharpenerMinGapDays: 3,
      eveEasySec: 1200,
      eveStrides: { reps: 4, sec: 20 },
      eveMaxSec: 1800,
      otherEasySec: 1800,
      raceKm: 42.2,
      raceDistanceM: 42195,
      raceWarmupSec: 300
    });
    expect(P.schedule).toEqual({ defaultLongDay: 'sun' });
  });

  it('M10 lestvice (doze u km) i druga struktura', () => {
    const km = (xs: readonly Structure[]): number[] => xs.map((x) => doseOf(x) / 1000);
    expect(km(P.ladders.R)).toEqual([1.2, 1.6, 1.8, 2, 2.4, 3.2]);
    expect(km(P.ladders.T_continuous)).toEqual([2, 3, 4, 5, 6, 8]);
    expect(km(P.ladders.T_cruise)).toEqual([2.4, 3, 4.8, 6.4, 8, 9.6]);
    expect(km(P.ladders.I)).toEqual([2, 3, 4, 5, 6]);
    expect(km(P.ladders.MP)).toEqual([6, 8, 10, 12, 14, 16]);
    expect(P.ladders.MP.map((s) => s.form)).toEqual([
      'reps',
      'reps',
      'reps',
      'continuous',
      'reps',
      'continuous'
    ]);
    expect(P.alternatives).toEqual({
      repsMin: 2,
      repsMax: 5,
      roundM: 100,
      roundFallbackM: 50,
      tRepMinM: 1000,
      mpRepMinM: 3000,
      mpContinuousMaxKm: 16,
      iRepsMax: 6,
      iRepMinM: 800,
      iRepMaxM: 1200,
      iPyramidM: [1200, 1000, 800],
      pyramidStepM: 200,
      rRepM: [200, 300, 400]
    });
  });

  it('M11 plafoni, M12 početni nivo, M13 dužine, M14 WU/CD i oporavci', () => {
    expect(P.caps).toEqual({ R: 0.05, I: 0.08, T: 0.1, MP: 0.2 });
    expect(P.startLevel).toEqual({ capShare: 0.6 });
    expect(P.lengths).toEqual({
      longMaxSec: 9000,
      easyMinKm: 5,
      longShortKm: 26,
      easyLongShare: 0.8,
      easyMinSec: 1200
    });
    expect(P.longJump).toEqual({ factor: 1.1, addKm: 1, windowWeeks: 4 });
    expect(P.workout).toEqual({
      warmupCooldown: [
        { fromKm: 0, warmupSec: 900, cooldownSec: 600 },
        { fromKm: 50, warmupSec: 1200, cooldownSec: 900 },
        { fromKm: 70, warmupSec: 1500, cooldownSec: 900 }
      ],
      iRecoveryMaxSec: 240,
      iRecoveryStepSec: 15,
      tCruiseRecovery: { shortMaxM: 1600, shortSec: 60, longSec: 90 },
      mpRecovery: { shortMaxM: 4000, shortSec: 90, longSec: 120 }
    });
  });

  it('M16 po osećaju (lagan 270–510 s/km, E ± 15 s, procena VDOT 25–60, RPE T 6–7 / I 8 / R 8 / MP 5–6) i test 5 km', () => {
    expect(P.feel).toEqual({
      easyPaceMinSec: 270,
      easyPaceMaxSec: 510,
      eRangeSec: 15,
      vdotMin: 25,
      vdotMax: 60,
      rpe: {
        T: { min: 6, max: 7, cue: 'udobno teško, kratke rečenice' },
        I: { min: 8, max: 8, cue: 'teško, izdrživo 3–5 min' },
        R: { min: 8, max: 8, cue: 'brzo, opušteno' },
        MP: { min: 5, max: 6, cue: 'ritam maratona' }
      }
    });
    expect(P.test).toEqual({ km: 5 });
  });

  it('M17 početnik: jedina tabela (4–5 dana, 16 ned, obim 25–45 / 30–50, uvod 2, +5 % 1,0–2,5, vrh 1,5× / +25, T 1,5, prag 24 km, WU/CD 15/10) i planRule', () => {
    expect(P.beginner).toEqual({
      days: { 4: { kmMin: 25, kmMax: 45 }, 5: { kmMin: 30, kmMax: 50 } },
      weeksMin: 16,
      introWeeks: 2,
      growth: 0.05,
      growthMinKm: 1,
      growthMaxKm: 2.5,
      peakFactor: 1.5,
      peakAddKm: 25,
      tFirstKm: 1.5,
      longShortKm: 24,
      warmupSec: 900,
      cooldownSec: 600
    });
    expect(BEGINNER_DAYS_COUNTS).toEqual([4, 5]);
    for (const n of [3, 6]) expect(planRule(n, 'beginner')).toBeNull();
    const b4 = planRule(4, 'beginner')!;
    expect({ ...b4 }).toMatchObject({
      quality: 1,
      easy: 2,
      kmMin: 25,
      kmMax: 45,
      peakMaxKm: 80,
      longMaxShare: P.days[4].longMaxShare,
      weekMinKm: 20,
      beginner: true,
      introWeeks: 2,
      weeksMin: 16,
      feelTest: false,
      longShortKm: 24,
      fixedWarmupCooldown: { warmupSec: 900, cooldownSec: 600 }
    });
    expect(planRule(5, 'beginner')).toMatchObject({ quality: 1, easy: 3, kmMin: 30, kmMax: 50 });
    // Redovno pravilo = red M15 + brojevi M6/M13 (bez uvoda, test po osećaju, WU/CD po pojasu).
    for (const n of RUN_DAYS_COUNTS)
      expect(planRule(n)).toEqual({
        ...dayRule(n)!,
        beginner: false,
        growth: 0.06,
        growthMinKm: 1,
        growthMaxKm: 5,
        peakFactor: 1.5,
        peakAddKm: 30,
        introWeeks: 0,
        weeksMin: 12,
        feelTest: true,
        longShortKm: 26,
        fixedWarmupCooldown: null
      });
  });

  it('pouka 10 (M17): T kont. 1,5 km i T cruise staju u plafon pri najmanjem obimu početnika (i 1,5 km u rasterećenju); MP 2 × 3000 m tek od 30 km (T kont. umesto MP)', () => {
    const cap = (z: keyof typeof P.caps, km: number): number => Math.floor(P.caps[z] * km * 1000);
    for (const n of BEGINNER_DAYS_COUNTS) {
      const r = planRule(n, 'beginner')!;
      expect(P.beginner.tFirstKm * 1000, `${n}`).toBeLessThanOrEqual(
        cap('T', P.deload.factor * r.kmMin)
      );
      expect(doseOf(P.ladders.T_cruise[0]!), `${n}`).toBeLessThanOrEqual(cap('T', r.kmMin));
    }
    expect(doseOf(P.ladders.MP[0]!)).toBeGreaterThan(cap('MP', 25));
    expect(doseOf(P.ladders.MP[0]!)).toBeLessThanOrEqual(cap('MP', 30));
  });

  it('pouka 10: najniži nivo svake lestvice staje u plafon pri najmanjem obimu svakog reda (izgradnja i rasterećenje)', () => {
    const first = (xs: readonly Structure[]): number => doseOf(xs[0]!);
    const cap = (z: keyof typeof P.caps, km: number): number => Math.floor(P.caps[z] * km * 1000);
    for (const n of RUN_DAYS_COUNTS) {
      const r = dayRule(n)!;
      if (r.quality === 2) {
        expect(first(P.ladders.R), `${n}`).toBeLessThanOrEqual(cap('R', r.kmMin));
        expect(first(P.ladders.I), `${n}`).toBeLessThanOrEqual(cap('I', r.kmMin));
      }
      expect(first(P.ladders.T_continuous), `${n}`).toBeLessThanOrEqual(cap('T', r.kmMin));
      expect(first(P.ladders.T_cruise), `${n}`).toBeLessThanOrEqual(cap('T', r.kmMin));
      expect(first(P.ladders.MP), `${n}`).toBeLessThanOrEqual(cap('MP', r.kmMin));
      // Rasterećenje: T 2,0 km pri 0,8 × najmanji obim.
      expect(P.deload.tMinKm * 1000, `${n}`).toBeLessThanOrEqual(
        cap('T', P.deload.factor * r.kmMin)
      );
    }
  });
});
