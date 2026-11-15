import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';

/* DRUGO PUŠTANJE (odluka vlasnika 15. 11. 2026; ranije V1b: stari plan se prikazivao uz poruku „Generiši nov plan"):
   plan starog formata (bez oznake politike, kakvih ima u bazi) se pri otvaranju uklanja sa svim podacima vezanim za
   plan (BRISANJE-PLAN § 2d), a korisnik vidi samo čarobnjak. Merenja, podešavanja i ručni unosi ostaju. */

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

test('drugo puštanje: stari plan se pri otvaranju uklanja sa podacima uz njega — samo čarobnjak; merenja i ručni unosi ostaju', async ({
  page
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const backend = await installBackend(page);
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  await expect(page.getByText(MESSAGE)).toHaveCount(0);
  await expect(page.locator('#legacy-plan-today')).toHaveCount(0);
  const local = async (): Promise<Record<string, unknown>> =>
    JSON.parse((await page.evaluate((k) => localStorage.getItem(k), STATE_KEY)) ?? '{}') as Record<
      string,
      unknown
    >;
  await expect.poll(async () => (await local())['genPlan'], { timeout: 15_000 }).toBeNull();
  const s = await local();
  expect(s['log']).toEqual({});
  expect(s['vdotLog']).toEqual([]);
  expect(s['knee']).toEqual([{ date: '2026-01-10', pain: 2, part: 'koleno-L' }]); // ručni bol ostaje
  expect((s['ui'] as { lastBackup: string }).lastBackup).toBe('2026-01-13');
  /* uklanjanje stiže i na server (jedan upis stanja) */
  await expect
    .poll(() => (backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan, {
      timeout: 15_000
    })
    .toBeNull();
  expect((backend.row?.data as { log?: unknown }).log).toEqual({});
  /* ponovno otvaranje: i dalje samo čarobnjak */
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  expect(errors).toEqual([]);
});
