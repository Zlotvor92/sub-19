import { describe, expect, it } from 'vitest';
import { compareRows as compare, generatorApi } from '@/test/fiveK/reference';
import { TEN_K_ADAPTATION_PARTS, tenKAdaptationPart } from '@/test/tenK/equivalence';
import { loadTenKReference } from '@/test/tenK/reference';
import * as tenK from './index';

/* PUN NIVO (`TEST_FULL=1`), deo 3 adaptacije 10K: v. `equivalence.node.test.ts` i `src/test/tenK/equivalence.ts`. */

const PART = 3;
const api = generatorApi(tenK);
const reference = loadTenKReference();

describe('10K izdvojen generator = stari mehanizam (polazno stanje)', () => {
  it(
    `adaptacija: svi tokovi daju identičan izlaz i ne menjaju ulaze (deo ${PART}/${TEN_K_ADAPTATION_PARTS})`,
    { timeout: 600_000 },
    () => {
      const { rows, expected, orphans, events } = tenKAdaptationPart(
        api,
        reference!.adaptation,
        PART
      );
      expect(orphans).toEqual([]);
      expect(events).toBe(false);
      expect(Object.keys(rows).filter((k) => k.startsWith('event · ')).length).toBe(0);
      const diff = compare(rows, expected);
      expect(diff.length, diff.slice(0, 20).join('\n')).toBe(0);
      expect(Object.values(rows).every((r) => r.pure)).toBe(true);
    }
  );
});
