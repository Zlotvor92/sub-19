/* generatePlan — invarijante, ne fiksni brojevi.

   Namerno se NE tvrdi „N3 mora imati 24.4 km": takav test puca na svaku legitimnu
   izmenu kalibracije. Proverava se ono što MORA da važi u svakom planu, jer je
   trenerski pogrešno ako ne važi (dugo trčanje kraće od laganog dana, taper viši
   od vrhunca, deload koji ne spušta, obrnut rast obima).

   parity: test/generator.test.mjs — svih 21 testova (generatePlan + buildDaySlots).
   Datumi su APSOLUTNI (stari testovi su zavisili od današnjeg dana). */

import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../../date';
import { profileFor } from '../distances';
import type { Day, PlanGenerationInput, TrainingPlan, Week } from '../types';
import { buildDaySlots } from './daySlots';
import { generatePlan } from './generatePlan';
import { rampStep } from './volume';

const DIST = { '5K': 5000, '10K': 10000, HM: 21097.5, Maraton: 42195 } as const;
const MIN_WEEKS: Record<number, number> = { 5000: 6, 10000: 8, 21097.5: 10, 42195: 12 };
const START = parseIsoDate('2026-01-05') as IsoDate; // ponedeljak

/** Datum trke `weeks` nedelja posle početka (isti dan u nedelji kao početak). */
const raceDateIn = (weeks: number): string => addDays(START, weeks * 7);

function baseInput(over: Partial<PlanGenerationInput> = {}): PlanGenerationInput {
  return {
    startDate: START,
    raceDate: raceDateIn(16),
    raceDistM: 5000,
    pb: { distM: 5000, sec: 1237 },
    weeklyKm: 40,
    runDays: 4,
    quality: 2,
    intensity: 'std',
    trainedRecently: true,
    ...over
  };
}

function gen(inp: PlanGenerationInput): TrainingPlan {
  const p = generatePlan(inp);
  if ('error' in p) throw new Error(`generatePlan: ${p.error}`);
  return p;
}

const kmOf = (d: Day): number => d.km || 0;
const weekKm = (w: Week): number => w.days.reduce((s, d) => s + kmOf(d), 0);
/** Obim BEZ same trke — trkačka nedelja inače uvek „premaši vrhunac" na maratonu. */
const weekTrainingKm = (w: Week): number =>
  w.days.reduce((s, d) => s + (d.tag === 'trka' ? 0 : kmOf(d)), 0);
const runDaysOf = (w: Week): Day[] => w.days.filter((d) => !d.rest && d.tag !== 'snaga');

interface Scenario {
  ime: string;
  inp: PlanGenerationInput;
}
/** Matrica: 4 distance × 4 broja dana × 3 obima × (treniran / početnik). */
const SCENARIOS: Scenario[] = [];
for (const [ime, distM] of Object.entries(DIST)) {
  const minW = MIN_WEEKS[distM] ?? 6;
  for (const runDays of [3, 4, 5, 6]) {
    for (const weeklyKm of [12, 30, 55]) {
      for (const trainedRecently of [true, false]) {
        SCENARIOS.push({
          ime: `${ime} · ${runDays}d · ${weeklyKm}km · ${trainedRecently ? 'trenirao' : 'početnik'}`,
          inp: baseInput({
            raceDistM: distM,
            raceDate: raceDateIn(Math.max(minW + 4, 18)),
            weeklyKm,
            runDays,
            trainedRecently,
            pb: { distM: 5000, sec: weeklyKm < 20 ? 1600 : 1237 }
          })
        });
      }
    }
  }
}
const PLANS = SCENARIOS.map((s) => ({ ...s, plan: gen(s.inp) }));

describe('generatePlan — osnovna ispravnost', () => {
  it('svi scenariji se generišu bez greške i bez NaN', () => {
    expect(PLANS.length).toBe(96);
    for (const s of PLANS) {
      expect(s.plan.weeks.length, s.ime).toBeGreaterThan(0);
      for (const w of s.plan.weeks) {
        for (const d of w.days) {
          expect(d.km == null || Number.isFinite(d.km), `${s.ime} N${w.w}: km ${d.km}`).toBe(true);
          expect(String(d.desc ?? ''), `${s.ime} N${w.w} dow${d.dow}`).not.toMatch(
            /NaN|undefined|Infinity/
          );
        }
      }
    }
  });

  it('nijedan opis ne pokazuje neurednu decimalu', () => {
    /* PUCALO: taper sesije skaliraju zagrevanje/smirivanje, a rezultat nije išao kroz r1() —
       „1.2000000000000002 km hlađenje". Sve kilometraže su na jednu decimalu. */
    for (const s of PLANS) {
      for (const w of s.plan.weeks) {
        for (const d of w.days) {
          const bad = (d.desc ?? '').match(/\d+\.\d\d+/);
          expect(bad, `${s.ime} N${w.w} d${d.dow}: ${d.desc}`).toBeNull();
        }
      }
    }
  });

  it('odbija degenerisan ulaz čistom greškom (ne NaN-om)', () => {
    const err = (over: Partial<PlanGenerationInput>): boolean =>
      'error' in generatePlan(baseInput(over));
    expect(err({ pb: { distM: 5000, sec: 0 } })).toBe(true);
    expect(err({ pb: { distM: 0, sec: 1200 } })).toBe(true);
    expect(err({ weeklyKm: 0 })).toBe(true);
    expect(err({ raceDistM: 1234 }), 'nepodržana distanca').toBe(true);
    expect(err({ raceDate: raceDateIn(2) }), 'prekratak rok').toBe(true);
    expect(err({ raceDate: raceDateIn(200) }), 'predug rok').toBe(true);
  });

  it('svaka nedelja ima tačno 7 dana (osim prve, koja se seče datumom, i trkačke)', () => {
    for (const s of PLANS.slice(0, 24)) {
      s.plan.weeks.forEach((w, i) => {
        if (i === 0 || i === s.plan.weeks.length - 1) return;
        expect(w.days.length, `${s.ime} N${w.w}`).toBe(7);
      });
    }
  });

  it('dow je uvek 1–7 i jedinstven unutar nedelje', () => {
    for (const s of PLANS.slice(0, 24)) {
      for (const w of s.plan.weeks) {
        const dows = w.days.map((d) => d.dow);
        expect(new Set(dows).size, `${s.ime} N${w.w}: ${dows.join(',')}`).toBe(dows.length);
        dows.forEach((x) => {
          expect(x >= 1 && x <= 7, `${s.ime} N${w.w}: dow ${x}`).toBe(true);
        });
      }
    }
  });
});

describe('generatePlan — trenerske invarijante', () => {
  it('dugo trčanje je NAJDUŽE trčanje svoje nedelje', () => {
    for (const s of PLANS) {
      s.plan.weeks.forEach((w, i) => {
        if (i === s.plan.weeks.length - 1) return; // trkačka nedelja ima trku
        const lr = w.days.filter((d) => d.tag === 'lr' || d.tag === 'rw');
        if (!lr.length) return;
        const longest = Math.max(...lr.map(kmOf));
        for (const d of w.days.filter((x) => x.tag !== 'lr' && x.tag !== 'rw' && !x.rest)) {
          expect(
            kmOf(d),
            `${s.ime} N${w.w}: ${d.tag} ${d.km} km > LR ${longest} km`
          ).toBeLessThanOrEqual(longest + 0.06);
        }
      });
    }
  });

  it('deload nedelja je manja od nedelje pre nje', () => {
    for (const s of PLANS) {
      s.plan.weeks.forEach((w, i) => {
        const prev = s.plan.weeks[i - 1];
        if (!w.deload || !prev) return;
        expect(weekKm(w), `${s.ime} N${w.w} (deload)`).toBeLessThan(weekKm(prev) + 0.01);
      });
    }
  });

  it('taper i trkačka nedelja su ispod vrhunca', () => {
    for (const s of PLANS) {
      const ws = s.plan.weeks;
      if (ws.length < 5) continue;
      const peak = Math.max(...ws.slice(0, -2).map(weekKm));
      expect(weekKm(ws[ws.length - 2] as Week), `${s.ime}: taper`).toBeLessThan(peak);
      expect(
        weekTrainingKm(ws[ws.length - 1] as Week),
        `${s.ime}: trkačka (bez trke)`
      ).toBeLessThan(peak);
    }
  });

  it('nedeljni obim nikad ne skoči preko bezbedne granice', () => {
    /* Poređenje kreće od i=1 i preskače nedelje sa <7 dana: PRVA nedelja je isečena datumom
       početka, pa „isečena N1 → puna N2" izgleda kao skok a nije. */
    for (const s of PLANS) {
      const h = (profileFor(s.inp.raceDistM ?? 5000) as NonNullable<ReturnType<typeof profileFor>>)
        .heuristic;
      const ws = s.plan.weeks;
      for (let i = 1; i < ws.length - 2; i++) {
        const prev = ws[i - 1] as Week;
        const cur = ws[i] as Week;
        if (prev.deload || cur.deload || prev.days.length < 7) continue;
        const pv = weekKm(prev);
        if (pv <= 0) continue;
        const step = rampStep(h, pv, s.inp.intensity);
        expect(weekKm(cur), `${s.ime} N${cur.w}: ${pv} -> ${weekKm(cur)}`).toBeLessThanOrEqual(
          pv + step * 2.2 + 0.5
        );
      }
    }
  });

  it('broj dana trčanja poštuje izbor korisnika', () => {
    for (const runDays of [2, 3, 4, 5, 6, 7]) {
      const p = gen(baseInput({ runDays, weeklyKm: 45, raceDate: raceDateIn(20) }));
      const w = p.weeks[Math.floor(p.weeks.length / 2)] as Week; // prva se seče datumom, poslednje su taper
      expect(runDaysOf(w).length, `traženo ${runDays} u N${w.w}`).toBe(runDays);
    }
  });

  it('izabrani konkretni dani se poštuju TAČNO', () => {
    const runDows = [2, 4, 6, 7];
    const p = gen(baseInput({ runDows, lrDow: 7, weeklyKm: 45, raceDate: raceDateIn(20) }));
    const w = p.weeks[Math.floor(p.weeks.length / 2)] as Week;
    expect(
      runDaysOf(w)
        .map((d) => d.dow)
        .sort((a, b) => a - b)
    ).toEqual(runDows);
  });

  it('dan trke pada TAČNO na zadati datum i nosi tačnu distancu', () => {
    for (const [ime, distM] of Object.entries(DIST)) {
      const p = gen(
        baseInput({
          raceDistM: distM,
          raceDate: raceDateIn((MIN_WEEKS[distM] ?? 6) + 6),
          weeklyKm: 50,
          runDays: 5
        })
      );
      const last = p.weeks[p.weeks.length - 1] as Week;
      const race = last.days.find((d) => d.tag === 'trka');
      expect(race, `${ime}: nema dana trke`).toBeDefined();
      expect(Math.abs(kmOf(race as Day) - distM / 1000), `${ime}`).toBeLessThan(0.01);
    }
  });

  it('bazna faza postoji samo za početnika i ne sadrži kvalitet', () => {
    const beginner = gen(
      baseInput({ trainedRecently: false, weeklyKm: 15, runDays: 4, raceDate: raceDateIn(24) })
    );
    expect(beginner.meta.baseWeeks).toBeGreaterThan(0);
    for (let i = 0; i < beginner.meta.baseWeeks; i++) {
      const w = beginner.weeks[i] as Week;
      expect(
        w.days.filter((d) => d.tag === 'int' || d.tag === 'tempo'),
        `N${w.w}`
      ).toHaveLength(0);
    }
    const trained = gen(
      baseInput({ trainedRecently: true, weeklyKm: 15, runDays: 4, raceDate: raceDateIn(24) })
    );
    expect(trained.meta.baseWeeks).toBe(0);
  });

  it('PRED redovi i qs ključevi pokazuju na dan koji stvarno postoji', () => {
    for (const s of PLANS.slice(0, 24)) {
      const exists = new Set<string>();
      s.plan.weeks.forEach((w) => w.days.forEach((d) => exists.add(`n${w.w}d${d.dow}`)));
      for (const k of Object.keys(s.plan.qs)) expect(exists.has(k), `${s.ime}: qs ${k}`).toBe(true);
      const namesByWeek = new Map<number, string[]>();
      s.plan.weeks.forEach((w) =>
        w.days.forEach((d) => {
          if (d.session)
            namesByWeek.set(w.w, [...(namesByWeek.get(w.w) ?? []), `N${w.w} · ${d.session.kind}`]);
        })
      );
      for (const r of s.plan.pred) {
        expect(namesByWeek.get(r.w) ?? [], `${s.ime}: PRED "${r.l}"`).toContain(r.l);
      }
    }
  });

  it('meta nosi goalSec kad je cilj zadat', () => {
    expect(gen(baseInput({ goalSec: 1170 })).meta.goalSec).toBe(1170);
    expect(gen(baseInput()).meta.goalSec).toBeNull();
  });

  it('nerealan cilj proizvodi upozorenje', () => {
    const p = gen(
      baseInput({ pb: { distM: 5000, sec: 1500 }, goalSec: 900, raceDate: raceDateIn(8) })
    );
    expect(p.meta.dayWarnings.some((t) => /iznad onoga što ovaj plan realno donosi/.test(t))).toBe(
      true
    );
  });
});

describe('buildDaySlots', () => {
  const count = (slots: Record<number, string>, pred: (r: string) => boolean): number =>
    Object.values(slots).filter(pred).length;

  it('kvalitet je ograničen na 1 kad je 3 ili manje dana trčanja', () => {
    for (const rd of [2, 3]) {
      expect(
        count(buildDaySlots(rd, 2, null, false), (r) => r === 'q1' || r === 'q2'),
        `runDays ${rd}`
      ).toBe(1);
    }
  });

  it('nikad više od 2 kvaliteta', () => {
    for (let rd = 2; rd <= 7; rd++) {
      expect(
        count(buildDaySlots(rd, 2, null, false), (r) => r === 'q1' || r === 'q2')
      ).toBeLessThanOrEqual(2);
    }
  });

  it('dugo trčanje ide na traženi dan', () => {
    for (let lrDow = 1; lrDow <= 7; lrDow++) {
      expect(buildDaySlots(5, 2, { lrDow }, false)[lrDow], `lrDow ${lrDow}`).toBe('lr');
    }
  });

  it('broj dana trčanja odgovara traženom', () => {
    for (let rd = 2; rd <= 7; rd++) {
      expect(
        count(buildDaySlots(rd, 2, null, false), (r) => r !== 'rest'),
        `traženo ${rd}`
      ).toBe(rd);
    }
  });

  it('srednje-dugo trčanje nikad ne pada uz dugo', () => {
    for (let rd = 5; rd <= 7; rd++) {
      const s = buildDaySlots(rd, 2, { lrDow: 7 }, true);
      const mlr = Object.keys(s).find((d) => s[Number(d)] === 'mlr');
      if (!mlr) continue;
      const d = Number(mlr);
      const neighbours = [d === 1 ? 7 : d - 1, d === 7 ? 1 : d + 1];
      expect(
        neighbours.some((x) => s[x] === 'lr'),
        `runDays ${rd}: MLR na ${d} je uz LR`
      ).toBe(false);
    }
  });
});
