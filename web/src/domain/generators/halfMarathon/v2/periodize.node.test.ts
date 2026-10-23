/* H4 faze i H5 raspored rasterećenja (pouka 4). */

import { describe, expect, it } from 'vitest';
import {
  buildAllowed,
  deloadAllowed,
  deloadWeeks,
  firstOfPhase,
  isBuildPhase,
  periodize,
  phaseCounts,
  phasesOf
} from './periodize.ts';

describe('H4 faze', () => {
  it('trka 1, taper 1; specifično 3 (B ≤ 9) / 4 (B 10–13) / 5 (B ≥ 14); baza ceil, razvoj ostatak', () => {
    const table = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => i + 10).map((n) => {
        const c = phaseCounts(n);
        return [n, [c.base, c.development, c.specific, c.taper, c.race]];
      })
    );
    expect(table).toEqual({
      10: [3, 2, 3, 1, 1],
      11: [3, 3, 3, 1, 1],
      12: [3, 3, 4, 1, 1],
      13: [4, 3, 4, 1, 1],
      14: [4, 4, 4, 1, 1],
      15: [5, 4, 4, 1, 1],
      16: [5, 4, 5, 1, 1],
      17: [5, 5, 5, 1, 1],
      18: [6, 5, 5, 1, 1],
      19: [6, 6, 5, 1, 1],
      20: [7, 6, 5, 1, 1]
    });
  });
});

describe('H5 rasterećenje (pouka 4)', () => {
  it('pravila: nikad u ned 1–2, na prvoj nedelji faze, na poslednjoj pred taperom, van izgradnje', () => {
    for (let n = 10; n <= 20; n++) {
      const ph = phasesOf(n);
      const B = ph.filter(isBuildPhase).length;
      for (let w = 1; w <= n; w++) {
        const ok = deloadAllowed(ph, w);
        if (w <= 2 || w === B || w > B || firstOfPhase(ph, w)) expect(ok, `${n}/${w}`).toBe(false);
        else expect(ok, `${n}/${w}`).toBe(true);
      }
    }
  });

  it('≤ 3 izgradnje zaredom, izuzetno 4 kad bi rasterećenje palo na prvu nedelju faze', () => {
    const ph = phasesOf(10); // baza 1–3, razvoj 4–5, specifično 6–8
    expect(buildAllowed(ph, 3, 2)).toBe(true);
    expect(buildAllowed(ph, 4, 3)).toBe(true); // ned 4 = prva nedelja razvoja
    expect(buildAllowed(ph, 5, 4)).toBe(false);
    expect(buildAllowed(ph, 7, 3)).toBe(false);
  });

  it('raspored: najmanje rasterećenja, izgradnja što ranije; postoji za 10–20 nedelja', () => {
    const table = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => i + 10).map((n) => [n, deloadWeeks(phasesOf(n))])
    );
    expect(table).toEqual({
      10: [5],
      11: [5, 8],
      12: [5, 9],
      13: [4, 9],
      14: [4, 8, 11],
      15: [4, 8, 12],
      16: [4, 8, 12],
      17: [4, 8, 12],
      18: [4, 8, 13],
      19: [4, 8, 12, 16],
      20: [4, 9, 13, 17]
    });
    const f = periodize('2026-11-02', 12)!;
    expect(f.map((x) => x.startDate).slice(0, 2)).toEqual(['2026-11-02', '2026-11-09']);
    expect(f.at(-1)!.endDate).toBe('2027-01-24');
  });
});
