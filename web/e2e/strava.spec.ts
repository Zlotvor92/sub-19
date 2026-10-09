import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import { back, createPlan, openDetails, openTi, tab } from './support/flows';

/* Tok 14: povezivanje Strave (OAuth povratak sa proverom `state`), razmena koda preko našeg `/api/auth`, uvoz trčanja i njegov upis u plan. Strava i
   `/api/auth` su lažni (nema tajni); testira se ono što klijent radi, ne Stravin server. */

let backend: Backend;
test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  backend.api.set('/api/auth', (r) => {
    expect(r.url).toContain('code=KOD123');
    return {
      body: {
        access_token: 'AT',
        refresh_token: 'RT',
        expires_at: Math.floor(Date.now() / 1000) + 21_600,
        athlete: { firstname: 'Ana', lastname: 'Trkač' }
      }
    };
  });
  backend.api.set('https://www.strava.com/api/v3/athlete/activities', () => ({
    body: [
      {
        id: 111,
        name: 'Jutarnje trčanje',
        type: 'Run',
        sport_type: 'Run',
        start_date_local: '2026-01-14T07:10:00Z',
        distance: 8600,
        moving_time: 2553,
        average_heartrate: 152,
        total_elevation_gain: 21
      }
    ]
  }));
  backend.api.set('https://www.strava.com/api/v3/athlete/zones', () => ({ status: 404, body: {} }));
  backend.api.set('https://www.strava.com/api/v3/activities/', () => ({ status: 404, body: {} }));
});

/** Presreće prelazak na Stravu i vraća se na aplikaciju sa `code` i istim `state`-om (kao da je čovek odobrio). */
async function strava(page: Page, opts: { state?: string } = {}) {
  let authorize: URL | null = null;
  await page.route(/^https:\/\/www\.strava\.com\/oauth\/authorize/, async (route) => {
    authorize = new URL(route.request().url());
    const back = authorize.searchParams.get('redirect_uri') ?? '';
    const state = opts.state ?? authorize.searchParams.get('state') ?? '';
    await route.fulfill({
      status: 302,
      headers: { location: `${back}?code=KOD123&scope=read,activity:read_all&state=${state}` }
    });
  });
  return () => authorize;
}

test('povezivanje: odobrenje vraća na aplikaciju, kod se menja za tokene na NAŠEM serveru, trčanje se uvozi u današnji dan', async ({
  page
}) => {
  const authorize = await strava(page);
  await createPlan(page);
  await openTi(page, /^Povezani servisi/);
  await page.getByRole('button', { name: /^Strava/ }).click();
  await page.getByRole('button', { name: 'Poveži Stravu' }).click();

  // povratak: aplikacija radi sa `code`, adresa se čisti, a Strava je povezana
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
  await expect.poll(() => page.url()).not.toContain('code=');
  const url = authorize() as unknown as URL;
  expect(url.searchParams.get('client_id')).toBe('259960');
  expect(url.searchParams.get('scope')).toBe('activity:read_all');
  expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{16,}$/);
  await expect.poll(() => backend.count('/api/auth')).toBeGreaterThan(0);

  // trčanje je uvezeno u plan: „Danas" je odrađen sa podacima sa Strave
  await tab(page, 'Danas').click();
  await expect(page.locator('#tcard[data-status="done"]')).toContainText(
    'Odrađeno · 8,6 km · 42:33 · 4:57 /km',
    { timeout: 15_000 }
  );
  await openDetails(page);
  await expect(page.getByLabel(/Distanca \(km\)/)).toHaveValue('8,6');
  await expect(page.getByRole('status', { name: 'Pros. tempo' })).toHaveText('4:57 /km');
  await expect(page.getByText('sa Strave', { exact: true })).toBeVisible(); // poreklo unosa je vidljivo
  await back(page).click();
  // tokeni žive samo na uređaju: ne idu na server
  await expect
    .poll(() => (backend.row?.data as { log?: unknown } | undefined)?.log !== undefined)
    .toBe(true);
  expect(JSON.stringify(backend.row?.data ?? {})).not.toContain('"AT"');
  expect(JSON.stringify(backend.row?.data ?? {})).not.toContain('"RT"');
  // veza je vidljiva u Ti → Povezani servisi
  await openTi(page, /^Povezani servisi/);
  await expect(page.getByText(/Ana Trkač/).first()).toBeVisible();
});

test('povratak sa POGREŠNIM `state`-om se odbija (CSRF): nema razmene koda i nema veze', async ({
  page
}) => {
  const alerts: string[] = [];
  page.on('dialog', (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  await strava(page, { state: 'podmetnut' });
  await createPlan(page);
  await openTi(page, /^Povezani servisi/);
  await page.getByRole('button', { name: /^Strava/ }).click();
  await page.getByRole('button', { name: 'Poveži Stravu' }).click();
  await expect.poll(() => alerts.length).toBeGreaterThan(0);
  expect(alerts[0]).toMatch(/^Povezivanje odbijeno — bezbednosna provera nije prošla\./);
  expect(backend.count('/api/auth')).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('sub19-v1'))).not.toContain('"AT"');
});
