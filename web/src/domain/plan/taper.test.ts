/* D5 (docs/ENGINE_CHANGES.md): oznaka „TAPER" u prikazu mora da prati ono što generator STVARNO radi — jedna taper nedelja na 5K/10K, dve na
   polumaratonu i maratonu. Pre izmene je prikaz pozicijom označavao samo pretposlednju nedelju, pa je prva taper nedelja HM/maratona
   (sa obimom već smanjenim na 80 %) stajala kao „VRHUNAC". */

import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../date';
import { generatePlan } from '../training/generator/generatePlan';
import { HEURISTIC_5K } from '../training/constants/distances';
import { weekPhase } from './describe';

const START = parseIsoDate('2026-10-05') as IsoDate;
const CASES: ReadonlyArray<[string, number, number, number, number, number]> = [
  ['5K', 5000, 1237, 40, 24, 1],
  ['10K', 10000, 2600, 40, 28, 1],
  ['HM', 21097.5, 5400, 45, 30, 2],
  ['42K', 42195, 12600, 50, 36, 2]
];

describe('weekPhase prati taper generatora', () => {
  for (const [name, dist, sec, km, weeks, taperWeeks] of CASES) {
    it(`${name}: ${taperWeeks} taper nedelja neposredno pre trke, pa TRKA`, () => {
      for (const intensity of ['kons', 'std', 'agr'] as const) {
        const p = generatePlan({
          startDate: START,
          raceDate: addDays(START, weeks * 7 + 6),
          raceDistM: dist,
          pb: { distM: dist, sec },
          weeklyKm: km,
          runDays: 5,
          quality: 2,
          intensity,
          trainedRecently: true
        });
        if ('error' in p) throw new Error(p.error);
        const phases = p.weeks.map((w) => weekPhase(w, p.weeks.length));
        expect(phases.at(-1), `${name} ${intensity}`).toBe('TRKA');
        const taper = phases.map((f, i) => (f === 'TAPER' ? i : -1)).filter((i) => i >= 0);
        expect(taper.length, `${name} ${intensity}`).toBe(taperWeeks);
        // neposredno ispred trkačke nedelje, bez rupe
        expect(taper).toEqual(
          Array.from({ length: taperWeeks }, (_, k) => p.weeks.length - 1 - taperWeeks + k)
        );
      }
    });
  }

  it('5K heuristika ne definiše taperWeeks (podrazumevano 1) — pretpostavka ovog testa', () => {
    expect((HEURISTIC_5K as { taperWeeks?: number }).taperWeeks).toBeUndefined();
  });

  it('opis „Taper …" označava taper i bez generatora; DELOAD ima prednost; ručno pisan plan i dalje ima pretposlednju nedelju', () => {
    expect(weekPhase({ w: 8, focus: 'Taper · Tempo' }, 20)).toBe('TAPER');
    expect(weekPhase({ w: 8, focus: 'taper — obim dole, oštrina ostaje' }, 20)).toBe('TAPER');
    expect(weekPhase({ w: 8, focus: 'Int + Taper' }, 20)).not.toBe('TAPER');
    expect(weekPhase({ w: 8, focus: 'DELOAD — Taper', deload: true }, 20)).toBe('DELOAD');
    expect(weekPhase({ w: 19, focus: '' }, 20)).toBe('TAPER');
    expect(weekPhase({ w: 20, focus: 'Taper' }, 20)).toBe('TRKA');
  });
});

describe('zastavica `taper` iz generatora', () => {
  it('stoji tačno na nedeljama čiji opis počinje sa „Taper" (oba izvora kažu isto), nikad na trkačkoj ni običnoj nedelji', () => {
    for (const [name, dist, sec, km, weeks, taperWeeks] of CASES) {
      const p = generatePlan({
        startDate: START,
        raceDate: addDays(START, weeks * 7 + 6),
        raceDistM: dist,
        pb: { distM: dist, sec },
        weeklyKm: km,
        runDays: 5,
        quality: 2,
        intensity: 'std',
        trainedRecently: true
      });
      if ('error' in p) throw new Error(p.error);
      const flagged = p.weeks.filter((w) => w.taper === true).map((w) => w.w);
      const byText = p.weeks.filter((w) => /^Taper/i.test(w.focus)).map((w) => w.w);
      expect(flagged, name).toEqual(byText);
      expect(flagged.length, name).toBe(taperWeeks);
      expect(JSON.stringify(p.weeks), name).not.toContain('"taper":false'); // samo `true` ili bez polja
      expect(p.weeks.at(-1)?.taper, name).toBeUndefined();
    }
  });

  it('plan bez taper zastavice (napravljen pre nje) se i dalje prikazuje po opisu', () => {
    const phases = [
      weekPhase({ w: 28, focus: 'Taper · Tempo' }, 30),
      weekPhase({ w: 29, focus: 'Taper — obim dole, oštrina ostaje' }, 30),
      weekPhase({ w: 30, focus: 'TRKA' }, 30)
    ];
    expect(phases).toEqual(['TAPER', 'TAPER', 'TRKA']);
    expect(weekPhase({ w: 10, focus: 'Int', taper: true }, 30)).toBe('TAPER');
  });
});
