import { describe, it } from 'vitest';
import { PARTS, orderCheck } from '@/test/fiveK/runtimeIsolation';

/* PUN NIVO, izolacija u izvršavanju (v. `runtimeIsolation.node.test.ts`): provera 2–3 (redosled) nad adaptacijom DRUGOG
   baznog plana svake distance (deo B1); prvi je u `runtimeIsolation.order1`, generisanje (deo G) u glavnom fajlu. */

describe('izolacija generatora u izvršavanju', () => {
  it(
    'različit redosled, isprepletano i ponovljeno izvršavanje daju isti rezultat (adaptacija, bazni plan 2)',
    { timeout: 900_000 },
    () => {
      orderCheck(PARTS.B1);
    }
  );
});
