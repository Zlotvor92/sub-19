import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import { createPlan } from './support/flows';

/* Zajednica je UGAŠENA (`COMMUNITY_ENABLED = false`): nema taba, nema podešavanja, nema ni jednog poziva ka tabeli zajednice. Kod i servis ostaju iza
   prekidača (v. `app/community.test.ts` za ponašanje kad je uključena i za povlačenje ranijeg javnog reda pri pokretanju). */

let backend: Backend;

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  await createPlan(page);
});

test('traka tabova ima četiri ekrana, bez Zajednice; adresa ?tab=zajed pada na Danas', async ({
  page
}) => {
  const nav = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(nav.getByRole('button')).toHaveText(['Danas', 'Plan', 'Oporavak', 'Trka']);
  await expect(nav.getByRole('button', { name: 'Zajednica' })).toHaveCount(0);
  await page.goto('/?tab=zajed');
  await expect(page.getByRole('heading', { level: 1, name: 'Danas' })).toBeVisible();
  await expect(page.locator('#pg-zajed')).toHaveCount(0);
});

test('u podešavanjima nema Zajednice: ni sekcije, ni prekidača, ni nadimka', async ({ page }) => {
  await page.getByRole('button', { name: 'Podešavanja' }).click();
  const sheet = page.getByRole('dialog');
  await page.getByRole('tab', { name: 'App' }).click();
  await expect(sheet.locator('details[data-k="Obaveštenja"]')).toBeVisible();
  await expect(sheet.locator('details[data-k="Zajednica"]')).toHaveCount(0);
  await expect(sheet.getByText('Zajednica')).toHaveCount(0);
  await expect(page.locator('#zaj-tgl')).toHaveCount(0);
});

test('nijedan zahtev ne ide ka tabeli zajednice (ni čitanje, ni upis, ni brisanje)', async ({
  page
}) => {
  const nav = page.getByRole('navigation', { name: 'Glavna navigacija' });
  for (const name of ['Plan', 'Oporavak', 'Trka', 'Danas'])
    await nav.getByRole('button', { name: name }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Danas' })).toBeVisible();
  expect(backend.count('/rest/v1/zajednica')).toBe(0);
});
