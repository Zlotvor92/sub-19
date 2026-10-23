import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/* Ugao 6 (aplikacija): istraživački E2E. Isto kao web/playwright.config.ts, ali testDir = ovaj folder.
   Server (build + preview) se pokreće iz web/. Pokretanje iz web/:
   npx playwright test -c ../docs/generators-v2/audit/app/playwright.config.ts */
const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '../../../../web');
const executablePath =
  process.env['SUB20_CHROMIUM'] ?? (process.env['CI'] ? undefined : '/opt/pw-browsers/chromium');

export default defineConfig({
  testDir: here,
  testMatch: /.*\.spec\.ts/,
  outputDir: resolve(here, 'test-results'),
  fullyParallel: true,
  workers: 3,
  timeout: 120_000,
  reporter: [['list'], ['json', { outputFile: resolve(here, 'results.json') }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    ...devices['Pixel 7'],
    launchOptions: executablePath ? { executablePath } : {}
  },
  webServer: {
    command: 'npm run preview',
    cwd: web,
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000
  }
});
