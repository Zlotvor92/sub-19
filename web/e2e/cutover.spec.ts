import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { startVersionedServer, type VersionedServer } from './support/versionedServer';

/* PRELAZ SA STAROG FRONTENDA NA NOVI, u pravom pregledaču (rizik R2 iz ARCHITECTURE.md): korisnik ima instaliran v282 sa svojim planom i unosima; deploy
   zamenjuje frontend; stari service worker mora da preuzme novi, a NOVI frontend mora da pročita podatke koje je upisao STARI. Stari frontend se servira
   iz korena repozitorija (isti fajlovi koje Vercel danas servira), novi iz `vite preview`; preklop radi proxy. */

test.use({ serviceWorkers: 'allow' });

let server: VersionedServer;
test.beforeAll(async () => {
  server = await startVersionedServer();
});
test.afterAll(async () => {
  await server.close();
});
const cacheNames = (page: Page): Promise<string[]> =>
  page
    .evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('sub19-cache-')))
    .catch(() => []);

/** Stari čarobnjak (po ID-jevima iz starog `renderOnboard`). */
async function legacyWizard(page: Page): Promise<void> {
  await page.locator('#raceDistChips [data-v="10000"]').click();
  await page.locator('#in-raceDate').fill('2026-04-12');
  await page.locator('#obNext').click();
  await page.locator('#pbDistChips [data-v="10000"]').click();
  await page.locator('#in-pbMin').fill('45');
  await page.locator('#in-pbSec').fill('0');
  await page.locator('#obNext').click();
  await page.locator('#in-weeklyKm').fill('40');
  await page.locator('#obNext').click();
  await page.locator('#in-goalMin').fill('42');
  await page.locator('#in-goalSec').fill('0');
  await page.locator('#obNext').click();
}

/** STARI klijent ima poznatu trku: dok traje prvi upis, njegova druga provera može da vidi red koji je upravo upisao a da još nema `seenAt` pa pita „sukob" (jedan u ~12 pokretanja). Novi klijent
    to nema (16/16 čistih). Ovde se odgovara kao čovek: „Zadrži sa telefona". */
async function legacyResolveConflict(page: Page): Promise<void> {
  await page.waitForTimeout(1500);
  if (await page.locator('#sync-sukob').isVisible()) await page.locator('#sy-push').click();
  await expect(page.locator('#sync-sukob')).toBeHidden();
}

test('v282 → novi frontend: stari SW preuzima novi, plan i unos iz starog frontenda se čitaju netaknuti, stari keš nestaje', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await fixToday(page);
  await seedSession(page);
  const backend = await installBackend(page);

  // 1. STARI frontend: plan i jedan završen trening
  server.mode = 'legacy';
  await page.goto(server.url);
  await legacyWizard(page);
  await expect(page.getByRole('button', { name: 'Završi trening' })).toBeVisible();
  await legacyResolveConflict(page);
  await page.getByRole('button', { name: 'Završi trening' }).click();
  await page.getByLabel(/Distanca \(km\)/).fill('8,6');
  await page.getByLabel(/^Vreme/).fill('4233');
  await page.getByLabel('Pros. puls').fill('152');
  await page.getByLabel('Pros. puls').blur();
  await expect(page.getByRole('status', { name: 'Pros. tempo' })).toHaveText('4:57 /km');
  await expect
    .poll(() => (backend.row?.data as { log?: Record<string, unknown> } | undefined)?.log)
    .toBeDefined();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => cacheNames(page)).toEqual(['sub19-cache-v282']);

  // 2. DEPLOY: server od sada servira novi frontend; pregledač proverava sw.js
  server.mode = 'new';
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
  // stari frontend nudi „Osveži" (njegova traka), jer novi SW čeka
  await expect(page.locator('#update-go')).toBeVisible({ timeout: 15_000 });
  await page.locator('#update-go').click();

  // 3. NOVI frontend preuzima: isti plan, isti unos, bez čarobnjaka i bez ponovne prijave
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible({
    timeout: 20_000
  });
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toHaveCount(0);
  await expect(page.locator('#h-sub')).toHaveText('Nedelja 1 / 13 · 88 dana do trke');
  await expect(page.locator('.st.done')).toHaveText('Odrađen');
  await expect(page.getByLabel(/Distanca \(km\)/)).toHaveValue('8,6');
  await expect(page.getByRole('status', { name: 'Pros. tempo' })).toHaveText('4:57 /km');
  // novi SW kontroliše stranicu, a stari keš je obrisan
  await expect
    .poll(async () =>
      (await cacheNames(page)).every((k) => /^sub19-cache-v283-[0-9a-f]{8}$/.test(k))
    )
    .toBe(true);
  expect(await cacheNames(page)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('povratak na stari frontend (rollback): stanje koje je upisao NOVI frontend stari čita bez gubitka', async ({
  page
}) => {
  await fixToday(page);
  await seedSession(page);
  const backend = await installBackend(page);
  server.mode = 'new';
  await page.goto(server.url);
  await page
    .getByRole('group', { name: 'Ciljna distanca' })
    .getByRole('button', { name: '10K', exact: true })
    .click();
  await page.getByLabel('Datum trke').fill('2026-04-12');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page
    .getByRole('group', { name: 'Distanca rezultata' })
    .getByRole('button', { name: '10 km', exact: true })
    .click();
  await page.getByLabel('minuti').fill('45');
  await page.getByLabel('sekunde').fill('0');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('40');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await page.getByRole('button', { name: 'Završi trening' }).click();
  await page.getByLabel(/Distanca \(km\)/).fill('8,6');
  await page.getByLabel(/^Vreme/).fill('4233');
  await page.getByLabel(/^Vreme/).blur();
  await expect.poll(() => JSON.stringify(backend.row?.data ?? {})).toContain('"km":8.6');

  server.mode = 'legacy';
  await page.unroute(/.*/).catch(() => undefined);
  const legacy = await page.context().newPage();
  await installBackend(legacy);
  await legacy.goto(server.url);
  await expect(legacy.getByRole('button', { name: 'Završi trening' })).toHaveCount(0); // već odrađen
  await expect(legacy.getByLabel(/Distanca \(km\)/)).toHaveValue('8,6');
});
