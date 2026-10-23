import { describe, expect, it } from 'vitest';
import { selectRoutedApi, selectRoutedDecisions } from '@/test/generators';
import {
  compareOtherSelection,
  loadOtherReference,
  OTHER_FULL_PARTS,
  otherFullPart
} from '@/test/fiveK/otherReference';

/* PUN NIVO, deo 2/4 (`OTHER_FULL_PARTS`) adaptacije 10K/HM/maraton (v. `otherDistances.node.test.ts`, deo 1 + generisanje i
   odluke): tokovi adaptacije nad baznim planovima ovog dela (`otherFullPart`) = odgovarajući redovi reference. */
const PART = 2;

describe('10K/HM/maraton nepromenjeni (polazni commit; kroz izdvojene generatore)', () => {
  it(`adaptacija je identična (deo ${PART}/${OTHER_FULL_PARTS})`, { timeout: 900_000 }, () => {
    expect(PART).toBeLessThanOrEqual(OTHER_FULL_PARTS);
    const { diff } = compareOtherSelection(
      selectRoutedApi(),
      selectRoutedDecisions(),
      loadOtherReference()!,
      otherFullPart(PART)
    );
    expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
  });
});
