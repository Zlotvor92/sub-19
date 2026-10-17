import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { back, tab } from './support/flows';

/* SEGMENT 08a — 5K v2 iza prekidača kroz pravi interfejs: podešavanje `ui.generatorV2FiveK` je uključeno u lokalnom
   stanju naloga pre pokretanja (novi korisnik bez plana vidi samo čarobnjaka), pa čarobnjak 5K v2 → plan → Plan tab i dan
   iz strukture; drugi tok: odbijanje v2 (5 dana, početnik) kao poruka sa razlogom. */

const STATE_KEY = 'sub19-v1:account:u-e2e';

async function enableFiveKV2(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('__e2e_v2')) return;
    sessionStorage.setItem('__e2e_v2', '1');
    localStorage.setItem(
      key,
      JSON.stringify({
        v: 12,
        log: {},
        knee: [],
        kg: [],
        pred: {},
        predLock: {},
        vdotLog: [],
        t3k: [],
        vreme: null,
        moves: {},
        alts: {},
        genPlan: null,
        strava: null,
        wellness: {},
        icu: null,
        vanPlana: {},
        zajed: { vidljiv: false, nadimak: '' },
        ui: {
          firstRun: '2026-01-14',
          lastBackup: null,
          snooze: null,
          seenWeek: null,
          geo: null,
          satTreninga: null,
          novo: null,
          generatorV2FiveK: true
        }
      })
    );
  }, STATE_KEY);
}

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });

async function raceStep(page: Page): Promise<void> {
  const wizard = page.getByRole('dialog', { name: 'Pravljenje plana' });
  await expect(wizard).toBeVisible();
  await expect(async () => {
    await group(page, 'Ciljna distanca')
      .getByRole('button', { name: '5K', exact: true })
      .click({ timeout: 2000 });
    await page.getByLabel('Datum trke').fill('2026-04-12', { timeout: 2000 });
    await expect(page.getByText(/Plan 5K v2: 12 nedelja/)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Dalje' }).click();
}

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await enableFiveKV2(page);
});

test('5K v2: čarobnjak (4 dana, rezultat) → plan v2 → Plan tab i dan pokazuju strukturu', async ({
  page
}) => {
  const backend = await installBackend(page);
  await page.goto('/');
  await raceStep(page);
  // 2. rezultat
  await page.getByRole('button', { name: 'Imam rezultat' }).click();
  await page.getByLabel('minuti').fill('22');
  await page.getByLabel('sekunde').fill('30');
  await page.getByLabel('Datum rezultata').fill('2026-01-10');
  await page.getByRole('button', { name: 'Dalje' }).click();
  // 3. iskustvo i obim
  await page.getByLabel('Nedeljna kilometraža').fill('32');
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  // 4. dani i cilj
  const days = group(page, 'Dani trčanja');
  for (const d of ['Uto', 'Čet', 'Sub', 'Ned'])
    await days.getByRole('button', { name: d, exact: true }).click();
  await page.getByLabel('minuti').fill('21');
  await page.getByLabel('sekunde').fill('30');
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();

  // Plan v2 je sačuvan (i na serveru) sa oznakom politike v2.
  await expect
    .poll(() =>
      JSON.stringify((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null)
    )
    .toContain('"policyId":"5k-v2"');

  // Plan tab: ocena cilja doslovno iz v2 i struktura u redovima dana (rad sa tempom).
  await tab(page, 'Plan').click();
  const plan = page.locator('.page.active');
  await expect(plan.locator('#goal-assessment')).toContainText('Cilj:');
  await expect(plan.getByText(/× \d+ m @ \d:\d\d\/km/).first()).toBeVisible();

  // Dan: struktura iz plana v2 (zagrevanje, rad, hlađenje).
  await plan
    .getByRole('button', { name: /Repeticije|Intervali/ })
    .first()
    .click();
  await expect(back(page)).toBeVisible();
  const structure = page.getByRole('group', { name: 'Struktura treninga' });
  await expect(structure).toBeVisible();
  await expect(structure).toContainText(/Pre\s*[\d,]+ km @ \d:\d\d–\d:\d\d\/km\s*zagrevanje/);
  await expect(structure).toContainText(/Rad\s*\d+ × \d+ m\s*\d:\d\d\/km/);
  await expect(page.getByRole('img', { name: /^Profil treninga: \d+ × \d+ m @/ })).toBeVisible();

  // Prilagođavanje: eksplicitno „stiže uskoro".
  await back(page).click();
  await tab(page, 'Plan').click();
  await page
    .locator('.page.active')
    .getByRole('button', { name: /^Prilagodi plan/ })
    .click();
  await expect(page.getByText(/Prilagođavanje plana stiže uskoro/)).toBeVisible();
});

test('5K v2: odbijanje (5 dana, početnik) je poruka sa razlogom, plan se ne pravi', async ({
  page
}) => {
  const backend = await installBackend(page);
  await page.goto('/');
  await raceStep(page);
  await page.getByRole('button', { name: 'Nemam skoriji rezultat' }).click();
  await page.getByLabel('minuti').fill('6');
  await page.getByLabel('sekunde').fill('30');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('25');
  await page.getByRole('button', { name: 'Početnik' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  const days = group(page, 'Dani trčanja');
  for (const d of ['Pon', 'Uto', 'Sre', 'Pet', 'Sub'])
    await days.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  const notice = page.getByRole('status').filter({ hasText: 'Plan nije napravljen' });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Početnik: najviše 4 dana trčanja nedeljno; zadato 5.');
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  expect((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null).toBeNull();
});
