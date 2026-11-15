import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import { createPlan, openProgress } from './support/flows';

/* Tokovi 8–9: bol i masa (Napredak → Bol, Telesna masa) i forma (Napredak → Forma i predikcija: test na 3 km, VDOT). */

let backend: Backend;
test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  await createPlan(page);
});

const state = (): Record<string, unknown> => (backend.row?.data ?? {}) as Record<string, unknown>;
const list = (k: string): unknown[] => (Array.isArray(state()[k]) ? (state()[k] as unknown[]) : []);

test('bol i masa: prazno stanje, unos bola, pa masa — sve stiže na server i preživljava ponovno učitavanje', async ({
  page
}) => {
  await openProgress(page, /^Bol/);
  await expect(page.getByText('Dodirni deo koji te boli')).toBeVisible();
  await expect(page.getByText('Nema unosa.').first()).toBeVisible();

  // bol: 4/10 na listi
  await page.getByRole('button', { name: 'Dodaj unos bola' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel(/Bol \(0–10\)/).fill('4');
  await sheet.getByLabel('Beleška').fill('Zategnuto posle tempa');
  await sheet.getByRole('button', { name: 'Dodaj', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect.poll(() => list('knee').length).toBe(1);
  expect(list('knee')[0]).toMatchObject({ pain: 4, note: 'Zategnuto posle tempa' });
  await expect(page.getByText('Zategnuto posle tempa').first()).toBeVisible(); // unos je u istoriji
  await expect(page.getByText('Nema unosa.')).toHaveCount(0);

  // masa
  await page.getByRole('button', { name: 'Nazad', exact: true }).click();
  await openProgress(page, /^Telesna masa/);
  await page.getByLabel('Masa (kg)').fill('80,5');
  await page.getByRole('button', { name: 'Sačuvaj merenje' }).click();
  await expect.poll(() => list('kg').length).toBe(1);
  expect(list('kg')[0]).toMatchObject({ kg: 80.5 });
  await expect(page.getByText('Još nema merenja — unesi prvo merenje ispod.')).toHaveCount(0);

  await page.reload();
  await openProgress(page, /^Bol/);
  await expect(page.getByText('Zategnuto posle tempa').first()).toBeVisible();
});

test('masa: nemoguć unos se odbija sa porukom i ništa se ne upisuje', async ({ page }) => {
  await openProgress(page, /^Telesna masa/);
  await page.getByLabel('Masa (kg)').fill('5');
  await page.getByRole('button', { name: 'Sačuvaj merenje' }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  expect(list('kg')).toHaveLength(0);
});

test('forma: nemoguće vreme testa se odbija sa porukom', async ({ page }) => {
  await openProgress(page, /^Forma i predikcija/);
  await page.getByRole('button', { name: 'Unesi test na 3 km' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Vreme').fill('2:00');
  await sheet.getByRole('button', { name: 'Sačuvaj' }).click();
  await expect(sheet.getByRole('status')).not.toBeEmpty();
  await expect(sheet).toBeVisible();
  expect(list('t3k')).toHaveLength(0);
});
