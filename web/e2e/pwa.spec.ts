import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { createPlan } from './support/flows';
import { startVersionedServer, type VersionedServer } from './support/versionedServer';

/* Tokovi 12–13: ponašanje bez mreže i ažuriranje aplikacije (novi service worker → traka „Osveži" → nova verzija). Service worker je ovde UKLJUČEN. */

test.use({ serviceWorkers: 'allow' });

let server: VersionedServer;
test.beforeAll(async () => {
  server = await startVersionedServer();
});
test.afterAll(async () => {
  await server.close();
});

/** Imena naših keševa; dok se stranica ponovo učitava (posle „Osveži") izvršno okruženje nestaje — to je „još nema odgovora", ne greška. */
const cacheNames = (page: Page): Promise<string[]> =>
  page
    .evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('sub19-cache-')))
    .catch(() => []);

/** Plan napravljen, service worker aktivan i kontroliše stranicu, a offline kopija spremna. */
async function ready(page: Page): Promise<void> {
  await fixToday(page);
  await seedSession(page);
  await installBackend(page);
  await createPlan(page, undefined, server.url);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => cacheNames(page)).toHaveLength(1);
  // prvo otvaranje nije pod kontrolom SW-a (clients.claim stiže posle aktivacije) — ponovno učitavanje je pod kontrolom
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
}

test('bez mreže: aplikacija se otvara iz keša sa podacima sa uređaja, bez ijednog dijaloga', async ({
  page,
  context
}) => {
  await ready(page);
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
  await expect(page.locator('#h-sub')).toHaveText(/N1\/13 · BAZA · 88 d/);
  await expect(page.getByRole('button', { name: 'Završi trening' })).toBeVisible();
  // radi i bez mreže: unos se čuva lokalno
  await page.getByRole('button', { name: 'Završi trening' }).click();
  await expect(page.locator('#tcard[data-status="done"] .focus-top .badge')).toHaveText('Odrađen');
  const saved = await page.evaluate(() => localStorage.getItem('sub19-v1'));
  expect(saved).toContain('"status":"done"');
  expect(dialogs).toEqual([]);
  // kad se mreža vrati, izmena odlazi na server (nije izgubljena)
  await context.setOffline(false);
});

test('ažuriranje: novi service worker čeka klik, traka „Osveži" ga aktivira, stari keš nestaje', async ({
  page
}) => {
  await ready(page);
  const [oldCache] = await cacheNames(page);
  expect(oldCache).toMatch(/^sub19-cache-v286-[0-9a-f]{8}$/);
  await expect(page.getByText('Dostupna je nova verzija')).toHaveCount(0);

  // „novi deploy": sw.js dobija drugačija bajta
  const next = server.bump();
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()));
  await expect(page.getByText('Dostupna je nova verzija')).toBeVisible();
  // dok se ne klikne, aktivan je STARI (nema skipWaiting na install-u)
  expect((await cacheNames(page)).sort()).toEqual([oldCache, `${oldCache}-${next}`].sort());
  await page.getByRole('button', { name: 'Osveži', exact: true }).click();
  await expect
    .poll(async () => cacheNames(page), { timeout: 15_000 })
    .toEqual([`${oldCache}-${next}`]);
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
  await expect(page.getByText('Dostupna je nova verzija')).toHaveCount(0);
});
