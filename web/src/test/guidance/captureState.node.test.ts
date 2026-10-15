import { describe, expect, it } from 'vitest';
import { loadStateReference } from './stateReference';

/* Referenca stanja trkača je snimljena JEDNOM, iz aplikacionog koda pre prenosa u generatore (commit `5f56a52`, `TZ=UTC`),
   sa harnesom `stateScenarios.ts` i API-jem `{ ...domain/recovery, readinessModel, loadMeaning, wellnessSignals }`
   (`features/recovery/readiness.ts`). Ti moduli posle prenosa ne postoje u aplikaciji; ponovno snimanje se radi u
   worktree-ju na `5f56a52`. Poređenje: `domain/generators/guidance.node.test.ts`. */
describe('referenca stanja trkača (pre prenosa)', () => {
  it('postoji i nosi polazni commit', () => {
    const ref = loadStateReference();
    expect(ref?.baselineSha).toBe('5f56a52');
    expect(ref?.tz).toBe('UTC');
    expect(Object.keys(ref?.flows ?? {}).length).toBe(7380);
  });
});
