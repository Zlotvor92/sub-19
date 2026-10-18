/* Brojevi politike su odluke D1–D30 iz zadataka segmenata 01, 01b, 02, 02b i 03: test pada kad se broj
   promeni bez izmene odluke. Svaka odluka ima red u DECISIONS sa mestom i obrazloženjem. */

import { describe, expect, it } from 'vitest';
import {
  BEGINNER_DAYS_COUNTS,
  dayRule,
  planRule,
  RUN_DAYS_COUNTS,
  TEN_K_V2_POLICY as P
} from './policy.ts';

describe('policy 10k-v2.3.0', () => {
  it('oznaka politike', () => {
    expect(P.id).toBe('10k-v2');
    expect(P.version).toBe('10k-v2.3.0');
  });

  it('DECISIONS: tačno D1–D22, D22b, D23, D25–D30 (03), svaka sa pravilom, mestom i obrazloženjem', () => {
    expect(P.DECISIONS.map((d) => d.id)).toEqual([
      ...Array.from({ length: 22 }, (_, i) => `D${i + 1}`),
      'D22b',
      'D23',
      'D25',
      'D26',
      'D27',
      'D28',
      'D29',
      'D30'
    ]);
    for (const d of P.DECISIONS) {
      expect(d.rule.length, d.id).toBeGreaterThan(20);
      expect(d.place.length, d.id).toBeGreaterThan(3);
      expect(d.rationale.length, d.id).toBeGreaterThan(20);
    }
    expect(P.DECISIONS.find((d) => d.id === 'D4')!.rationale).toMatch(/Bosquet/);
    const rule = (id: string): string => P.DECISIONS.find((d) => d.id === id)!.rule;
    expect(rule('D12')).toMatch(/D11 ispred D12/);
    expect(rule('D12')).toMatch(/baza bez platoa \(tvrdo, D22\)/);
    expect(rule('D16')).toMatch(/60 % plafona/);
    expect(rule('D17')).toMatch(/JEDINA/);
    expect(rule('D18')).toMatch(/bez I i R/);
    expect(rule('D19')).toMatch(/razlika ≤ 0,1 km/);
    expect(rule('D20')).toMatch(/min\(broj dana, 5\)/);
    expect(rule('D21')).toMatch(/8 ned → 2\/2\/2\/1\/1, 9 ned → 2\/3\/2\/1\/1/);
    expect(rule('D22')).toMatch(/2,5 = 2 × 1250; 3,5 = 2 × 1750; 4,5 = 3 × 1500/);
    // 02b (10k-v2.2.1).
    expect(rule('D17')).toMatch(/dugi ≤ 45 %/);
    expect(rule('D22b')).toMatch(/≥ 1000 m .*od 10k-v2\.3\.0 RP deonice ≥ 800 m, D30/);
    expect(rule('D22b')).toMatch(/2,5 = 2 × 1250; 3,5 = 2 × 1750/);
    expect(rule('D23')).toMatch(/min\(35 min E, km najkraćeg laganog dana tapera\)/);
    expect(rule('D25')).toMatch(/UPOZORENJE LONG_SHORTER_THAN_QUALITY/);
    const why = (id: string): string => P.DECISIONS.find((d) => d.id === id)!.rationale;
    expect(why('D17')).toMatch(/396 → 0, ukupno 528 → 330/);
    expect(why('D25')).toMatch(/1320 → 1830/);
    // 03 (10k-v2.3.0).
    expect(rule('D1')).toMatch(/inače plan po osećaju \(D26\)/);
    expect(rule('D26')).toMatch(/E = lagan tempo ± 15 s/);
    expect(rule('D26')).toMatch(/T 6–7, RP 7–8, I 8, R 8/);
    expect(rule('D27')).toMatch(/poslednja nedelja baze, na danu Q1/);
    expect(rule('D27')).toMatch(/NE u dozu kvaliteta/);
    expect(rule('D28')).toMatch(/nedelje 1–2 uvod bez kvaliteta/);
    expect(rule('D28')).toMatch(/rast \+5 % \(min 1,0, max 2,0 km\)/);
    expect(rule('D29')).toMatch(/RUN_WALK_NOT_SUPPORTED/);
    expect(rule('D30')).toMatch(/deonica ≥ 800 m \(T ostaje ≥ 1000 m\)/);
    expect(rule('D30')).toMatch(/planirano \+ trka \(10 km\) ≥ minimum nedelje/);
    expect(why('D27')).toMatch(/D27 ispred D5/);
    expect(why('D28')).toMatch(/D11 ispred D28/);
    expect(why('D30')).toMatch(/1224 \/ 192 \/ 144 \/ 144 → 240 \/ 48 \/ 0 \/ 0/);
  });

  it('D1 opseg (dani i obim: D17; početnik: D28), D29', () => {
    expect(P.input).toEqual({
      weeksMin: 8,
      weeksMax: 18,
      resultMaxAgeDays: 84,
      resultDistancesM: [3000, 5000, 10000, 21097.5],
      vdotMin: 30,
      vdotMax: 80,
      continuousRunMin: 30
    });
  });

  it('D26 plan po osećaju i D27 test', () => {
    expect(P.feel).toEqual({
      easyPaceMinSec: 270,
      easyPaceMaxSec: 510,
      eRangeSec: 15,
      vdotMin: 25,
      vdotMax: 60,
      rpe: {
        T: { min: 6, max: 7, cue: 'udobno teško, kratke rečenice' },
        RP: { min: 7, max: 8, cue: 'ritam trke 10K' },
        I: { min: 8, max: 8, cue: 'teško, izdrživo 3–5 min' },
        R: { min: 8, max: 8, cue: 'brzo, opušteno' }
      }
    });
    expect(P.test).toEqual({ km: 5 });
  });

  it('D28: jedna tabela početnika; planRule — redovan = red D17 + D6/D13, početnik = red D17 izmenjen tabelom', () => {
    expect(P.beginner).toEqual({
      days: { 3: { kmMin: 15, kmMax: 30 }, 4: { kmMin: 18, kmMax: 35 } },
      weeksMin: 10,
      introWeeks: 2,
      growth: 0.05,
      growthMinKm: 1,
      growthMaxKm: 2,
      peakFactor: 1.3,
      peakAddKm: 10,
      longMaxSec: 90 * 60
    });
    expect(BEGINNER_DAYS_COUNTS).toEqual([3, 4]);
    for (const n of RUN_DAYS_COUNTS)
      expect(planRule(n, 'regular')).toEqual({
        ...dayRule(n),
        beginner: false,
        longMaxSec: 105 * 60,
        growth: 0.06,
        growthMinKm: 1,
        growthMaxKm: 3,
        peakFactor: 1.4,
        peakAddKm: 15,
        introWeeks: 0,
        weeksMin: 8,
        dayCounts: [3, 4, 5, 6]
      });
    expect(planRule(4, 'beginner')).toEqual({
      quality: 1,
      easy: 2,
      kmMin: 18,
      kmMax: 35,
      peakMaxKm: 60,
      longMaxShare: 0.33,
      weekMinKm: 12,
      beginner: true,
      longMaxSec: 90 * 60,
      growth: 0.05,
      growthMinKm: 1,
      growthMaxKm: 2,
      peakFactor: 1.3,
      peakAddKm: 10,
      introWeeks: 2,
      weeksMin: 10,
      dayCounts: [3, 4]
    });
    expect(planRule(3, 'beginner')).toMatchObject({ quality: 1, easy: 1, kmMin: 15, kmMax: 30 });
    expect([5, 6, 2, 7].map((n) => planRule(n, 'beginner'))).toEqual([null, null, null, null]);
  });

  it('D17: jedina tabela po broju dana (02b: 3 dana udeo dugog 0,45; 4 dana bez promene od 10k-v2.1.0)', () => {
    expect(P.days).toEqual({
      3: {
        quality: 1,
        easy: 1,
        kmMin: 20,
        kmMax: 40,
        peakMaxKm: 45,
        longMaxShare: 0.45,
        weekMinKm: 9
      },
      4: {
        quality: 2,
        easy: 1,
        kmMin: 25,
        kmMax: 55,
        peakMaxKm: 60,
        longMaxShare: 0.33,
        weekMinKm: 12
      },
      5: {
        quality: 2,
        easy: 2,
        kmMin: 30,
        kmMax: 65,
        peakMaxKm: 75,
        longMaxShare: 0.3,
        weekMinKm: 15
      },
      6: {
        quality: 2,
        easy: 3,
        kmMin: 35,
        kmMax: 80,
        peakMaxKm: 90,
        longMaxShare: 0.27,
        weekMinKm: 18
      }
    });
    expect(RUN_DAYS_COUNTS).toEqual([3, 4, 5, 6]);
    expect([1, 2, 7].map(dayRule)).toEqual([null, null, null]);
    for (const n of RUN_DAYS_COUNTS) expect(dayRule(n)!.quality + dayRule(n)!.easy + 1).toBe(n);
    // Nema pojedinačnih brojeva 4 dana van tabele.
    expect(P.lengths).toEqual({ longMaxSec: 105 * 60, easyMinKm: 3 });
    expect('peakMaxKm' in P.volume).toBe(false);
    expect('week' in P).toBe(false);
  });

  it('D3, D4/D21, D5, D6, D7 faktori', () => {
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
      peakAddKm: 15
    });
    expect(P.taper).toMatchObject({ factor: 0.75, doseShare: 0.6, tMinKm: 2, longFactor: 0.75 });
    expect(P.taper.rpMin).toEqual({ reps: 2, repM: 1000 });
    expect(P.phases).toEqual({
      specificShort: 3,
      specificLong: 4,
      specificShortMaxBuild: 11,
      shortPrepMaxBuild: 7,
      shortPrepSpecific: 2,
      taperWeeks: 1,
      raceWeeks: 1
    });
  });

  it('D8 + D20 trkačka nedelja', () => {
    expect(P.raceWeek).toEqual({
      maxRunDays: 5,
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

  it('D10 lestvice (km u zoni), D22/D30 druge strukture (T ≥ 1000 m, RP ≥ 800 m, 50 m bez podele na 100 m)', () => {
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
      roundFallbackM: 50,
      repMinM: 1000,
      rpRepMinM: 800,
      iRepsMax: 6,
      iRepMinM: 800,
      iRepMaxM: 1200,
      iPyramidM: [1200, 1000, 800],
      rRepM: [200, 300, 400]
    });
  });

  it('D11 jedan plafon po zoni', () => {
    expect(P.caps).toEqual({ R: 0.05, I: 0.08, T: 0.1, RP: 0.1 });
  });

  it('D14, D16', () => {
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
    expect(P.startLevel).toEqual({ capShare: 0.6 });
  });
});
