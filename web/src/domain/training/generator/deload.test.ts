/* DELOAD ZADRŽAVA JEDNU OŠTRINU, I NEDELJA KAŽE ČEMU SLUŽI.

   Plan je delovao jednolično: na generisanom 5K planu od 16 nedelja 3 nedelje BEZ IJEDNOG kvaliteta.
   `if(isDeload) continue;` je preskakao oba kvalitetna slota, pa je nedelja rasterećenja bila četiri
   identična laka trčanja plus dugo. Sada q1 slot dobija kratku oštrinu (4–8 × 200 m sa PUNIM
   oporavkom); q2 ostaje lagan dan. Polje `focus` kaže čemu nedelja služi.

   Zamke čuvaju invarijante, ne brojeve: deload OSTAJE rasterećenje, oštrina je MANJA od redovnog
   kvaliteta, nedelja rasterećenja ostaje prepoznatljiva.

   parity: test/deload-ostrina.test.mjs (generatorski deo). Testovi „deload ostaje prepoznatljiv
   SVUDA gde se čita" i „ručno pisan plan" (adaptGeneratedPlan / weekPhase) prelaze sa modulom
   `domain/plan`. */

import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../../date';
import type { Day, PlanGenerationInput, Week } from '../types';
import { generatePlan } from './generatePlan';

const PB: Record<number, { distM: number; sec: number }> = {
  5000: { distM: 5000, sec: 1290 },
  10000: { distM: 10000, sec: 2700 },
  21097.5: { distM: 21097.5, sec: 5700 },
  42195: { distM: 42195, sec: 12000 }
};
const DISTANCES: Array<[string, number, number, number]> = [
  ['5K', 5000, 16, 45],
  ['10K', 10000, 18, 50],
  ['Polumaraton', 21097.5, 20, 70],
  ['Maraton', 42195, 20, 70]
];
const START = parseIsoDate('2026-08-17') as IsoDate;
const dateIn = (n: number): string => addDays(START, n * 7 - 2);

function plan(
  distM: number,
  weeks: number,
  km: number,
  extra: Partial<PlanGenerationInput> = {}
): Week[] {
  const g = generatePlan({
    startDate: START,
    raceDate: dateIn(weeks),
    raceDistM: distM,
    pb: PB[distM] as { distM: number; sec: number },
    weeklyKm: km,
    runDays: 5,
    quality: 2,
    intensity: 'std',
    trainedRecently: true,
    ...extra
  });
  if ('error' in g) throw new Error(`plan se nije napravio: ${g.error}`);
  return g.weeks;
}

const weekKm = (w: Week): number => w.days.reduce((s, d) => s + (d.km || 0), 0);
const sharpness = (w: Week): Day[] => w.days.filter((d) => d.session?.kind === 'Oštrina');
const quality = (w: Week): Day[] => w.days.filter((d) => d.tag === 'int' || d.tag === 'tempo');

describe('Deload više nije nedelja bez ijednog stimulusa', () => {
  for (const [name, distM, weeks, km] of DISTANCES) {
    it(`${name}: svaka deload nedelja u kvalitetnoj fazi ima tačno jednu oštrinu`, () => {
      /* TAČNO JEDNU: nula je stari propust, dve su prestale da budu rasterećenje. Bazne nedelje
         se ne broje — tamo kvaliteta nema po definiciji. */
      const deloads = plan(distM, weeks, km).filter(
        (x) => x.deload && quality(x).length + sharpness(x).length > 0
      );
      expect(
        deloads.length,
        'nijedna deload nedelja u kvalitetnoj fazi — proveri postavku'
      ).toBeGreaterThan(0);
      for (const d of deloads) {
        expect(sharpness(d).length, `N${d.w}: oštrina`).toBe(1);
        expect(
          quality(d).length,
          `N${d.w}: deload nosi više kvalitetnih dana — više nije rasterećenje`
        ).toBe(1);
      }
    });
  }

  it('oštrina je MANJA od najmanjeg redovnog kvaliteta', () => {
    for (const [name, distM, weeks, km] of DISTANCES) {
      const w = plan(distM, weeks, km);
      /* TAPER SE IZUZIMA: njegove sesije su namerno najmanje u planu. Meri se prema REDOVNOM
         kvalitetu, jer to je ono od čega deload rasterećuje. */
      const lastWorking = w.length - 2;
      const smallestRegular = Math.min(
        ...w
          .filter((x) => !x.deload && x.w <= lastWorking)
          .flatMap((x) => quality(x).filter((d) => d.session && d.session.kind !== 'Oštrina'))
          .map((d) => d.km || 0)
          .filter((x) => x > 0)
      );
      for (const d of w.filter((x) => x.deload)) {
        for (const o of sharpness(d)) {
          expect(o.km as number, `${name} N${d.w}`).toBeLessThan(smallestRegular);
        }
      }
    }
  });

  it('radni deo oštrine je simboličan, ne trening', () => {
    for (const [name, distM, weeks, km] of DISTANCES) {
      for (const d of plan(distM, weeks, km).filter((x) => x.deload)) {
        for (const o of sharpness(d)) {
          const s = o.session;
          if (s?.type !== 'int') throw new Error('oštrina mora biti intervalna sesija');
          expect((s.reps * s.repM) / 1000, `${name} N${d.w}: rad`).toBeLessThanOrEqual(2);
          expect(s.restSec, `${name} N${d.w}: pauza — nije pun oporavak`).toBeGreaterThanOrEqual(
            90
          );
        }
      }
    }
  });

  it('deload i dalje NOSI MANJE od nedelje pre sebe', () => {
    for (const [name, distM, weeks, km] of DISTANCES) {
      const w = plan(distM, weeks, km);
      for (let i = 1; i < w.length; i++) {
        const cur = w[i] as Week;
        const prev = w[i - 1] as Week;
        if (!cur.deload) continue;
        expect(weekKm(cur), `${name} N${cur.w}`).toBeLessThan(weekKm(prev));
      }
    }
  });

  it('deload ostaje u pojasu rasterećenja, ne postaje nedelja odmora', () => {
    /* Uhvaćeno tek MERENJEM: kad je oštrina izuzeta iz mehanizma koji produžuje zagrevanje, deload
       je padao i do 46% prethodne nedelje — nedelja odmora. Mreža ide kroz 3 dana i 12–22 km, gde
       propust stvarno bije (manjak nastaje tamo gde nedelja nema odakle da nadoknadi). */
    for (const [name, distM, weeks] of DISTANCES) {
      for (const days of [3, 4, 5]) {
        for (const km of [12, 22, 45, 70]) {
          const w = plan(distM, weeks, km, { runDays: days });
          for (let i = 1; i < w.length; i++) {
            const cur = w[i] as Week;
            if (!cur.deload) continue;
            const share = weekKm(cur) / weekKm(w[i - 1] as Week);
            const where = `${name} ${days}d ${km}km N${cur.w}`;
            expect(
              share,
              `${where}: ${(share * 100).toFixed(0)}% — odmor, ne rasterećenje`
            ).toBeGreaterThanOrEqual(0.58);
            expect(
              share,
              `${where}: ${(share * 100).toFixed(0)}% — nije rasterećenje`
            ).toBeLessThanOrEqual(0.92);
          }
        }
      }
    }
  });

  it('oštrina se ne pojavljuje u BAZNOJ fazi', () => {
    const w = plan(5000, 20, 25, { trainedRecently: false });
    const base = w.filter((x) =>
      x.days.every(
        (d) => d.rest || d.tag === 'lako' || d.tag === 'lr' || d.tag === 'rw' || d.tag === 'snaga'
      )
    );
    expect(base.length, 'nema baznih nedelja — proveri postavku').toBeGreaterThan(0);
    for (const b of base) expect(sharpness(b).length, `N${b.w}`).toBe(0);
  });
});

describe('Nedelja kaže čemu služi', () => {
  it('nijedna nedelja nije bez oznake', () => {
    for (const [name, distM, weeks, km] of DISTANCES) {
      for (const w of plan(distM, weeks, km)) expect(w.focus, `${name} N${w.w}`).toMatch(/\S/);
    }
  });

  it('oznaka imenuje ono što u nedelji STVARNO stoji', () => {
    const all = plan(5000, 16, 45);
    for (const w of all) {
      /* Trkačka nedelja nosi „TRKA" i to je cela poruka. */
      if (w.deload || w.w === all.length || !quality(w).length) continue;
      for (const d of quality(w)) expect(w.focus, `N${w.w}`).toContain(d.session?.kind ?? '');
    }
  });

  it('trkačka nedelja i taper nose svoje ime', () => {
    const w = plan(5000, 16, 45);
    expect((w[w.length - 1] as Week).focus).toMatch(/TRKA/);
    expect((w[w.length - 2] as Week).focus).toMatch(/Taper/i);
  });
});
