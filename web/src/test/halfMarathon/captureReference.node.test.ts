import { describe, expect, it } from 'vitest';
import { executionBasis } from '@/domain/plan/executionAdjustment';
import {
  basisFromPlan,
  buildPreparationChoice,
  isLimitedLongPreparation,
  preparationDecision
} from '@/domain/plan/preparationDecision';
import { legacyApi } from '@/test/fiveK/legacyApi';
import {
  hmAdaptationRows,
  hmDecisionRows,
  hmGenerationRows,
  loadHmReference,
  writeHmReference
} from './reference';
import type { HmApi } from './scenarios';

/* Snimanje HM reference je ručna, jednokratna radnja na polaznom stanju (pre izdvajanja HM):
       CAPTURE_HM_REFERENCE=<polazni SHA> npx vitest run --project node halfMarathon/captureReference
   Bez promenljive test samo proverava da referenca postoji i da je uzeta na zabeleženom commitu. */
const legacyHmApi: HmApi = {
  ...legacyApi,
  executionBasis,
  basisFromPlan,
  preparationDecision,
  buildPreparationChoice,
  isLimitedLongPreparation
};

describe('HM referenca (stari mehanizam)', () => {
  it('postoji i nosi polazni commit', { timeout: 1_800_000 }, () => {
    const baseline = process.env['CAPTURE_HM_REFERENCE'];
    if (baseline)
      writeHmReference({
        baselineSha: baseline,
        ...(process.env['CROSS_CHECK_SHA']
          ? { crossCheckedSha: process.env['CROSS_CHECK_SHA'] }
          : {}),
        capturedWith:
          'legacyApi + preparationDecision (domain/training + domain/plan, pre izdvajanja HM)',
        tz: process.env['TZ'] ?? '',
        generation: hmGenerationRows(legacyHmApi),
        adaptation: hmAdaptationRows(legacyHmApi),
        decisions: hmDecisionRows(legacyHmApi)
      });
    const ref = loadHmReference();
    expect(ref).not.toBeNull();
    expect(ref?.baselineSha).toBe('90f2d0e5a21524ab408ba38060347f97e9843955');
    expect(Object.keys(ref?.generation ?? {}).length).toBeGreaterThan(1500);
    expect(Object.keys(ref?.adaptation ?? {}).length).toBeGreaterThan(1000);
    expect(Object.keys(ref?.decisions ?? {}).length).toBeGreaterThan(50);
  });
});
