/* H9 raspored: kvaliteti i dugi međusobno nesusedni (ciklično); dan dugog iz ulaza / nedelja / poslednji. */

import { describe, expect, it } from 'vitest';
import { adjacentDays, longDayOf, patternOf, suggestSchedule } from './schedule.ts';
import type { Weekday } from './types.ts';

describe('H9 raspored', () => {
  it('šabloni mreže 01', () => {
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

  it('dan dugog: ulaz, inače nedelja, inače poslednji dan', () => {
    expect(longDayOf(['tue', 'thu', 'sat', 'sun'], 'sat')).toBe('sat');
    expect(longDayOf(['tue', 'thu', 'sat', 'sun'])).toBe('sun');
    expect(longDayOf(['mon', 'tue', 'thu', 'sat'])).toBe('sat');
  });

  it('svaki rešiv izbor 4 dana: teški dani međusobno nesusedni (ciklično); nerešiv → predlog', () => {
    const W: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    let solved = 0;
    for (let m = 0; m < 128; m++) {
      const days = W.filter((_, i) => m & (1 << i));
      if (days.length !== 4) continue;
      for (const long of days) {
        const p = patternOf(days, long);
        if (!p) {
          const s = suggestSchedule(days, long);
          if (s) expect(patternOf(s.runDays, s.long)).not.toBeNull();
          continue;
        }
        solved++;
        expect(
          adjacentDays(p.q1, p.long) || adjacentDays(p.q2, p.long) || adjacentDays(p.q1, p.q2)
        ).toBe(false);
        expect([p.q1, p.q2, p.long, ...p.easy].sort()).toEqual([...days].sort());
      }
    }
    expect(solved).toBeGreaterThan(0);
    expect(patternOf(['mon', 'fri', 'sat', 'sun'], 'sun')).toBeNull();
  });
});
