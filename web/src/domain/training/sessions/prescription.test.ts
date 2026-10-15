import { generatePlan } from '@/test/generators';
import { describe, expect, it } from 'vitest';
import { applyQualityDose } from '@/domain/generators/halfMarathon/training/distances/qualityDose';
import { PROFILE_5K } from '@/domain/generators/fiveK/training/distances/profile5k';
import { PROFILE_10K } from '@/domain/generators/tenK/training/distances/profile10k';
import { PROFILE_21K } from '@/domain/generators/halfMarathon/training/distances/profile21k';
import { PROFILE_42K } from '@/domain/generators/marathon/training/distances/profile42k';
import type { QualityRequest } from '@/domain/generators/halfMarathon/training/distances/types';
import { ZONE_FOR_KIND } from '../vdot/zoneForKind';
import { sessInt, sessPyramid } from '@/domain/generators/halfMarathon/training/sessions/build';
import { sessDesc, sessKm } from './calc';
import { constrainSession } from '@/domain/generators/halfMarathon/training/sessions/constraints';

/* Stari zajednički engine je obrisan: svaki profil dolazi iz generatora svoje distance; gradnja i ograničenja su isti u sve
   četiri kopije, doza u 5K/HM/maratonskoj (10K ima svoju); ovde se uzimaju iz polumaratonske. */

const req: QualityRequest = {
  qualW: 10,
  qualWeeks: 13,
  slotRole: 'q1',
  effQ: 2,
  vol: 60,
  pI: 250,
  pT: 280,
  pE: 360,
  pR: 240,
  isTaper1: false,
  dow: 2,
  racePace: 270,
  readiness: 'experienced',
  qualityIntensity: 'std',
  ctx: { weeks: 16, w: 12, taperW: 1 }
};

describe('prescription purpose precedes dose and constraints', () => {
  it.each([60, 75, 90, 180])('RP keeps builder recovery %s s, including legacy input', (rest) => {
    const day = sessInt(2, 3, 6, 1200, 270, rest, 2, 'Trkački ritam');
    delete day.session.purpose;
    delete day.session.zone;
    delete day.session.paceSource;
    applyQualityDose(day, req);
    expect(day.session).toMatchObject({
      purpose: 'RP',
      zone: 'RP',
      paceSec: 270,
      restSec: rest,
      // Experienced policy: RP keeps the builder's amount as reference; the 22 min
      // per-session cap (4.9 km @ 4:30) allows 4 × 1200 m where the legacy 0.9 × 20 min
      // cap allowed 3. Recovery is the subject of this test and stays unchanged.
      reps: 4
    });
    expect(constrainSession(day.session, 60, 1800)).toBe(true);
    expect(day.session).toMatchObject({
      purpose: 'RP',
      zone: 'RP',
      paceSource: 'race-specific',
      restSec: rest
    });
    expect(day.desc).toBe(sessDesc(day.session));
    expect(day.km).toBe(sessKm(day.session));
    // Actual-workout inference must retain its historical conservative semantics.
    expect(ZONE_FOR_KIND['Trkački ritam']).toBe('I');
    expect(ZONE_FOR_KIND['Tempo trke']).toBe('T');
  });

  it.each(['T', 'I', 'R', 'M', 'RP'] as const)(
    'explicit %s intent controls recovery even with an interval label',
    (purpose) => {
      const day = sessInt(2, 2, 6, 400, 250, 75, 1, 'Intervali');
      day.session.purpose = purpose;
      applyQualityDose(day, req);
      expect(constrainSession(day.session, 60, 1800)).toBe(true);
      expect(day.session.zone).toBe(purpose);
      if (day.session.type !== 'int') throw new Error('Expected interval format');
      const expected = purpose === 'I' ? 75 : purpose === 'R' ? 250 : 75;
      expect(day.session.restSec).toBe(expected);
    }
  );

  it('scaled I pyramids remove sub-minute legs without increasing work or changing pace', () => {
    const day = sessPyramid(2, 2, [200, 400, 600, 400, 200], 272, 90, 1, 'Piramida');
    applyQualityDose(day, { ...req, qualW: 1, qualityIntensity: 'kons' });
    expect(constrainSession(day.session, 30, 1800)).toBe(false);
    // A tiny budget cannot support two genuine I legs; weekly guard substitutes easy work.
    expect(day.session.paceSec).toBe(272);
  });

  it('I pyramid limits apply without the dose stage as well', () => {
    const day = sessPyramid(2, 2, [100, 200, 300, 200, 100], 272, 90, 1, 'Piramida');
    expect(constrainSession(day.session, 60, 1800)).toBe(false);
    const viable = sessPyramid(2, 2, [200, 400, 600, 400, 200], 272, 90, 1, 'Piramida');
    expect(constrainSession(viable.session, 60, 1800)).toBe(true);
    if (viable.session.type !== 'pyramid') throw new Error('Expected pyramid');
    expect(viable.session.reps).toEqual([400, 600, 400]);
    expect(viable.session.restSec).toBe(122);
  });

  it('activation has RP pace metadata and preserves 120 s recovery without R scaling', () => {
    const day = sessInt(2, 1, 6, 200, 266, 120, 0.8, 'Aktivacija');
    applyQualityDose(day, req);
    expect(constrainSession(day.session, 20, 1800)).toBe(true);
    expect(day.session).toMatchObject({
      purpose: 'activation',
      zone: 'RP',
      paceSec: 266,
      restSec: 120
    });
    expect(sessDesc(day.session)).toContain('Aktivacija');
  });

  it('HM race progression is RP, while marathon progression is M', () => {
    // HM race-specific work is built as RP blocks with jog recovery (hmProgression), not
    // as a progression run; it must still carry RP purpose from construction.
    const hm = PROFILE_21K.buildQuality({ ...req, qualW: 13, slotRole: 'q1', racePace: 360 });
    expect(hm.session).toMatchObject({
      type: 'int',
      kind: 'Tempo trke',
      purpose: 'RP',
      zone: 'RP',
      paceSec: 360
    });
    expect(hm.session.type === 'int' && hm.session.restSec).toBeLessThanOrEqual(90);
    const marathon = PROFILE_42K.buildQuality({ ...req, qualW: 1, slotRole: 'q1', racePace: 360 });
    expect(marathon.session).toMatchObject({ type: 'prog', purpose: 'M', zone: 'M', paceSec: 360 });
  });

  it('delivered race activation remains RP and is excluded from measured fitness rows', () => {
    for (const raceDistM of [5000, 10000, 21097.5, 42195]) {
      const plan = generatePlan({
        startDate: '2026-10-05',
        raceDate: '2027-02-07',
        raceDistM,
        pb: { distM: 5000, sec: 1250 },
        weeklyKm: 60,
        runDays: 5,
        quality: 2,
        intensity: 'std',
        consistentWeeks: 24,
        qualityExperience: 'experienced'
      });
      if ('error' in plan) throw new Error(plan.error);
      const activation = plan.weeks
        .flatMap((w) => w.days)
        .find((d) => d.session?.purpose === 'activation');
      expect(activation?.session).toMatchObject({ kind: 'Aktivacija', zone: 'RP', restSec: 120 });
      expect(activation?.desc).toContain('bez sprinta');
      expect(
        plan.pred
          .filter((r) => r.l.includes('Aktivacija'))
          .every((r) => r.zone === 'RP' && r.nemeri)
      ).toBe(true);
    }
  });

  it('all four profiles assign explicit purpose before returning a prescription', () => {
    for (const profile of [PROFILE_5K, PROFILE_10K, PROFILE_21K, PROFILE_42K])
      for (const qualW of [1, 4, 8, 10, 13])
        for (const slotRole of ['q1', 'q2'] as const) {
          const day = profile.buildQuality({ ...req, qualW, slotRole });
          expect(day.session.purpose).toBe(day.session.zone);
          expect(day.desc).toBe(sessDesc(day.session));
        }
  });
});
