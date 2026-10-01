import { expect, test } from '@playwright/test';

/* Bez sesije aplikacija mora da pokaže kapiju za prijavu (nalog je obavezan), bez grešaka u konzoli i bez inline skripti
   (CSP u vercel.json je `script-src 'self'`). Mreža ka Supabase-u se ne dotiče dok nema sesije. */
test('bez sesije: kapija za prijavu, bez grešaka u konzoli i bez inline skripti', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Prijavi se da nastaviš' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prijavi se Google nalogom' })).toBeVisible();
  expect(await page.locator('script:not([src])').count()).toBe(0);
  expect(errors).toEqual([]);
});
