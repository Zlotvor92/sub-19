import { describe, it } from 'vitest';
import { PARTS, orderCheck } from '@/test/fiveK/runtimeIsolation';

/* PUN NIVO, izolacija u izvršavanju (v. `runtimeIsolation.node.test.ts`): provera 2–3 (redosled) nad adaptacijom PRVOG
   baznog plana svake distance (deo B0); drugi je u `runtimeIsolation.order2`, generisanje (deo G) u glavnom fajlu. */

describe('izolacija generatora u izvršavanju', () => {
  it(
    'različit redosled, isprepletano i ponovljeno izvršavanje daju isti rezultat (adaptacija, bazni plan 1)',
    { timeout: 900_000 },
    () => {
      orderCheck(PARTS.B0);
    }
  );
});
