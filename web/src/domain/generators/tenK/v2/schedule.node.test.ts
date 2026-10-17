/* D9 — raspored: Q1, Q2 i dugi međusobno nesusedni (ciklično), dan dugog, odbijanje sa predlogom. */

import { describe, expect, it } from 'vitest';
import { WEEKDAYS } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { adjacentDays, longDayOf, patternOf, suggestSchedule } from './schedule.ts';
import { inputOf, SCHEDULES } from './testInputs.ts';
import type { Weekday } from './types.ts';

/** Nezavisna provera: postoji li ikakav izbor dva kvaliteta nesusedna dugom i međusobno. */
function solvable(days: readonly Weekday[], long: Weekday): boolean {
  const idx = (d: Weekday): number => WEEKDAYS.indexOf(d);
  const adj = (a: Weekday, b: Weekday): boolean => {
    const g = (((idx(a) - idx(b)) % 7) + 7) % 7;
    return g === 1 || g === 6;
  };
  const rest = days.filter((d) => d !== long);
  return rest.some((a) =>
    rest.some((b) => a !== b && !adj(a, b) && !adj(a, long) && !adj(b, long))
  );
}

const combos = (): Weekday[][] => {
  const out: Weekday[][] = [];
  for (let m = 0; m < 128; m++) {
    const ds = WEEKDAYS.filter((_, i) => (m >> i) & 1);
    if (ds.length === 4) out.push([...ds]);
  }
  return out;
};

describe('D9: raspored nedelje', () => {
  it('šabloni mreže', () => {
    expect(patternOf(SCHEDULES.A.days, 'sun')).toEqual({
      long: 'sun',
      q1: 'tue',
      q2: 'thu',
      easy: ['sat']
    });
    expect(patternOf(SCHEDULES.B.days, 'sun')).toEqual({
      long: 'sun',
      q1: 'wed',
      q2: 'fri',
      easy: ['mon']
    });
    expect(patternOf(SCHEDULES.C.days, 'sat')).toEqual({
      long: 'sat',
      q1: 'tue',
      q2: 'thu',
      easy: ['mon']
    });
  });

  it('nedelja i ponedeljak su susedni (ciklično)', () => {
    expect(adjacentDays('sun', 'mon')).toBe(true);
    expect(adjacentDays('mon', 'sun')).toBe(true);
    expect(adjacentDays('sun', 'tue')).toBe(false);
  });

  it('dan dugog: iz ulaza, inače nedelja, inače poslednji dan trčanja', () => {
    expect(longDayOf(['mon', 'wed', 'fri', 'sun'])).toBe('sun');
    expect(longDayOf(['mon', 'tue', 'thu', 'sat'])).toBe('sat');
    expect(longDayOf(['mon', 'wed', 'fri', 'sun'], 'wed')).toBe('wed');
  });

  it('svih 35 izbora od 4 dana: šablon postoji ⇔ postoji rešenje, i uvek je nesusedan', () => {
    for (const days of combos()) {
      const long = longDayOf(days);
      const p = patternOf(days);
      expect(p !== null, days.join()).toBe(solvable(days, long));
      if (!p) continue;
      expect([p.q1, p.q2, p.long, ...p.easy].sort()).toEqual([...days].sort());
      expect(
        adjacentDays(p.q1, p.q2) || adjacentDays(p.q1, p.long) || adjacentDays(p.q2, p.long)
      ).toBe(false);
    }
  });

  it('pon/uto/sre/čet → SCHEDULE_NO_RECOVERY sa izvodljivim predlogom', () => {
    const r = generateTenKV2(
      inputOf({ weeks: 12, km: 35, vdot: 45, days: ['mon', 'tue', 'wed', 'thu'] })
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reasons.map((x) => x.code)).toEqual(['SCHEDULE_NO_RECOVERY']);
    expect(r.reasons[0]!.message).toMatch(/Predlog:/);
    const s = suggestSchedule(['mon', 'tue', 'wed', 'thu'])!;
    expect(patternOf(s.runDays, s.long)).not.toBeNull();
  });

  it('svaki generisan plan drži šablon u svim nedeljama izgradnje i tapera', () => {
    for (const key of ['A', 'B', 'C'] as const) {
      const r = generateTenKV2(
        inputOf({
          weeks: 14,
          km: 40,
          vdot: 50,
          days: SCHEDULES[key].days,
          long: SCHEDULES[key].long
        })
      );
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const pat = r.plan.pattern;
      for (const w of r.plan.weeks.filter((x) => x.phase !== 'race' && !x.deload)) {
        const role = (wd: Weekday): string | undefined =>
          w.days.find((d) => d.weekday === wd)?.role;
        expect([role(pat.q1), role(pat.q2), role(pat.long), role(pat.easy[0]!)]).toEqual([
          'q1',
          'q2',
          'long',
          'easy'
        ]);
      }
    }
  });
});
