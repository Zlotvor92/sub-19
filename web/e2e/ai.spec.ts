import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import { createPlan, logToday, openDetails } from './support/flows';

/* AI analiza treninga: tri faze (`start` troši kvotu, `radi` računa bez čekanja, `citaj` se pita na 3 s), tekst se čuva uz trening. Backend je lažan. */

let backend: Backend;
test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  await createPlan(page);
});

test('analiza: pokretanje → „radi se" → rezultat se upisuje uz trening i preživljava ponovno učitavanje', async ({
  page
}) => {
  let reads = 0;
  backend.api.set('/api/analyze', ({ body }) => {
    const b = body as { posao?: string; posaoId?: string; danId?: string };
    if (b.posao === 'start') return { body: { posaoId: 'J1' } };
    if (b.posao === 'radi') return { body: {} };
    reads++;
    return reads < 2
      ? { body: { stanje: 'radi' } }
      : { body: { stanje: 'gotovo', tekst: 'Dobar rad: tempo je ujednačen, puls miran.' } };
  });
  await logToday(page, { km: '8,6', time: '4233' });

  await page.getByRole('button', { name: /Analiziraj trening/ }).click();
  await expect(page.getByText(/^Analiziram…/)).toBeVisible();
  await expect(page.getByText('Dobar rad: tempo je ujednačen, puls miran.')).toBeVisible({
    timeout: 15_000
  });
  // sva tri poziva su stigla, `radi` nosi podatke o treningu i ID dana
  const calls = backend.requests
    .filter((r) => r.url.endsWith('/api/analyze'))
    .map((r) => r.body as Record<string, unknown>);
  expect(calls.map((c) => c['posao'])).toEqual(['start', 'radi', 'citaj', 'citaj']);
  expect(calls[1]).toMatchObject({ posaoId: 'J1' });
  expect(typeof calls[1]?.['danId']).toBe('string');
  expect(JSON.stringify(calls[1])).toContain('8.6');
  // tekst je u stanju (stiže na server) i vidi se posle ponovnog učitavanja, bez novog poziva
  await expect
    .poll(() => JSON.stringify(backend.row?.data ?? {}))
    .toContain('Dobar rad: tempo je ujednačen');
  const before = backend.count('/api/analyze');
  await page.reload();
  await openDetails(page);
  await expect(page.getByText('Dobar rad: tempo je ujednačen, puls miran.')).toBeVisible();
  expect(backend.count('/api/analyze')).toBe(before);
});

test('analiza: dnevni limit se prikazuje kao poruka, ne kao pad', async ({ page }) => {
  backend.api.set('/api/analyze', () => ({
    status: 429,
    body: { error: 'Dnevni limit analiza je potrošen.' }
  }));
  await logToday(page, { km: '8,6', time: '4233' });
  await page.getByRole('button', { name: /Analiziraj trening/ }).click();
  await expect(page.getByText('Dnevni limit analiza je potrošen.')).toBeVisible();
});
