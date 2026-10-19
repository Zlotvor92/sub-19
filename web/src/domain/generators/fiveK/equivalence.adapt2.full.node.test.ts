import { describe, expect, it } from 'vitest';
import {
  ADAPTATION_PARTS,
  adaptationPart,
  compareRows as compare,
  generatorApi,
  loadReference
} from '@/test/fiveK/reference';
import * as fiveK from './index';

/* PUN NIVO (`TEST_FULL=1`), deo 2 adaptacije 5K: v. `equivalence.node.test.ts` i `adaptationSlice` u
   `src/test/fiveK/reference.ts`. */

const PART = 2;
const api = generatorApi(fiveK);
const reference = loadReference();

describe('5K izdvojen generator = stari mehanizam (polazni commit)', () => {
  it(
    `adaptacija: svi tokovi daju identičan izlaz i ne menjaju ulaze (deo ${PART}/${ADAPTATION_PARTS})`,
    { timeout: 600_000 },
    () => {
      const { rows, expected, orphans } = adaptationPart(api, reference!.adaptation, PART);
      expect(orphans).toEqual([]);
      const diff = compare(rows, expected);
      expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
      expect(Object.values(rows).every((r) => r.pure)).toBe(true);
    }
  );
});
