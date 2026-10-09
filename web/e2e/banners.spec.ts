import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { createPlan, openDetails, tab } from './support/flows';

/* Sistemske trake (oštećen zapis, sukob, nova verzija) traže odluku: moraju da se vide i da se mogu pritisnuti u svakom stanju, i dok je čarobnjak jedini ekran. */

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await installBackend(page);
});

test('oštećen lokalni zapis: traka „Skini spašeno“ / „Uzmi sa servera“ je iznad čarobnjaka i može da se pritisne', async ({
  page
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('__e2e_corrupt')) {
      sessionStorage.setItem('__e2e_corrupt', '1');
      localStorage.setItem('sub19-v1:account:u-e2e', '{"v":11,"log":{');
    }
  });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  const alert = page.getByRole('alert').filter({ hasText: 'Sačuvani podaci se ne mogu pročitati' });
  await expect(alert).toBeVisible();
  const download = page.getByRole('button', { name: 'Skini spašeno' });
  await expect(download).toBeVisible();
  await download.click({ trial: true }); // nijedan element ga ne prekriva
  const server = page.getByRole('button', { name: 'Uzmi sa servera' });
  await server.click({ trial: true });
  // traka ne zaklanja dugmad čarobnjaka
  const next = page.getByRole('button', { name: 'Dalje' });
  const a = await alert.boundingBox();
  const b = await next.boundingBox();
  expect(a && b && a.y + a.height <= b.y + 1).toBe(true);
});

test('Escape zatvara ekran iznad taba; polje za unos ga ne zatvara', async ({ page }) => {
  await createPlan(page);
  await openDetails(page);
  await page.getByLabel(/Distanca \(km\)/).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Nazad', exact: true })).toBeVisible();
  await page.locator('h1:visible').first().focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Nazad', exact: true })).toHaveCount(0);
  await expect(tab(page, 'Danas')).toHaveAttribute('aria-current', 'page');
});

test('čarobnjak otvoren iz Prilagodi plan zatvara ekrane ispod njega (nijedan ekran ne ostaje u steku)', async ({
  page
}) => {
  await createPlan(page);
  await tab(page, 'Plan').click();
  await page.getByRole('button', { name: /^Prilagodi plan/ }).click();
  await page.getByRole('button', { name: /^Napravi novi plan/ }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  await expect(page.locator('.screen')).toHaveCount(0);
});
