import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { createPlan } from './support/flows';

/* Dugme „Instaliraj" gore desno u pregledaču. Service worker je ovde blokiran, pa pregledač ne šalje `beforeinstallprompt` — Pixel 7 posle
   dodira dobija uputstvo za meni pregledača (put „android"). */

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await installBackend(page);
  await createPlan(page);
});

test('dugme stoji u gornjem redu taba odmah, bez ikakvog klika; dodir otvara uputstvo', async ({
  page
}) => {
  const btn = page.locator('.page.active .appbar').getByRole('button', { name: 'Instaliraj' });
  await expect(btn).toBeVisible();
  await btn.click();
  const sheet = page.getByRole('dialog', { name: 'Instaliraj sub20' });
  await expect(sheet.getByText('Instaliraj aplikaciju')).toBeVisible();
  await sheet.getByRole('button', { name: 'U redu' }).click();
  await expect(sheet).toBeHidden();
});
