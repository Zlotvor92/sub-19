import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import { createPlan, openSetting } from './support/flows';

/* Zajednica: podrazumevano ISKLJUČENA; uključivanje šalje tačno određena polja (nikad beleške, telesnu masu ni bol), a isključivanje BRIŠE red. */

let backend: Backend;
const profiles: unknown[] = [];

test.beforeEach(async ({ page }) => {
  profiles.length = 0;
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  backend.api.set('/rest/v1/zajednica_profil', ({ method, body }) => {
    if (method === 'GET') return { body: profiles };
    if (method === 'POST') {
      profiles.splice(0, profiles.length, {
        ...(body as object),
        azurirano: '2026-01-14T09:00:00Z'
      });
      return { status: 201, body: {} };
    }
    if (method === 'DELETE') {
      profiles.length = 0;
      return { status: 204, body: {} };
    }
    return { status: 404, body: {} };
  });
  backend.api.set('/rest/v1/zajednica_izazov', () => ({
    body: [{ tekst: 'Odradi sve treninge po planu ove nedelje.' }]
  }));
  await createPlan(page);
});

test('uključivanje: tabela se popunjava, šalje se samo dozvoljeno, isključivanje briše red', async ({
  page
}) => {
  // beleška, bol i masa postoje u stanju — ne smeju da izađu
  await page.getByRole('button', { name: 'Završi trening' }).click();
  await page.getByLabel(/Distanca \(km\)/).fill('8,6');
  await page.getByLabel(/^Vreme/).fill('4233');
  await page.getByText('Više detalja (RPE, bol, masa, datum, beleška)').click();
  await page.getByLabel('Beleška').fill('TAJNA BELEŠKA');
  await page.getByLabel('Beleška').blur();

  await openSetting(page, 'App', 'Zajednica');
  await page.locator('#zaj-tgl').click();
  await expect.poll(() => backend.count('/rest/v1/zajednica_profil', 'POST')).toBe(1);
  const sent = backend.requests.find(
    (r) => r.method === 'POST' && r.url.includes('/rest/v1/zajednica_profil')
  )?.body as Record<string, unknown>;
  expect(sent).toMatchObject({ user_id: 'u-e2e', vidljiv: true, cilj: '10K' });
  expect(JSON.stringify(sent)).not.toContain('TAJNA');
  expect(Object.keys(sent).sort()).toEqual(
    [
      'avatar_url',
      'cilj',
      'izazov_od',
      'izazov_ura',
      'km_nedelja',
      'nadimak',
      'nedelja_br',
      'nedelja_od',
      'niz_dana',
      'plan_pct',
      'test3k_sec',
      'trcanja',
      'trka_datum',
      'user_id',
      'vdot',
      'vdot_pocetni',
      'vidljiv',
      'znacke'
    ].sort()
  );

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page
    .getByRole('navigation', { name: 'Glavna navigacija' })
    .getByRole('button', { name: 'Zajednica' })
    .click();
  await expect(page.getByText('Odradi sve treninge po planu ove nedelje.')).toBeVisible();

  await openSetting(page, 'App', 'Zajednica');
  await page.getByRole('button', { name: 'Isključi Zajednicu' }).click();
  await expect.poll(() => backend.count('/rest/v1/zajednica_profil', 'DELETE')).toBe(1);
  expect(profiles).toHaveLength(0); // red je OBRISAN, ne samo sakriven
});
