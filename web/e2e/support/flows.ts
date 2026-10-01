import { expect, type Page } from '@playwright/test';

/* Ponovljivi koraci koje koriste više tokova. Sve ide kroz PRAVI interfejs (čarobnjak), ne kroz upis u skladište: plan koji test koristi je onaj koji
   aplikacija zaista pravi. */

export interface PlanInput {
  dist: string;
  raceDate: string;
  pbDist: string;
  pbMin: string;
  pbSec: string;
  weeklyKm: string;
  goal?: { min: string; sec: string };
}
export const TEN_K: PlanInput = {
  dist: '10K',
  raceDate: '2026-04-12',
  pbDist: '10 km',
  pbMin: '45',
  pbSec: '0',
  weeklyKm: '40',
  goal: { min: '42', sec: '0' }
};

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });

export async function runWizard(page: Page, input: PlanInput = TEN_K): Promise<void> {
  const wizard = page.getByRole('dialog', { name: 'Pravljenje plana' });
  await expect(wizard).toBeVisible();
  // 1. distanca i datum
  await group(page, 'Ciljna distanca')
    .getByRole('button', { name: input.dist, exact: true })
    .click();
  await page.getByLabel('Datum trke').fill(input.raceDate);
  await page.getByRole('button', { name: 'Dalje' }).click();
  // 2. poslednji rezultat
  await group(page, 'Distanca rezultata')
    .getByRole('button', { name: input.pbDist, exact: true })
    .click();
  await page.getByLabel('minuti').fill(input.pbMin);
  await page.getByLabel('sekunde').fill(input.pbSec);
  await expect(page.getByText('Tvoja forma')).toBeVisible();
  await page.getByRole('button', { name: 'Dalje' }).click();
  // 3. obim
  await page.getByLabel('Nedeljna kilometraža').fill(input.weeklyKm);
  await page.getByRole('button', { name: 'Dalje' }).click();
  // 4. cilj i izrada
  if (input.goal) {
    await page.getByLabel('minuti').fill(input.goal.min);
    await page.getByLabel('sekunde').fill(input.goal.sec);
  }
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(wizard).toBeHidden();
}

/** Prijavljen korisnik bez plana → čarobnjak → plan. Vraća se kad je ekran „Danas" prikazan. */
export async function createPlan(page: Page, input: PlanInput = TEN_K, url = '/'): Promise<void> {
  await page.goto(url);
  await runWizard(page, input);
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
}

export const tab = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('button', { name });

/** Podešavanja → grupa → sekcija otvorena (sekcija koja „čeka" ume da bude otvorena sama, pa se ne sme slepo kliknuti). */
export async function openSetting(page: Page, group: string, section: string): Promise<void> {
  const sheet = page.getByRole('dialog');
  if (!(await sheet.isVisible())) await page.getByRole('button', { name: 'Podešavanja' }).click();
  await page.getByRole('tab', { name: group }).click();
  const card = page.locator(`details[data-k="${section}"]`);
  await expect(card).toBeVisible();
  if ((await card.getAttribute('open')) === null) await card.locator('> summary').click();
  await expect(card).toHaveAttribute('open', '');
}
