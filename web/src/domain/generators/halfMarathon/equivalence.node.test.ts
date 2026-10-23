import { afterEach, describe, expect, it, vi } from 'vitest';
import { hmReference as reference, hmSetup as s } from '@/test/halfMarathon/equivalence';
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

/* POLUMARATON PRE/POSLE IZDVAJANJA. Referenca je uzeta iz STAROG zajedničkog mehanizma pre izdvajanja HM
   (`src/test/fixtures/halfMarathon-reference.json.gz`, v. `src/test/halfMarathon/captureReference.node.test.ts`; ponovo
   snimljena u čistom worktree-ju na izvornom `main` — bajt-identična). Poredi se tačan zapis celog izlaza
   (`src/test/fiveK/exact.ts`): nijedno polje nije izostavljeno i ništa se ne zaokružuje. Kategorije samo imenuju gde je
   razlika. Opciju „kraća distanca" (10K/5K) pravi izdvojeni generator te distance, predat kroz aplikacioni `handoff.ts`
   — isti put kao u produkciji (`select.ts`); ugovor je u `src/test/halfMarathon/equivalence.ts`.

   NIVOI (`src/test/level.ts`, `src/test/halfMarathon/equivalenceKit.ts`): brz nivo poredi deterministički uzorak (v.
   obrazloženje u `src/test/halfMarathon/equivalence.ts`); pun nivo (`TEST_FULL=1`) sve redove — ovde deo 1 adaptacije
   i vremenske zone i sve odluke, ostali delovi u `equivalence.<deo>.full.node.test.ts`. */

describe('HM izdvojen generator = stari mehanizam (polazno stanje)', () => {
  it('referenca postoji', () => {
    expect(reference?.baselineSha).toBe('90f2d0e5a21524ab408ba38060347f97e9843955');
    expect(reference?.crossCheckedSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
  });

  it('generisanje: svi HM ulazi daju identičan izlaz', { timeout: 600_000 }, () =>
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
    'odluke o pripremi (produženje, 10K/5K kroz predaju, povratni režim) su identične',
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
