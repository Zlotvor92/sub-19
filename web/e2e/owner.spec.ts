import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { openProgress, tab } from './support/flows';

/* Ugrađeni lični plan vlasnika (nema generisanog plana): vlasnik odmah vidi svoj plan, ne čarobnjaka. Ostali idu pravo u čarobnjaka (v. plan.spec). */
const OWNER = '0403f8fb-a643-4d4e-843d-f71199a0d6f9';

test('vlasnik bez generisanog plana vidi ugrađeni plan (Bokeški polumaraton), ne čarobnjaka', async ({
  page
}) => {
  await fixToday(page, '2026-10-01T09:00:00');
  await seedSession(page, { email: 'vlasnik@sub20.test', userId: OWNER });
  await installBackend(page);
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toHaveCount(0);
  await tab(page, 'Plan').click();
  await expect(page.getByRole('heading', { level: 2, name: 'Nedelja 2 od 12' })).toBeVisible();
  await expect(page.getByText(/Bokeški polumaraton · .* · za 73 dana/)).toBeVisible();
  await openProgress(page, /^Forma i predikcija/);
  await expect(
    page
      .locator('.screen')
      .getByText(/1:35:00/)
      .first()
  ).toBeVisible();
});
