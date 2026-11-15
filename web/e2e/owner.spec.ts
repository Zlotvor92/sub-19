import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { openProgress, tab } from './support/flows';
import { installV4 } from './support/v4';

/* Ugrađeni lični plan vlasnika (nema generisanog plana): vlasnik odmah vidi svoj plan, ne čarobnjaka. Ostali idu pravo u čarobnjaka (v. plan.spec). */
const OWNER = '0403f8fb-a643-4d4e-843d-f71199a0d6f9';

test('vlasnik bez generisanog plana vidi ugrađeni plan (Bokeški polumaraton), ne čarobnjaka', async ({
  page
}) => {
  await fixToday(page, '2026-11-03T09:00:00');
  await seedSession(page, { email: 'vlasnik@sub20.test', userId: OWNER });
  await installBackend(page);
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toHaveCount(0);
  await tab(page, 'Plan').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Nedelja 1 od 6' })).toBeVisible();
  await expect(page.getByText(/Bokeški polumaraton · .* · za 40 dana/)).toBeVisible();
  await openProgress(page, /^Forma i predikcija/);
  await expect(
    page
      .locator('.screen')
      .getByText(/1:40:00/)
      .first()
  ).toBeVisible();
});

test('vlasnik: plan od 2.11. — nedelja 2 sa pragom 3×1600 m', async ({ page }) => {
  await fixToday(page, '2026-11-10T09:00:00');
  await seedSession(page, { email: 'vlasnik@sub20.test', userId: OWNER });
  await installBackend(page);
  await page.goto('/');
  await tab(page, 'Plan').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Nedelja 2 od 6' })).toBeVisible();
  await expect(page.getByText(/3×1600 m @ 4:40\/km/).first()).toBeVisible();
});

test('drugo puštanje: lični plan vlasnika prelazi u plan_v4 (zaštićen), prikaz isti kao pre', async ({
  page
}) => {
  await fixToday(page, '2026-11-10T09:00:00');
  await seedSession(page, { email: 'vlasnik@sub20.test', userId: OWNER });
  const backend = await installBackend(page);
  const v4 = installV4(backend, false);
  await page.goto('/');
  await tab(page, 'Plan').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Nedelja 2 od 6' })).toBeVisible();
  const rows = page.locator('.page.active .plan-row');
  await expect(rows.first()).toBeVisible();
  const before = await rows.allInnerTexts();

  v4.enabled = true;
  await page.reload();
  await expect.poll(() => v4.row?.rev ?? 0, { timeout: 15_000 }).toBe(1);
  expect((v4.row?.doc as unknown as { header: { protected: boolean } }).header.protected).toBe(
    true
  );
  await expect.poll(() => v4.events.map((e) => e.vrsta), { timeout: 15_000 }).toContain('preuzeto');
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toHaveCount(0);
  await tab(page, 'Plan').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Nedelja 2 od 6' })).toBeVisible();
  await expect(rows.first()).toBeVisible();
  expect(await rows.allInnerTexts()).toEqual(before);
  await page.reload();
  await expect
    .poll(() => backend.count('/rest/v1/plan_v4?', 'GET'), { timeout: 15_000 })
    .toBeGreaterThan(1);
  expect(v4.writes).toBe(1);
});
