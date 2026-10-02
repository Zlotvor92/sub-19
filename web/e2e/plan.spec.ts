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

test('čarobnjak: pregleda korake, razlog se vidi odmah, a prekratak rok se odbija pri izradi sa porukom na prvom koraku', async ({
  page
}) => {
  await installBackend(page);
  await page.goto('/');
  await page
    .getByRole('group', { name: 'Ciljna distanca' })
    .getByRole('button', { name: '10K', exact: true })
    .click();
  await page.getByLabel('Datum trke').fill('2026-01-20'); // 6 dana — premalo za 10K
  await expect(page.getByText(/traži najmanje/)).toBeVisible();
  await page.getByLabel('Datum trke').fill('2026-04-12');
  await expect(page.getByText(/dovoljno za pun ciklus pripreme/)).toBeVisible();
  await page.getByRole('button', { name: 'Dalje' }).click();
  await expect(page.getByRole('heading', { name: 'Šta si poslednje istrčao?' })).toBeVisible();
  // rezultat koji nije moguć za izabranu distancu: razlog stoji na ekranu, „Dalje" je zaključano
  await page
    .getByRole('group', { name: 'Distanca rezultata' })
    .getByRole('button', { name: '10 km', exact: true })
    .click();
  await page.getByLabel('minuti').fill('3');
  await page.getByLabel('sekunde').fill('0');
  await expect(page.getByText('Proveri uneto vreme')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dalje' })).toBeDisabled();
  await page.getByLabel('minuti').fill('45');
  await expect(page.getByText('Tvoja forma')).toBeVisible();
  await page.getByRole('button', { name: 'Dalje' }).click();
  await expect(page.getByRole('heading', { name: 'Koliko trčiš nedeljno?' })).toBeVisible();
  await page.getByRole('button', { name: 'Nazad' }).click();
  await expect(page.getByRole('heading', { name: 'Šta si poslednje istrčao?' })).toBeVisible();
  // prekratak rok: generator odbija, čarobnjak se vraća na prvi korak i kaže zašto
  await page.getByRole('button', { name: 'Nazad' }).click();
  await page.getByLabel('Datum trke').fill('2026-01-20');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('40');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('heading', { name: 'Za koju trku se spremaš?' })).toBeVisible();
  await expect(page.locator('#ob-err-1')).not.toBeEmpty();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
});

test('pravljenje plana: završava na „Danas", plan ima nedelje do trke, a stanje stiže na server', async ({
  page
}) => {
  const backend = await installBackend(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await createPlan(page);
  await expect(tab(page, 'Danas')).toHaveAttribute('aria-current', 'page');
  // Danas: 88 dana do trke 12. aprila, prvi trening je planiran za danas
  await expect(page.locator('#h-sub')).toHaveText('N1/13 · BAZA · 88 d');
  await expect(page.getByRole('button', { name: 'Završi trening' })).toBeVisible();
  await tab(page, 'Plan').click();
  await expect(page.getByText('NEDELJNA KILOMETRAŽA')).toBeVisible();
  await expect(page.getByText('OSTALO · 13 NEDELJA')).toBeVisible();
  // server je dobio stanje sa generisanim planom
  await expect
    .poll(() => (backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan != null)
    .toBe(true);
  const saved = backend.row?.data as {
    genPlan?: { weeks?: unknown[]; ulaz?: { raceDistM?: number } };
  };
  expect(saved.genPlan?.ulaz?.raceDistM).toBe(10000);
  expect((saved.genPlan?.weeks ?? []).length).toBeGreaterThanOrEqual(13);
  expect(errors).toEqual([]);
});

test('plan preživljava ponovno učitavanje: čarobnjak se ne vraća', async ({ page }) => {
  await installBackend(page);
  await createPlan(page);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toHaveCount(0);
});
