import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { createPlan, tab } from './support/flows';

test('ručna trka: zaseban AI zahtev i rezultat opstaju posle ponovnog učitavanja', async ({
  page
}) => {
  await fixToday(page);
  await seedSession(page);
  const backend = await installBackend(page);
  await createPlan(page);
  backend.api.set('/api/analyze', ({ body }) => {
    const b = body as { posao: string };
    return {
      body:
        b.posao === 'start'
          ? { posaoId: 'race-job' }
          : b.posao === 'citaj'
            ? { stanje: 'gotovo', tekst: 'Prvi polumaraton je završen uz kontrolisan napor.' }
            : {}
    };
  });
  await tab(page, 'Trka').click();
  const form = page.getByRole('region', { name: 'Analiza trke' });
  await form.getByLabel('Trčanje', { exact: true }).selectOption('manual');
  await form.getByLabel('Naziv trke').fill('Niški polumaraton');
  await form.getByLabel('Zvanična distanca (km)').fill('21.0975');
  await form.getByLabel('Namera nastupa').selectOption('first_distance');
  await form.getByLabel('Vreme trčanja', { exact: true }).fill('1:45:00');
  await form.getByLabel('Zvanično vreme (opciono)').fill('1:46:00');
  await form.getByRole('button', { name: 'Sačuvaj kontekst trke' }).click();
  await form.getByRole('button', { name: /Analiziraj trku/ }).click();
  await expect(form.getByText('Prvi polumaraton je završen uz kontrolisan napor.')).toBeVisible({
    timeout: 10000
  });
  const call = backend.requests.find(
    (r) => (r.body as Record<string, unknown>)?.['analysisType'] === 'race'
  );
  expect(call?.body).toMatchObject({
    race: {
      name: 'Niški polumaraton',
      distanceM: 21097.5,
      officialSec: 6360,
      intent: 'first_distance'
    },
    session: { tag: 'trka' }
  });
  await expect.poll(() => JSON.stringify(backend.row?.data)).toContain('raceAi');
  await page.reload();
  await tab(page, 'Trka').click();
  await expect(form.getByText('Prvi polumaraton je završen uz kontrolisan napor.')).toBeVisible();
});

for (const fallback of [false, true]) {
  test(`postojeći HM dobija svaki km iz ${fallback ? 'Strava splits fallback-a' : 'ICU streamova'} pre AI zahteva`, async ({
    page
  }) => {
    await fixToday(page);
    await seedSession(page);
    const backend = await installBackend(page);
    await createPlan(page);
    await tab(page, 'Trka').click();
    const form = page.getByRole('region', { name: 'Analiza trke' });
    await form.getByLabel('Trčanje', { exact: true }).selectOption('manual');
    await form.getByLabel('Naziv trke').fill('Niški polumaraton');
    await form.getByLabel('Zvanična distanca (km)').fill('21.0975');
    await form.getByLabel('Vreme trčanja', { exact: true }).fill('1:44:12');
    await form.getByLabel('Zvanično vreme (opciono)').fill('1:44:32');
    await form.getByRole('button', { name: 'Sačuvaj kontekst trke' }).click();
    // The manually entered official distance is close to the GPS distance;
    // the single-activity metadata must replace it for the GPS analysis only.
    await expect.poll(() => JSON.stringify(backend.row?.data)).toContain('raceAi');
    const points = Array.from({ length: 23 }, (_, i) => Math.min(i * 1000, 21500));
    const stream = {
      distance: { data: points },
      time: { data: points.map((d) => (d * 6252) / 21500) },
      heartrate: { data: points.map((_, i) => 150 + i) },
      moving: { data: points.map(() => true) }
    };
    backend.api.set('/api/icu', ({ body }) => {
      const b = body as { tokovi?: string[]; detalji?: string[] };
      if (b.tokovi)
        return fallback
          ? { status: 403, body: { error: 'Tokovi nisu dostupni.' } }
          : { body: { tokovi: { i42: stream } } };
      if (b.detalji)
        return {
          body: {
            detalji: {
              i42: { krugovi: [{ distM: 21500, sec: 6252, paceSec: 291, hr: 166 }], grupe: [] }
            }
          }
        };
      return {
        body: {
          treninzi: [
            { id: 'warmup', datum: '2026-01-14', tip: 'Run', km: 0.4, sec: 180, hr: 120 },
            {
              id: 'i42',
              datum: '2026-01-14',
              tip: 'Run',
              km: 21.5,
              sec: 6252,
              elapsedSec: 6272,
              hr: 166,
              maxHr: 186,
              zoneGranice: [140, 160, 180],
              zonePuls: [10, 400, 5842]
            }
          ]
        }
      };
    });
    backend.api.set('https://www.strava.com/api/v3/athlete/activities', () => ({
      body: [
        {
          id: 41,
          type: 'Run',
          start_date_local: '2026-01-14T08:45:00',
          distance: 400,
          moving_time: 180
        },
        {
          id: 42,
          type: 'Run',
          start_date_local: '2026-01-14T09:00:00',
          distance: 21500,
          moving_time: 6252
        }
      ]
    }));
    backend.api.set('https://www.strava.com/api/v3/activities/42', ({ url }) =>
      url.includes('/streams')
        ? { status: 403, body: { message: 'Unavailable' } }
        : {
            body: {
              id: 42,
              start_date_local: '2026-01-14T09:00:00',
              distance: 21500,
              moving_time: 6252,
              elapsed_time: 6272,
              average_heartrate: 166,
              splits_metric: points.slice(1).map((d, i) => ({
                distance: d - points[i],
                moving_time: ((d - points[i]) * 6252) / 21500,
                elapsed_time: ((d - points[i]) * 6272) / 21500,
                average_heartrate: 150 + i
              }))
            }
          }
    );
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('sub19-v1')!) as Record<string, unknown>;
      state['icu'] = {
        athleteId: 'i123',
        apiKey: 'fixture-key',
        trSync: Date.now(),
        autoDan: '2026-01-14'
      };
      state['strava'] = {
        access: 'fixture-access',
        refresh: 'fixture-refresh',
        expiresAt: Date.now() / 1000 + 7200,
        lastSync: Date.now()
      };
      localStorage.setItem('sub19-v1', JSON.stringify(state));
      localStorage.setItem('sub19-v1:account:u-e2e', JSON.stringify(state));
    });
    backend.api.set('/api/analyze', ({ body }) => ({
      body:
        (body as { posao: string }).posao === 'start'
          ? { posaoId: 'race-splits-job' }
          : (body as { posao: string }).posao === 'citaj'
            ? { stanje: 'gotovo', tekst: 'Prolazi su analizirani po svakom kilometru.' }
            : { gotovo: true }
    }));
    backend.api.set('/api/analyze?posao=', () => ({
      body: { stanje: 'gotovo', tekst: 'Prolazi su analizirani po svakom kilometru.' }
    }));
    await page.reload();
    await tab(page, 'Trka').click();
    await form.getByRole('button', { name: /Analiziraj trku/ }).click();
    await expect(form.getByText('Prolazi su analizirani po svakom kilometru.')).toBeVisible({
      timeout: 15000
    });
    const call = backend.requests.find(
      (r) => (r.body as Record<string, unknown>)?.['analysisType'] === 'race'
    );
    const entered = (
      call?.body as {
        entered: {
          perKm: unknown[];
          perKmSource: string;
          km: number;
          movingSec: number;
          elapsedSec: number;
        };
      }
    ).entered;
    expect(entered.perKm).toHaveLength(22);
    expect(entered.perKm[21]).toMatchObject({ km: 22, distanceM: 500, partial: true });
    expect(entered).toMatchObject({
      perKmSource: fallback ? 'strava' : 'icu',
      km: 21.5,
      movingSec: 6252,
      elapsedSec: 6272
    });
    expect(JSON.stringify(call?.body)).not.toContain('fixture-key');
    await form.getByText(/Prolazi po kilometru/).click();
    await expect(form.getByRole('cell', { name: '22 (500 m)', exact: true })).toBeVisible();
    await expect.poll(() => JSON.stringify(backend.row?.data)).toContain('raceDetails');
    await page.reload();
    await tab(page, 'Trka').click();
    await expect(form.getByText('Prolazi su analizirani po svakom kilometru.')).toBeVisible();
    await expect(form.getByText(/22 deonica/).first()).toBeVisible();
  });
}
