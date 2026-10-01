/* ULAZ GENERATORA — degenerisan ulaz mora dati čistu grešku, nikad NaN/Infinity u planu.

   Stari generator je to prihvatao bez greške (docs/TRAINING_ENGINE_AUDIT.md §11, G1–G9). Probe koje
   su ih reprodukovale (docs/probes/legacy-*.mjs) ovde postaju testovi, plus fuzz nad nasumičnim
   nevalidnim vrednostima svakog polja.

   Nema paraleli u starim testovima: stari `generator.test` pokriva samo `minWeeks`/`maxWeeks`. */

import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../../date';
import type { PlanGenerationInput } from '../types';
import { generatePlan } from './generatePlan';

const START = parseIsoDate('2026-01-05') as IsoDate;

const valid = (): PlanGenerationInput => ({
  startDate: START,
  raceDate: addDays(START, 16 * 7 + 6),
  raceDistM: 5000,
  pb: { distM: 5000, sec: 1237 },
  weeklyKm: 40,
  runDays: 4,
  quality: 2,
  intensity: 'std',
  trainedRecently: true
});

/** Ulaz sa polem zamenjenim vrednošću koju tip zabranjuje (kao da je stigla iz nepouzdanog JSON-a). */
const withBad = (patch: Record<string, unknown>): PlanGenerationInput => ({ ...valid(), ...patch });

const isError = (inp: PlanGenerationInput): boolean => 'error' in generatePlan(inp);

describe('G1–G3: datumi', () => {
  it.each([
    ['G1 trka: nevažeći string', { raceDate: 'abc' }],
    ['G1 trka: izostavljena', { raceDate: undefined }],
    ['G2 trka: nemoguć kalendarski datum (preliva se u mart)', { raceDate: '2026-02-31' }],
    ['G2 trka: 29. februar u običnoj godini', { raceDate: '2027-02-29' }],
    ['G3 početak: nevažeći string', { startDate: 'abc' }],
    ['G3 početak: izostavljen', { startDate: undefined }],
    ['G3 početak: sa vremenom', { startDate: '2026-01-05T10:00:00Z' }]
  ])('%s → čista greška, ne plan sa 0 nedelja ni izuzetak', (_n, patch) => {
    const r = generatePlan(withBad(patch));
    expect('error' in r).toBe(true);
  });

  it('trka pre početka i dalje daje grešku o minimumu nedelja', () => {
    const r = generatePlan({ ...valid(), raceDate: addDays(START, -30) });
    expect('error' in r && /Manje od/.test(r.error)).toBe(true);
  });
});

describe('G4–G8: brojevi i tipovi', () => {
  it.each([
    ['G4 intensity: izostavljen', { intensity: undefined }],
    ['G4 intensity: nepoznat', { intensity: 'xyz' }],
    ['G4 intensity: velika slova', { intensity: 'STD' }],
    ['G5 pb.sec: Infinity', { pb: { distM: 5000, sec: Infinity } }],
    ['G5 pb.sec: 1 s', { pb: { distM: 5000, sec: 1 } }],
    ['G5 pb.sec: NaN', { pb: { distM: 5000, sec: NaN } }],
    ['G5 pb.distM: 1 m', { pb: { distM: 1, sec: 60 } }],
    ['G5 pb.distM: Infinity', { pb: { distM: Infinity, sec: 1200 } }],
    ['G5 pb.sec: ceo dan za 5K', { pb: { distM: 5000, sec: 86400 } }],
    ['G6 weeklyKm: Infinity', { weeklyKm: Infinity }],
    ['G6 weeklyKm: NaN', { weeklyKm: NaN }],
    ['G6 weeklyKm: negativan', { weeklyKm: -5 }],
    ['G7 goalSec: 1 s', { goalSec: 1 }],
    ['G7 goalSec: Infinity', { goalSec: Infinity }],
    ['G7 goalSec: negativan', { goalSec: -1200 }],
    ['G8 raceDistM: string "5000"', { raceDistM: '5000' }],
    ['raceDistM: nepodržana distanca', { raceDistM: 1234 }]
  ])('%s → greška', (_n, patch) => {
    expect(isError(withBad(patch))).toBe(true);
  });

  it('goalSec koji nije pozitivan broj i dalje znači „nema cilja" (kao pre)', () => {
    for (const goal of [0, null, undefined, NaN]) {
      const r = generatePlan(withBad({ goalSec: goal }));
      expect('error' in r, `goalSec=${String(goal)}`).toBe(false);
      if (!('error' in r)) expect(r.meta.goalSec).toBeNull();
    }
  });

  it('weeklyKm iznad 120 se i dalje tiho svodi (proizvodna odluka, v. AUDIT D4) — ali bez NaN', () => {
    const r = generatePlan(withBad({ weeklyKm: 500 }));
    expect('error' in r).toBe(false);
  });
});

/** Svaki broj u planu mora biti konačan; nijedan string ne sme nositi NaN/undefined/Infinity. */
function assertClean(x: unknown, path: string): void {
  if (typeof x === 'number') {
    if (!Number.isFinite(x)) throw new Error(`${path}: nije konačan broj (${x})`);
  } else if (typeof x === 'string') {
    if (/NaN|undefined|Infinity/.test(x))
      throw new Error(`${path}: string sadrži NaN/undefined/Infinity — "${x.slice(0, 90)}"`);
  } else if (Array.isArray(x)) {
    x.forEach((v, i) => assertClean(v, `${path}[${i}]`));
  } else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) assertClean(v, `${path}.${k}`);
  }
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GARBAGE: readonly unknown[] = [
  undefined,
  null,
  NaN,
  Infinity,
  -Infinity,
  0,
  -1,
  1e9,
  '',
  'abc',
  '5000',
  [],
  {},
  [NaN],
  true
];

describe('fuzz: nasumično pokvaren ulaz', () => {
  it('2 000 pokvarenih ulaza: nikad izuzetak, a ako plan postoji — nikad NaN/Infinity u njemu', () => {
    const r = rng(7);
    const fields = [
      'startDate',
      'raceDate',
      'raceDistM',
      'pb',
      'weeklyKm',
      'runDays',
      'quality',
      'intensity',
      'goalSec',
      'trainedRecently',
      'lrDow',
      'qDows',
      'runDows'
    ];
    let plans = 0;
    let errors = 0;
    for (let i = 0; i < 2000; i++) {
      const inp: Record<string, unknown> = { ...valid() };
      const broken = 1 + Math.floor(r() * 3);
      for (let k = 0; k < broken; k++) {
        const f = fields[Math.floor(r() * fields.length)] as string;
        const g = GARBAGE[Math.floor(r() * GARBAGE.length)];
        if (f === 'pb') {
          inp['pb'] = r() < 0.5 ? g : { distM: r() < 0.5 ? g : 5000, sec: r() < 0.5 ? g : 1237 };
        } else {
          inp[f] = g;
        }
      }
      let result: ReturnType<typeof generatePlan>;
      try {
        result = generatePlan(inp as unknown as PlanGenerationInput);
      } catch (e) {
        throw new Error(
          `izuzetak za ulaz ${JSON.stringify(inp)}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
      if ('error' in result) {
        errors++;
        expect(typeof result.error).toBe('string');
        continue;
      }
      plans++;
      try {
        assertClean(result, 'plan');
      } catch (e) {
        throw new Error(
          `${e instanceof Error ? e.message : String(e)}\n  ulaz: ${JSON.stringify(inp)}`
        );
      }
    }
    /* test ne sme da bude prazan hod: i planovi (polja koja se tolerišu) i greške */
    expect(plans).toBeGreaterThan(100);
    expect(errors).toBeGreaterThan(500);
  });
});
