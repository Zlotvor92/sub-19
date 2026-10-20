import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { back, tab } from './support/flows';

/* 10K v2 SEGMENT 05/06 — 10K v2 iza prekidača kroz pravi interfejs: podešavanje `ui.generatorV2TenK` je uključeno u lokalnom
   stanju naloga pre pokretanja (novi korisnik bez plana vidi samo čarobnjaka; prekidač u Podešavanjima vidi samo
   administrator ili razvoj). Tokovi: (1) čarobnjak sa rezultatom → plan `10k-v2` na serveru → Plan tab i dan iz strukture
   → Prilagodi plan: pregled iz činjenica, prijavljena pauza → primena → revizija (segment 06); (2) čarobnjak po osećaju → RPE i tempo „orijentir (procena)", test 5 km u planu;
   (3) trčanje/hodanje → odbijanje v2 doslovno sa preporukom 5K, plan se ne pravi. */

const STATE_KEY = 'sub19-v1:account:u-e2e';

async function enableTenKV2(page: Page): Promise<void> {
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
          generatorV2TenK: true
        }
      })
    );
  }, STATE_KEY);
}

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
/** Upis na server ide tek PUSH_DEBOUNCE_MS (4 s) posle poslednje izmene; podrazumevanih 5 s za `expect.poll` je na
 *  opterećenom CI-ju premalo (hm-v2 „pauza → revizija" pao 1× na c7ee38a: server još bez revizije posle 5 s). */
const SYNC = { timeout: 15_000 };
const serverPlan = (backend: Awaited<ReturnType<typeof installBackend>>): string =>
  JSON.stringify((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null);

async function raceStep(page: Page): Promise<void> {
  const wizard = page.getByRole('dialog', { name: 'Pravljenje plana' });
  await expect(wizard).toBeVisible();
  await expect(async () => {
    await group(page, 'Ciljna distanca')
      .getByRole('button', { name: '10K', exact: true })
      .click({ timeout: 2000 });
    await page.getByLabel('Datum trke').fill('2026-04-12', { timeout: 2000 });
    await expect(page.getByText(/Plan 10K v2: 12 nedelja/)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Dalje' }).click();
}

async function pickDays(page: Page, days: string[]): Promise<void> {
  const g = group(page, 'Dani trčanja');
  for (const d of days) await g.getByRole('button', { name: d, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await enableTenKV2(page);
});

test('10K v2: čarobnjak (rezultat, 4 dana) → plan v2 → Plan tab i dan pokazuju strukturu', async ({
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
  // 3. trčanje bez prekida, obim, iskustvo
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('40');
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  // 4. dani, dan dugog, cilj
  await pickDays(page, ['Uto', 'Čet', 'Sub', 'Ned']);
  await group(page, 'Dan dugog trčanja').getByRole('button', { name: 'Ned', exact: true }).click();
  await page.getByLabel('minuti').fill('43');
  await page.getByLabel('sekunde').fill('0');
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();

  // Plan v2 je sačuvan (i na serveru) sa oznakom politike v2 i izlazom v2.
  await expect.poll(() => serverPlan(backend), SYNC).toContain('"policyId":"10k-v2"');
  expect(serverPlan(backend)).toContain('"policyVersion":"10k-v2.6.0"');
  expect(serverPlan(backend)).toContain('"tenKV2":{');

  // Plan tab: ocena cilja doslovno iz v2 i struktura u redovima nedelje (rad sa tempom).
  await tab(page, 'Plan').click();
  const plan = page.locator('.page.active');
  await expect(plan.locator('#goal-assessment')).toContainText('Cilj:');
  await expect(plan.getByText(/km @ \d:\d\d\/km|× \d+ m @ \d:\d\d\/km/).first()).toBeVisible();

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

  // Prilagođavanje (segment 06): pregled iz činjenica, bez alata 10K v1; prijavljena pauza → pregled → primena → revizija.
  await back(page).click();
  await tab(page, 'Plan').click();
  await page
    .locator('.page.active')
    .getByRole('button', { name: /^Prilagodi plan/ })
    .click();
  const preview = page.locator('#plan-change-preview');
  await expect(preview).toContainText('bez novih činjenica');
  await expect(preview).toContainText('Budući deo plana se ne menja.');
  await expect(page.getByText('Prilagođavanje prema izvršenju')).toHaveCount(0);
  const before = serverPlan(backend);
  await page.getByLabel('Pauza od').fill('2026-01-05');
  await page.getByLabel('Pauza do').fill('2026-01-14');
  await page.getByRole('button', { name: 'Dodaj pauzu' }).click();
  await expect(preview.getByRole('list', { name: 'Razlozi prilagođavanja' })).toContainText(
    'Pauza (prijavljena) 10 dana'
  );
  await expect(preview.getByRole('table', { name: 'Promenjene nedelje' })).toBeVisible();
  expect(serverPlan(backend)).toBe(before); // pregled ne upisuje
  await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Plan je prilagođen' })).toBeVisible();
  await expect.poll(() => serverPlan(backend), SYNC).toContain('Prilagođavanje 2026-01-14: pauza');
  expect(serverPlan(backend)).toContain('"policyId":"10k-v2"');
  expect(serverPlan(backend)).toContain('"asOf":"2026-01-14"');
});

test('10K v2 po osećaju: RPE i tempo „orijentir (procena)", test 5 km u planu', async ({
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
  await page.getByLabel('Nedeljna kilometraža').fill('25');
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  await pickDays(page, ['Uto', 'Čet', 'Ned']);
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect.poll(() => serverPlan(backend), SYNC).toContain('"paceBasis":"feel"');
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

test('10K v2: trčanje/hodanje → odbijanje v2 doslovno sa preporukom 5K, plan se ne pravi', async ({
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
    '10K plan traži neprekidno trčanje ≥ 30 min; preporuka: 5K plan (trčanje/hodanje).'
  );
  await expect(page.getByRole('button', { name: 'Dalje' })).toBeDisabled();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  expect((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null).toBeNull();
});
