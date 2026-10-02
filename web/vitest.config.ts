import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

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
          testTimeout: 120_000
        }
      },
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
