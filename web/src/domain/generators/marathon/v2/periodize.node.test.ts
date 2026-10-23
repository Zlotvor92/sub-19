import { describe, expect, it } from 'vitest';
import {
  deloadAllowed,
  deloadWeeks,
  firstOfPhase,
  isBuildPhase,
  periodize,
  phaseCounts,
  phasesOf,
  taperStep
} from './periodize.ts';

/* M4 faze (taper 2 nedelje) i M5 raspored rasterećenja (pouka 4). */

describe('M4 faze', () => {
  it('B = N − 3: specifično 4 (B ≤ 12) / 5 (13–16) / 6 (≥ 17); baza = ceil((B − spec)/2); taper 2, trka 1', () => {
    const c = (n: number) => {
      const x = phaseCounts(n);
      return [x.base, x.development, x.specific, x.taper, x.race];
    };
    expect(c(12)).toEqual([3, 2, 4, 2, 1]);
    expect(c(15)).toEqual([4, 4, 4, 2, 1]);
    expect(c(16)).toEqual([4, 4, 5, 2, 1]);
    expect(c(19)).toEqual([6, 5, 5, 2, 1]);
    expect(c(20)).toEqual([6, 5, 6, 2, 1]);
    expect(c(24)).toEqual([8, 7, 6, 2, 1]);
    for (let n = 12; n <= 24; n++) {
      const x = phaseCounts(n);
      expect(x.base + x.development + x.specific + x.taper + x.race).toBe(n);
      expect(x.development).toBeGreaterThan(0);
    }
  });

  it('M7: tačno dve nedelje tapera (N−2, N−1), pa trka; taperStep 0/1', () => {
    for (let n = 12; n <= 24; n++) {
      const ph = phasesOf(n);
      expect(ph.slice(-3)).toEqual(['taper', 'taper', 'race']);
      expect(taperStep(ph, n - 2)).toBe(0);
      expect(taperStep(ph, n - 1)).toBe(1);
      expect(taperStep(ph, n)).toBeNull();
      expect(taperStep(ph, 1)).toBeNull();
    }
  });
});

describe('M5 rasterećenje (pouka 4)', () => {
  it('za svako N 12–24 postoji raspored; nikad na prvoj nedelji faze, u ned 1–2, pred taperom; ≤ 3 izgradnje (izuzetno 4 na početku faze)', () => {
    for (let n = 12; n <= 24; n++) {
      const ph = phasesOf(n);
      const d = deloadWeeks(ph);
      expect(d, `N=${n}`).not.toBeNull();
      const build = ph.filter(isBuildPhase).length;
      for (const w of d!) {
        expect(w).toBeGreaterThanOrEqual(3);
        expect(firstOfPhase(ph, w)).toBe(false);
        expect(w).not.toBe(build);
        expect(isBuildPhase(ph[w - 1]!)).toBe(true);
      }
      let run = 0;
      for (let w = 1; w <= build; w++) {
        if (d!.includes(w)) {
          run = 0;
          continue;
        }
        run++;
        expect(run <= 3 || (run === 4 && firstOfPhase(ph, w)), `N=${n} w=${w}`).toBe(true);
      }
    }
  });

  it('primeri: 12, 16, 24 ned (najmanje rasterećenja, izgradnja što ranije; 24 ned: ned 16 je prva nedelja specifične → 4 izgradnje 13–16)', () => {
    expect(deloadWeeks(phasesOf(12))).toEqual([5, 8]);
    expect(deloadWeeks(phasesOf(16))).toEqual([4, 8, 12]);
    expect(deloadWeeks(phasesOf(24))).toEqual([4, 8, 12, 17, 20]);
  });

  it('deloadAllowed: ned 1–2, prva nedelja faze, poslednja pred taperom i taper/trka su zabranjeni', () => {
    const ph = phasesOf(16);
    expect(deloadAllowed(ph, 2)).toBe(false);
    expect(deloadAllowed(ph, 5)).toBe(false); // prva nedelja razvoja
    expect(deloadAllowed(ph, 13)).toBe(false); // poslednja pred taperom
    expect(deloadAllowed(ph, 14)).toBe(false);
    expect(deloadAllowed(ph, 4)).toBe(true);
  });

  it('okviri: datumi uzastopni, nedelja = 7 dana, faza i rasterećenje iz odluke', () => {
    const f = periodize('2026-11-02', 18)!;
    expect(f).toHaveLength(18);
    expect(f[0]!.startDate).toBe('2026-11-02');
    expect(f[17]!.endDate).toBe('2027-03-07');
    expect(f.filter((x) => x.deload).map((x) => x.index)).toEqual(deloadWeeks(phasesOf(18)));
  });
});
