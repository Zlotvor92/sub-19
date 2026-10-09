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
  // 1. distanca i datum. Aplikacija se pri pokretanju još usklađuje sa nalogom i može da ponovo iscrta čarobnjaka (unos tada nestaje): korak se ponavlja
  // dok „Dalje“ ne postane dostupno, umesto da test zavisi od toga ko je prvi stigao.
  await expect(async () => {
    await group(page, 'Ciljna distanca')
      .getByRole('button', { name: input.dist, exact: true })
      .click({ timeout: 2000 });
    await page.getByLabel('Datum trke').fill(input.raceDate, { timeout: 2000 });
    await expect(page.getByRole('button', { name: 'Dalje' })).toBeEnabled({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
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

export const tab = (page: Page, name: 'Danas' | 'Plan' | 'Napredak' | 'Ti') =>
  page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('button', { name });

/* NAVIGACIJA KROZ ISTI INTERFEJS KAO KORISNIK. Četiri taba; ekrani iznad taba (Detalji treninga, Prilagodi plan, Forma…) se otvaraju iz redova i zatvaraju
   dugmetom „Nazad“. Red je dugme čije ime počinje naslovom reda (podnaslov je deo imena). */

/** Dugme „Nazad“ na ekranu iznad taba. */
export const back = (page: Page) => page.getByRole('button', { name: 'Nazad', exact: true });

/** Tab → red u njemu: otvara ekran iznad taba i čeka da se pojavi „Nazad“. */
export async function openFrom(
  page: Page,
  name: Parameters<typeof tab>[1],
  row: RegExp
): Promise<void> {
  await tab(page, name).click();
  await page.locator('.page.active').getByRole('button', { name: row }).first().click();
  await expect(back(page)).toBeVisible();
}

/** Ti → red (profil, cilj, servisi, privatnost…). */
export const openTi = (page: Page, row: RegExp) => openFrom(page, 'Ti', row);
/** Napredak → red (Forma i predikcija, Oporavak, Bol, Telesna masa, Analiza trke). */
export const openProgress = (page: Page, row: RegExp) => openFrom(page, 'Napredak', row);
/** Plan → Prilagodi plan. */
export const openAdjust = (page: Page) => openFrom(page, 'Plan', /^Prilagodi plan/);

/** Danas → Detalji treninga (dana). */
export async function openDetails(page: Page): Promise<void> {
  await tab(page, 'Danas').click();
  await page.getByRole('button', { name: /^Detalji (treninga|dana)/ }).click();
  await expect(back(page)).toBeVisible();
}

/** Unos današnjeg trčanja: „Završi trening“ na Danas, pa Detalji treninga i polja (km, vreme, po želji puls). Ostaje na Detaljima. */
export async function logToday(
  page: Page,
  run: { km: string; time: string; hr?: string }
): Promise<void> {
  await page.getByRole('button', { name: 'Završi trening' }).click();
  await openDetails(page);
  await page.getByLabel(/Distanca \(km\)/).fill(run.km);
  await page.getByLabel(/^Vreme/).fill(run.time);
  if (run.hr) await page.getByLabel('Pros. puls').fill(run.hr);
  await page.getByLabel(/^Vreme/).blur();
}
