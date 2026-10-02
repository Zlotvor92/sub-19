import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import { createPlan, tab } from './support/flows';

/* Tokovi 8–9: pregled oporavka (bol, masa) i trke (test na 3 km, VDOT). */

let backend: Backend;
test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  await createPlan(page);
});

const state = (): Record<string, unknown> => (backend.row?.data ?? {}) as Record<string, unknown>;
const list = (k: string): unknown[] => (Array.isArray(state()[k]) ? (state()[k] as unknown[]) : []);

test('oporavak: prazno stanje, unos bola, pa masa — sve stiže na server i preživljava ponovno učitavanje', async ({
  page
}) => {
  await tab(page, 'Oporavak').click();
  await expect(page.getByText('Bez povreda')).toBeVisible();
  await expect(page.getByText('Nema unosa.').first()).toBeVisible();

  // bol: 4/10 na listi
  await page.getByRole('button', { name: '+ Dodaj unos bola' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel(/Bol \(0–10\)/).fill('4');
  await sheet.getByLabel('Beleška').fill('Zategnuto posle tempa');
  await sheet.getByRole('button', { name: 'Dodaj', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect.poll(() => list('knee').length).toBe(1);
  expect(list('knee')[0]).toMatchObject({ pain: 4, note: 'Zategnuto posle tempa' });
  await expect(page.getByText('Bez povreda')).toHaveCount(0); // stanje se promenilo

  // masa
  await page.getByLabel('Masa (kg)').fill('80,5');
  await page.getByRole('button', { name: 'Sačuvaj merenje' }).click();
  await expect.poll(() => list('kg').length).toBe(1);
  expect(list('kg')[0]).toMatchObject({ kg: 80.5 });
  await expect(page.getByText('Još nema merenja — unesi prvo ispod.')).toHaveCount(0);

  await page.reload();
  await tab(page, 'Oporavak').click();
  await expect(page.getByText('Zategnuto posle tempa').first()).toBeVisible();
});

test('masa: nemoguć unos se odbija sa porukom i ništa se ne upisuje', async ({ page }) => {
  await tab(page, 'Oporavak').click();
  await page.getByLabel('Masa (kg)').fill('5');
  await page.getByRole('button', { name: 'Sačuvaj merenje' }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  expect(list('kg')).toHaveLength(0);
});

test('trka: cilj i početni VDOT, test na 3 km pomera formu, može da se obriše', async ({
  page
}) => {
  await tab(page, 'Trka').click();
  await expect(page.getByText('42:00 · VDOT 49,1')).toBeVisible();
  await expect(page.getByText('Početni VDOT: 45,3')).toBeVisible();
  await page.getByRole('button', { name: 'Unesi test na 3 km' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Vreme').fill('11:42');
  await sheet.getByRole('button', { name: 'Sačuvaj' }).click();
  await expect(sheet).toBeHidden();
  await expect.poll(() => list('t3k').length).toBe(1);
  expect(list('t3k')[0]).toMatchObject({ sec: 702 });
  // test je u formi: „Zadnja" više nije prazna
  await expect(page.getByText('još nema unosa')).toHaveCount(0);
  // brisanje
  await page.getByRole('button', { name: /11:42/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Obriši test' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await expect.poll(() => list('t3k').length).toBe(0);
});

test('trka: nemoguće vreme testa se odbija sa porukom', async ({ page }) => {
  await tab(page, 'Trka').click();
  await page.getByRole('button', { name: 'Unesi test na 3 km' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Vreme').fill('2:00');
  await sheet.getByRole('button', { name: 'Sačuvaj' }).click();
  await expect(sheet.getByRole('status')).not.toBeEmpty();
  await expect(sheet).toBeVisible();
  expect(list('t3k')).toHaveLength(0);
});
