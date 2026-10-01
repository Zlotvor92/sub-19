import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import { createPlan, openSetting } from './support/flows';

/* Vreme: uključivanje lokacije (dozvola pregledača), prognoza direktno od Open-Meteo (koordinate zaokružene na ~1 km), kartica na „Danas", isključivanje briše lokaciju. */

test.use({
  geolocation: { latitude: 44.81234, longitude: 20.46789 },
  permissions: ['geolocation']
});

let backend: Backend;
const hours = (date: string, temp: number): Record<string, unknown> => {
  const time = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);
  return {
    hourly: {
      time,
      temperature_2m: time.map(() => temp),
      apparent_temperature: time.map(() => temp + 2),
      relative_humidity_2m: time.map(() => 55),
      wind_speed_10m: time.map(() => 9),
      precipitation_probability: time.map(() => 10)
    }
  };
};

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  backend.api.set('https://api.open-meteo.com/v1/forecast', () => ({
    body: hours('2026-01-14', 31)
  }));
  await createPlan(page);
});

test('uključivanje: zaokružene koordinate idu samo Open-Meteo, kartica pokazuje vrućinu, isključivanje briše lokaciju', async ({
  page
}) => {
  await expect(page.getByText('Vreme', { exact: true })).toHaveCount(0); // bez lokacije nema kartice
  await openSetting(page, 'Trening', 'Vreme');
  await page.getByRole('button', { name: 'Uključi lokaciju' }).click();
  await expect.poll(() => backend.count('open-meteo.com')).toBeGreaterThan(0);

  const call = backend.requests.find((r) => r.url.includes('open-meteo.com'));
  const q = new URL(call?.url ?? '').searchParams;
  expect(q.get('latitude')).toBe('44.81');
  expect(q.get('longitude')).toBe('20.47');
  // koordinate ne idu NA NAŠ server, ni u stanje koje se šalje na server
  expect(backend.requests.filter((r) => r.url.includes('/api/')).map((r) => r.url)).not.toEqual(
    expect.arrayContaining([expect.stringContaining('44.81')])
  );
  // koordinate (i keš prognoze koji ih nosi) ostaju NA UREĐAJU: u stanju koje ide na server ih nema
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('sub19-v1') ?? ''))
    .toContain('"geo":{"lat":44.81,"lon":20.47}');
  await expect.poll(() => backend.count('/rest/v1/user_state', 'POST')).toBeGreaterThan(1);
  const onServer = JSON.stringify(backend.row?.data ?? {});
  expect(onServer).not.toContain('44.81');
  expect(onServer).not.toContain('"vreme"');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  const card = page.locator('.card', { has: page.getByText('Vreme', { exact: true }) });
  await expect(card).toBeVisible();
  await expect(card).toContainText('31');

  // isključivanje: lokacija se briše sa uređaja
  await openSetting(page, 'Trening', 'Vreme');
  await page.getByRole('button', { name: /Isključi/ }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('sub19-v1') ?? ''))
    .not.toMatch(/"geo":\{/);
});

test('dozvola odbijena: poruka umesto pada, lokacija se ne pamti', async ({ page }) => {
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) =>
      fail?.({ code: 1, message: 'User denied Geolocation' } as GeolocationPositionError);
  });
  const alerts: string[] = [];
  page.on('dialog', (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  await openSetting(page, 'Trening', 'Vreme');
  await page.getByRole('button', { name: 'Uključi lokaciju' }).click();
  await expect.poll(() => alerts.length).toBe(1);
  expect(backend.count('open-meteo.com')).toBe(0);
});
