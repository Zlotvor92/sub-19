import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { back, tab } from './support/flows';

/* SEGMENT 08a — 5K v2 iza prekidača kroz pravi interfejs: podešavanje `ui.generatorV2FiveK` je uključeno u lokalnom
   stanju naloga pre pokretanja (novi korisnik bez plana vidi samo čarobnjaka), pa čarobnjak 5K v2 → plan → Plan tab i dan
   iz strukture; drugi tok: odbijanje v2 (5 dana, početnik) kao poruka sa razlogom.
   SEGMENT 08b — tok prilagođavanja: propuštena nedelja → pregled (bez potvrde ništa, uz potvrdu pauza) → potvrda → nova
   revizija na serveru. */

const STATE_KEY = 'sub19-v1:account:u-e2e';

async function enableFiveKV2(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('__e2e_v2')) return;
    sessionStorage.setItem('__e2e_v2', '1');
    localStorage.setItem(
      key,
      JSON.stringify({
        v: 12,
        log: {},
        knee: [],
        kg: [],
        pred: {},
        predLock: {},
        vdotLog: [],
        t3k: [],
        vreme: null,
        moves: {},
        alts: {},
        genPlan: null,
        strava: null,
        wellness: {},
        icu: null,
        vanPlana: {},
        zajed: { vidljiv: false, nadimak: '' },
        ui: {
          firstRun: '2026-01-14',
          lastBackup: null,
          snooze: null,
          seenWeek: null,
          geo: null,
          satTreninga: null,
          novo: null,
          generatorV2FiveK: true
        }
      })
    );
  }, STATE_KEY);
}

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
/** Upis na server ide tek PUSH_DEBOUNCE_MS (4 s) posle poslednje izmene; podrazumevanih 5 s za `expect.poll` je na
 *  opterećenom CI-ju premalo (hm-v2 „pauza → revizija" pao 1× na c7ee38a: server još bez revizije posle 5 s). */
const SYNC = { timeout: 15_000 };

async function raceStep(page: Page): Promise<void> {
  const wizard = page.getByRole('dialog', { name: 'Pravljenje plana' });
  await expect(wizard).toBeVisible();
  await expect(async () => {
    await group(page, 'Ciljna distanca')
      .getByRole('button', { name: '5K', exact: true })
      .click({ timeout: 2000 });
    await page.getByLabel('Datum trke').fill('2026-04-12', { timeout: 2000 });
    await expect(page.getByText(/Plan 5K v2: 12 nedelja/)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Dalje' }).click();
}

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await enableFiveKV2(page);
});

test('5K v2: čarobnjak (4 dana, rezultat) → plan v2 → Plan tab i dan pokazuju strukturu', async ({
  page
}) => {
  const backend = await installBackend(page);
  await page.goto('/');
  await raceStep(page);
  // 2. rezultat
  await page.getByRole('button', { name: 'Imam rezultat' }).click();
  await page.getByLabel('minuti').fill('22');
  await page.getByLabel('sekunde').fill('30');
  await page.getByLabel('Datum rezultata').fill('2026-01-10');
  await page.getByRole('button', { name: 'Dalje' }).click();
  // 3. iskustvo i obim
  await page.getByLabel('Nedeljna kilometraža').fill('32');
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  // 4. dani i cilj
  const days = group(page, 'Dani trčanja');
  for (const d of ['Uto', 'Čet', 'Sub', 'Ned'])
    await days.getByRole('button', { name: d, exact: true }).click();
  await page.getByLabel('minuti').fill('21');
  await page.getByLabel('sekunde').fill('30');
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();

  // Plan v2 je sačuvan (i na serveru) sa oznakom politike v2.
  await expect
    .poll(
      () =>
        JSON.stringify((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null),
      SYNC
    )
    .toContain('"policyId":"5k-v2"');

  // Plan tab: ocena cilja doslovno iz v2 i struktura u redovima dana (rad sa tempom).
  await tab(page, 'Plan').click();
  const plan = page.locator('.page.active');
  await expect(plan.locator('#goal-assessment')).toContainText('Cilj:');
  await expect(plan.getByText(/× \d+ m @ \d:\d\d\/km/).first()).toBeVisible();

  // Dan: struktura iz plana v2 (zagrevanje, rad, hlađenje).
  await plan
    .getByRole('button', { name: /Repeticije|Intervali/ })
    .first()
    .click();
  await expect(back(page)).toBeVisible();
  const structure = page.getByRole('group', { name: 'Struktura treninga' });
  await expect(structure).toBeVisible();
  await expect(structure).toContainText(/Pre\s*[\d,]+ km @ \d:\d\d–\d:\d\d\/km\s*zagrevanje/);
  await expect(structure).toContainText(/Rad\s*\d+ × \d+ m\s*\d:\d\d\/km/);
  await expect(page.getByRole('img', { name: /^Profil treninga: \d+ × \d+ m @/ })).toBeVisible();

  // Prilagođavanje (08b): tok v2 — pregled iz činjenica odmah, bez alata v1.
  await back(page).click();
  await tab(page, 'Plan').click();
  await page
    .locator('.page.active')
    .getByRole('button', { name: /^Prilagodi plan/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Prilagođavanje plana' })).toBeVisible();
  await expect(page.locator('#plan-change-preview')).toBeVisible();
  await expect(page.getByText('Prilagođavanje prema izvršenju')).toHaveCount(0);
});

/** Čarobnjak 5K v2: 4 dana (uto, čet, sub, ned), rezultat 22:30, 32 km, cilj 21:30 → plan na serveru. */
async function createV2Plan(page: Page, backend: Awaited<ReturnType<typeof installBackend>>) {
  await page.goto('/');
  await raceStep(page);
  await page.getByRole('button', { name: 'Imam rezultat' }).click();
  await page.getByLabel('minuti').fill('22');
  await page.getByLabel('sekunde').fill('30');
  await page.getByLabel('Datum rezultata').fill('2026-01-10');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('32');
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  const days = group(page, 'Dani trčanja');
  for (const d of ['Uto', 'Čet', 'Sub', 'Ned'])
    await days.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect
    .poll(
      () =>
        JSON.stringify((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null),
      SYNC
    )
    .toContain('"policyId":"5k-v2"');
}

test('5K v2 (08b): propuštena nedelja → pregled → potvrda → nova revizija', async ({ page }) => {
  const backend = await installBackend(page);
  await createV2Plan(page, backend);
  // Dnevnik: prva nedelja odrađena po planu, druga bez ijednog trčanja (stanje naloga, kao uvoz sa sata).
  const start = await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!) as {
      genPlan: {
        weeks: Array<{
          start: string;
          days: Array<{ id: string; rest?: boolean; km?: number | null; dow: number }>;
        }>;
      };
      log: Record<string, unknown>;
    };
    const w1 = state.genPlan.weeks[0];
    for (const d of w1.days)
      if (!d.rest)
        state.log[d.id] = { status: 'done', km: d.km ?? 5, sec: Math.round((d.km ?? 5) * 330) };
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem('sub19-v1', JSON.stringify(state));
    return w1.start;
  }, STATE_KEY);
  expect(start).toBe('2026-01-19');
  await fixToday(page, '2026-02-01T09:00:00');
  await page.reload();
  await tab(page, 'Plan').click();
  await page
    .locator('.page.active')
    .getByRole('button', { name: /^Prilagodi plan/ })
    .click();
  const preview = page.locator('#plan-change-preview');
  // Bez potvrde potpunosti: dan bez zapisa nije pauza.
  await expect(preview).toContainText('Budući deo plana se ne menja.');
  await expect(preview.getByRole('button', { name: 'Primeni prikazanu promenu' })).toBeDisabled();
  await page.getByLabel(/Zapis treninga za proteklih/).check();
  await expect(preview.getByRole('list', { name: 'Razlozi prilagođavanja' })).toContainText(
    /Pauza 7 dana \(obim 7 dana pre pauze/
  );
  await expect(preview.getByRole('table', { name: 'Promenjene nedelje' })).toBeVisible();
  const before = JSON.stringify((backend.row?.data as { genPlan?: unknown }).genPlan);
  expect(before).not.toContain('planRevisions');
  await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Plan je prilagođen' })).toBeVisible();
  await expect
    .poll(() => {
      const g = (backend.row?.data as { genPlan?: Record<string, unknown> } | undefined)?.genPlan;
      const v2 = g?.['fiveKV2'] as { adaptation?: { asOf: string } } | undefined;
      return [((g?.['planRevisions'] as unknown[]) ?? []).length, v2?.adaptation?.asOf ?? null];
    }, SYNC)
    .toEqual([1, '2026-02-01']);
  await expect(page.locator('#plan-revisions')).toContainText('Prilagođavanje 2026-02-01: pauza');
});

test('5K v2: odbijanje (5 dana, početnik) je poruka sa razlogom, plan se ne pravi', async ({
  page
}) => {
  const backend = await installBackend(page);
  await page.goto('/');
  await raceStep(page);
  await page.getByRole('button', { name: 'Nemam skoriji rezultat' }).click();
  await page.getByLabel('minuti').fill('6');
  await page.getByLabel('sekunde').fill('30');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('25');
  await page.getByRole('button', { name: 'Početnik' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  const days = group(page, 'Dani trčanja');
  for (const d of ['Pon', 'Uto', 'Sre', 'Pet', 'Sub'])
    await days.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  const notice = page.getByRole('status').filter({ hasText: 'Plan nije napravljen' });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Početnik: najviše 4 dana trčanja nedeljno; zadato 5.');
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  expect((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null).toBeNull();
});
