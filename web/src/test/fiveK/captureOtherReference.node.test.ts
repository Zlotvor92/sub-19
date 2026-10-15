import { describe, expect, it } from 'vitest';
import {
  basisFromPlan,
  buildPreparationChoice,
  isLimitedLongPreparation,
  preparationDecision
} from '@/domain/plan/preparationDecision';
import { legacyApi } from './legacyApi';
import { loadOtherReference, otherRows, writeOtherReference } from './otherReference';

/* Ručno, jednom, na polaznom commitu (u zasebnom worktree-ju):
       CAPTURE_OTHER_REFERENCE=<polazni SHA> npx vitest run --project node captureOtherReference */
describe('10K/HM/maraton referenca (stari mehanizam, polazni commit)', () => {
  it('postoji i nosi polazni commit', () => {
    const baseline = process.env['CAPTURE_OTHER_REFERENCE'];
    if (baseline)
      writeOtherReference({
        baselineSha: baseline,
        ...otherRows(legacyApi, {
          basisFromPlan,
          preparationDecision,
          buildPreparationChoice,
          isLimitedLongPreparation
        })
      });
    const ref = loadOtherReference();
    expect(ref?.baselineSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
    expect(Object.keys(ref?.generation ?? {}).length).toBeGreaterThan(1500);
  });
});
