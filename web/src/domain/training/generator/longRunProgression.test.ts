import { describe, expect, it } from 'vitest';
import { HEURISTIC_21K, HEURISTIC_42K } from '../constants/distances';
import { PROFILE_21K } from '../distances/profile21k';
import { PROFILE_42K } from '../distances/profile42k';
import type { QualityRequest } from '../distances/types';
import { sessQKm } from '../sessions/calc';
import { ZONE_FOR_KIND } from '../vdot/zoneForKind';
import { nextLongRunTarget, type LongRunProgressionRequest } from './longRunProgression';

const base: LongRunProgressionRequest = {
  heuristic: HEURISTIC_21K,
  week: 1,
  recentLongRunKm: 12,
  consistentWeeks: 12,
  trainedRecently: true,
  startingWeeklyKm: 40,
  weeklyKm: 40,
  paceSecPerKm: 360
};

describe('Independent long-run exposure progression', () => {
  it('starts at the recently repeatable run without an automatic week-one increase', () => {
    expect(nextLongRunTarget(base)).toMatchObject({ km: 12, baselineKm: 12, basis: 'reported' });
    expect(nextLongRunTarget({ ...base, recentLongRunKm: 8 }).km).toBe(8);
  });

  it('uses a conservative declared inference when recent long-run history is missing', () => {
    const result = nextLongRunTarget({ ...base, recentLongRunKm: undefined });
    expect(result.basis).toBe('inferred');
    expect(result.km).toBeLessThanOrEqual(12);
    expect(
      nextLongRunTarget({ ...base, startingWeeklyKm: 60, recentLongRunKm: undefined }).km
    ).toBe(14);
  });

  it('keeps the target unchanged when weekly mileage rises but exposure is unchanged', () => {
    const a = nextLongRunTarget({ ...base, week: 2, previousPeakKm: 12 });
    const b = nextLongRunTarget({ ...base, week: 2, previousPeakKm: 12, weeklyKm: 70 });
    expect(a.km).toBe(b.km);
    expect(a.km).toBeGreaterThan(12);
  });

  it('allows HM progression beyond the old 14 km low-volume plateau within capacity', () => {
    let previousPeakKm = 14;
    for (let week = 2; week <= 8; week++) {
      const target = nextLongRunTarget({ ...base, week, previousPeakKm, weeklyKm: 50 });
      expect(target.km - previousPeakKm).toBeLessThanOrEqual(1.5 + 1e-8);
      previousPeakKm = Math.max(previousPeakKm, target.km);
    }
    expect(previousPeakKm).toBeGreaterThan(20);
    expect(previousPeakKm).toBeLessThanOrEqual(22);
  });

  it('does not raise a target faster merely because a marathon goal is longer', () => {
    const hm = nextLongRunTarget({ ...base, week: 2, previousPeakKm: 12 });
    const marathon = nextLongRunTarget({
      ...base,
      heuristic: HEURISTIC_42K,
      marathon: true,
      week: 2,
      previousPeakKm: 12
    });
    expect(marathon.km).toBe(hm.km);
  });

  it('uses slower growth with unknown continuity and when returning to running', () => {
    const experienced = nextLongRunTarget({ ...base, week: 2, previousPeakKm: 12 }).km;
    const missing = nextLongRunTarget({
      ...base,
      week: 2,
      previousPeakKm: 12,
      consistentWeeks: undefined
    }).km;
    const returning = nextLongRunTarget({
      ...base,
      week: 2,
      previousPeakKm: 12,
      trainedRecently: false
    }).km;
    expect(missing).toBeLessThan(experienced);
    expect(returning).toBe(missing);
  });

  it('does not accumulate missed mileage after a blocked target', () => {
    const blocked = nextLongRunTarget({ ...base, week: 2, previousPeakKm: 12, weeklyKm: 25 });
    expect(blocked.km).toBeLessThanOrEqual(25 * HEURISTIC_21K.longRunMaxShare);
    expect(blocked.limitedBy).toContain('weekly-share');
    const recovery = nextLongRunTarget({ ...base, week: 7, previousPeakKm: 12, weeklyKm: 50 });
    expect(recovery.km).toBeLessThanOrEqual(12 * 1.08);
  });

  it('cuts deload and taper from actual peak without advancing the exposure', () => {
    const peak = 18;
    expect(nextLongRunTarget({ ...base, week: 4, previousPeakKm: peak, isDeload: true }).km).toBe(
      13.5
    );
    expect(
      nextLongRunTarget({
        ...base,
        week: 14,
        previousPeakKm: peak,
        isDeload: true,
        taperFactor: 0.65
      }).km
    ).toBe(11.7);
    expect(nextLongRunTarget({ ...base, week: 5, previousPeakKm: peak, weeklyKm: 50 }).km).toBe(
      19.4
    );
  });

  it('gives the marathon a consolidation week rather than a new longest run every week', () => {
    const request = { ...base, heuristic: HEURISTIC_42K, marathon: true, previousPeakKm: 20 };
    expect(nextLongRunTarget({ ...request, week: 3, weeklyKm: 60 }).km).toBe(18);
    expect(nextLongRunTarget({ ...request, week: 4, weeklyKm: 60 }).km).toBe(21.5);
  });

  it.each([
    [HEURISTIC_21K, 800],
    [HEURISTIC_21K, 250],
    [HEURISTIC_42K, 800],
    [HEURISTIC_42K, 250]
  ])('preserves duration and absolute limits for fast and slow runners', (heuristic, pace) => {
    const result = nextLongRunTarget({
      ...base,
      heuristic,
      week: 10,
      previousPeakKm: 40,
      startingWeeklyKm: 100,
      weeklyKm: 100,
      paceSecPerKm: pace
    });
    expect(result.km * pace).toBeLessThanOrEqual(heuristic.longRun.timeCapMin * 60);
    expect(result.km).toBeLessThanOrEqual(heuristic.longRun.absCapKm);
    expect(result.km).toBeLessThanOrEqual(100 * heuristic.longRunMaxShare);
  });

  it('does not use the whole weekly budget just to preserve an overlarge reported longest run', () => {
    const result = nextLongRunTarget({ ...base, recentLongRunKm: 32, startingWeeklyKm: 30 });
    expect(result.baselineKm).toBeLessThanOrEqual(30 * HEURISTIC_21K.longRunMaxShare);
  });
});

describe('HM q1 when a hard LR finish replaces q2', () => {
  const req: QualityRequest = {
    qualW: 11,
    qualWeeks: 15,
    slotRole: 'q1',
    effQ: 2,
    vol: 60,
    pI: 190,
    pT: 210,
    pE: 300,
    pR: 180,
    isTaper1: false,
    dow: 2,
    racePace: 210,
    ctx: { weeks: 20, w: 13, taperW: 2 }
  };

  it('restores q1 threshold allocation while preserving its original training family', () => {
    const split = PROFILE_21K.buildQuality(req);
    const rebuilt = PROFILE_21K.buildQuality({ ...req, replacesSecondQuality: true });
    expect(rebuilt.session.kind).toBe(split.session.kind);
    expect(rebuilt.session.zone).toBe(split.session.zone);
    expect(rebuilt.session.type).toBe(split.session.type);
    expect(sessQKm(rebuilt.session)).toBeGreaterThan(sessQKm(split.session));
    expect(sessQKm(rebuilt.session)).toBeLessThanOrEqual(req.vol * 0.1);
  });

  it('preserves a non-threshold q1 instead of switching it to the one-quality menu', () => {
    const intervalReq = { ...req, qualW: 9 };
    const normal = PROFILE_21K.buildQuality(intervalReq);
    const rebuilt = PROFILE_21K.buildQuality({ ...intervalReq, replacesSecondQuality: true });
    expect(rebuilt).toEqual(normal);
    expect(ZONE_FOR_KIND[rebuilt.session.kind]).toBe('I');
  });

  it('prioritizes threshold for an experienced HM runner from the start', () => {
    const day = PROFILE_21K.buildQuality({
      ...req,
      qualW: 1,
      qualWeeks: 20,
      readiness: 'experienced',
      qualityIntensity: 'std'
    });
    expect(day.session.zone ?? ZONE_FOR_KIND[day.session.kind]).toBe('T');
    expect(day.session.paceSec).toBe(req.pT);
  });

  it('introduces controlled quality when returning to HM or marathon training', () => {
    for (const profile of [PROFILE_21K, PROFILE_42K]) {
      const day = profile.buildQuality({
        ...req,
        qualW: 1,
        qualWeeks: 20,
        effQ: 1,
        readiness: 'returning',
        qualityIntensity: 'kons'
      });
      expect(day.session.type).toBe('fartlek');
      expect(day.session.zone).toBe('T');
      expect(day.session.paceSec).toBe(req.pT);
      expect(day.desc).toContain('Uvod u kvalitet');
    }
  });

  it('keeps the HM race rehearsal protocol despite a conservative quality preference', () => {
    const raceRehearsal = { ...req, qualW: 15, qualWeeks: 20, ctx: { ...req.ctx, w: 17 } };
    const raw = PROFILE_21K.buildQuality(raceRehearsal);
    const adjusted = PROFILE_21K.buildQuality({
      ...raceRehearsal,
      readiness: 'experienced',
      qualityIntensity: 'kons'
    });
    expect(adjusted.session.kind).toBe('Kontrolna trka');
    expect(adjusted).toEqual(raw);
    expect(sessQKm(adjusted.session)).toBe(9);
  });

  it('prioritizes controlled marathon-specific progression for an experienced runner', () => {
    const day = PROFILE_42K.buildQuality({
      ...req,
      qualW: 1,
      qualWeeks: 20,
      readiness: 'experienced',
      qualityIntensity: 'std'
    });
    expect(day.session.type).toBe('prog');
    expect(day.session.zone ?? ZONE_FOR_KIND[day.session.kind]).toBe('M');
    expect(day.session.paceSec).toBe(req.racePace);
  });
});
