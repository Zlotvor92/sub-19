import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { createPlan } from './support/flows';

/* List „Instaliraj" u pregledaču: jednom po kartici, zatvaranje drži i posle osvežavanja. Service worker je ovde blokiran, pa pregledač ne šalje
   `beforeinstallprompt` — Pixel 7 dobija uputstvo za meni pregledača (put „android"). */

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await installBackend(page);
  await createPlan(page);
});

test('otvaranje u pregledaču nudi instalaciju; posle „U redu" ne iskače do nove kartice', async ({
  page
}) => {
  await page.evaluate(() => sessionStorage.removeItem('sub20-instaliraj'));
  await page.reload();
  const sheet = page.getByRole('dialog', { name: 'Instaliraj sub20' });
  await expect(sheet).toBeVisible({ timeout: 10_000 });
  await expect(sheet.getByText('Instaliraj aplikaciju')).toBeVisible();
  await sheet.getByRole('button', { name: 'U redu' }).click();
  await expect(sheet).toBeHidden();

  await page.reload();
  await page.waitForTimeout(7_000);
  await expect(page.getByRole('dialog', { name: 'Instaliraj sub20' })).toBeHidden();
});
