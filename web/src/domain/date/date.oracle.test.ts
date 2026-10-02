import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import {
  addDays,
  diffDays,
  mondayOnOrAfter,
  mondayOnOrBefore,
  parseIsoDate,
  weekdayIndex,
  type IsoDate
} from './index';

/* parity: test/danas.test.mjs :: datumska aritmetika (osnova), pure.test.mjs
   Novi `domain/date` poredi se sa starim addD / diffD / dowOf / mondayOfWeek / nextMonday
   na svakom danu 1990–2060. Pokreće se i pod različitim TZ (v. REWRITE_STATUS). */

const DOW = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
let legacy: LegacyApp;

beforeAll(async () => {
  legacy = await loadLegacyApp();
});

function* days(from: string, to: string): Generator<IsoDate> {
  let cur = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!cur || !end) throw new Error('test: opseg');
  while (cur <= end) {
    yield cur;
    cur = addDays(cur, 1);
  }
}

describe('domain/date naspram starog koda', () => {
  it('dan u nedelji, ponedeljak nedelje i sledeći ponedeljak — svaki dan 1990–2060', () => {
    let n = 0;
    for (const s of days('1990-01-01', '2060-12-31')) {
      expect(DOW[weekdayIndex(s)], s).toBe(legacy.call('dowOf', s));
      expect(mondayOnOrBefore(s), s).toBe(legacy.call('mondayOfWeek', s));
      expect(mondayOnOrAfter(s), s).toBe(legacy.call('nextMonday', s));
      n++;
    }
    expect(n).toBeGreaterThan(25000);
  });

  it('addDays i diffDays — pomaci do ±800 dana oko DST granica i prestupnih godina', () => {
    const anchors = [
      '2024-02-28',
      '2026-03-28',
      '2026-10-24',
      '2026-12-31',
      '2027-03-27',
      '2028-02-29'
    ];
    for (const a of anchors) {
      const base = parseIsoDate(a);
      if (!base) throw new Error(a);
      for (let k = -800; k <= 800; k += 7) {
        const next = addDays(base, k);
        expect(next, `${a}+${k}`).toBe(legacy.call('addD', a, k));
        expect(diffDays(base, next), `${a}→${next}`).toBe(legacy.call('diffD', a, next));
      }
    }
  });
});
