/* SIMETRIJA ČETIRI DISTANCE — zamka za ispravku koja sleti u tri od četiri.

   Stari generator je držao 61 funkciju i 25 konstanti sa sufiksom 5K/10K/21K/42K, pa je metodološka
   ispravka morala ručno u četiri mesta, a kad sleti u tri NIŠTA ne pukne. U novoj arhitekturi je
   mašina zajednička, a distance su PODACI (`product` + `heuristic`) i STRATEGIJE (`DistanceProfile`):
   interfejs sam, u vreme kompajliranja, traži da svaka distanca ima `phase`, `buildQuality` i
   `intervalPaceForWeek`. Ovde se zato ne testira postojanje funkcija nego ono što tip ne može:
   - da je oblik profila (koja polja koja distanca nosi) odluka, a ne previd;
   - da ograničenje tempa dolazi iz JEDNOG izvora (profil) i da stvarno vezuje;
   - da zagrevanje dolazi iz jedne funkcije;
   - da se skaliranje ponaša isto (smer) na sve četiri distance.

   parity: test/simetrija-distanci.test.mjs — 11 testova. Matrica „koja familija postoji za koju
   distancu" (čitana regexom iz app.js) više nema smisla: familije su sada parametrizovane
   (`sessions/{tempo,cruise,repetitions,intervals,progression}.ts`), a razlike su podaci. */

import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../../date';
import { generatePlan } from '../generator/generatePlan';
import { longRunCap, peakVolume, rampStep } from '../generator/volume';
import { wuCdForVolume } from '../sessions/build';
import { DISTANCE_PROFILES, profileFor } from './index';

const DISTANCES = [
  { name: '5K', m: 5000 },
  { name: '10K', m: 10000 },
  { name: 'HM', m: 21097.5 },
  { name: 'Maraton', m: 42195 }
] as const;

const profile = (m: number) => {
  const p = profileFor(m);
  if (!p) throw new Error(`nema profila za ${m}`);
  return p;
};

describe('profili distanci', () => {
  it('svaka distanca ima svoj profil sa imenom i najmanjim brojem nedelja', () => {
    expect(Object.keys(DISTANCE_PROFILES).sort()).toEqual(['10000', '21097.5', '42195', '5000']);
    for (const d of DISTANCES) {
      const p = profile(d.m);
      expect(typeof p.product.name).toBe('string');
      expect(p.product.minWeeks).toBeGreaterThan(0);
    }
  });

  it('minimum nedelja, baza za početnike i prag drugog kvaliteta rastu sa distancom', () => {
    const keys = ['minWeeks', 'baseWeeksBeginner', 'qual2MinKm', 'minPeakKm'] as const;
    for (const k of keys) {
      const v = DISTANCES.map((d) => profile(d.m).product[k]);
      for (let i = 1; i < v.length; i++) {
        expect(v[i], `${k}: ${DISTANCES[i]?.name} < ${DISTANCES[i - 1]?.name}`).toBeGreaterThan(
          v[i - 1] as number
        );
      }
    }
  });
});

describe('Ograničenje tempa dolazi iz JEDNOG izvora po distanci', () => {
  /* Kod starog 5K generatora ista brojka je stajala NAPISANA DVAPUT (`20*60` u gradiocu i
     `tempoMaxSec` u profilu). Danas se poklapaju; promeni jednu kopiju i one se tiho raziđu. Test to
     hvata PONAŠANJEM: pusti se obim toliko velik da ograničenje MORA da veže, pa se izmereni
     najduži prag poredi sa profilom. */
  for (const d of DISTANCES) {
    it(`${d.name}: najduži kontinuirani prag u planu odgovara tempoMaxSec iz profila`, () => {
      const cap = profile(d.m).heuristic.tempoMaxSec;
      const start = parseIsoDate('2026-01-05') as IsoDate;
      let longest = 0;
      for (const intensity of ['kons', 'std', 'agr'] as const) {
        const p = generatePlan({
          startDate: start,
          raceDate: addDays(start, 40 * 7),
          raceDistM: d.m,
          pb: {
            distM: d.m,
            sec: d.m === 5000 ? 1100 : d.m === 10000 ? 2300 : d.m === 21097.5 ? 5000 : 10500
          },
          weeklyKm: 120,
          runDays: 6,
          quality: 2,
          intensity,
          trainedRecently: true
        });
        if ('error' in p) throw new Error(p.error);
        for (const w of p.weeks) {
          for (const day of w.days) {
            const s = day.session;
            if (s?.type !== 'tempo' || s.kind !== 'Tempo') continue;
            const sec = s.qKm * s.paceSec;
            longest = Math.max(longest, sec);
            /* tolerancija je zaokruživanje na 0,1 km (r1), ne sloboda */
            expect(sec, `${d.name} N${w.w}: prag ${s.qKm} km @ ${s.paceSec}`).toBeLessThanOrEqual(
              cap + 0.06 * s.paceSec
            );
          }
        }
      }
      /* zamka ne sme da bude prazan hod: ograničenje stvarno veže */
      expect(longest, `${d.name}: ograničenje nikad ne veže — test ne meri ništa`).toBeGreaterThan(
        cap * 0.9
      );
    });
  }

  it('tempoMaxSec je razuman i raste sa distancom', () => {
    const v = DISTANCES.map((d) => profile(d.m).heuristic.tempoMaxSec);
    v.forEach((x, i) => {
      expect(
        x >= 10 * 60 && x <= 60 * 60,
        `${DISTANCES[i]?.name}: ${x} s van svake trkačke logike`
      ).toBe(true);
      if (i) expect(x).toBeGreaterThanOrEqual(v[i - 1] as number);
    });
  });
});

describe('Zajedničko ostaje zajedničko', () => {
  it('zagrevanje i smirivanje dolaze iz jedne funkcije za sve distance', () => {
    /* Zagrevanje ne zavisi od distance trke nego od nedeljnog obima. */
    for (const vol of [15, 25, 30, 50, 80]) {
      const seen = DISTANCES.map((d) => {
        const s = profile(d.m).buildQuality({
          qualW: 2,
          qualWeeks: 10,
          slotRole: 'q2',
          effQ: 2,
          vol,
          pI: 270,
          pT: 300,
          pE: 360,
          pR: 250,
          isTaper1: false,
          dow: 4,
          racePace: 290,
          ctx: { weeks: 20, w: 8, taperW: 1 }
        }).session;
        return `${s.wuKm}/${s.cdKm}`;
      });
      const [wu, cd] = wuCdForVolume(vol);
      expect(new Set(seen).size, `${vol} km/ned: ${seen.join(' ')}`).toBe(1);
      expect(seen[0]).toBe(`${wu}/${Math.max(cd, 1)}`);
    }
  });
});

describe('Skaliranje se ponaša isto na sve četiri distance', () => {
  /* Vrednosti smeju da se razlikuju — SMER ne sme. */
  it('peakVolume raste (ne opada) sa unetim nedeljnim obimom', () => {
    for (const d of DISTANCES) {
      const h = profile(d.m).heuristic;
      const v = [10, 20, 30, 40, 60, 80].map((x) => peakVolume(h, x, 8, 'std'));
      for (let i = 1; i < v.length; i++) {
        expect(v[i], `${d.name}: ${v[i - 1]} -> ${v[i]}`).toBeGreaterThanOrEqual(
          (v[i - 1] as number) - 1e-9
        );
      }
    }
  });

  it('longRunCap raste sa obimom i nikad ne pojede celu nedelju', () => {
    for (const d of DISTANCES) {
      const h = profile(d.m).heuristic;
      const vols = [20, 40, 60, 80];
      const v = vols.map((x) => longRunCap(h, x, 330));
      v.forEach((x, i) => {
        expect(x, `${d.name}: ${vols[i]} km`).toBeGreaterThan(0);
        expect(x, `${d.name}: LR duži od cele nedelje`).toBeLessThanOrEqual(vols[i] as number);
        if (i)
          expect(x, `${d.name}: LR se skraćuje kad obim raste`).toBeGreaterThanOrEqual(
            (v[i - 1] as number) - 1e-9
          );
      });
    }
  });

  it('agresivniji izbor nikad ne daje manji korak rasta', () => {
    for (const d of DISTANCES) {
      const h = profile(d.m).heuristic;
      const [k, s, a] = (['kons', 'std', 'agr'] as const).map((i) => rampStep(h, 40, i)) as [
        number,
        number,
        number
      ];
      expect(k <= s && s <= a, `${d.name}: kons ${k}, std ${s}, agr ${a}`).toBe(true);
      expect(k).toBeGreaterThan(0);
    }
  });
});

describe('Oblik profila je zaključan — polje dodato u tri od četiri se vidi', () => {
  /* Kratke i duge distance NAMERNO nose različit skup polja: `longRunCycle`, `fuelFromMin`,
     `taperWeeks` i slično nemaju smisla na 5K. Zato se ne traži da svi profili budu isti — nego da
     su TAČNO ovakvi kakvi jesu. Kad se sutra doda polje, test pukne i traži svesnu odluku: da li ide
     u sve četiri distance ili samo u neke. */
  const COMMON_PRODUCT = ['baseWeeksBeginner', 'minPeakKm', 'minWeeks', 'name', 'qual2MinKm'];
  const COMMON_HEURISTIC = [
    'deloadFactor',
    'hardCapKm',
    'intervalBudget',
    'introShare',
    'longRun',
    'longRunMaxShare',
    'raceWeekFactor',
    'rampStep',
    'repetitionBudget',
    'taperFactor',
    'taperLongRunFactor',
    'targetVolumeKm',
    'tempoBudget',
    'tempoMaxSec',
    'wuCdMaxExtraKm'
  ];
  const LONG = ['baseLongRunStart', 'firstTaperFactor', 'fuelFromMin', 'midweekLong', 'taperWeeks'];
  const EXPECTED: Record<string, { product: string[]; heuristic: string[]; strategies: string[] }> =
    {
      '5K': { product: COMMON_PRODUCT, heuristic: COMMON_HEURISTIC, strategies: [] },
      '10K': { product: COMMON_PRODUCT, heuristic: COMMON_HEURISTIC, strategies: [] },
      HM: {
        product: [...COMMON_PRODUCT, 'recommendedMinRunDays'],
        heuristic: [...COMMON_HEURISTIC, ...LONG, 'racePaceBudget'],
        strategies: ['longRunFinish', 'paceStrategy']
      },
      Maraton: {
        product: [...COMMON_PRODUCT, 'recommendedMinRunDays'],
        heuristic: [...COMMON_HEURISTIC, ...LONG, 'fuelStrongFromMin', 'marathonPaceBudget'],
        strategies: ['longRunCycle', 'longRunFinish']
      }
    };

  for (const d of DISTANCES) {
    it(`${d.name} nosi tačno očekivana polja`, () => {
      const p = profile(d.m);
      const exp = EXPECTED[d.name] as {
        product: string[];
        heuristic: string[];
        strategies: string[];
      };
      const optionalStrategies = (
        ['longRunCycle', 'longRunFinish', 'paceStrategy'] as const
      ).filter((k) => typeof p[k] === 'function');
      expect({
        product: Object.keys(p.product).sort(),
        heuristic: Object.keys(p.heuristic).sort(),
        strategies: [...optionalStrategies].sort()
      }).toEqual({
        product: [...exp.product].sort(),
        heuristic: [...exp.heuristic].sort(),
        strategies: [...exp.strategies].sort()
      });
    });
  }
});
