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
  loadMarathonReference,
  marathonAdaptationRows,
  marathonDecisionRows,
  marathonGenerationRows,
  writeMarathonReference
} from './reference';
import type { MarathonApi } from './scenarios';

/* Snimanje maratonske reference je ručna, jednokratna radnja na polaznom stanju (pre izdvajanja maratona):
       CAPTURE_MARATHON_REFERENCE=<polazni SHA> npx vitest run --project node marathon/captureReference
   Bez promenljive test samo proverava da referenca postoji i da je uzeta na zabeleženom commitu. Opcije „kraća distanca"
   (polumaraton, 10K) stari mehanizam predaje izdvojenim HM/10K generatorima kroz `generators/handoff.ts` (od segmenata
   2–3); na izvornom `main` (`CROSS_CHECK_SHA`) iste opcije pravi sam stari mehanizam. */
const legacyMarathonApi: MarathonApi = {
  ...legacyApi,
  executionBasis,
  basisFromPlan,
  preparationDecision,
  buildPreparationChoice,
  isLimitedLongPreparation
};

describe('maratonska referenca (stari mehanizam)', () => {
  it('postoji i nosi polazni commit', { timeout: 3_600_000 }, () => {
    const baseline = process.env['CAPTURE_MARATHON_REFERENCE'];
    if (baseline)
      writeMarathonReference({
        baselineSha: baseline,
        ...(process.env['CROSS_CHECK_SHA']
          ? { crossCheckedSha: process.env['CROSS_CHECK_SHA'] }
          : {}),
        capturedWith:
          'legacyApi + preparationDecision (domain/training + domain/plan, pre izdvajanja maratona)',
        tz: process.env['TZ'] ?? '',
        generation: marathonGenerationRows(legacyMarathonApi),
        adaptation: marathonAdaptationRows(legacyMarathonApi),
        decisions: marathonDecisionRows(legacyMarathonApi)
      });
    const ref = loadMarathonReference();
    expect(ref).not.toBeNull();
    expect(ref?.baselineSha).toBe('ad464c01bb3fb3e146cd27939cbe17d8a8e442e8');
    expect(Object.keys(ref?.generation ?? {}).length).toBeGreaterThan(1500);
    expect(Object.keys(ref?.adaptation ?? {}).length).toBeGreaterThan(1000);
    expect(Object.keys(ref?.decisions ?? {}).length).toBeGreaterThan(50);
  });
});
