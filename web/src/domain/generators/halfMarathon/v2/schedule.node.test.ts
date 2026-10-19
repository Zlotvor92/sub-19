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

  it('šabloni mreže 02 (3, 5, 6 dana): 3 dana jedan kvalitet (Q2 nema), lagani rastućim danom', () => {
    // Najveći razmak dugi → Q1 (ned → čet 4 dana).
    expect(patternOf(['tue', 'thu', 'sun'], 'sun')).toEqual({
      long: 'sun',
      q1: 'thu',
      q2: null,
      easy: ['tue']
    });
    expect(patternOf(['wed', 'sat', 'sun'], 'sun')).toEqual({
      long: 'sun',
      q1: 'wed',
      q2: null,
      easy: ['sat']
    });
    expect(patternOf(['mon', 'tue', 'thu', 'sat', 'sun'], 'sun')).toEqual({
      long: 'sun',
      q1: 'tue',
      q2: 'thu',
      easy: ['mon', 'sat']
    });
    expect(patternOf(['mon', 'tue', 'wed', 'thu', 'sat', 'sun'], 'sun')).toEqual({
      long: 'sun',
      q1: 'tue',
      q2: 'thu',
      easy: ['mon', 'wed', 'sat']
    });
  });

  it('svaki rešiv izbor 3–6 dana: teški dani međusobno nesusedni (ciklično); nerešiv → predlog', () => {
    const W: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const solved: Record<number, number> = {};
    for (let m = 0; m < 128; m++) {
      const days = W.filter((_, i) => m & (1 << i));
      if (days.length < 3 || days.length > 6) continue;
      for (const long of days) {
        const p = patternOf(days, long);
        if (!p) {
          const s = suggestSchedule(days, long);
          if (s) expect(patternOf(s.runDays, s.long)).not.toBeNull();
          continue;
        }
        solved[days.length] = (solved[days.length] ?? 0) + 1;
        expect(p.q2 === null).toBe(days.length === 3);
        const hard = [p.q1, ...(p.q2 ? [p.q2] : []), p.long];
        for (const a of hard)
          for (const b of hard) if (a !== b) expect(adjacentDays(a, b)).toBe(false);
        expect([...hard, ...p.easy].sort()).toEqual([...days].sort());
        expect(p.easy.length).toBe(days.length - hard.length);
      }
    }
    expect(Object.keys(solved)).toEqual(['3', '4', '5', '6']);
    expect(patternOf(['mon', 'fri', 'sat', 'sun'], 'sun')).toBeNull();
    expect(patternOf(['sat', 'sun', 'mon'], 'sun')).toBeNull();
  });
});
