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
