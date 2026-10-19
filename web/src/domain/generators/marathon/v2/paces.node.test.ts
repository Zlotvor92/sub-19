import { describe, expect, it } from 'vitest';
import {
  assessGoal,
  mpCorrection,
  pacesFromVdot,
  predictedMarathon,
  raceTimeForVdot,
  round1,
  vdotFromResult
} from './paces.ts';
import { timeForVdot } from './testInputs.ts';

/* M2 tempo (zone kao udeo VDOT-a, MP iz VDOT-a umanjenog za korekciju obima) i M3 ocena cilja. */

describe('M2 tempo', () => {
  it('Daniels–Gilbert: VDOT ↔ vreme (maraton 3:00:00 ≈ VDOT 53,5; HM 1:30:00 ≈ VDOT 51,0)', () => {
    expect(round1(vdotFromResult(42195, 3 * 3600))).toBe(53.5);
    expect(round1(vdotFromResult(21097.5, 5400))).toBe(51);
    expect(Math.abs(raceTimeForVdot(53.5, 42195) - 3 * 3600)).toBeLessThan(30);
  });

  it('korekcija obima: < 40 km −2,0; 40–59,9 km −1,0; ≥ 60 km 0 (pojas po 0,1 km)', () => {
    expect(mpCorrection(35)).toBe(-2);
    expect(mpCorrection(39.9)).toBe(-2);
    expect(mpCorrection(40)).toBe(-1);
    expect(mpCorrection(59.9)).toBe(-1);
    expect(mpCorrection(59.95)).toBe(0);
    expect(mpCorrection(60)).toBe(0);
    expect(mpCorrection(65)).toBe(0);
  });

  it('MP = tempo prognoze maratona iz VDOT-a umanjenog za korekciju; E/T/I/R iz trenutnog VDOT-a', () => {
    const lo = pacesFromVdot(45, 35);
    const mid = pacesFromVdot(45, 45);
    const hi = pacesFromVdot(45, 60);
    expect([lo.mpVdot, mid.mpVdot, hi.mpVdot]).toEqual([43, 44, 45]);
    expect(lo.MP).toBe(Math.round(raceTimeForVdot(43, 42195) / 42.195));
    expect(hi.MP).toBe(Math.round(raceTimeForVdot(45, 42195) / 42.195));
    expect(lo.MP).toBeGreaterThan(mid.MP);
    expect(mid.MP).toBeGreaterThan(hi.MP);
    // Brze zone ne zavise od obima.
    expect([lo.E, lo.T, lo.I, lo.R]).toEqual([hi.E, hi.T, hi.I, hi.R]);
    expect(predictedMarathon(mid)).toBe(raceTimeForVdot(44, 42195));
  });

  it('redosled zona za VDOT 30–80: E sporo > E brzo > MP > T > I > R', () => {
    for (let v = 30; v <= 80; v += 5)
      for (const km of [35, 45, 65]) {
        const p = pacesFromVdot(v, km);
        expect(p.E.slow).toBeGreaterThan(p.E.fast);
        expect(p.E.fast).toBeGreaterThan(p.MP);
        expect(p.MP).toBeGreaterThan(p.T);
        expect(p.T).toBeGreaterThan(p.I);
        expect(p.I).toBeGreaterThan(p.R);
      }
  });

  it('tempo je fiksan (isti ulaz → isti tempo)', () => {
    expect(pacesFromVdot(52.34, 50)).toEqual(pacesFromVdot(52.3, 50));
  });
});

describe('M3 ocena cilja (prema maratonskom VDOT-u)', () => {
  it('Δ ≤ 0,08·N realističan, ≤ 0,16·N ambiciozan, više nerealan', () => {
    // N = 20: realistično ≤ 1,6, ambiciozno ≤ 3,2 VDOT.
    const at = (gap: number) => assessGoal(44, timeForVdot(44 + gap, 42195), 20).status;
    expect(at(0)).toBe('realistic');
    expect(at(1.6)).toBe('realistic');
    expect(at(1.7)).toBe('ambitious');
    expect(at(3.2)).toBe('ambitious');
    expect(at(3.3)).toBe('unrealistic');
    expect(assessGoal(44, timeForVdot(40, 42195), 20).status).toBe('realistic');
  });
});
