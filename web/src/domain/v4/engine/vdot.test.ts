import { describe, expect, it } from 'vitest';
import {
  paceAtShare,
  racePaceWeight,
  raceTimeSec,
  vdotFromEasyPace,
  vdotFromResult,
  weightAtSpeedRatio,
  zonePaces
} from './vdot';

const HALF_M = 21097.5;
const mmss = (min: number, sec: number): number => min * 60 + sec;

describe('vdot (SPEC § 5.4)', () => {
  it('VDOT 44,6 ↔ 21 097,5 m za 1:41:00', () => {
    expect(vdotFromResult(HALF_M, 101 * 60)).toBeCloseTo(44.6, 1);
    expect(Math.abs(raceTimeSec(44.6, HALF_M) - 101 * 60)).toBeLessThan(10);
  });

  it('vreme za VDOT je inverz VDOT-a iz rezultata', () => {
    for (const distanceM of [1500, 3000, 5000, 8000, 10000, HALF_M, 42195]) {
      for (const vdot of [25, 30, 38.4, 44.6, 52, 60, 70]) {
        expect(vdotFromResult(distanceM, raceTimeSec(vdot, distanceM))).toBeCloseTo(vdot, 6);
      }
    }
  });

  it('tempa zona za VDOT 44,6 na ± 1 s', () => {
    const p = zonePaces(44.6, HALF_M, false);
    const expected: [number, number][] = [
      [p.easySlow, mmss(6, 10)],
      [p.easyFast, mmss(5, 36)],
      [p.easy, mmss(5, 52)],
      [p.M, mmss(5, 2)],
      [p.T, mmss(4, 40)],
      [p.I, mmss(4, 18)],
      [p.R, mmss(4, 3)],
      [p.RP, mmss(4, 47)]
    ];
    for (const [got, want] of expected) expect(Math.abs(got - want)).toBeLessThanOrEqual(1);
    expect(p.byFeel).toBe(false);
  });

  it('brži VDOT daje brža tempa i kraće vreme', () => {
    expect(paceAtShare(50, 0.88)).toBeLessThan(paceAtShare(45, 0.88));
    expect(raceTimeSec(50, 10000)).toBeLessThan(raceTimeSec(45, 10000));
  });

  it('lagani tempo ↔ VDOT (66 %)', () => {
    expect(paceAtShare(vdotFromEasyPace(352), 0.66)).toBeCloseTo(352, 6);
  });
});

describe('težina opterećenja (SPEC § 5.1)', () => {
  it('sidra i ravno van njih', () => {
    expect(weightAtSpeedRatio(0.5)).toBe(1);
    expect(weightAtSpeedRatio(0.8)).toBe(1);
    expect(weightAtSpeedRatio(0.93)).toBeCloseTo(1.5, 10);
    expect(weightAtSpeedRatio(1)).toBeCloseTo(2, 10);
    expect(weightAtSpeedRatio(1.09)).toBe(3);
    expect(weightAtSpeedRatio(1.3)).toBe(3);
    expect(weightAtSpeedRatio(0.965)).toBeCloseTo(1.75, 10);
  });

  it('težina tempa trke raste kako se dužina skraćuje (VDOT 45)', () => {
    const w = [42195, HALF_M, 10000, 5000].map((d) => racePaceWeight(45, d));
    expect(w[0]).toBeCloseTo(1.55, 2);
    expect(w[1]).toBeCloseTo(1.8, 2);
    expect(w[2]).toBeGreaterThan(2);
    expect(w[3]).toBeGreaterThan(w[2] ?? 0);
    for (const x of w) expect(Math.abs(x * 20 - Math.round(x * 20))).toBeLessThan(1e-9);
  });
});
