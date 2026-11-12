import { describe, expect, it } from 'vitest';
import { clock, days, km, plural, shortDate, weeks } from './explain';

describe('rečenice (§ 14.2)', () => {
  it('množina', () => {
    const f = (n: number): string => plural(n, 'nedelja', 'nedelje', 'nedelja');
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 112].map(f)).toEqual([
      'nedelja',
      'nedelje',
      'nedelje',
      'nedelja',
      'nedelja',
      'nedelja',
      'nedelja',
      'nedelja',
      'nedelje',
      'nedelja',
      'nedelja',
      'nedelja'
    ]);
    expect(days(1)).toBe('1 dan');
    expect(days(3)).toBe('3 dana');
    expect(weeks(5)).toBe('5 nedelja');
  });

  it('datum, vreme, km', () => {
    expect(shortDate('2026-10-03')).toBe('3. 10.');
    expect(clock(6121)).toBe('1:42:01');
    expect(clock(1413)).toBe('23:33');
    expect(km(21097.5)).toBe('21,1 km');
  });
});
