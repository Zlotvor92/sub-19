import { describe, expect, it } from 'vitest';
import {
  axisOf,
  commits,
  edgeOffset,
  isFling,
  neighborTab,
  settleMs,
  stepOf,
  SWIPE_MS_MAX,
  SWIPE_MS_MIN,
  type Release
} from './swipe';

const rel = (o: Partial<Release> = {}): Release => ({
  dx: -50,
  width: 400,
  velocity: 0,
  sinceLastMoveMs: 500,
  hasTarget: true,
  ...o
});

describe('osa pokreta', () => {
  it('ispod 10 px po obe ose se još čeka', () => {
    expect(axisOf(9, 9)).toBe('wait');
    expect(axisOf(-9, 0)).toBe('wait');
  });
  it('pri neodlučnosti pobeđuje uspravno: vodoravno mora biti 1,3× duže', () => {
    expect(axisOf(20, 20)).toBe('vertical');
    expect(axisOf(26, 20)).toBe('vertical'); // 26 = 1,3 × 20 — jednako NIJE dovoljno
    expect(axisOf(27, 20)).toBe('horizontal');
    expect(axisOf(-40, 5)).toBe('horizontal');
    expect(axisOf(5, -40)).toBe('vertical');
  });
});

describe('susedni tab', () => {
  const order = ['a', 'b', 'c'] as const;
  it('prst ulevo = sledeći, udesno = prethodni; na krajevima nema', () => {
    expect(neighborTab(order, 'b', stepOf(-30))).toBe('c');
    expect(neighborTab(order, 'b', stepOf(30))).toBe('a');
    expect(neighborTab(order, 'a', 1)).toBe('b');
    expect(neighborTab(order, 'a', -1)).toBeNull();
    expect(neighborTab(order, 'c', 1)).toBeNull();
    expect(neighborTab(order, 'x' as 'a', 1)).toBeNull();
  });
});

describe('puštanje', () => {
  it('prag je 28% širine: 111 px od 400 ne prolazi, 113 prolazi (400 × 0,28 je u pomičnom zarezu 112,00…01, isto kao u starom kodu)', () => {
    expect(commits(rel({ dx: -111 }))).toBe(false);
    expect(commits(rel({ dx: -113 }))).toBe(true);
    expect(commits(rel({ dx: 113 }))).toBe(true);
  });
  it('kratak ali brz pokret prolazi; usporen pa zaustavljen ne', () => {
    expect(commits(rel({ velocity: -0.5, sinceLastMoveMs: 30 }))).toBe(true);
    expect(commits(rel({ velocity: -0.44, sinceLastMoveMs: 30 }))).toBe(false);
    expect(commits(rel({ velocity: -0.5, sinceLastMoveMs: 120 }))).toBe(false);
    expect(commits(rel({ velocity: -0.5, sinceLastMoveMs: 119 }))).toBe(true);
  });
  it('flik u suprotnom smeru od pomaka se ne računa', () => {
    expect(isFling(rel({ dx: -50, velocity: 0.9, sinceLastMoveMs: 10 }))).toBe(false);
    expect(isFling(rel({ dx: 50, velocity: 0.9, sinceLastMoveMs: 10 }))).toBe(true);
  });
  it('bez susednog ekrana nikad ne prelazi, ma koliko jak pokret', () => {
    expect(commits(rel({ dx: -390, velocity: -2, sinceLastMoveMs: 1, hasTarget: false }))).toBe(
      false
    );
  });
});

describe('otpor na kraju niza i trajanje dovršetka', () => {
  it('popušta 34% pomaka, najviše 70 px, u obe strane', () => {
    expect(edgeOffset(100)).toBeCloseTo(34);
    expect(edgeOffset(-100)).toBeCloseTo(-34);
    expect(edgeOffset(1000)).toBe(70);
    expect(edgeOffset(-1000)).toBe(-70);
  });
  it('trajanje: iz preostalog puta i brzine, uvek između 240 i 560 ms', () => {
    expect(settleMs(300, 0)).toBe(SWIPE_MS_MAX); // stoji → najduže
    expect(settleMs(300, 5)).toBe(SWIPE_MS_MIN); // vrlo brz → najkraće
    expect(settleMs(300, 1)).toBe(300); // 300 px pri 1 px/ms
    expect(settleMs(0, 0)).toBe(SWIPE_MS_MAX); // v = 0 → najduže (isto kao stari kod)
    for (const px of [10, 100, 400])
      for (const v of [0, 0.1, 0.6, 3]) {
        const ms = settleMs(px, v);
        expect(ms).toBeGreaterThanOrEqual(SWIPE_MS_MIN);
        expect(ms).toBeLessThanOrEqual(SWIPE_MS_MAX);
      }
  });
});
