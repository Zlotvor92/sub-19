import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  adaptationPart,
  adaptationRows,
  categoryOfName,
  compareRows as compare,
  generationRows,
  generatorApi,
  loadReference,
  pickRows
} from '@/test/fiveK/reference';
import { adaptationBases, generationCases } from '@/test/fiveK/scenarios';
import { FULL, logCompared, part, sample } from '@/test/level';
import * as fiveK from './index';

/* 5K PRE/POSLE IZDVAJANJA. Referenca je uzeta iz STAROG zajedničkog mehanizma na polaznom commitu
   (`src/test/fixtures/fiveK-reference.json.gz`, v. `captureReference.node.test.ts`). Poredi se tačan zapis celog izlaza
   (`src/test/fiveK/exact.ts`): nijedno polje nije izostavljeno i ništa se ne zaokružuje. Kategorije (raspored, datumi, km,
   segmenti, tempo, odmor, taper, upozorenja, adaptacija) samo imenuju gde je razlika.

   NIVOI (src/test/level.ts): brz poredi deterministički uzorak (generisanje: svaki 5. unutar kategorije, qa i edge svi;
   adaptacija: `adaptationSlice` u `src/test/fiveK/reference.ts`; vremenska zona: sve 4 zone, svaka svoj deo skupa). Pun
   (`TEST_FULL=1`) poredi sve: ovde generisanje, vremensku zonu i deo 1 adaptacije, a ostale delove
   `equivalence.adapt<N>.full.node.test.ts`. */

const api = generatorApi(fiveK);
const reference = loadReference();

describe('5K izdvojen generator = stari mehanizam (polazni commit)', () => {
  it('referenca postoji', () => {
    expect(reference?.baselineSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
  });

  it('generisanje: svi 5K ulazi daju identičan izlaz', () => {
    const all = generationCases().map((c) => c.name);
    // Svaki red reference ima svoj ulaz (bez ovoga brz nivo ne bi video ulaz koji nedostaje).
    const inputs = new Set(all);
    expect(Object.keys(reference!.generation).filter((n) => !inputs.has(n))).toEqual([]);
    const names = sample(all, 5, categoryOfName, (n) => /^(qa|edge) /.test(n));
    const picked = new Set(names);
    const expected = pickRows(reference!.generation, names);
    logCompared('fiveK.generation', Object.keys(expected));
    const diff = compare(
      generationRows(api, (n) => picked.has(n), reference!.generation),
      expected
    );
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
    expect(Object.keys(reference!.generation).length).toBeGreaterThan(1000);
  });

  it('adaptacija: svi tokovi daju identičan izlaz i ne menjaju ulaze', { timeout: 600_000 }, () => {
    const { rows, expected, orphans } = adaptationPart(api, reference!.adaptation, 1);
    expect(orphans).toEqual([]);
    const diff = compare(rows, expected);
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
    expect(Object.values(rows).every((r) => r.pure)).toBe(true);
  });

  it('vremenska zona, sat i slučajnost ne utiču na rezultat', { timeout: 600_000 }, () => {
    const tz = process.env['TZ'];
    const RealDate = Date;
    /* Pun nivo: u svakoj zoni isti skup (qa, edge i otisak od 6 nedelja; prva 3 bazna plana adaptacije). Brz: zona i
       poredi i-ti od 4 dela istog skupa ulaza generisanja i i-ti (mod 3) od ista 3 bazna plana. */
    const genNames = generationCases()
      .map((c) => c.name)
      .filter((n) => /^(edge|qa) /.test(n) || /· 6n$/.test(n));
    const firstBases = adaptationBases().slice(0, 3);
    try {
      // Domen ne sme da čita sat ni slučajnost: svaki takav poziv bi ovde pao.
      vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Math.random u 5K generatoru');
      });
      class NoClockDate extends RealDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) throw new Error('new Date() bez argumenta u 5K generatoru');
          super(...(args as [string]));
        }
        static override now(): number {
          throw new Error('Date.now u 5K generatoru');
        }
      }
      const zones = ['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC'];
      for (const [i, zone] of zones.entries()) {
        const picked = new Set(FULL ? genNames : part(genNames, i + 1, zones.length));
        process.env['TZ'] = zone;
        globalThis.Date = NoClockDate as DateConstructor;
        const gen = generationRows(api, (n) => picked.has(n), reference!.generation);
        const adapt = FULL
          ? adaptationRows(api, 3, reference!.adaptation)
          : adaptationRows(api, undefined, reference!.adaptation, [
              firstBases[i % firstBases.length]!
            ]);
        globalThis.Date = RealDate;
        logCompared('fiveK.tz.generation', Object.keys(gen));
        logCompared('fiveK.tz.adaptation', Object.keys(adapt));
        const diff = [
          ...compare(
            gen,
            Object.fromEntries(Object.keys(gen).map((k) => [k, reference!.generation[k]!]))
          ),
          ...compare(
            adapt,
            Object.fromEntries(Object.keys(adapt).map((k) => [k, reference!.adaptation[k]!]))
          )
        ];
        expect(diff, zone).toEqual([]);
        // Brz nivo: četvrtina skupa generisanja i jedan bazni plan po zoni (v. gore), pa su i pragovi manji.
        expect(Object.keys(gen).length).toBeGreaterThan(FULL ? 100 : 50);
        expect(Object.keys(adapt).length).toBeGreaterThan(FULL ? 500 : 300);
      }
    } finally {
      globalThis.Date = RealDate;
      process.env['TZ'] = tz;
      vi.restoreAllMocks();
    }
  });

  afterEach(() => vi.restoreAllMocks());
});
