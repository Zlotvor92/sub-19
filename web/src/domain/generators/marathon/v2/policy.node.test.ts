import { describe, expect, it } from 'vitest';
import { dayRule, MARATHON_V2_POLICY as P, RUN_DAYS_COUNTS } from './policy.ts';
import type { Structure } from './types.ts';
import { doseOf } from './workouts.ts';

/* Brojevi M1–M15 (MASTER-HM-MARATHON.md § 5) zakucani: izmena broja mora da obori test i ide kroz DECISIONS. */

describe('politika maraton v2 (M1–M15)', () => {
  it('oznaka politike (Uslov 6)', () => {
    expect(P.id).toBe('marathon-v2');
    expect(P.version).toBe('marathon-v2.0.0');
  });

  it('DECISIONS: M1–M15 i M7a (M7 ispred M11 samo u taperu), svaka sa pravilom, mestom i obrazloženjem', () => {
    const ids = Array.from({ length: 15 }, (_, i) => `M${i + 1}`);
    ids.splice(7, 0, 'M7a');
    expect(P.DECISIONS.map((d) => d.id)).toEqual(ids);
    for (const d of P.DECISIONS) {
      expect(d.rule.length, d.id).toBeGreaterThan(40);
      expect(d.place.length, d.id).toBeGreaterThan(5);
      expect(d.rationale.length, d.id).toBeGreaterThan(40);
    }
  });

  it('M1 opseg ulaza i M15 red 4 dana', () => {
    expect(P.input).toEqual({
      weeksMin: 12,
      weeksMax: 24,
      resultMaxAgeDays: 84,
      resultDistancesM: [5000, 10000, 21097.5, 42195],
      shortResultM: 5000,
      vdotMin: 30,
      vdotMax: 80
    });
    expect(RUN_DAYS_COUNTS).toEqual([4]);
    expect(dayRule(4)).toEqual({
      quality: 2,
      easy: 1,
      kmMin: 35,
      kmMax: 65,
      peakMaxKm: 80,
      longMaxShare: 0.4,
      weekMinKm: 20
    });
    for (const n of [1, 2, 3, 5, 6, 7]) expect(dayRule(n)).toBeNull();
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
      rRepM: [200, 300, 400]
    });
  });

  it('M11 plafoni, M12 početni nivo, M13 dužine, M14 WU/CD i oporavci', () => {
    expect(P.caps).toEqual({ R: 0.05, I: 0.08, T: 0.1, MP: 0.2 });
    expect(P.startLevel).toEqual({ capShare: 0.6 });
    expect(P.lengths).toEqual({ longMaxSec: 9000, easyMinKm: 5, longShortKm: 26 });
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

  it('pouka 10: najniži nivo svake lestvice staje u plafon pri najmanjem obimu reda (izgradnja i rasterećenje)', () => {
    const r = dayRule(4)!;
    const first = (xs: readonly Structure[]): number => doseOf(xs[0]!);
    const cap = (z: keyof typeof P.caps, km: number): number => Math.floor(P.caps[z] * km * 1000);
    expect(first(P.ladders.R)).toBeLessThanOrEqual(cap('R', r.kmMin));
    expect(first(P.ladders.T_continuous)).toBeLessThanOrEqual(cap('T', r.kmMin));
    expect(first(P.ladders.T_cruise)).toBeLessThanOrEqual(cap('T', r.kmMin));
    expect(first(P.ladders.I)).toBeLessThanOrEqual(cap('I', r.kmMin));
    expect(first(P.ladders.MP)).toBeLessThanOrEqual(cap('MP', r.kmMin));
    // Rasterećenje: T 2,0 km pri 0,8 × najmanji obim.
    expect(P.deload.tMinKm * 1000).toBeLessThanOrEqual(cap('T', P.deload.factor * r.kmMin));
  });
});
