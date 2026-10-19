import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { back, openTi, tab } from './support/flows';

/* HM v2 SEGMENT HM-05 — polumaraton v2 iza prekidača kroz pravi interfejs: podešavanje `ui.generatorV2HalfMarathon` je
   uključeno u lokalnom stanju naloga pre pokretanja (novi korisnik bez plana vidi samo čarobnjaka; prekidač u
   Podešavanjima vidi samo administrator ili razvoj), uz povezan intervals.icu (da bi „Slanje na sat" bilo ponuđeno).
   Tokovi: (1) čarobnjak sa rezultatom → plan `hm-v2` na serveru → Plan tab i dan iz strukture → Prilagodi plan „stiže
   uskoro" → sat: pregled slanja bez preskočenih dana; (2) čarobnjak po osećaju → RPE i tempo „orijentir (procena)", test
   5 km u planu → sat: dani po osećaju preskočeni sa razlogom; (3) trčanje/hodanje → odbijanje v2 doslovno sa preporukom
   5K, plan se ne pravi. */

const STATE_KEY = 'sub19-v1:account:u-e2e';

async function enableHmV2(page: Page): Promise<void> {
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
        icu: { athleteId: 'i77', apiKey: 'k' },
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
          generatorV2HalfMarathon: true
        }
      })
    );
  }, STATE_KEY);
}

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
const serverPlan = (backend: Awaited<ReturnType<typeof installBackend>>): string =>
  JSON.stringify((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null);

async function raceStep(page: Page): Promise<void> {
  const wizard = page.getByRole('dialog', { name: 'Pravljenje plana' });
  await expect(wizard).toBeVisible();
  await expect(async () => {
    await group(page, 'Ciljna distanca')
      .getByRole('button', { name: 'Polumaraton', exact: true })
      .click({ timeout: 2000 });
    await page.getByLabel('Datum trke').fill('2026-04-12', { timeout: 2000 });
    await expect(page.getByText(/Plan polumaratona v2: 12 nedelja/)).toBeVisible({
      timeout: 2000
    });
  }).toPass({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Dalje' }).click();
}

async function pickDays(page: Page, days: string[]): Promise<void> {
  const g = group(page, 'Dani trčanja');
  for (const d of days) await g.getByRole('button', { name: d, exact: true }).click();
}

/** Ti → Povezani servisi → Slanje na sat → „Vidi šta se šalje". */
async function watchPreview(page: Page): Promise<void> {
  await openTi(page, /^Povezani servisi/);
  await page
    .locator('.page.active, .screen')
    .getByRole('button', { name: /^Slanje na sat/ })
    .first()
    .click();
  await page.locator('#icu-vidi').click();
  await expect(page.locator('#icu-pregled')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await enableHmV2(page);
});

test('HM v2: čarobnjak (rezultat, 4 dana, cilj 1:40:00) → plan v2 → Plan tab i dan → „stiže uskoro" → sat', async ({
  page
}) => {
  const backend = await installBackend(page);
  await page.goto('/');
  await raceStep(page);
  // 2. rezultat (10 km)
  await page.getByRole('button', { name: 'Imam rezultat' }).click();
  await page.getByLabel('minuti').fill('45');
  await page.getByLabel('sekunde').fill('0');
  await page.getByLabel('Datum rezultata').fill('2026-01-10');
  await page.getByRole('button', { name: 'Dalje' }).click();
  // 3. trčanje bez prekida, obim, skorašnji najduži, iskustvo
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('40');
  await page.getByLabel('Najduže skorašnje trčanje (km)').fill('16');
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  // 4. dani, dan dugog, cilj sa satima
  await pickDays(page, ['Uto', 'Čet', 'Sub', 'Ned']);
  await group(page, 'Dan dugog trčanja').getByRole('button', { name: 'Ned', exact: true }).click();
  await page.getByLabel('sati').fill('1');
  await page.getByLabel('minuti').fill('40');
  await page.getByLabel('sekunde').fill('0');
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();

  // Plan v2 je sačuvan (i na serveru) sa oznakom politike v2 i izlazom v2.
  await expect.poll(() => serverPlan(backend)).toContain('"policyId":"hm-v2"');
  expect(serverPlan(backend)).toMatch(/"policyVersion":"hm-v2\.\d+\.\d+"/);
  expect(serverPlan(backend)).toContain('"hmV2":{');
  expect(serverPlan(backend)).toContain('"recentLongRunKm":16');

  // Plan tab: ocena cilja doslovno iz v2 i struktura u redovima nedelje (rad sa tempom).
  await tab(page, 'Plan').click();
  const plan = page.locator('.page.active');
  await expect(plan.locator('#goal-assessment')).toContainText('Cilj:');
  await expect(plan.getByText(/km @ \d:\d\d\/km|× [\d,]+ k?m @ \d:\d\d\/km/).first()).toBeVisible();

  // Dan: struktura iz plana v2 (zagrevanje sa E opsegom, rad sa tempom).
  await plan
    .getByRole('button', { name: /Tempo|Intervali|Repeticije|Trkački ritam/ })
    .first()
    .click();
  await expect(back(page)).toBeVisible();
  const structure = page.getByRole('group', { name: 'Struktura treninga' });
  await expect(structure).toBeVisible();
  await expect(structure).toContainText(/Pre\s*[\d,]+ km @ \d:\d\d–\d:\d\d\/km\s*zagrevanje/);
  await expect(structure).toContainText(/\d:\d\d\/km/);

  // Prilagođavanje: „stiže uskoro" umesto alata HM v1 (HM-06).
  await back(page).click();
  await tab(page, 'Plan').click();
  await page
    .locator('.page.active')
    .getByRole('button', { name: /^Prilagodi plan/ })
    .click();
  await expect(page.locator('#v2-unsupported')).toContainText('Prilagođavanje plana stiže uskoro');
  await expect(page.getByText('Prilagođavanje prema izvršenju')).toHaveCount(0);
  await back(page).click();

  // Sat: pregled slanja iz strukture; plan sa rezultatom nema preskočenih dana.
  await watchPreview(page);
  await expect(page.locator('#icu-pregled')).toContainText(/Pace/);
  await expect(page.locator('#icu-skipped')).toHaveCount(0);
  await expect(page.getByText(/Preskočeno dana trčanja/)).toHaveCount(0);
});

test('HM v2 po osećaju: RPE i tempo „orijentir (procena)", test 5 km u planu, sat preskače dane po osećaju', async ({
  page
}) => {
  const backend = await installBackend(page);
  await page.goto('/');
  await raceStep(page);
  await page.getByRole('button', { name: 'Nemam skoriji rezultat' }).click();
  await page.getByLabel('minuti').fill('6');
  await page.getByLabel('sekunde').fill('30');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('30');
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  await pickDays(page, ['Uto', 'Čet', 'Ned']);
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect.poll(() => serverPlan(backend)).toContain('"paceBasis":"feel"');
  expect(serverPlan(backend)).toContain('"tag":"test"');

  // Dan kvaliteta: napor (RPE) i tempo samo kao procena.
  await tab(page, 'Plan').click();
  const plan = page.locator('.page.active');
  await expect(
    plan.getByText(/RPE \d(–\d)?\), orijentir \(procena\) \d:\d\d\/km/).first()
  ).toBeVisible();
  await plan
    .getByRole('button', { name: /Tempo|Trkački ritam/ })
    .first()
    .click();
  const structure = page.getByRole('group', { name: 'Struktura treninga' });
  await expect(structure).toContainText(/RPE \d/);
  await expect(structure).toContainText(/orijentir \(procena\)/);
  await back(page).click();

  // Sat: dani sa delom po osećaju se ne šalju — broje se i navode sa razlogom.
  await watchPreview(page);
  await expect(page.getByText(/Preskočeno dana trčanja: \d+/)).toBeVisible();
  await expect(page.locator('#icu-skipped')).toContainText('deo po osećaju (RPE)');
  await back(page).click();

  // Nedelja testa: dan „Test" sa 5 km i procenom tempa.
  const testDate = await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!) as {
      genPlan: { weeks: Array<{ start: string; days: Array<{ tag?: string; dow: number }> }> };
    };
    for (const w of s.genPlan.weeks)
      for (const d of w.days)
        if (d.tag === 'test') {
          const t = new Date(`${w.start}T00:00:00Z`);
          t.setUTCDate(t.getUTCDate() + d.dow);
          return t.toISOString().slice(0, 10);
        }
    return null;
  }, STATE_KEY);
  expect(testDate).not.toBeNull();
  await fixToday(page, `${testDate}T09:00:00`);
  await page.reload();
  await tab(page, 'Plan').click();
  await expect(
    page
      .locator('.page.active')
      .getByText(/5 km — orijentir \(procena\) \d:\d\d\/km/)
      .first()
  ).toBeVisible();
});

test('HM v2: trčanje/hodanje → odbijanje v2 doslovno sa preporukom 5K, plan se ne pravi', async ({
  page
}) => {
  const backend = await installBackend(page);
  await page.goto('/');
  await raceStep(page);
  await page.getByRole('button', { name: 'Nemam skoriji rezultat' }).click();
  await page.getByLabel('minuti').fill('7');
  await page.getByLabel('sekunde').fill('30');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: 'Ne još' }).click();
  const notice = page.getByRole('status').filter({ hasText: 'Plan nije napravljen' });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText(
    'Plan polumaratona traži neprekidno trčanje; preporuka: 5K plan trčanja/hodanja.'
  );
  await expect(page.getByRole('button', { name: 'Dalje' })).toBeDisabled();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  expect((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null).toBeNull();
});
