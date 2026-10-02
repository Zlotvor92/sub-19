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
          exclude: ['src/**/*.oracle.test.ts']
        }
      },
      {
        /* ORACLE: poredi novi kod sa STARIM (../test/harness.mjs, node:vm).
           Živi do Phase 12 — kad se app.js obriše, brišu se i ovi testovi. */
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
