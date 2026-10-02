import { describe, expect, it } from 'vitest';
import { MIN_GAP, gapToGoal, journeyModel } from './journey';

describe('journeyModel', () => {
  it('brže je desno: start 20:37 → sada 20:13 → cilj 19:59 → plan 19:45', () => {
    const m = journeyModel({ start: 1237, now: 1213, goal: 1199, projection: 1185 });
    const pos = Object.fromEntries(m.map((p) => [p.key, p.pos]));
    expect(pos['start']).toBe(6);
    expect(pos['projection']).toBe(94);
    expect(pos['now']).toBeGreaterThan(pos['start'] as number);
    expect(pos['goal']).toBeGreaterThan(pos['now'] as number);
    expect(pos['projection']).toBeGreaterThan(pos['goal'] as number);
  });
  it('bez dovoljno tačaka nema ose; nevažeće vrednosti se preskaču', () => {
    expect(journeyModel({ start: 1237, now: null, goal: null, projection: null })).toEqual([]);
    expect(journeyModel({ start: NaN, now: 1200, goal: 1199, projection: null })).toHaveLength(2);
  });
  it('iste vrednosti: sve na sredini (nema deljenja nulom)', () => {
    const m = journeyModel({ start: 1200, now: 1200, goal: 1200, projection: null });
    expect(m.every((p) => p.pos === 50)).toBe(true);
  });
  it('oznake: „sada" i projekcija gore, start i cilj dole; uz ivicu poravnanje ide ka sredini', () => {
    const m = journeyModel({ start: 1237, now: 1213, goal: 1199, projection: 1185 });
    const side = Object.fromEntries(m.map((p) => [p.key, p.side]));
    expect(side).toEqual({ start: 'down', now: 'up', goal: 'down', projection: 'up' });
    const align = Object.fromEntries(m.map((p) => [p.key, p.align]));
    expect(align['start']).toBe('start');
    expect(align['projection']).toBe('end');
    expect(align['goal']).toBe('center');
  });
  it('dve bliske oznake na istoj strani se razdvajaju: kasnija prelazi na drugu stranu', () => {
    /* sada i projekcija su 5 s razmaka na osi od 52 s → ~8 % ose, manje od MIN_GAP; dole je mesta */
    const m = journeyModel({ start: 1237, now: 1190, goal: 1225, projection: 1185 });
    const pos = Object.fromEntries(m.map((p) => [p.key, p.pos]));
    const side = Object.fromEntries(m.map((p) => [p.key, p.side]));
    expect(Math.abs((pos['projection'] as number) - (pos['now'] as number))).toBeLessThan(MIN_GAP);
    expect(side['now']).not.toBe(side['projection']);
  });
  it('razlika do cilja je u sekundama, znak pokazuje smer', () => {
    expect(gapToGoal(1213, 1199)).toBe(14);
    expect(gapToGoal(1190, 1199)).toBe(-9);
    expect(gapToGoal(null, 1199)).toBeNull();
  });
});
