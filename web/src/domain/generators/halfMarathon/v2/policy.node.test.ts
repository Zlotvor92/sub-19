/* H1–H17, HI*: svi brojevi politike zakucani (izmena broja = svesna izmena testa i DECISIONS). */

import { describe, expect, it } from 'vitest';
import { dayRule, HM_V2_POLICY as P, RUN_DAYS_COUNTS } from './policy.ts';

describe('HM v2 politika (MASTER § 4)', () => {
  it('oznaka politike (Uslov 6)', () => {
    expect(P.id).toBe('hm-v2');
    expect(P.version).toBe('hm-v2.4.1');
  });

  it('H1 opseg ulaza', () => {
    expect(P.input).toEqual({
      weeksMin: 10,
      weeksMax: 20,
      resultMaxAgeDays: 84,
      resultDistancesM: [5000, 10000, 21097.5, 42195],
      vdotMin: 30,
      vdotMax: 80
    });
  });

  it('H15 tabela 3/4/5/6 dana (4 dana: udeo 40 %, odluka organizatora); 1/2/7 dana nema', () => {
    expect(RUN_DAYS_COUNTS).toEqual([3, 4, 5, 6]);
    expect(dayRule(3)).toEqual({
      quality: 1,
      easy: 1,
      kmMin: 25,
      kmMax: 45,
      peakMaxKm: 55,
      longMaxShare: 0.45,
      weekMinKm: 12
    });
    expect(dayRule(5)).toEqual({
      quality: 2,
      easy: 2,
      kmMin: 35,
      kmMax: 75,
      peakMaxKm: 85,
      longMaxShare: 0.32,
      weekMinKm: 20
    });
    expect(dayRule(6)).toEqual({
      quality: 2,
      easy: 3,
      kmMin: 40,
      kmMax: 90,
      peakMaxKm: 100,
      longMaxShare: 0.3,
      weekMinKm: 24
    });
    expect(dayRule(4)).toEqual({
      quality: 2,
      easy: 1,
      kmMin: 30,
      kmMax: 60,
      peakMaxKm: 70,
      longMaxShare: 0.4,
      weekMinKm: 16
    });
    for (const n of [0, 1, 2, 7]) expect(dayRule(n)).toBeNull();
    // Minimum nedelje = dani × lagan 4 km (H15, Uslov 8).
    for (const n of RUN_DAYS_COUNTS) expect(dayRule(n)!.weekMinKm).toBe(n * P.lengths.easyMinKm);
  });

  it('H2 udeli zona, RP = polumaraton; H3 pragovi cilja', () => {
    expect(P.paces).toEqual({
      eFractionFast: 0.7,
      eFractionSlow: 0.62,
      tFraction: 0.88,
      iFraction: 0.975,
      rFraction: 1.05,
      raceDistanceM: 21097.5
    });
    expect(P.goal).toEqual({ realisticPerWeek: 0.1, ambitiousPerWeek: 0.2 });
  });

  it('H4 faze, H5 rasterećenje, H6 obim, H7 taper', () => {
    expect(P.phases.specific).toEqual([
      { maxBuild: 9, weeks: 3 },
      { maxBuild: 13, weeks: 4 },
      { maxBuild: Infinity, weeks: 5 }
    ]);
    expect([P.phases.taperWeeks, P.phases.raceWeeks]).toEqual([1, 1]);
    expect(P.deload).toEqual({
      maxBuildRun: 3,
      exceptionRun: 4,
      firstAllowedWeek: 3,
      factor: 0.8,
      tShare: 0.6,
      tMinKm: 2.0,
      longFactor: 0.8
    });
    expect(P.volume).toEqual({
      growth: 0.06,
      growthMinKm: 1.0,
      growthMaxKm: 4.0,
      peakFactor: 1.4,
      peakAddKm: 20
    });
    expect(P.taper).toEqual({
      factor: 0.7,
      doseShare: 0.6,
      rpMin: { reps: 2, repM: 2000 },
      tMinKm: 2.0,
      longFactor: 0.6
    });
  });

  it('H8 trkačka nedelja', () => {
    expect(P.raceWeek).toEqual({
      maxRunDays: 5,
      sharpener: { reps: 2, repM: 2000, recoverySec: 120 },
      sharpenerMinGapDays: 3,
      eveEasySec: 1200,
      eveStrides: { reps: 4, sec: 20 },
      eveMaxSec: 1800,
      otherEasySec: 2100,
      raceKm: 21.1,
      raceWarmupSec: 600,
      raceCooldownSec: 600
    });
  });

  it('H10 lestvice (doze u m) i druga struktura (HI1)', () => {
    const d = (xs: readonly { reps: number; repM: number }[]): number[] =>
      xs.map((x) => x.reps * x.repM);
    expect(d(P.ladders.R)).toEqual([1200, 1600, 1800, 2000, 2400, 3200]);
    expect(P.ladders.T_continuous).toEqual([2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 7.0]);
    expect(d(P.ladders.T_cruise)).toEqual([2400, 3000, 3200, 4000, 4800, 6000, 6400, 8000, 9000]);
    expect(d(P.ladders.I)).toEqual([2000, 2400, 3000, 4000, 4800, 5000, 6000]);
    expect(d(P.ladders.RP)).toEqual([4000, 5000, 6000, 8000, 9000, 10000, 12000]);
    expect(P.alternatives).toEqual({
      repsMin: 2,
      repsMax: 5,
      roundM: 100,
      roundFallbackM: 50,
      tRepMinM: 1000,
      rpRepMinM: 2000,
      rpContinuousMaxKm: 10,
      iRepsMax: 6,
      iRepMinM: 800,
      iRepMaxM: 1200,
      iPyramidM: [1200, 1000, 800],
      pyramidStepM: 200,
      rRepM: [200, 300, 400]
    });
  });

  it('H11 plafoni, H12 početni nivo, H13 dužine, H14 WU/CD i oporavci', () => {
    expect(P.caps).toEqual({ R: 0.05, I: 0.08, T: 0.1, RP: 0.15 });
    expect(P.startLevel).toEqual({ capShare: 0.6 });
    // H13: dugi ≤ 24 km (odluka organizatora HM-01 → 02); pouka 28 (HI7).
    expect(P.lengths).toEqual({ longMaxSec: 9000, longMaxKm: 24, easyMinKm: 4.0, longWarnKm: 16 });
    expect(P.recentLong).toEqual({
      minKm: 5,
      maxKm: 42,
      factor: 1.1,
      addKm: 1.0,
      windowWeeks: 4,
      thresholdStepKm: 0.5
    });
    expect(P.workout.warmupCooldown).toEqual([
      { fromKm: 0, warmupSec: 900, cooldownSec: 600 },
      { fromKm: 40, warmupSec: 1200, cooldownSec: 900 },
      { fromKm: 60, warmupSec: 1500, cooldownSec: 900 }
    ]);
    expect([P.workout.iRecoveryMaxSec, P.workout.iRecoveryStepSec]).toEqual([240, 15]);
    expect(P.workout.tCruiseRecovery).toEqual([
      { maxRepM: 1600, sec: 60 },
      { maxRepM: Infinity, sec: 90 }
    ]);
    expect(P.workout.rpRecovery).toEqual([
      { maxRepM: 3000, sec: 90 },
      { maxRepM: Infinity, sec: 120 }
    ]);
  });

  it('H16 po osećaju: lagan 270–510 s/km, E ± 15 s, procena VDOT 25–60, RPE T/RP 6–7, I/R 8; test 5 km', () => {
    expect(P.feel).toEqual({
      easyPaceMinSec: 270,
      easyPaceMaxSec: 510,
      eRangeSec: 15,
      vdotMin: 25,
      vdotMax: 60,
      rpe: {
        T: { min: 6, max: 7, cue: 'udobno teško, kratke rečenice' },
        RP: { min: 6, max: 7, cue: 'ritam polumaratona' },
        I: { min: 8, max: 8, cue: 'teško, izdrživo 3–5 min' },
        R: { min: 8, max: 8, cue: 'brzo, opušteno' }
      }
    });
    expect(P.test).toEqual({ km: 5 });
  });

  it('DECISIONS: svaka odluka ima pravilo, mesto i obrazloženje; jedinstveni id', () => {
    const ids = P.DECISIONS.map((d) => d.id);
    expect(ids).toEqual([
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'H7',
      'H8',
      'H9',
      'H10',
      'H11',
      'H12',
      'H13',
      'H14',
      'H15',
      'H16',
      'H17',
      'HI1',
      'HI4',
      'HI5',
      'HI2',
      'HI3',
      'HI6',
      'HI7',
      'HI8',
      'HI9',
      'HI10',
      'HI14',
      'HI11',
      'HI12',
      'HI15',
      'HI13',
      'A1',
      'A2',
      'A3',
      'A4',
      'A5',
      'A6',
      'A7',
      'A8',
      'A9',
      'A10',
      'A11',
      'A12',
      'A13',
      'A14',
      'A15',
      'A17',
      'A18',
      'F4a-N5',
      'F4a-N6',
      'F4a-N7',
      'F4a-N9',
      'F4a-N10',
      'F4a-N11',
      'F4a-N12',
      'HM07b-GUARD'
    ]);
    for (const d of P.DECISIONS) {
      expect(d.rule.length, d.id).toBeGreaterThan(20);
      expect(d.place.length, d.id).toBeGreaterThan(5);
      expect(d.rationale.length, d.id).toBeGreaterThan(20);
    }
    expect(P.DECISIONS.find((d) => d.id === 'H15')!.rule).toContain('40 %');
    expect(P.DECISIONS.find((d) => d.id === 'H13')!.rule).toContain('24 km');
    expect(P.DECISIONS.find((d) => d.id === 'H13')!.rationale).toContain('1320 / 3696');
    // HM-04 A: pouka 32 — izuzetak od „doza ne opada" i najniži nivo zone izuzet od drugog člana.
    const hi15 = P.DECISIONS.find((d) => d.id === 'HI15')!.rule;
    expect(hi15).toContain('izuzetak od „doza ne opada"');
    expect(hi15).toContain('Najniži nivo zone');
    // H18: orijentir < 10 nedelja, bol dugi ≤ 60 min i lagani × 0,7 ≥ 4 km, taper posle smanjenja 0,7 ×.
    expect(P.adapt.restartFullPrepWeeks).toBe(10);
    expect([P.adapt.painLongMaxSec, P.adapt.painEasyFactor, P.lengths.easyMinKm]).toEqual([
      3600, 0.7, 4
    ]);
    expect(P.taper.factor).toBe(0.7);
    expect(P.DECISIONS.find((d) => d.id === 'A4')!.rule).toContain('Pouka 18');
  });
});
