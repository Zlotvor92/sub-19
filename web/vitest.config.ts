import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';
import { DurationSequencer } from './scripts/testSequencer.ts';

// Recorded local-time fixtures were captured in UTC.
process.env['TZ'] = 'UTC';

/* Nivo testova (src/test/level.ts, docs/testing/TEST-SPEED.md): brz je podrazumevan; pun (`TEST_FULL=1` — `npm test`,
   `npm run check:full`, CI) poredi sve redove i uključuje delove velikih testova `*.full.node.test.ts`. */
const FULL = process.env['TEST_FULL'] === '1';
const FULL_ONLY = FULL ? [] : ['**/*.full.node.test.ts'];

/* V1 (TEST-SPEED.md § 12): poređenje zamrznutih v1 generatora (podrazumevani u produkciji) sa referencama starog koda.
   v1 kod se ne menja, a ovi fajlovi nose najveći deo punog nivoa, pa su izdvojeni u projekat `v1`: u brzom nivou
   isključen (osim `TEST_V1=1`), u punom uključen (osim `TEST_V1=0` — CI delovi; CI ga pokreće posebnim poslom kad se
   od poslednjeg zelenog run-a promeni nešto što v1 koristi). */
const V1 = process.env['TEST_V1'] === '1' || (FULL && process.env['TEST_V1'] !== '0');
const V1_REFERENCE = [
  'src/domain/generators/*/equivalence*.node.test.ts',
  'src/domain/generators/otherDistances*.node.test.ts',
  'src/domain/generators/runtimeIsolation*.node.test.ts',
  'src/domain/generators/personalPlan.node.test.ts',
  'src/domain/generators/guidance.node.test.ts',
  'src/domain/training/generator/generator.differential.node.test.ts',
  'src/domain/training/generator/generator.fingerprint.node.test.ts'
];

const alias = { '@': fileURLToPath(new URL('./src', import.meta.url)) };

/* Dva projekta, namerno:
   - `domain`  → okruženje `node`: domen ne sme ni slučajno da dobije DOM.
                 Test koji treba `document` pripada projektu `ui`.
   - `ui`      → `jsdom`: komponente, store-ovi, servisi sa DOM API-jem. */
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    /* Podela `--shard` i redosled po izmerenom trajanju fajla (scripts/testSequencer.ts, TEST-SPEED.md § 11). */
    sequence: { sequencer: DurationSequencer },
    projects: [
      {
        extends: true,
        test: {
          name: 'domain',
          environment: 'node',
          include: ['src/domain/**/*.test.ts'],
          exclude: ['src/**/*.oracle.test.ts', 'src/**/*.node.test.ts']
        }
      },
      {
        /* ORACLE (zamrznut): poredi novi kod sa odgovorima STAROG frontenda (APP_VERSION 282, commit b7afc41). Stari kod više ne postoji; njegovi odgovori
           su snimljeni u `src/test/legacy-recordings/` i `legacyOracle.ts` ih vraća istim redom (v. komentar u njemu). */
        extends: true,
        test: {
          name: 'oracle',
          environment: 'node',
          include: ['src/**/*.oracle.test.ts'],
          testTimeout: 120_000,
          hookTimeout: 120_000
        }
      },
      {
        /* NODE: kod koji se izvršava van pregledača (service worker u `node:vm` sandbox-u, skripte izgradnje). Treba Node API; ostatku NE. */
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/**/*.node.test.ts',
            'scripts/**/*.node.test.ts',
            'deploy/**/*.node.test.ts'
          ],
          /* `*.harness.node.test.ts`: zajednički kod glavnog fajla i delova punog nivoa (bez testova); ime *.test.ts ga
             čini test kodom za proveru izolacije i tsconfig. */
          exclude: [
            ...configDefaults.exclude,
            '**/*.harness.node.test.ts',
            ...FULL_ONLY,
            ...V1_REFERENCE
          ],
          testTimeout: 120_000
        }
      },
      ...(V1
        ? [
            {
              extends: true,
              test: {
                name: 'v1',
                environment: 'node',
                include: V1_REFERENCE,
                exclude: [...configDefaults.exclude, ...FULL_ONLY],
                testTimeout: 120_000
              }
            }
          ]
        : []),
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: [
            'src/domain/**',
            'src/**/*.oracle.test.ts',
            'src/**/*.node.test.ts',
            'node_modules/**'
          ],
          setupFiles: ['src/test/setup.ts']
        }
      }
    ]
  }
});
