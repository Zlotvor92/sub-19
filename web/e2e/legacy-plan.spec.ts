import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { tab } from './support/flows';

/* V1b — STARI PLAN (v1 generator obrisan): plan starog formata (bez oznake politike, kakvih ima u bazi) se otvara i
   prikazuje, unos radi, a umesto prilagođavanja stoji jedna poruka i dugme „Generiši nov plan". Potvrda kaže šta se
   briše a šta ostaje. Stanje se ne migrira. */

const STATE_KEY = 'sub19-v1:account:u-e2e';
const MESSAGE = 'Plan je napravljen starim generatorom: prikazuje se, ali se više ne prilagođava.';

const day = (w: number, dow: number, tag: string, km: number | null, desc: string) => ({
  id: `g${w}d${dow + 1}`,
  dow,
  tag,
  km,
  desc,
  ...(tag === 'odmor' ? { rest: true } : {})
});
const week = (w: number, start: string) => ({
  w,
  start,
  deload: false,
  focus: w === 3 ? 'TRKA' : 'Baza · lagano',
  days: [
    day(w, 0, 'odmor', null, 'Odmor'),
    day(w, 1, 'lako', 6, 'Lako trčanje 6 km'),
    day(w, 2, 'lako', 7, 'Lako trčanje 7 km'),
    day(w, 3, 'odmor', null, 'Odmor'),
    day(w, 4, 'odmor', null, 'Odmor'),
    day(w, 5, 'lako', 5, 'Lako trčanje 5 km'),
    day(w, 6, 'lr', 12, 'Dugo trčanje 12 km')
  ]
});
/** Plan v1 formata: nedelje od ponedeljka, `ulaz` čarobnjaka v1, bez `meta.policyId`. */
const OLD_PLAN = {
  weeks: [week(1, '2026-01-12'), week(2, '2026-01-19'), week(3, '2026-01-26')],
  pred: [],
  qs: {},
  meta: {
    raceDistM: 10000,
    raceDate: '2026-02-01',
    start: '2026-01-12',
    weeks: 3,
    vdot0: 45,
    goalSec: 2520,
    dayWarnings: []
  },
  ulaz: { raceDistM: 10000, raceDate: '2026-02-01', startDate: '2026-01-12', weeklyKm: 30 }
};

async function seedOldPlan(page: Page): Promise<void> {
  await page.addInitScript(
    ([key, plan]) => {
      if (sessionStorage.getItem('__e2e_old')) return;
      sessionStorage.setItem('__e2e_old', '1');
      localStorage.setItem(
        key,
        JSON.stringify({
          v: 12,
          log: { g1d2: { status: 'done', km: 6, ts: '2026-01-13' } },
          knee: [{ date: '2026-01-10', pain: 2, part: 'koleno-L' }],
          kg: [],
          pred: {},
          predLock: {},
          vdotLog: [],
          t3k: [],
          vreme: null,
          moves: {},
          alts: {},
          genPlan: plan,
          strava: null,
          wellness: {},
          icu: null,
          vanPlana: {},
          zajed: { vidljiv: false, nadimak: '' },
          ui: {
            firstRun: '2026-01-12',
            lastBackup: '2026-01-13',
            snooze: null,
            seenWeek: null,
            geo: null,
            satTreninga: null,
            novo: null
          }
        })
      );
    },
    [STATE_KEY, OLD_PLAN] as const
  );
}

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await seedOldPlan(page);
});

test('stari plan: prikazuje se, unos radi; poruka i „Generiši nov plan" sa jasnom potvrdom', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await installBackend(page);
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
  // Danas: plan se prikazuje (današnji trening) i nosi poruku sa radnjom.
  const today = page.locator('#legacy-plan-today');
  await expect(today).toContainText(MESSAGE);
  await expect(today.getByRole('button', { name: /Generiši nov plan/ })).toBeVisible();
  await expect(page.locator('#tcard')).toBeVisible();
  // Unos radi: današnji trening (sreda 14. 1.) se označava kao završen.
  await page.getByRole('button', { name: 'Završi trening' }).click();
  await expect(page.locator('#tcard')).toHaveAttribute('data-status', 'done');
  // Plan: nedelja starog plana i ista poruka; Prilagodi plan bez predloga i bez prilagođavanja.
  await tab(page, 'Plan').click();
  await expect(page.getByRole('heading', { name: 'Nedelja 1 od 3' })).toBeVisible();
  await expect(page.locator('#legacy-plan')).toContainText(MESSAGE);
  // „Generiši nov plan": potvrda kaže šta se briše a šta ostaje; „Ne" ne menja ništa.
  await page
    .locator('#legacy-plan')
    .getByRole('button', { name: /Generiši nov plan/ })
    .click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('TRAJNO se briše');
  await expect(dialog).toContainText('Ostaje: test na 3 km, bol i težina upisani ručno');
  await dialog.getByRole('button', { name: 'Ne', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nedelja 1 od 3' })).toBeVisible();
  // „Da": stari plan i njegovi unosi odlaze, otvara se čarobnjak (v2).
  await page
    .locator('#legacy-plan')
    .getByRole('button', { name: /Generiši nov plan/ })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Da', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  expect(errors).toEqual([]);
});
