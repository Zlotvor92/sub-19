import { describe, expect, it } from 'vitest';
import { sessInt, sessPyramid, sessProg, sessTempo } from '../sessions/build';
import { sessKm, sessQKm } from '../sessions/calc';
import { constrainSession } from '../sessions/constraints';
import type { Intensity, SessionDay } from '../types';
import { PROFILE_5K } from './profile5k';
import { PROFILE_10K } from './profile10k';
import { applyQualityDose } from './qualityDose';
import type { QualityRequest } from './types';

const request = (extra: Partial<QualityRequest> = {}): QualityRequest => ({
  qualW: 1,
  qualWeeks: 20,
  slotRole: 'q1',
  effQ: 2,
  vol: 60,
  pI: 240,
  pT: 270,
  pE: 345,
  pR: 220,
  racePace: 245,
  dow: 2,
  isTaper1: false,
  ctx: { weeks: 24, w: 1, taperW: 1 },
  readiness: 'experienced',
  qualityIntensity: 'std',
  ...extra
});

describe('quality entry follows evidence of training, not a compulsory R block', () => {
  it('experienced 5K starts with aerobic intervals and threshold support, without R300', () => {
    const first = PROFILE_5K.buildQuality(request()).session;
    const second = PROFILE_5K.buildQuality(request({ slotRole: 'q2' })).session;
    expect(first.kind).toBe('Intervali');
    expect(first.paceSec).toBe(240);
    expect(first.type).toBe('int');
    if (first.type === 'int') expect(first.repM).toBeGreaterThan(300);
    expect(second.kind).toBe('Tempo isprekidan');
    expect(second.paceSec).toBe(270);
  });

  it('experienced 10K opens on threshold and adds aerobic intervals in the next quality week', () => {
    expect(PROFILE_10K.buildQuality(request()).session.kind).toBe('Tempo isprekidan');
    expect(PROFILE_10K.buildQuality(request({ qualW: 2 })).session.kind).toBe('Intervali');
  });

  it('10K threshold-first weeks share a single weekly threshold budget between quality days', () => {
    for (const readiness of ['experienced', 'developing'] as const)
      for (const vol of [30, 60, 100])
        for (const qualW of [3, 5])
          for (const qualityIntensity of ['kons', 'std', 'agr'] as const) {
            const days = (['q1', 'q2'] as const).map((slotRole) =>
              PROFILE_10K.buildQuality(
                request({ readiness, vol, qualW, qualityIntensity, slotRole })
              )
            );
            for (const day of days) {
              expect(constrainSession(day.session, vol, PROFILE_10K.heuristic.tempoMaxSec)).toBe(
                true
              );
              expect(day.session.zone).toBe('T');
            }
            expect(days.reduce((n, d) => n + sessQKm(d.session), 0)).toBeLessThanOrEqual(
              vol * 0.1 + 0.1
            );
          }
  });

  for (const readiness of ['beginner', 'returning', 'developing'] as const) {
    for (const profile of [PROFILE_5K, PROFILE_10K]) {
      it(`${profile.product.name} ${readiness}: controlled timed efforts begin at current threshold`, () => {
        const day = profile.buildQuality(request({ readiness }));
        expect(day.session.type).toBe('fartlek');
        expect(day.session.paceSec).toBe(270);
        expect(day.session.zone).toBe('T');
        expect(day.session.paceSource).toBe('current-fitness');
        if (day.session.type === 'fartlek') {
          expect(day.session.repSec).toBe(30);
          expect(day.session.restSec).toBeGreaterThan(day.session.repSec);
        }
        expect(day.desc).toContain('bez sprinta');
      });
    }
  }

  it('developing exits introduction into a mixed T/I block, rather than mandatory R300', () => {
    for (const profile of [PROFILE_5K, PROFILE_10K]) {
      const day = profile.buildQuality(request({ readiness: 'developing', qualW: 4 }));
      expect(day.session.kind).toBe('Intervali');
    }
  });

  it('a returner has one additional entry week and does not jump into the late phase', () => {
    const s = PROFILE_5K.buildQuality(
      request({ readiness: 'returning', qualW: 3, qualWeeks: 4 })
    ).session;
    expect(s.type).toBe('fartlek');
    expect(s.paceSec).toBe(270);
    if (s.type === 'fartlek') expect(s.repSec).toBe(60);
  });

  it('slow runners retain a meaningful introduction after all constraints, within the T budget', () => {
    for (const profile of [PROFILE_5K, PROFILE_10K])
      for (const readiness of ['beginner', 'returning', 'developing'] as const)
        for (const vol of [10, 14, 20])
          for (const pT of [390, 450, 540])
            for (const qualityIntensity of ['kons', 'std', 'agr'] as const) {
              const day = profile.buildQuality(request({ readiness, vol, pT, qualityIntensity }));
              expect(constrainSession(day.session, vol, profile.heuristic.tempoMaxSec)).toBe(true);
              expect(sessQKm(day.session)).toBeGreaterThanOrEqual(0.4);
              expect(sessQKm(day.session)).toBeLessThanOrEqual(vol * 0.1 + 0.05);
              expect(day.session.paceSec).toBe(pT);
            }
  });

  it('direct callers without new fields retain their existing profile behavior', () => {
    for (const profile of [PROFILE_5K, PROFILE_10K]) {
      const s = profile.buildQuality(
        request({ readiness: undefined, qualityIntensity: undefined })
      ).session;
      expect(s.kind).toBe('Repeticije');
      if (s.type === 'int') expect(s.repM).toBe(300);
    }
  });
});

describe('quality dose is independent of the weekly volume preference', () => {
  const prototype = (): SessionDay => sessInt(2, 2, 10, 800, 240, 120, 1.5, 'Intervali');
  const intensities: readonly Intensity[] = ['kons', 'std', 'agr'];

  it('different dose choices change work while volume input and paces stay identical', () => {
    const days = intensities.map((qualityIntensity) =>
      applyQualityDose(prototype(), request({ qualW: 8, qualityIntensity }))
    );
    const work = days.map((d) => sessQKm(d.session));
    expect(work[0]).toBeLessThan(work[1]!);
    expect(work[1]).toBeLessThan(work[2]!);
    expect(work[2]).toBeLessThanOrEqual((20 * 60) / 240);
    for (const d of days) {
      expect(d.session.paceSec).toBe(240);
      expect([d.session.wuKm, d.session.cdKm]).toEqual([2, 1.5]);
    }
  });

  it('work builds over quality weeks at unchanged volume, with no pace acceleration', () => {
    const doses = [1, 4, 8].map((qualW) =>
      applyQualityDose(prototype(), request({ qualW, qualityIntensity: 'agr' }))
    );
    expect(sessQKm(doses[0]!.session)).toBeLessThan(sessQKm(doses[1]!.session));
    expect(sessQKm(doses[1]!.session)).toBeLessThan(sessQKm(doses[2]!.session));
    expect(doses.map((d) => d.session.paceSec)).toEqual([240, 240, 240]);
  });

  it('slow paces cannot turn the same kilometre budget into unlimited quality time', () => {
    const slow = prototype();
    slow.session.paceSec = 480;
    const fastDay = applyQualityDose(prototype(), request({ qualW: 8, qualityIntensity: 'agr' }));
    const slowDay = applyQualityDose(slow, request({ qualW: 8, pI: 480, qualityIntensity: 'agr' }));
    expect(sessQKm(slowDay.session)).toBeLessThan(sessQKm(fastDay.session));
    expect(sessQKm(slowDay.session) * slowDay.session.paceSec).toBeLessThanOrEqual(20 * 60);
    expect(slowDay.session.paceSec).toBe(480);
  });

  it('dose controls never increase work or shorten preparation in any supported format', () => {
    const make = [
      prototype,
      () => sessTempo(2, 2, 6, 270, 1.5, 'Tempo'),
      () => sessPyramid(2, 2, [400, 800, 1200, 800, 400], 240, 120, 1.5, 'Piramida'),
      () => sessProg(2, 9, 270, 345)
    ];
    for (const build of make)
      for (const qualityIntensity of intensities) {
        const day = build();
        const original = structuredClone(day.session);
        applyQualityDose(day, request({ qualityIntensity }));
        expect(sessQKm(day.session)).toBeLessThanOrEqual(sessQKm(original));
        expect([day.session.wuKm, day.session.cdKm]).toEqual([original.wuKm, original.cdKm]);
        expect(day.km).toBe(sessKm(day.session));
      }
  });

  it('pace-preserving scaling also respects final zone ceilings across readiness/volume/phase', () => {
    for (const profile of [PROFILE_5K, PROFILE_10K])
      for (const readiness of ['beginner', 'returning', 'developing', 'experienced'] as const)
        for (const vol of [12, 30, 60, 100])
          for (const qualW of [1, 3, 8, 15])
            for (const qualityIntensity of intensities) {
              const day = profile.buildQuality(
                request({ vol, qualW, readiness, qualityIntensity })
              );
              const survives = constrainSession(day.session, vol, profile.heuristic.tempoMaxSec);
              if (!survives) continue;
              const pct =
                day.session.zone === 'R'
                  ? 0.05
                  : day.session.zone === 'I'
                    ? 0.08
                    : day.session.zone === 'T'
                      ? 0.1
                      : 0.2;
              expect(sessQKm(day.session)).toBeLessThanOrEqual(vol * pct + 0.05);
            }
  });

  it('a trained 5K cycle uses purposeful threshold, interval, economy and pyramid sessions', () => {
    const sessions = Array.from(
      { length: 20 },
      (_, n) => PROFILE_5K.buildQuality(request({ qualW: n + 1, vol: 80 })).session
    );
    const kinds = new Set(sessions.map((s) => s.kind));
    for (const kind of ['Intervali', 'Tempo isprekidan', 'Repeticije', 'Piramida']) {
      if (kind === 'Tempo isprekidan') {
        expect(PROFILE_5K.buildQuality(request({ slotRole: 'q2' })).session.kind).toBe(kind);
      } else expect(kinds.has(kind)).toBe(true);
    }
  });
});
