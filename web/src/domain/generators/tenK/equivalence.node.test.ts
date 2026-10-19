import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  categoryOfName,
  compareRows as compare,
  generatorApi,
  pickRows
} from '@/test/fiveK/reference';
import { FULL, logCompared, part, sample } from '@/test/level';
import { tenKAdaptationPart } from '@/test/tenK/equivalence';
import { loadTenKReference, tenKAdaptationRows, tenKGenerationRows } from '@/test/tenK/reference';
import { tenKAdaptationBases, tenKGenerationCases } from '@/test/tenK/scenarios';
import * as tenK from './index';

/* 10K PRE/POSLE IZDVAJANJA. Referenca je uzeta iz STAROG zajedničkog mehanizma pre izdvajanja 10K
   (`src/test/fixtures/tenK-reference.json.gz`, v. `src/test/tenK/captureReference.node.test.ts`; ponovo snimljena u čistom
   worktree-ju na izvornom `main` — bajt-identična). Poredi se tačan zapis celog izlaza (`src/test/fiveK/exact.ts`): nijedno
   polje nije izostavljeno i ništa se ne zaokružuje. Kategorije samo imenuju gde je razlika.

   NIVOI (src/test/level.ts): brz poredi deterministički uzorak (generisanje: svaki 5. unutar kategorije, qa i edge10k
   svi; adaptacija: v. `src/test/tenK/equivalence.ts`; vremenska zona: sve 4 zone, svaka svoj deo skupa). Pun
   (`TEST_FULL=1`) poredi sve: ovde generisanje, vremensku zonu i deo 1 adaptacije, a ostale delove
   `equivalence.adapt<N>.full.node.test.ts`. */

const api = generatorApi(tenK);
const reference = loadTenKReference();

describe('10K izdvojen generator = stari mehanizam (polazno stanje)', () => {
  it('referenca postoji', () => {
    expect(reference?.baselineSha).toBe('f745be0e3f11d0382ee62879dcd24c57e9175683');
    expect(reference?.crossCheckedSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
  });

  it('generisanje: svi 10K ulazi daju identičan izlaz', () => {
    const all = tenKGenerationCases().map((c) => c.name);
    // Svaki red reference ima svoj ulaz (bez ovoga brz nivo ne bi video ulaz koji nedostaje).
    const inputs = new Set(all);
    expect(Object.keys(reference!.generation).filter((n) => !inputs.has(n))).toEqual([]);
    const names = sample(all, 5, categoryOfName, (n) => /^(qa|edge10k) /.test(n));
    const picked = new Set(names);
    const expected = pickRows(reference!.generation, names);
    logCompared('tenK.generation', Object.keys(expected));
    const diff = compare(
      tenKGenerationRows(api, (n) => picked.has(n), reference!.generation),
      expected
    );
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
    expect(Object.keys(reference!.generation).length).toBeGreaterThan(1000);
  });

  it('adaptacija: svi tokovi daju identičan izlaz i ne menjaju ulaze', { timeout: 600_000 }, () => {
    const { rows, expected, orphans, events } = tenKAdaptationPart(api, reference!.adaptation, 1);
    expect(orphans).toEqual([]);
    expect(events).toBe(true);
    expect(Object.keys(rows).filter((k) => k.startsWith('event · ')).length).toBe(9);
    const diff = compare(rows, expected);
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
    expect(Object.values(rows).every((r) => r.pure)).toBe(true);
  });

  it('vremenska zona, sat i slučajnost ne utiču na rezultat', { timeout: 600_000 }, () => {
    const tz = process.env['TZ'];
    const RealDate = Date;
    /* Pun nivo: u svakoj zoni isti skup (qa, edge10k i otisak od 8 nedelja; prva 3 bazna plana adaptacije). Brz: zona i
       poredi i-ti od 4 dela istog skupa ulaza generisanja i i-ti (mod 3) od ista 3 bazna plana. */
    const genNames = tenKGenerationCases()
      .map((c) => c.name)
      .filter((n) => /^(edge10k|qa) /.test(n) || /· 8n$/.test(n));
    const firstBases = tenKAdaptationBases().slice(0, 3);
    try {
      // Domen ne sme da čita sat ni slučajnost: svaki takav poziv bi ovde pao.
      vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Math.random u 10K generatoru');
      });
      class NoClockDate extends RealDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) throw new Error('new Date() bez argumenta u 10K generatoru');
          super(...(args as [string]));
        }
        static override now(): number {
          throw new Error('Date.now u 10K generatoru');
        }
      }
      const zones = ['Pacific/Kiritimati', 'America/Los_Angeles', 'Asia/Kolkata', 'UTC'];
      for (const [i, zone] of zones.entries()) {
        const picked = new Set(FULL ? genNames : part(genNames, i + 1, zones.length));
        process.env['TZ'] = zone;
        globalThis.Date = NoClockDate as DateConstructor;
        const gen = tenKGenerationRows(api, (n) => picked.has(n), reference!.generation);
        const adapt = FULL
          ? tenKAdaptationRows(api, 3, reference!.adaptation)
          : tenKAdaptationRows(api, undefined, reference!.adaptation, {
              bases: [firstBases[i % firstBases.length]!],
              events: false
            });
        globalThis.Date = RealDate;
        logCompared('tenK.tz.generation', Object.keys(gen));
        logCompared('tenK.tz.adaptation', Object.keys(adapt));
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
