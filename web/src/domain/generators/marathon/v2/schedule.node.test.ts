import { describe, expect, it } from 'vitest';
import { WEEKDAYS } from './dates.ts';
import { adjacentDays, longDayOf, patternOf, suggestSchedule } from './schedule.ts';
import type { Weekday } from './types.ts';

/* M9: Q1, Q2 i dugi međusobno nesusedni (ciklično); dan dugog iz ulaza / nedelja / poslednji dan. */

function combos(k: number, from: readonly Weekday[] = WEEKDAYS): Weekday[][] {
  if (k === 0) return [[]];
  return from.flatMap((d, i) => combos(k - 1, from.slice(i + 1)).map((c) => [d, ...c]));
}

describe('M9 raspored', () => {
  it('dan dugog: ulaz, inače nedelja, inače poslednji dan', () => {
    expect(longDayOf(['tue', 'thu', 'sat', 'sun'])).toBe('sun');
    expect(longDayOf(['mon', 'tue', 'thu', 'sat'])).toBe('sat');
    expect(longDayOf(['tue', 'thu', 'sat', 'sun'], 'sat')).toBe('sat');
  });

  it('svaka kombinacija 4 dana: šablon (kad postoji) ima nesusedne teške dane, ostalo lagan', () => {
    let found = 0;
    for (const days of combos(4))
      for (const long of [null, ...days]) {
        const p = patternOf(days, long);
        if (!p) {
          expect(suggestSchedule(days, long)).not.toBeUndefined();
          continue;
        }
        found++;
        expect(adjacentDays(p.q1, p.long) || adjacentDays(p.q2, p.long)).toBe(false);
        expect(adjacentDays(p.q1, p.q2)).toBe(false);
        expect([p.long, p.q1, p.q2, ...p.easy].sort()).toEqual([...days].sort());
        expect(p.easy).toHaveLength(1);
      }
    expect(found).toBeGreaterThan(0);
  });

  it('rasporedi mreže: A uto/čet/sub/ned, B pon/sre/pet/ned, C pon/uto/čet/sub', () => {
    expect(patternOf(['tue', 'thu', 'sat', 'sun'], 'sun')).toEqual({
      long: 'sun',
      q1: 'tue',
      q2: 'thu',
      easy: ['sat']
    });
    expect(patternOf(['mon', 'wed', 'fri', 'sun'], 'sun')).toEqual({
      long: 'sun',
      q1: 'wed',
      q2: 'fri',
      easy: ['mon']
    });
    expect(patternOf(['mon', 'tue', 'thu', 'sat'], 'sat')).toEqual({
      long: 'sat',
      q1: 'tue',
      q2: 'thu',
      easy: ['mon']
    });
  });

  it('nema rešenja → null i predlog koji ima rešenje', () => {
    const days: Weekday[] = ['thu', 'fri', 'sat', 'sun'];
    expect(patternOf(days)).toBeNull();
    const s = suggestSchedule(days)!;
    expect(patternOf(s.runDays, s.long)).not.toBeNull();
  });
});
