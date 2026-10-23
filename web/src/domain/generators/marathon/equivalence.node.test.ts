import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  adaptationBasesFor,
  checkAdaptation,
  checkAdaptationCoverage,
  checkDecisions,
  checkGeneration,
  checkTimezone,
  decisionBasesFor,
  expectPartFiles
} from '@/test/halfMarathon/equivalenceKit';
import { marathonReference as reference, marathonSetup as s } from '@/test/marathon/equivalence';

/* MARATON PRE/POSLE IZDVAJANJA. Referenca je uzeta iz STAROG zajedničkog mehanizma pre izdvajanja maratona
   (`src/test/fixtures/marathon-reference.json.gz`, v. `src/test/marathon/captureReference.node.test.ts`; ponovo
   snimljena u čistom worktree-ju na izvornom `main` — bajt-identična). Poredi se tačan zapis celog izlaza
   (`src/test/fiveK/exact.ts`): nijedno polje nije izostavljeno i ništa se ne zaokružuje. Kategorije samo imenuju gde je
   razlika. Opciju „kraća distanca" (polumaraton/10K) pravi izdvojeni generator te distance, predat kroz aplikacioni `handoff.ts`
   — isti put kao u produkciji (`select.ts`); ugovor je u `src/test/marathon/equivalence.ts`.

   NIVOI (`src/test/level.ts`, `src/test/halfMarathon/equivalenceKit.ts`): brz nivo poredi deterministički uzorak (v.
   obrazloženje u `src/test/marathon/equivalence.ts`); pun nivo (`TEST_FULL=1`) sve redove — ovde deo 1 adaptacije,
   odluka i vremenske zone, ostali delovi u `equivalence.<deo>.full.node.test.ts`. */

describe('maratonski izdvojen generator = stari mehanizam (polazno stanje)', () => {
  it('referenca postoji', () => {
    expect(reference?.baselineSha).toBe('ad464c01bb3fb3e146cd27939cbe17d8a8e442e8');
    expect(reference?.crossCheckedSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
  });

  it('generisanje: svi maratonski ulazi daju identičan izlaz', { timeout: 600_000 }, () =>
    checkGeneration(s)
  );

  it(
    'adaptacija: svi tokovi daju identičan izlaz i ne menjaju ulaze',
    { timeout: 1_200_000 },
    () => {
      expectPartFiles(import.meta.url, 'adapt', s.parts.adaptation);
      checkAdaptationCoverage(s);
      checkAdaptation(s, adaptationBasesFor(s, 1), true);
    }
  );

  it(
    'odluke o pripremi (produženje, polumaraton/10K kroz predaju, povratni režim) su identične',
    { timeout: 900_000 },
    () => {
      expectPartFiles(import.meta.url, 'decisions', s.parts.decisions);
      checkDecisions(s, decisionBasesFor(s, 1));
    }
  );

  it('vremenska zona, sat i slučajnost ne utiču na rezultat', { timeout: 900_000 }, () => {
    expectPartFiles(import.meta.url, 'tz', s.parts.timezone);
    checkTimezone(s, 1);
  });

  afterEach(() => vi.restoreAllMocks());
});
