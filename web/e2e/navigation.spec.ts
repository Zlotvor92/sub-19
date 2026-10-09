import { expect, test } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import {
  back,
  createPlan,
  openAdjust,
  openDetails,
  openProgress,
  openTi,
  tab
} from './support/flows';

/* Organizacija: četiri taba, ekrani iznad njih, Back, stari linkovi. Zajednica je UGAŠENA i ne postoji u interfejsu (nema taba, reda ni zahteva ka njenoj
   tabeli); kod servisa ostaje iza prekidača (v. `app/community.test.ts`). */

let backend: Backend;

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  await createPlan(page);
});

const h1 = (page: import('@playwright/test').Page) =>
  page.locator('.page.active').getByRole('heading', { level: 1 });

test('traka tabova ima četiri ekrana, bez Zajednice; adresa ?tab=zajed pada na Danas', async ({
  page
}) => {
  const nav = page.getByRole('navigation', { name: 'Glavna navigacija' });
  await expect(nav.getByRole('button')).toHaveText(['Danas', 'Plan', 'Napredak', 'Ti']);
  await expect(nav.getByRole('button', { name: 'Zajednica' })).toHaveCount(0);
  await page.goto('/?tab=zajed');
  await expect(h1(page)).toHaveText('Danas');
  await expect(page.locator('#pg-zajed')).toHaveCount(0);
});

test('u Ti nema Zajednice: ni reda, ni prekidača, ni nadimka', async ({ page }) => {
  await tab(page, 'Ti').click();
  await expect(page.getByText('Zajednica')).toHaveCount(0);
  await openTi(page, /^Povezani servisi/);
  await expect(page.getByText('Zajednica')).toHaveCount(0);
  await expect(page.locator('#zaj-tgl')).toHaveCount(0);
});

test('nijedan zahtev ne ide ka tabeli zajednice (ni čitanje, ni upis, ni brisanje)', async ({
  page
}) => {
  for (const name of ['Plan', 'Napredak', 'Ti', 'Danas'] as const) await tab(page, name).click();
  await page.reload();
  await expect(h1(page)).toHaveText('Danas');
  expect(backend.count('/rest/v1/zajednica')).toBe(0);
});

test('stari linkovi: ?tab=opor vodi na Oporavak, ?tab=pred na Formu i predikciju', async ({
  page
}) => {
  await page.goto('/?tab=opor');
  await expect(tab(page, 'Napredak')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1, name: 'Oporavak' })).toBeVisible();
  await page.goto('/?tab=pred');
  await expect(tab(page, 'Napredak')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1, name: 'Forma i predikcija' })).toBeVisible();
});

test('push obaveštenje: ?dan=<id> otvara Detalje tog treninga; nepostojeći ili podmetnut ID ostaje na Danas', async ({
  page
}) => {
  const id = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('sub19-v1') ?? '{}') as {
      genPlan?: { weeks: Array<{ days: Array<{ id: string }> }> };
    };
    return state.genPlan?.weeks[1]?.days[0]?.id ?? '';
  });
  expect(id).toMatch(/^g\d+d\d+$/);
  await page.goto(`/?dan=${id}`);
  await expect(back(page)).toBeVisible();
  await expect(page.getByText(/^N2 · /)).toBeVisible();
  expect(page.url()).not.toContain('dan='); // adresa se čisti odmah, osvežavanje ne otvara ponovo

  // nepostojeći dan: ekran se ne otvara (tab ostaje onaj koji je bio zapamćen u ovoj sesiji)
  await page.goto('/?dan=nema-ga');
  await expect(page.locator('.page.active')).toBeVisible();
  await expect(back(page)).toHaveCount(0);
  await page.goto('/?dan=%22%3E%3Cimg%20src=x%3E');
  await expect(page.locator('.page.active')).toBeVisible();
  await expect(back(page)).toHaveCount(0);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});

test('Back sistema zatvara ekran i list, ne izlazi iz aplikacije', async ({ page }) => {
  await openDetails(page);
  await page.goBack();
  await expect(back(page)).toHaveCount(0);
  await expect(h1(page)).toHaveText('Danas');
  expect(page.url()).toContain('localhost:4173');

  await openProgress(page, /^Bol/);
  await page.getByRole('button', { name: 'Dodaj unos bola' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack(); // prvo list…
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Bol' })).toBeVisible();
  await page.goBack(); // …pa ekran
  await expect(h1(page)).toHaveText('Napredak');
});

test('promena taba zatvara ekran iznad; „Nazad“ vraća jedan nivo', async ({ page }) => {
  await openProgress(page, /^Forma i predikcija/);
  await back(page).click();
  await expect(h1(page)).toHaveText('Napredak');
  await openProgress(page, /^Oporavak/);
  await tab(page, 'Plan').click();
  await expect(back(page)).toHaveCount(0);
  await expect(h1(page)).toHaveText('Tvoj plan');
  await tab(page, 'Napredak').click();
  await expect(h1(page)).toHaveText('Napredak');
});

test('izgled: izbor teme se pamti po uređaju, preživljava ponovno učitavanje i ne ide na server', async ({
  page
}) => {
  await openTi(page, /^Izgled aplikacije/);
  await page.getByRole('button', { name: 'Tamna' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // primenjeno pre prvog iscrtavanja
  await openTi(page, /^Izgled aplikacije/);
  await expect(page.getByRole('button', { name: 'Tamna' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Prati sistem' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  expect(JSON.stringify(backend.row?.data ?? {})).not.toContain('sub20-tema');
});

/* ZADACI NOVOG KORISNIKA (sopstvena provera, ne ispitivanje korisnika): koliko dodira od početnog ekrana do cilja. Gornja granica je namerno stroga — ako neki
   put postane duži, ovo pada i traži odluku, umesto da se organizacija tiho zaguši. */
test.describe('zadaci novog korisnika — broj dodira od početnog ekrana', () => {
  test('1. gde je današnji trening i njegovi detalji: 1 dodir', async ({ page }) => {
    await expect(page.locator('#tcard')).toBeVisible(); // trening je odmah na ekranu
    await page.getByRole('button', { name: /^Detalji (treninga|dana)/ }).click();
    await expect(page.getByRole('button', { name: /^Odrađen$/ })).toBeVisible();
  });

  test('2. promena datuma treninga: 3 dodira (Detalji → Pomeri → dan)', async ({ page }) => {
    await openDetails(page);
    await page.getByRole('button', { name: /^Pomeri na drugi dan/ }).click();
    // dan iz Detalja je već izabran: dovoljan je još jedan dodir
    await expect(page.getByText(/^Izabrano: .* dodirni dan sa kojim/)).toBeVisible();
    await expect(page.locator('.swap-list button.swap-row').first()).toBeVisible();
  });

  test('3. sledeća nedelja: 2 dodira (Plan → ›)', async ({ page }) => {
    await tab(page, 'Plan').click();
    await page.getByRole('button', { name: 'Sledeća nedelja' }).click();
    await expect(page.getByRole('heading', { level: 2, name: /^Nedelja 2 od/ })).toBeVisible();
  });

  test('4. prethodna aktivnost: 2 dodira (Napredak → Sve aktivnosti)', async ({ page }) => {
    await page.getByRole('button', { name: 'Završi trening' }).click();
    await tab(page, 'Napredak').click();
    await page.getByRole('button', { name: 'Sve aktivnosti' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sve aktivnosti' })).toBeVisible();
    await expect(page.locator('.screen .rows > .row').first()).toBeVisible();
  });

  test('5. analiza trke: 2 dodira (Napredak → Analiza trke)', async ({ page }) => {
    await openProgress(page, /^Analiza trke/);
    await expect(page.getByRole('heading', { level: 1, name: 'Analiza trke' })).toBeVisible();
  });

  test('6. povezivanje servisa i provera sinhronizacije: 3 dodira (Ti → Servisi → Strava)', async ({
    page
  }) => {
    await openTi(page, /^Povezani servisi/);
    await expect(page.getByRole('button', { name: /^Strava/ })).toContainText('nije povezano');
    await page.getByRole('button', { name: /^Strava/ }).click();
    await expect(page.getByRole('button', { name: 'Poveži Stravu' })).toBeVisible();
  });

  test('7. cilj i podešavanja plana: 2 dodira (Ti → Cilj) i 2 (Plan → Prilagodi plan)', async ({
    page
  }) => {
    await tab(page, 'Ti').click();
    await page.getByRole('button', { name: /^Trenutni cilj/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Cilj' })).toBeVisible();
    await expect(page.getByLabel('Novo ciljno vreme')).toBeVisible();
    await back(page).click();
    await openAdjust(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Prilagodi plan' })).toBeVisible();
  });
});
