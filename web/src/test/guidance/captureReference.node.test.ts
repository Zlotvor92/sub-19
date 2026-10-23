import { describe, expect, it } from 'vitest';
import { loadGuidanceReference } from './reference';

/* Referenca je snimljena JEDNOM, iz aplikacionog koda pre prenosa u generatore (commit `ae6b43a`), sa ovim harnesom
   (`scenarios.ts`) i API-jem sastavljenim od tada postojećih modula: `domain/recovery/proposal` (`injuryProposal`,
   `applyInjuryProposal`, `runWalkForPain`), `domain/activities/realign` (`realignPlan`), `domain/watch/icuWorkouts`
   (`workoutsForWatch`, `thresholdPace`, `dayWorkoutText`, `sessionFromDescription`), `domain/weather` (`weatherCard`,
   `targetPace`, `heatFor`, `heatAdvice`, `heatAdjustedPace`), `domain/plan/describe` (`rpeTarget`),
   `training/vdot/paceForZone` i `domain/onboarding.formPreview`, pod `TZ=UTC`. Ti moduli posle prenosa ne postoje, pa se
   ponovno snimanje radi u worktree-ju na `ae6b43a` (kopirati `src/test/guidance/*` i `src/test/fiveK/*`). Ovaj test
   samo proverava da referenca postoji i nosi taj commit; poređenje je `domain/generators/guidance.node.test.ts`. */
describe('referenca zajedničke trenerske logike (pre prenosa u generatore)', () => {
  it('postoji i nosi polazni commit', () => {
    const ref = loadGuidanceReference();
    expect(ref?.baselineSha).toBe('ae6b43a');
    expect(ref?.tz).toBe('UTC');
    expect(Object.keys(ref?.flows ?? {}).length).toBe(14744);
    expect(Object.keys(ref?.formPreview ?? {}).length).toBe(30);
  });
});
