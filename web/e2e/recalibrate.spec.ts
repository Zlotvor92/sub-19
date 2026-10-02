import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import { createPlan, openSetting, tab } from './support/flows';

/* Preračunavanje plana prema formi (Podešavanja → Trening → Plan): kroz pravi interfejs, plan pravi čarobnjak, forma dolazi iz tri testa na 3 km. */

let backend: Backend;
test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  await createPlan(page);
});

interface ServerPlan {
  meta: Record<string, unknown>;
  weeks: Array<{ w: number; days: unknown[] }>;
}
const plan = (): ServerPlan =>
  ((backend.row?.data ?? {}) as { genPlan?: ServerPlan }).genPlan ?? { meta: {}, weeks: [] };

async function addTest(page: Page, time: string): Promise<void> {
  await page.getByRole('button', { name: /^(Unesi test na 3 km|Novi test)$/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Vreme').fill(time);
  await sheet.getByRole('button', { name: 'Sačuvaj' }).click();
  await expect(sheet).toBeHidden();
}

test('bez merenja forme: objašnjenje, plan se ne menja', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.accept();
  });
  await expect.poll(() => plan().weeks.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Podešavanja' }).click();
  await openSetting(page, 'Trening', 'Plan');
  await page.getByRole('button', { name: 'Preračunaj plan prema formi' }).click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toMatch(/bar 3 izmerena rezultata/);
  expect(plan().meta['recalWeek']).toBeUndefined();
});

test('tri brza testa: plan i forma se razilaze → preračunavanje; posle njega nema predloga tempa, a polazna forma ostaje', async ({
  page
}) => {
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.accept();
  });
  await expect.poll(() => plan().weeks.length).toBeGreaterThan(0); // plan je stigao na server
  await tab(page, 'Trka').click();
  const baseVdot = plan().meta['vdot0'] as number;
  for (const t of ['10:30', '10:25', '10:20']) await addTest(page, t);
  await expect(page.getByRole('button', { name: 'Prilagodi tempo' })).toBeVisible();

  await page.getByRole('button', { name: 'Podešavanja' }).click();
  await openSetting(page, 'Trening', 'Plan');
  await page.getByRole('button', { name: 'Preračunaj plan prema formi' }).click();
  await expect(page.getByText(/^Preračunati preostali plan prema izmerenoj formi\?/)).toBeVisible();
  await expect(page.getByText(/Nema vraćanja/)).toBeVisible();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toMatch(/^Plan preračunat\./);

  await expect.poll(() => plan().meta['recalWeek']).toBe(1);
  expect(plan().meta['vdotBase']).toBe(baseVdot);
  expect(plan().meta['vdot0']).not.toBe(baseVdot);

  await page.keyboard.press('Escape');
  await tab(page, 'Trka').click();
  await expect(page.getByRole('button', { name: 'Prilagodi tempo' })).toHaveCount(0);
  // ponovo: forma i plan se slažu
  await page.getByRole('button', { name: 'Podešavanja' }).click();
  await openSetting(page, 'Trening', 'Plan');
  await page.getByRole('button', { name: 'Preračunaj plan prema formi' }).click();
  await expect.poll(() => dialogs.length).toBe(2);
  expect(dialogs[1]).toMatch(/se slažu/);
});
