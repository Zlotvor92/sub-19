/* Samo za merne skripte faze 3a (docs/generators-v2/handoff/*.measure.ts); nije deo npm test. Bez uvoza (konfiguracija
   je van web/, pa `vitest/config` nije dostupan iz ovog foldera). */
import { fileURLToPath } from 'node:url';

export default {
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['*.measure.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 3_600_000
  }
};
