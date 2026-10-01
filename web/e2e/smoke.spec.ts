import { expect, test } from '@playwright/test';

test('ljuska se učitava i CSP-kompatibilna je (nema inline skripti)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('SUB-20');
  const inlineScripts = await page.locator('script:not([src])').count();
  expect(inlineScripts).toBe(0);
  expect(errors).toEqual([]);
});
