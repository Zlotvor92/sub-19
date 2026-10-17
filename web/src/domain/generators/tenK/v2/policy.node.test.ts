/* Brojevi politike su odluke D1–D16 iz zadataka segmenata 01 i 01b: test pada kad se broj promeni
   bez izmene odluke. Svaka odluka ima red u DECISIONS sa mestom i obrazloženjem. */

import { describe, expect, it } from 'vitest';
import { TEN_K_V2_POLICY as P } from './policy.ts';

describe('policy 10k-v2.1.0', () => {
  it('oznaka politike', () => {
    expect(P.id).toBe('10k-v2');
    expect(P.version).toBe('10k-v2.1.0');
  });

  it('DECISIONS: tačno D1–D16, svaka sa pravilom, mestom i obrazloženjem', () => {
    expect(P.DECISIONS.map((d) => d.id)).toEqual(Array.from({ length: 16 }, (_, i) => `D${i + 1}`));
    for (const d of P.DECISIONS) {
      expect(d.rule.length, d.id).toBeGreaterThan(20);
      expect(d.place.length, d.id).toBeGreaterThan(3);
      expect(d.rationale.length, d.id).toBeGreaterThan(20);
    }
    expect(P.DECISIONS.find((d) => d.id === 'D4')!.rationale).toMatch(/Bosquet/);
    // 01b: D11 ispred D12 je usvojena odluka (D12), ne odstupanje; D6 poruka kapaciteta.
    const rule = (id: string): string => P.DECISIONS.find((d) => d.id === id)!.rule;
    expect(rule('D12')).toMatch(/D11 ispred D12/);
    expect(rule('D6')).toContain(
      '4 dana ne nose ovaj obim uz dugi ≤ 105 min; preporuka 5–6 dana (od segmenta 02)'
    );
    expect(rule('D16')).toMatch(/60 % plafona/);
  });

  it('D1 opseg', () => {
    expect(P.input).toMatchObject({
      runDays: 4,
      weeksMin: 10,
      weeksMax: 18,
      weeksAbsoluteMin: 8,
      weeklyKmMin: 25,
      weeklyKmMax: 55,
      resultMaxAgeDays: 84,
      vdotMin: 30,
      vdotMax: 80
    });
    expect(P.input.runDaysLaterSegment).toEqual([3, 5, 6]);
    expect(P.input.resultDistancesM).toEqual([3000, 5000, 10000, 21097.5]);
  });

  it('D3, D5, D6, D7 faktori', () => {
    expect(P.goal).toEqual({ realisticPerWeek: 0.1, ambitiousPerWeek: 0.2 });
    expect(P.deload).toMatchObject({
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
      growthMaxKm: 3,
      peakFactor: 1.4,
      peakAddKm: 15,
      peakMaxKm: 60
    });
    expect(P.taper).toMatchObject({ factor: 0.75, doseShare: 0.6, tMinKm: 2, longFactor: 0.75 });
    expect(P.taper.rpMin).toEqual({ reps: 2, repM: 1000 });
    expect(P.phases).toMatchObject({
      specificShort: 3,
      specificLong: 4,
      specificShortMaxBuild: 11
    });
  });

  it('D8 trkačka nedelja', () => {
    expect(P.raceWeek).toEqual({
      maxRunDays: 4,
      sharpener: { reps: 3, repM: 1000, recoverySec: 90 },
      sharpenerSmallReps: 2,
      sharpenerMinGapDays: 3,
      eveEasySec: 1200,
      eveStrides: { reps: 4, sec: 20 },
      eveMaxSec: 1800,
      otherEasySec: 2100,
      raceKm: 10,
      raceWarmupSec: 900,
      raceCooldownSec: 600
    });
  });

  it('D10 lestvice (km u zoni)', () => {
    const km = (l: readonly { reps: number; repM: number }[]): number[] =>
      l.map((r) => (r.reps * r.repM) / 1000);
    expect(km(P.ladders.R)).toEqual([1.2, 1.6, 1.8, 2.0, 2.4]);
    expect(P.ladders.T_continuous).toEqual([2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]);
    expect(km(P.ladders.T_cruise)).toEqual([2.0, 2.4, 3.0, 3.6, 4.0, 4.8, 5.0, 6.0, 6.4, 8.0]);
    expect(km(P.ladders.I)).toEqual([2.0, 2.4, 3.0, 3.6, 4.0, 4.8, 5.0, 6.0]);
    expect(km(P.ladders.RP)).toEqual([2.4, 3.0, 4.0, 4.5, 5.0, 6.0]);
    expect(P.alternatives).toEqual({
      repsMin: 2,
      repsMax: 5,
      roundM: 100,
      tRepMinM: 1000,
      iRepsMax: 6,
      iRepMinM: 800,
      iRepMaxM: 1200,
      iPyramidM: [1200, 1000, 800],
      rRepM: [200, 300]
    });
  });

  it('D11 jedan plafon po zoni', () => {
    expect(P.caps).toEqual({ R: 0.05, I: 0.08, T: 0.1, RP: 0.1 });
  });

  it('D13, D14, D15, D16', () => {
    expect(P.lengths).toEqual({ longMaxShare: 0.33, longMaxSec: 105 * 60, easyMinKm: 3 });
    expect(P.workout.warmupCooldown).toEqual([
      { fromKm: 0, warmupSec: 15 * 60, cooldownSec: 10 * 60 },
      { fromKm: 35, warmupSec: 20 * 60, cooldownSec: 15 * 60 },
      { fromKm: 45, warmupSec: 25 * 60, cooldownSec: 15 * 60 }
    ]);
    expect(P.workout).toMatchObject({
      iRecoveryMaxSec: 240,
      iRecoveryStepSec: 15,
      tCruiseRecoverySec: 60
    });
    expect(P.workout.rpRecovery).toEqual([
      { maxRepM: 1200, sec: 60 },
      { maxRepM: 2000, sec: 90 },
      { maxRepM: 3000, sec: 120 }
    ]);
    expect(P.week.minKm).toBe(12);
    expect(P.startLevel).toEqual({ capShare: 0.6 });
  });
});
