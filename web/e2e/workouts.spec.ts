import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import { createPlan, tab } from './support/flows';

/* Tokovi 5–7: završi trening, pomeri trening, izmeni trening. Plan se pravi kroz čarobnjaka (v. support/flows). */

let backend: Backend;
test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  await createPlan(page);
});

const state = (): Record<string, Record<string, Record<string, unknown>>> =>
  (backend.row?.data ?? {}) as Record<string, Record<string, Record<string, unknown>>>;

test('završi trening: unos km i vremena računa prosečan tempo, sačuvan je lokalno i na serveru, preživljava ponovno učitavanje', async ({
  page
}) => {
  await page.getByRole('button', { name: 'Završi trening' }).click();
  await expect(page.locator('#tcard[data-status="done"] .focus-top .badge')).toHaveText('Odrađen');
  await page.getByLabel(/Distanca \(km\)/).fill('8,6');
  await page.getByLabel(/^Vreme/).fill('4233');
  await page.getByLabel('Pros. puls').fill('152');
  await page.getByLabel('Pros. puls').blur();
  // 42:33 na 8,6 km = 4:57/km
  await expect(page.getByRole('status', { name: 'Pros. tempo' })).toHaveText('4:57 /km');
  await expect.poll(() => Object.values(state()['log'] ?? {})[0]?.['km']).toBe(8.6);
  const entry = Object.values(state()['log'] ?? {})[0] ?? {};
  expect(entry).toMatchObject({ status: 'done', km: 8.6, sec: 2553, hr: 152 });
  await page.reload();
  await expect(page.getByLabel(/Distanca \(km\)/)).toHaveValue('8,6');
  await expect(page.locator('#tcard[data-status="done"] .focus-top .badge')).toHaveText('Odrađen');
});

test('preskoči trening, pa „Vrati": status se menja i nema unosa na „Danas"', async ({ page }) => {
  await page.getByRole('button', { name: 'Preskoči' }).click();
  await expect(page.getByText('Označi trening kao preskočen?')).toBeVisible();
  await page.getByRole('button', { name: 'Ne', exact: true }).click();
  await expect(page.locator('#tcard[data-status="skip"]')).toHaveCount(0); // „Ne" ne menja ništa
  await page.getByRole('button', { name: 'Preskoči' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await expect(page.locator('#tcard[data-status="skip"]')).toBeVisible();
  await page.getByRole('button', { name: 'Vrati' }).click();
  await expect(page.getByRole('button', { name: 'Završi trening' })).toBeVisible();
});

test('pomeri trening: zamena dva dana u nedelji, vidi se u planu, stiže na server, a „Vrati raspored" je poništava', async ({
  page
}) => {
  await tab(page, 'Plan').click();
  await page.getByRole('button', { name: 'Nedelja 2', exact: true }).click();
  await page.getByRole('button', { name: 'Pomeri treninge' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Dodirni dan koji hoćeš da pomeriš')).toBeVisible();
  const days = sheet.locator('.swap-list button.day');
  const before = await days.allInnerTexts();
  await days.nth(0).click();
  await expect(sheet.getByText(/Izabrano:/)).toBeVisible();
  await days.nth(2).click();
  await expect(sheet.getByText(/pomeren sa/).first()).toBeVisible();
  const after = await days.allInnerTexts();
  expect(after).not.toEqual(before);
  await expect
    .poll(() => Object.keys((state()['moves'] as Record<string, unknown> | undefined) ?? {}).length)
    .toBeGreaterThan(0);
  await sheet.getByRole('button', { name: 'Vrati raspored nedelje na plan' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await expect(sheet.getByText(/pomeren sa/)).toHaveCount(0);
  await expect
    .poll(() => Object.keys((state()['moves'] as Record<string, unknown> | undefined) ?? {}).length)
    .toBe(0);
});

test('izmeni trening: promena kilometraže važi samo za taj dan, sa oznakom „izmenjen", i vraća se na plan', async ({
  page
}) => {
  await tab(page, 'Plan').click();
  await page.getByRole('button', { name: 'Nedelja 2', exact: true }).click();
  const firstRun = page.locator('.pl-body button.day[class*="t-"]:not(.t-rest)').first();
  await firstRun.click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /Izmeni trening/ }).click();
  await expect(sheet.getByText('Izmeni trening').first()).toBeVisible();
  await sheet.getByLabel('Kilometraža').fill('5');
  await sheet.getByRole('button', { name: 'Sačuvaj' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.pl-body button.day[class*="t-"]').first()).toContainText(/5 km/);
  await expect
    .poll(() => Object.keys((state()['alts'] as Record<string, unknown> | undefined) ?? {}).length)
    .toBe(1);
  // povratak na plan
  await page.locator('.pl-body button.day[class*="t-"]:not(.t-rest)').first().click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Izmeni trening/ })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Vrati na plan' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await expect
    .poll(() => Object.keys((state()['alts'] as Record<string, unknown> | undefined) ?? {}).length)
    .toBe(0);
});
