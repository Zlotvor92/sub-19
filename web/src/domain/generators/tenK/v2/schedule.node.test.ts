/* D9 — raspored: teški dani međusobno nesusedni (ciklično), dan dugog, odbijanje sa predlogom; D18 (3 dana:
   jedan kvalitet), D19 (5–6 dana: ostali dani lagani). */

import { describe, expect, it } from 'vitest';
import { WEEKDAYS } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { adjacentDays, longDayOf, patternOf, suggestSchedule } from './schedule.ts';
import { inputOf, SCHEDULES, SCHEDULES_BY_DAYS } from './testInputs.ts';
import type { Weekday } from './types.ts';

/** Nezavisna provera: postoji li izbor `k` kvaliteta nesusednih dugom i međusobno (k = 1 ili 2). */
function solvable(days: readonly Weekday[], long: Weekday, k = 2): boolean {
  const idx = (d: Weekday): number => WEEKDAYS.indexOf(d);
  const adj = (a: Weekday, b: Weekday): boolean => {
    const g = (((idx(a) - idx(b)) % 7) + 7) % 7;
    return g === 1 || g === 6;
  };
  const rest = days.filter((d) => d !== long && !adj(d, long));
  if (k === 1) return rest.length > 0;
  return rest.some((a) => rest.some((b) => a !== b && !adj(a, b)));
}

const combos = (n = 4): Weekday[][] => {
  const out: Weekday[][] = [];
  for (let m = 0; m < 128; m++) {
    const ds = WEEKDAYS.filter((_, i) => (m >> i) & 1);
    if (ds.length === n) out.push([...ds]);
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
      const q2 = p.q2!;
      expect([p.q1, q2, p.long, ...p.easy].sort()).toEqual([...days].sort());
      expect(adjacentDays(p.q1, q2) || adjacentDays(p.q1, p.long) || adjacentDays(q2, p.long)).toBe(
        false
      );
    }
  });

  it('D18/D19: 3, 5 i 6 dana — šablon postoji ⇔ postoji rešenje; teški dani nesusedni; ostali dani lagani', () => {
    for (const [n, k] of [
      [3, 1],
      [5, 2],
      [6, 2]
    ] as const) {
      let ok = 0;
      for (const days of combos(n)) {
        const long = longDayOf(days);
        const p = patternOf(days);
        expect(p !== null, days.join()).toBe(solvable(days, long, k));
        if (!p) continue;
        ok++;
        expect(p.q2 === null).toBe(k === 1);
        const hard = [p.q1, ...(p.q2 ? [p.q2] : []), p.long];
        expect([...hard, ...p.easy].sort()).toEqual([...days].sort());
        expect(p.easy.length).toBe(n - 1 - k);
        for (const a of hard)
          for (const b of hard) if (a !== b) expect(adjacentDays(a, b)).toBe(false);
      }
      expect(ok).toBeGreaterThan(0);
    }
    // 1, 2 i 7 dana nemaju red u tabeli D17.
    expect(patternOf(['tue', 'sun'])).toBeNull();
    expect(patternOf([...WEEKDAYS])).toBeNull();
  });

  it('šabloni mreže 02 (3/5/6 dana)', () => {
    expect(patternOf(SCHEDULES_BY_DAYS[3].A.days, 'sun')).toEqual({
      long: 'sun',
      q1: 'thu',
      q2: null,
      easy: ['tue']
    });
    expect(patternOf(SCHEDULES_BY_DAYS[5].A.days, 'sun')).toEqual({
      long: 'sun',
      q1: 'tue',
      q2: 'thu',
      easy: ['mon', 'sat']
    });
    expect(patternOf(SCHEDULES_BY_DAYS[6].B.days, 'sun')).toEqual({
      long: 'sun',
      q1: 'wed',
      q2: 'fri',
      easy: ['mon', 'tue', 'thu']
    });
  });

  it('3 dana sub/ned/pon (dugi ned) → SCHEDULE_NO_RECOVERY sa izvodljivim predlogom', () => {
    const r = generateTenKV2(inputOf({ weeks: 12, km: 30, vdot: 45, days: ['mon', 'sat', 'sun'] }));
    expect(!r.ok && r.reasons.map((x) => x.code)).toEqual(['SCHEDULE_NO_RECOVERY']);
    expect(!r.ok && r.reasons[0]!.message).toMatch(
      /kvalitet i dugi ne mogu biti nesusedni.*Predlog:/
    );
    const s = suggestSchedule(['mon', 'sat', 'sun'])!;
    expect(patternOf(s.runDays, s.long)).not.toBeNull();
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

  it('svaki generisan plan drži šablon u svim nedeljama izgradnje i tapera (3/4/5/6 dana)', () => {
    for (const n of [3, 4, 5, 6] as const)
      for (const key of ['A', 'B', 'C'] as const) {
        const sc = SCHEDULES_BY_DAYS[n][key];
        const r = generateTenKV2(
          inputOf({ weeks: 14, km: n === 3 ? 30 : 45, vdot: 50, days: sc.days, long: sc.long })
        );
        expect(r.ok).toBe(true);
        if (!r.ok) continue;
        const pat = r.plan.pattern;
        for (const w of r.plan.weeks.filter((x) => x.phase !== 'race' && !x.deload)) {
          const role = (wd: Weekday): string | undefined =>
            w.days.find((d) => d.weekday === wd)?.role;
          expect(role(pat.q1)).toBe('q1');
          if (pat.q2) expect(role(pat.q2)).toBe('q2');
          expect(role(pat.long)).toBe('long');
          for (const e of pat.easy) expect(role(e)).toBe('easy');
          expect(w.days.length).toBe(n);
        }
      }
  });
});
