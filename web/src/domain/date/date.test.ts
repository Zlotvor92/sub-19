import { describe, expect, it } from 'vitest';
import {
  addDays,
  diffDays,
  fromEpochDay,
  isIsoDate,
  mondayOnOrAfter,
  mondayOnOrBefore,
  parseIsoDate,
  toEpochDay,
  weekdayIndex,
  type IsoDate
} from './index';

const d = (s: string): IsoDate => {
  const p = parseIsoDate(s);
  if (!p) throw new Error(`test: neispravan datum ${s}`);
  return p;
};

describe('parseIsoDate — strogo', () => {
  it('prihvata postojeće datume, uključujući prestupnu godinu', () => {
    expect(parseIsoDate('2026-10-01')).toBe('2026-10-01');
    expect(parseIsoDate('2028-02-29')).toBe('2028-02-29');
    expect(parseIsoDate('2000-02-29')).toBe('2000-02-29');
  });

  it.each([
    '2026-02-31', // preliva se u mart — stari kod ga je tiho prihvatao (G2)
    '2026-02-29', // 2026 nije prestupna
    '1900-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-04-31',
    '2026-1-1',
    '26-10-01',
    '2026-10-01T00:00:00Z',
    ' 2026-10-01',
    'abc',
    ''
  ])('odbija %j', (s) => {
    expect(parseIsoDate(s)).toBeNull();
  });

  it.each([undefined, null, 20261001, {}, [], true])('odbija ne-string %j', (v) => {
    expect(parseIsoDate(v)).toBeNull();
    expect(isIsoDate(v)).toBe(false);
  });
});

describe('račun nad datumima', () => {
  it('epoch-dan je inverzan', () => {
    for (const s of ['1970-01-01', '1999-12-31', '2024-02-29', '2026-10-01', '2100-03-01']) {
      expect(fromEpochDay(toEpochDay(d(s)))).toBe(s);
    }
    expect(toEpochDay(d('1970-01-01'))).toBe(0);
  });

  it('addDays prelazi mesece, godine i prestupne dane', () => {
    expect(addDays(d('2026-01-31'), 1)).toBe('2026-02-01');
    expect(addDays(d('2026-12-31'), 1)).toBe('2027-01-01');
    expect(addDays(d('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDays(d('2026-03-01'), -1)).toBe('2026-02-28');
    expect(addDays(d('2026-10-01'), 0)).toBe('2026-10-01');
  });

  it('diffDays je antisimetričan i računa kalendarske dane', () => {
    expect(diffDays(d('2026-01-05'), d('2026-05-03'))).toBe(118);
    expect(diffDays(d('2026-05-03'), d('2026-01-05'))).toBe(-118);
    expect(diffDays(d('2026-03-28'), d('2026-03-30'))).toBe(2); // prelaz na letnje računanje vremena
  });

  it('addDays i diffDays su međusobno inverzni', () => {
    const base = d('2026-06-15');
    for (let n = -800; n <= 800; n += 37) {
      expect(diffDays(base, addDays(base, n))).toBe(n);
    }
  });

  it('toEpochDay baca za ručno podmetnut neispravan datum', () => {
    expect(() => toEpochDay('2026-02-31' as IsoDate)).toThrow(RangeError);
  });
});

describe('dani u nedelji (Pon=0)', () => {
  it('poznati datumi', () => {
    expect(weekdayIndex(d('2026-01-05'))).toBe(0); // ponedeljak
    expect(weekdayIndex(d('2026-10-01'))).toBe(3); // četvrtak
    expect(weekdayIndex(d('2026-12-13'))).toBe(6); // nedelja (Bokeški polumaraton)
    expect(weekdayIndex(d('1970-01-01'))).toBe(3); // četvrtak
    expect(weekdayIndex(d('1969-12-31'))).toBe(2); // sreda — negativni epoch-dan
  });

  it('mondayOnOrBefore', () => {
    expect(mondayOnOrBefore(d('2026-01-05'))).toBe('2026-01-05');
    expect(mondayOnOrBefore(d('2026-01-11'))).toBe('2026-01-05');
    expect(mondayOnOrBefore(d('2026-01-04'))).toBe('2025-12-29');
  });

  it('mondayOnOrAfter (ponedeljak vraća isti dan)', () => {
    expect(mondayOnOrAfter(d('2026-01-05'))).toBe('2026-01-05');
    expect(mondayOnOrAfter(d('2026-01-06'))).toBe('2026-01-12');
    expect(mondayOnOrAfter(d('2026-01-11'))).toBe('2026-01-12');
  });
});
