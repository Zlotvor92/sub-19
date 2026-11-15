import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { createPlan, tab } from './support/flows';

/* Tokovi 2–4: prvi start sa nalogom, čarobnjak, pravljenje plana, ekran „Danas". */

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
});

test('prijavljen korisnik bez plana odmah dobija čarobnjaka (nema ekrana iza koga bi mogao da ga zatvori)', async ({
  page
}) => {
  await installBackend(page);
  await page.goto('/');
  const wizard = page.getByRole('dialog', { name: 'Pravljenje plana' });
  await expect(wizard).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Za koju trku se spremaš?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Otkaži' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dalje' })).toBeDisabled(); // bez datuma trke
});

test('pravljenje plana: završava na „Danas", plan ima nedelje do trke, a stanje stiže na server', async ({
  page
}) => {
  const backend = await installBackend(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createPlan(page);
  await expect(tab(page, 'Danas')).toHaveAttribute('aria-current', 'page');
  // Danas: prvi trening je planiran za danas
  await expect(page.getByRole('button', { name: 'Završi trening' })).toBeVisible();
  // Plan (v2): 83 dana do trke 7. aprila, nedelja 1 od 12
  await tab(page, 'Plan').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Nedelja 1 od 12' })).toBeVisible();
  await expect(page.getByText(/za 83 dana/)).toBeVisible();
  await page.getByRole('button', { name: 'Pregled celog plana' }).click();
  await expect(page.getByText('Nedeljna kilometraža')).toBeVisible();
  // server je dobio stanje sa generisanim planom
  await expect
    .poll(() => (backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan != null)
    .toBe(true);
  const saved = backend.row?.data as {
    genPlan?: { weeks?: unknown[]; meta?: { raceDistM?: number; policyId?: string } };
  };
  // V1b: plan v2 (bez `ulaz` čarobnjaka v1), oznaka politike v2.
  expect(saved.genPlan?.meta?.raceDistM).toBe(10000);
  expect(saved.genPlan?.meta?.policyId).toBe('10k-v2');
  expect((saved.genPlan?.weeks ?? []).length).toBe(12);
  expect(errors).toEqual([]);
});

test('plan preživljava ponovno učitavanje: čarobnjak se ne vraća', async ({ page }) => {
  await installBackend(page);
  await createPlan(page);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toHaveCount(0);
});
