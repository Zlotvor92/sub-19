import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { back, createPlan, logToday, openAdjust, openDetails, tab, TEN_K } from './support/flows';

interface ServerState {
  genPlan?: {
    planRevisions?: Array<{ id: string; reason: string; summary: string }>;
  };
  log?: Record<string, { status?: string; km?: number; sec?: number; [key: string]: unknown }>;
}

/** Real wizard and runner actions. Backend observations are read-only; no plan/log is injected. */
test('potvrđen povratak: pregled, primena i vraćanje verzije preživljavaju reload bez gubitka novog unosa', async ({
  page
}) => {
  await fixToday(page);
  await seedSession(page);
  const backend = await installBackend(page);
  const state = (): ServerState => backend.row?.data ?? {};
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createPlan(page, TEN_K);
  await openAdjust(page);

  await page.getByLabel('Šta želiš da prilagodiš?').selectOption('return');
  await page.getByLabel('Trajanje pauze').selectOption('14');
  await page.getByRole('checkbox', { name: /Potvrđujem da sam pravio navedenu pauzu/ }).check();
  await page.getByLabel('Ponovljiva baza pre pauze (km/ned)').fill('40');
  await page.getByLabel('Ponovljiva dužina pre pauze (km, opciono)').fill('12');
  await page.getByRole('button', { name: 'Pregledaj predlog', exact: true }).click();
  const preview = page.locator('#plan-change-preview');
  await expect(preview.getByRole('heading', { name: 'Pregled promene' })).toBeVisible();
  const table = preview.getByRole('table', { name: 'Preostali km pre i posle promene' });
  await expect(table).toBeVisible();
  await expect(preview.getByText(/kvalitetan rad .*→ 0,0 min/).first()).toBeVisible();
  await expect(preview.getByText(/zahtevni treninzi .*→ 0/).first()).toBeVisible();
  const firstWeek = table.locator('tbody tr').first();
  const beforeKm = Number((await firstWeek.locator('td').nth(0).innerText()).replace(',', '.'));
  const afterKm = Number((await firstWeek.locator('td').nth(1).innerText()).replace(',', '.'));
  expect(afterKm).toBeGreaterThan(0);
  expect(afterKm).toBeLessThan(beforeKm);
  expect(state().genPlan?.planRevisions ?? []).toHaveLength(0);

  await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect(
    page.getByText('Promena je primenjena. Prethodni plan je sačuvan u istoriji.')
  ).toBeVisible();
  await expect.poll(() => state().genPlan?.planRevisions?.length).toBe(1);
  expect(state().genPlan?.planRevisions?.[0]?.reason).toBe('execution');
  await page.reload();
  await openAdjust(page);
  await expect(page.getByRole('heading', { name: 'Prethodne verzije plana' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Pregledaj vraćanje:/ })).toHaveCount(1);

  // An actual entry made AFTER applying the return plan must survive restoring its predecessor.
  await back(page).click();
  await tab(page, 'Danas').click();
  await logToday(page, { km: '6,2', time: '3400' });
  await expect
    .poll(() =>
      Object.values(state().log ?? {}).some(
        (entry) => entry.status === 'done' && entry.km === 6.2 && entry.sec === 2040
      )
    )
    .toBe(true);
  const logBeforeRestore = structuredClone(state().log);
  await back(page).click();
  await openAdjust(page);
  await page.getByRole('button', { name: /^Pregledaj vraćanje:/ }).click();
  await expect(preview.getByRole('heading', { name: 'Pregled promene' })).toBeVisible();
  expect(state().genPlan?.planRevisions).toHaveLength(1);
  await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect.poll(() => state().genPlan?.planRevisions?.length).toBe(2);
  expect(state().genPlan?.planRevisions?.[1]?.reason).toBe('restore');
  expect(state().log).toEqual(logBeforeRestore);
  await page.reload();
  await tab(page, 'Danas').click();
  await expect(page.locator('#tcard[data-status="done"]')).toContainText('Odrađeno · 6,2 km');
  await openDetails(page);
  await expect(page.getByLabel(/Distanca \(km\)/)).toHaveValue('6,2');
  await expect(page.getByLabel(/^Vreme/)).toHaveValue('34:00');
  await back(page).click();
  await openAdjust(page);
  await expect(page.getByRole('button', { name: /^Pregledaj vraćanje:/ })).toHaveCount(2);
  expect(errors).toEqual([]);
});
