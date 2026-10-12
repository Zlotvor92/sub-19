import { describe, expect, it } from 'vitest';
import { goalContext } from '../../ai';
import { addDays, type IsoDate } from '../../date';
import type { Intensity, TrainingPlan } from '../types';
import { raceTimeForVdot } from '../vdot/racePrediction';
import { vdotFromRace } from '../vdot/calculateVDOT';
import { assess } from './assess';
import { generatePlan } from './generatePlan';

const intensities: Intensity[] = ['kons', 'std', 'agr'];
const pb = { distM: 5000, sec: 1235 };

describe('current-fitness assessment, without unsupported improvement promises', () => {
  it('changing intensity or weeks cannot improve the same confirmed result', () => {
    const reference = assess(pb, 16, 'std', 1139, 5000);
    expect(reference.predictedSec).toBeCloseTo(pb.sec, 0);
    expect(reference.vdotGoal).toBe(reference.vdot0);
    expect(reference.assessmentBasis).toBe('current-fitness');
    expect(reference.realno).toBe(false);
    for (const intensity of intensities)
      for (const weeks of [6, 16, 40])
        expect(assess(pb, weeks, intensity, 1139, 5000)).toEqual(reference);
  });

  it('an easier target changes the verdict, not the reference fitness', () => {
    const fasterGoal = assess(pb, 16, 'std', 1139, 5000);
    const easierGoal = assess(pb, 16, 'std', 1300, 5000);
    expect(easierGoal.realno).toBe(true);
    expect(easierGoal.predictedSec).toBe(fasterGoal.predictedSec);
    expect(easierGoal.vdotGoal).toBe(fasterGoal.vdotGoal);
    expect(assess(pb, 16, 'std', null, 5000).realno).toBeNull();
  });

  it('cross-distance equivalence is labelled as a reference, not a readiness promise', () => {
    const marathon = assess(pb, 20, 'agr', null, 42195);
    expect(marathon.predictedSec).toBeCloseTo(
      raceTimeForVdot(vdotFromRace(pb.distM, pb.sec), 42195),
      0
    );
    expect(goalContext({ ...marathon, raceName: 'Maraton' })).toContain(
      'nije prognoza napretka ni potvrda spremnosti'
    );
    // Legacy saved plans retain their existing context wording.
    expect(goalContext({ predictedSec: 1200, raceName: '5 km' })).toContain('procenjeno vreme');
  });

  it('dose preference changes training without changing the confirmed fitness reference', () => {
    const start = '2026-10-12' as IsoDate;
    const plans = intensities.map((intensity): TrainingPlan => {
      const p = generatePlan({
        startDate: start,
        raceDate: addDays(start, 16 * 7 - 1),
        pb,
        weeklyKm: 50,
        runDays: 5,
        quality: 2,
        intensity,
        volIntensity: 'std',
        goalSec: 1139,
        _noSuggest: true
      });
      if ('error' in p) throw new Error(p.error);
      return p;
    });
    for (const plan of plans) {
      expect(plan.meta.predictedSec).toBe(plans[0]!.meta.predictedSec);
      expect(plan.meta.vdot0).toBe(plans[0]!.meta.vdot0);
      expect(plan.meta.vdotGoal).toBe(plans[0]!.meta.vdotGoal);
      expect(plan.meta.racePace).toBeGreaterThanOrEqual(247);
      expect(plan.meta.assessmentBasis).toBe('current-fitness');
    }
    // This check is meaningful now that intensity controls quality dose.
    expect(plans[0]!.weeks).not.toEqual(plans[2]!.weeks);
  });
});
