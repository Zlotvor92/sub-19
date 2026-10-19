import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { createPlan } from './support/flows';

/* Dugme „Instaliraj" u pregledaču. Service worker je ovde blokiran, pa pregledač ne šalje `beforeinstallprompt` — Pixel 7 posle dodira
   dobija uputstvo za meni pregledača (put „android"). */

test.describe('u aplikaciji', () => {
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
});

test('ekran za prijavu (prvo što novi korisnik vidi): dugme stoji i pre prijave, koraci se otvaraju na samom ekranu', async ({
  page
}) => {
  await installBackend(page);
  await page.goto('/');
  const gate = page.getByRole('dialog', { name: 'Prijava' });
  await expect(gate.getByRole('heading', { name: 'Prijavi se da nastaviš' })).toBeVisible();
  await gate.getByRole('button', { name: 'Instaliraj' }).click();
  await expect(gate.getByText('Instaliraj aplikaciju')).toBeVisible();
  await expect(gate.getByRole('button', { name: 'Prijavi se Google nalogom' })).toBeVisible();
});
