import { defineConfig, devices } from '@playwright/test';

/* Preinstalirani Chromium (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1, bez `playwright install`).
   Putanja se može preglasati sa SUB20_CHROMIUM; bez nje se koristi Playwright-ov. */
const executablePath =
  process.env['SUB20_CHROMIUM'] ?? (process.env['CI'] ? undefined : '/opt/pw-browsers/chromium');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    /* Service worker presreće mrežu pre Playwright-a (`page.route` ga ne vidi), pa je podrazumevano ISKLJUČEN; specifikacije za PWA ga uključuju. */
    serviceWorkers: 'block',
    ...devices['Pixel 7'],
    launchOptions: executablePath ? { executablePath } : {}
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000
  }
});
