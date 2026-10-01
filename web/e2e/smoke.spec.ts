import { expect, test } from '@playwright/test';

/* Bez sesije aplikacija mora da pokaže kapiju za prijavu (nalog je obavezan), bez grešaka u konzoli i bez inline skripti
   (CSP u vercel.json je `script-src 'self'`). Mreža ka Supabase-u se ne dotiče dok nema sesije. */
test('bez sesije: kapija za prijavu, bez grešaka u konzoli i bez inline skripti', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Prijavi se da nastaviš' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Prijavi se Google nalogom' })).toBeVisible();
  expect(await page.locator('script:not([src])').count()).toBe(0);
  expect(errors).toEqual([]);
});

/* Uvodni ekran: crta se IZ HTML-a (pre paketa aplikacije), hladan start ga drži ~1,5 s, dodir ga preskače, toplo pokretanje ga nema. */
test('uvodni ekran: hladan start ga prikazuje i sam se gasi; dodir ga preskače; osvežavanje ga ne ponavlja', async ({
  page
}) => {
  await page.goto('/');
  await expect(page.locator('#uvod')).toBeVisible();
  expect(await page.evaluate(() => document.body.classList.contains('uvod-radi'))).toBe(true);
  await expect(page.locator('#uvod')).toHaveCount(0, { timeout: 5000 });
  expect(await page.evaluate(() => document.body.classList.contains('uvod-radi'))).toBe(false);

  await page.reload(); // toplo: trag u sessionStorage
  await expect(page.locator('#uvod')).toHaveCount(0);

  const fresh = await page.context().newPage(); // nova kartica = prazan sessionStorage = hladan start
  await fresh.goto('/');
  await expect(fresh.locator('#uvod')).toBeVisible();
  await fresh.locator('#uvod').dispatchEvent('pointerdown');
  await expect(fresh.locator('#uvod')).toHaveCount(0, { timeout: 1500 }); // 0,24 s, ne 1,55 s
});
