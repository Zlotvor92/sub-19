import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { selectRoutedApi, selectRoutedDecisions } from '@/test/generators';
import { FULL } from '@/test/level';
import { otherAdaptationBases } from '@/test/fiveK/otherScenarios';
import {
  compareOtherSelection,
  loadOtherReference,
  OTHER_FULL_PARTS,
  otherFastSelection,
  otherFullPart,
  rowsWithoutSingleBase
} from '@/test/fiveK/otherReference';
import {
  FIVE_K_GENERATOR,
  HALF_MARATHON_GENERATOR,
  HALF_MARATHON_PREPARATION,
  MARATHON_GENERATOR,
  MARATHON_PREPARATION,
  TEN_K_GENERATOR,
  generatorForDistance,
  generatorForPlan,
  generatorIdFor,
  preparationForPlan
} from './select';

/* 10K, POLUMARATON I MARATON POSLE IZDVAJANJA 5K. Referenca je uzeta iz starog koda na polaznom commitu, u zasebnom
   worktree-ju (`src/test/fiveK/captureOtherReference.node.test.ts`). Pozivi idu kroz aplikacioni izbor generatora — isti
   put kao u produkciji, pa 10K deo reference od segmenta 2/5 proverava izdvojeni 10K generator. Odluka o pripremi uključuje
   opcije „kraća distanca: 5K" i „kraća distanca: 10K", koje sada prave izdvojeni 5K i 10K generator (`handoff.ts`); i
   njihov rezultat mora biti identičan. Od segmenta 3/5 HM deo reference (generisanje, adaptacija i odluka o pripremi —
   `preparationForPlan`) proverava izdvojeni HM generator, a maratonska opcija „kraća distanca: polumaraton" ide HM
   generatoru kroz `handoff.ts`. Od segmenta 4/5 i maratonski deo reference (generisanje, adaptacija, odluka o pripremi)
   proverava izdvojeni maratonski generator; referenca nije menjana.

   NIVOI (`src/test/fiveK/otherReference.ts`): brz poredi uzorak po distanci i vrsti ulaza (sve odluke o pripremi); pun
   poredi sve redove — ovde generisanje, sve odluke i deo 1 adaptacije, ostali delovi adaptacije su u
   `otherDistances.adapt<n>.full.node.test.ts`. Ugovor generatora ide kroz `select.ts` (`selectRoutedApi`). */

const reference = loadOtherReference();

describe('izbor generatora', () => {
  /* Segment 2/5: 10K je izdvojen, pa 10000 više ne ide starom mehanizmu (ranije očekivanje 'legacy' je bilo pravilo
     izbora iz segmenta 1, ne trenerski rezultat). */
  /* Segment 3/5: polumaraton je izdvojen, pa 21097.5 više ne ide starom mehanizmu (pravilo izbora, ne trenerski rezultat). */
  /* Segment 4/5: maraton je izdvojen, pa 42195 više ne ide starom mehanizmu (pravilo izbora, ne trenerski rezultat). */
  /* Segment 5/5: stari mehanizam više nije rezerva. Distanca bez generatora daje `null` (aplikacija to prikazuje), nema
     plana → `null`; 5K/10K nemaju odluku o pripremi (`null`). */
  it('5K (i ulaz bez distance), 10K, HM i maraton idu izdvojenim generatorima; ostalo nema generator', () => {
    expect(generatorIdFor(5000)).toBe('5k');
    expect(generatorIdFor(undefined)).toBe('5k');
    expect(generatorIdFor(0)).toBe('5k');
    expect(generatorIdFor(10000)).toBe('10k');
    expect(generatorIdFor(21097.5)).toBe('hm');
    expect(generatorIdFor(42195)).toBe('marathon');
    for (const d of [7000, 10000.5, 21097, 21098, 42194, 42195.5])
      expect(generatorIdFor(d)).toBeNull();
    for (const d of [7000, 21097, 42194]) {
      expect(generatorForDistance(d)).toBeNull();
      expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: d } } as never)).toBeNull();
    }
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 10000 } } as never)).toBe(
      TEN_K_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], ulaz: { raceDistM: 10000 } })).toBe(
      TEN_K_GENERATOR
    );
    expect(generatorForPlan(null)).toBeNull();
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 5000 } } as never)).toBe(
      FIVE_K_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], ulaz: { raceDistM: 5000 } })).toBe(
      FIVE_K_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 21097.5 } } as never)).toBe(
      HALF_MARATHON_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], ulaz: { raceDistM: 21097.5 } })).toBe(
      HALF_MARATHON_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], meta: { raceDistM: 42195 } } as never)).toBe(
      MARATHON_GENERATOR
    );
    expect(generatorForPlan({ weeks: [], pred: [], ulaz: { raceDistM: 42195 } })).toBe(
      MARATHON_GENERATOR
    );
    // Odluka o pripremi: HM plan → HM generator, maraton → maratonski; 5K/10K je nemaju (null).
    expect(preparationForPlan({ weeks: [], pred: [], meta: { raceDistM: 21097.5 } } as never)).toBe(
      HALF_MARATHON_PREPARATION
    );
    expect(preparationForPlan({ weeks: [], pred: [], meta: { raceDistM: 42195 } } as never)).toBe(
      MARATHON_PREPARATION
    );
    for (const raceDistM of [10000, 5000])
      expect(preparationForPlan({ weeks: [], pred: [], meta: { raceDistM } } as never)).toBeNull();
    expect(preparationForPlan(null)).toBeNull();
  });
});

describe('10K/HM/maraton nepromenjeni (polazni commit; kroz izdvojene generatore)', () => {
  it('referenca postoji', () => {
    expect(reference?.baselineSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
  });

  it('generisanje, adaptacija i odluke o pripremi su identični', { timeout: 900_000 }, () => {
    // Delovi po baznim planovima su particija reference: svaki red adaptacije i odluke pripada tačno jednom baznom planu.
    const bases = otherAdaptationBases();
    expect(rowsWithoutSingleBase(reference!.adaptation, bases)).toEqual([]);
    expect(rowsWithoutSingleBase(reference!.decisions, bases)).toEqual([]);
    // Pun nivo: delovi 2…n adaptacije su zasebni fajlovi (unija delova = svi bazni planovi).
    const missing = Array.from(
      { length: OTHER_FULL_PARTS - 1 },
      (_, i) => `./otherDistances.adapt${i + 2}.full.node.test.ts`
    ).filter((f) => !existsSync(fileURLToPath(new URL(f, import.meta.url))));
    expect(missing).toEqual([]);
    const { now, diff } = compareOtherSelection(
      selectRoutedApi(),
      selectRoutedDecisions(),
      reference!,
      FULL ? otherFullPart(1) : otherFastSelection()
    );
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
    expect(
      Object.keys(now.decisions).some((k) => k.includes('"kind":"shorter","raceDistM":5000'))
    ).toBe(true);
    // Predaja „kraća distanca: 10K" iz HM/maratona ide izdvojenom 10K generatoru (`handoff.ts`).
    expect(
      Object.keys(now.decisions).filter((k) => k.includes('"kind":"shorter","raceDistM":10000'))
        .length
    ).toBeGreaterThan(10);
    // Maratonska opcija „kraća distanca: polumaraton" ide izdvojenom HM generatoru (`handoff.ts`).
    expect(
      Object.keys(now.decisions).filter((k) => k.includes('"kind":"shorter","raceDistM":21097.5'))
        .length
    ).toBeGreaterThan(0);
  });
});
