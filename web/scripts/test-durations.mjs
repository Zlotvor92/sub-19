/* TABELA TRAJANJA TEST FAJLOVA za `scripts/testSequencer.ts` (docs/testing/TEST-SPEED.md § 11) — vitest reporter.

   Osvežavanje (iz web/, pun nivo, svi projekti):
     TEST_FULL=1 TEST_V1=1 npx vitest run --reporter=default --reporter=./scripts/test-durations.mjs

   Na kraju pokretanja upisuje `scripts/test-durations.json`: putanja fajla (relativno na web/) → trajanje u sekundama
   (sakupljanje + testovi + `beforeAll`/`afterAll`). Fajl koji nije pokrenut zadržava staru vrednost; obrisan fajl ispada.
   Osvežiti kad se doda ili bitno promeni težak test (nov fajl do tada dobija `UNKNOWN_S`). Ne menja nijedan test. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = resolve(WEB, 'scripts/test-durations.json');

export default class TestDurationsReporter {
  seen = new Map();

  onTestModuleEnd(testModule) {
    const d = testModule.diagnostic();
    const key = relative(WEB, testModule.moduleId).split('\\').join('/');
    this.seen.set(key, Math.round((d.duration + d.collectDuration) / 100) / 10);
  }

  onTestRunEnd() {
    const table = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
    for (const [key, s] of this.seen) table[key] = s;
    const kept = Object.keys(table)
      .filter((key) => existsSync(resolve(WEB, key)))
      .sort();
    writeFileSync(
      OUT,
      `${JSON.stringify(Object.fromEntries(kept.map((key) => [key, table[key]])), null, 2)}\n`
    );
    console.log(`${OUT}: ${kept.length} fajlova (${this.seen.size} iz ovog pokretanja)`);
  }
}
