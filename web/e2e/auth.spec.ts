import { expect, test } from '@playwright/test';
import { SUPABASE, fixToday, installBackend, jwt, seedSession } from './support/backend';
import { createPlan } from './support/flows';

/* Tokovi 1, 10, 11: prvi start bez naloga, prijava (povratak sa Google-a preko Supabase-a, sa proverom nonce-a), odjava. */

const hash = (email: string): string =>
  `#access_token=${jwt(email)}&refresh_token=RT&expires_in=3600&token_type=bearer`;

test.beforeEach(async ({ page }) => {
  await fixToday(page);
});

test('prvi start bez naloga: kapija sa jednim dugmetom, ništa se ne šalje na server, nema grešaka', async ({
  page
}) => {
  const backend = await installBackend(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Prijavi se da nastaviš' })).toBeVisible();
  await expect(page.getByText('Posle prijave aplikacija radi i bez interneta.')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toHaveCount(0);
  expect(backend.requests).toEqual([]);
  expect(errors).toEqual([]);
});

test('prijava: dugme vodi na Google preko Supabase-a, povratak sa ispravnim nonce-om otvara aplikaciju', async ({
  page
}) => {
  const backend = await installBackend(page);
  let authorize: URL | null = null;
  await page.route(`${SUPABASE}/auth/v1/authorize**`, async (route) => {
    authorize = new URL(route.request().url());
    const back = authorize.searchParams.get('redirect_to') ?? '';
    await route.fulfill({
      status: 302,
      headers: { location: `${back}${hash('trkac@sub20.test')}` }
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Prijavi se Google nalogom' }).click();
  // posle povratka: prijavljen, bez plana → čarobnjak
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  expect(authorize).not.toBeNull();
  const url = authorize as unknown as URL;
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('redirect_to')).toMatch(/\/\?sbn=[0-9a-f]{16,}$/);
  expect(url.searchParams.get('state')).toBeNull(); // `state` je Supabase-ov, nonce putuje kao `sbn`
  // tokeni su uklonjeni iz adrese, a sesija je upisana
  expect(page.url()).not.toContain('access_token');
  const stored = await page.evaluate(() => localStorage.getItem('sub19_sb'));
  expect(JSON.parse(stored ?? '{}')).toMatchObject({ email: 'trkac@sub20.test', refresh: 'RT' });
  expect(backend.count('/rest/v1/user_state', 'GET')).toBeGreaterThan(0);
});

test('prijava: povratak sa POGREŠNIM nonce-om se odbija (CSRF) — nema sesije, kapija ostaje', async ({
  page
}) => {
  await installBackend(page);
  await page.route(`${SUPABASE}/auth/v1/authorize**`, async (route) => {
    const origin = new URL(route.request().url()).searchParams.get('redirect_to') ?? '';
    const forged = origin.replace(/sbn=[^&]+/, 'sbn=lazni');
    await route.fulfill({
      status: 302,
      headers: { location: `${forged}${hash('napadac@sub20.test')}` }
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Prijavi se Google nalogom' }).click();
  await expect(page.getByRole('heading', { name: 'Prijavi se da nastaviš' })).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem('sub19_sb'));
  expect(JSON.parse(stored ?? '{}')).toMatchObject({ access: null, refresh: null, email: null });
});

test('odjava: kapija ostaje posle učitavanja, a plan se vraća istom nalogu i bez servera', async ({
  page
}) => {
  await seedSession(page);
  const backend = await installBackend(page);
  await createPlan(page);
  const ownerKey = 'sub19-v1:account:u-e2e';
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), ownerKey))
    .not.toBeNull();
  const savedPlan = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? '{}').genPlan,
    ownerKey
  );
  expect(savedPlan).toBeTruthy();
  await page.getByRole('button', { name: 'Podešavanja' }).click();
  await page.getByRole('tab', { name: 'Nalog' }).click();
  await page.locator('details[data-k="Nalog"] > summary').click();
  await page.getByRole('button', { name: 'Odjavi se' }).click();
  await expect(page.getByText('Odjaviti se? Podaci na ovom uređaju ostaju.')).toBeVisible();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prijavi se da nastaviš' })).toBeVisible();
  const left = await page.evaluate(() => localStorage.getItem('sub19_sb'));
  expect(JSON.parse(left ?? '{}')).toMatchObject({ access: null, refresh: null });
  // Odjava aktivira gosta; plan ostaje sačuvan samo u prostoru vlasnika.
  expect(await page.evaluate(() => localStorage.getItem('sub19-local-owner'))).toBe('__guest__');
  expect(await page.evaluate(() => localStorage.getItem('sub19-v1'))).toBeNull();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').genPlan, ownerKey)
  ).toEqual(savedPlan);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Prijavi se da nastaviš' })).toBeVisible();
  // Ponovna prijava vraća lokalni plan čak i kada cloud sync nije dostupan.
  backend.offline = true;
  await page.route(`${SUPABASE}/auth/v1/authorize**`, async (route) => {
    const back = new URL(route.request().url()).searchParams.get('redirect_to') ?? '';
    await route.fulfill({
      status: 302,
      headers: { location: `${back}${hash('e2e@sub20.test')}` }
    });
  });
  await page.getByRole('button', { name: 'Prijavi se Google nalogom' }).click();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('sub19-local-owner'))).toBe('u-e2e');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('sub19-v1') ?? '{}').genPlan)
  ).toEqual(savedPlan);
});
