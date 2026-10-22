import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { tab } from './support/flows';

/* FAZA 3, SEGMENT 3g — predaja „kraća distanca" za izvore v2 kroz pravi interfejs, po kombinaciji prekidača korisnika
   (lokalno stanje naloga pre pokretanja, kao u `hm-v2.spec.ts`). Plan se pravi u čarobnjaku 2026-01-14 (start
   2026-01-19); predaja se radi u utorak druge ili prve nedelje plana, posle prijavljene pauze od 35 dana:
   (a) HM v2 po osećaju → 5K v2 (prekidač 5K v2): ponuda u pregledu → primena → odluka → izbor → plan 5K v2 sa
       nedeljama izvora kao prefiksom, revizija na serveru; (f) vraćanje verzije HM preko plana 5K → razlog, plan isti;
   (b) maraton v2 → HM v2 (prekidač HM v2);
   (c) HM v2 sa rezultatom → 10K v1 (prekidač 10K v2 isključen);
   (d) HM v2 po osećaju bez rezultata, ciljevi v1 → opcije nedostupne sa razlogom doslovno; (e) „Zatvori" ne menja
       plan, odluka se ponovo prikazuje pri sledećem otvaranju. */

const STATE_KEY = 'sub19-v1:account:u-e2e';
const NEEDS_RESULT =
  'Kraća distanca nije dostupna: plan te distance (v1) traži rezultat trke ili testa pre početka novog plana, a ovaj plan ga nema.';
const RESTORE_OTHER =
  'Sačuvana verzija je plan druge distance (pre izbora kraće distance), pa se ne može vratiti preko ovog plana.';

type Flags = Partial<
  Record<
    'generatorV2FiveK' | 'generatorV2TenK' | 'generatorV2HalfMarathon' | 'generatorV2Marathon',
    boolean
  >
>;
async function enableFlags(page: Page, flags: Flags): Promise<void> {
  await page.addInitScript(
    ({ key, flags }) => {
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
            ...flags
          }
        })
      );
    },
    { key: STATE_KEY, flags }
  );
}

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
/** Upis na server ide tek PUSH_DEBOUNCE_MS (4 s) posle poslednje izmene (v. `hm-v2.spec.ts`). */
const SYNC = { timeout: 15_000 };
type Backend = Awaited<ReturnType<typeof installBackend>>;
const serverPlan = (backend: Backend): string =>
  JSON.stringify((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null);

async function raceStep(page: Page, distance: string, date: string, shown: RegExp): Promise<void> {
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  await expect(async () => {
    await group(page, 'Ciljna distanca')
      .getByRole('button', { name: distance, exact: true })
      .click({ timeout: 2000 });
    await page.getByLabel('Datum trke').fill(date, { timeout: 2000 });
    await expect(page.getByText(shown)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Dalje' }).click();
}
async function pickDays(page: Page, days: string[]): Promise<void> {
  const g = group(page, 'Dani trčanja');
  for (const d of days) await g.getByRole('button', { name: d, exact: true }).click();
}
async function finish(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
}

/** HM v2 po osećaju (lak tempo 6:30, 30 km, 3 dana). */
async function hmFeelPlan(page: Page): Promise<void> {
  await raceStep(page, 'Polumaraton', '2026-04-12', /Plan polumaratona v2: 12 nedelja/);
  await page.getByRole('button', { name: 'Nemam skoriji rezultat' }).click();
  await page.getByLabel('minuti').fill('6');
  await page.getByLabel('sekunde').fill('30');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('30');
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  await pickDays(page, ['Uto', 'Čet', 'Ned']);
  await group(page, 'Dan dugog trčanja').getByRole('button', { name: 'Ned', exact: true }).click();
  await finish(page);
}

/** Pomeranje dana (sat) i otvaranje „Prilagodi plan"; prijavljena pauza 35 dana do danas → pregled. */
async function pauseReview(page: Page, today: string, from: string): Promise<void> {
  await fixToday(page, `${today}T09:00:00`);
  await page.reload();
  await tab(page, 'Plan').click();
  await page
    .locator('.page.active')
    .getByRole('button', { name: /^Prilagodi plan/ })
    .click();
  await page.getByLabel('Pauza od').fill(from);
  await page.getByLabel('Pauza do').fill(today);
  await page.getByRole('button', { name: 'Dodaj pauzu' }).click();
}

/** Ponuda u pregledu → primena prilagođavanja → odluka o pripremi. */
async function applyWithOffer(page: Page, backend: Backend, distance: string, day: string) {
  const preview = page.locator('#plan-change-preview');
  await expect(preview.getByRole('note')).toContainText(
    `Posle ovog prilagođavanja plan nije puna priprema za ${distance}`
  );
  await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect.poll(() => serverPlan(backend), SYNC).toContain(`Prilagođavanje ${day}: pauza`);
  const decision = page.locator('#plan-decision');
  await expect(decision).toContainText('Posle prilagođavanja najduži dugi u planu je');
  return decision;
}

/** Izbor opcije → pregled (pre → posle) → primena → revizija na serveru. */
async function choose(page: Page, backend: Backend, title: string): Promise<void> {
  await page
    .locator('#plan-decision')
    .getByRole('button', { name: `Pregledaj opciju: ${title}` })
    .click();
  const preview = page.locator('#plan-change-preview');
  await expect(preview).toContainText(title);
  await expect(preview.getByLabel('Promena trke i cilja')).toContainText('bez vremenskog cilja');
  await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect.poll(() => serverPlan(backend), SYNC).toContain(`"summary":"${title}"`);
}

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
});

test('(a)(f) HM v2 po osećaju → 5K v2: ponuda posle pauze 35 d → izbor → plan 5K v2 sa prefiksom → vraćanje HM verzije odbijeno', async ({
  page
}) => {
  await enableFlags(page, { generatorV2HalfMarathon: true, generatorV2FiveK: true });
  const backend = await installBackend(page);
  await page.goto('/');
  await hmFeelPlan(page);
  await expect.poll(() => serverPlan(backend), SYNC).toContain('"policyId":"hm-v2"');

  await pauseReview(page, '2026-01-27', '2025-12-24');
  const decision = await applyWithOffer(page, backend, 'polumaraton', '2026-01-27');
  await expect(decision).toContainText('Kraća distanca: 5K istog datuma');
  await expect(decision.getByRole('list', { name: 'Nedostupne opcije' })).toContainText(
    `10K: ${NEEDS_RESULT}`
  );
  await choose(page, backend, 'Kraća distanca: 5K istog datuma');
  expect(serverPlan(backend)).toContain('"policyId":"5k-v2"');
  expect(serverPlan(backend)).toContain('"fiveKV2Prefix":{"offset":2');

  // Prefiks: tekuća nedelja je nedelja izvora — broj nedelje u kalendaru je offset + index.
  await page.reload();
  await tab(page, 'Plan').click();
  await expect(
    page.locator('.page.active').getByRole('heading', { name: 'Nedelja 2 od 12' })
  ).toBeVisible();

  // (f) Vraćanje verzije HM (pre predaje) preko plana 5K: razlog domena, ništa se ne upisuje.
  await page
    .locator('.page.active')
    .getByRole('button', { name: /^Prilagodi plan/ })
    .click();
  const after = serverPlan(backend);
  await page
    .getByRole('button', { name: 'Pregledaj vraćanje: Prilagođavanje 2026-01-27: pauza' })
    .click();
  await expect(page.locator('#v2-adapt-rejected')).toContainText(RESTORE_OTHER);
  expect(serverPlan(backend)).toBe(after);
});

test('(b) maraton v2 → HM v2 (prekidač HM v2): ponuda → izbor → plan HM v2 sa prefiksom', async ({
  page
}) => {
  await enableFlags(page, { generatorV2Marathon: true, generatorV2HalfMarathon: true });
  const backend = await installBackend(page);
  await page.goto('/');
  await raceStep(page, 'Maraton', '2026-05-10', /Plan maratona v2: 16 nedelja/);
  await page.getByRole('button', { name: 'Imam rezultat' }).click();
  await page.getByLabel('minuti').fill('38');
  await page.getByLabel('sekunde').fill('0');
  await page.getByLabel('Datum rezultata').fill('2026-01-10');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('50');
  await page.getByLabel('Najduže skorašnje trčanje (km)').fill('24');
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  await pickDays(page, ['Uto', 'Čet', 'Sub', 'Ned']);
  await group(page, 'Dan dugog trčanja').getByRole('button', { name: 'Ned', exact: true }).click();
  await page.getByLabel('sati').fill('3');
  await page.getByLabel('minuti').fill('10');
  await page.getByLabel('sekunde').fill('0');
  await finish(page);
  await expect.poll(() => serverPlan(backend), SYNC).toContain('"policyId":"marathon-v2"');

  await pauseReview(page, '2026-01-27', '2025-12-24');
  await applyWithOffer(page, backend, 'maraton', '2026-01-27');
  await choose(page, backend, 'Kraća distanca: Polumaraton istog datuma');
  expect(serverPlan(backend)).toContain('"policyId":"hm-v2"');
  expect(serverPlan(backend)).toContain('"hmV2Prefix":{"offset":2');
});

test('(c) HM v2 sa rezultatom → 10K v1 (prekidač 10K v2 isključen)', async ({ page }) => {
  await enableFlags(page, { generatorV2HalfMarathon: true, generatorV2TenK: false });
  const backend = await installBackend(page);
  await page.goto('/');
  await raceStep(page, 'Polumaraton', '2026-04-12', /Plan polumaratona v2: 12 nedelja/);
  await page.getByRole('button', { name: 'Imam rezultat' }).click();
  await page.getByLabel('minuti').fill('45');
  await page.getByLabel('sekunde').fill('0');
  await page.getByLabel('Datum rezultata').fill('2026-01-10');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await page.getByLabel('Nedeljna kilometraža').fill('40');
  await page.getByLabel('Najduže skorašnje trčanje (km)').fill('16');
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  await pickDays(page, ['Uto', 'Čet', 'Sub', 'Ned']);
  await group(page, 'Dan dugog trčanja').getByRole('button', { name: 'Ned', exact: true }).click();
  await page.getByLabel('sati').fill('1');
  await page.getByLabel('minuti').fill('40');
  await page.getByLabel('sekunde').fill('0');
  await finish(page);
  await expect.poll(() => serverPlan(backend), SYNC).toContain('"policyId":"hm-v2"');

  await pauseReview(page, '2026-01-20', '2025-12-17');
  const decision = await applyWithOffer(page, backend, 'polumaraton', '2026-01-20');
  await expect(decision).toContainText(/najduže [\d,]+ km · vrhunac [\d,]+ km\/ned/);
  await choose(page, backend, 'Kraća distanca: 10K istog datuma');
  expect(serverPlan(backend)).toContain('"policyId":"10k-v1"');
  // Plan cilja je u formatu v1: bez objekta HM v2 (stari plan HM v2 je samo u istoriji verzija).
  const top = JSON.parse(serverPlan(backend)) as Record<string, unknown>;
  expect('hmV2' in top).toBe(false);
  expect(top['ulaz']).toBeTruthy();
});

test('(d)(e) HM v2 po osećaju, ciljevi v1: opcije nedostupne sa razlogom doslovno; „Zatvori" ne menja plan', async ({
  page
}) => {
  await enableFlags(page, { generatorV2HalfMarathon: true });
  const backend = await installBackend(page);
  await page.goto('/');
  await hmFeelPlan(page);
  await expect.poll(() => serverPlan(backend), SYNC).toContain('"policyId":"hm-v2"');

  await pauseReview(page, '2026-01-27', '2025-12-24');
  const decision = await applyWithOffer(page, backend, 'polumaraton', '2026-01-27');
  const list = decision.getByRole('list', { name: 'Nedostupne opcije' });
  await expect(list.getByRole('listitem')).toHaveText([
    `10K: ${NEEDS_RESULT}`,
    `5K: ${NEEDS_RESULT}`
  ]);
  await expect(decision.getByRole('button', { name: /^Pregledaj opciju/ })).toHaveCount(0);

  // (e) „Zatvori" (zadrži plan v2): odluka nestaje, plan se ne menja; stanje traje → ponovo pri otvaranju.
  const adapted = serverPlan(backend);
  await decision.getByRole('button', { name: 'Zatvori' }).click();
  await expect(page.locator('#plan-decision')).toHaveCount(0);
  await page.reload();
  await tab(page, 'Plan').click();
  await page
    .locator('.page.active')
    .getByRole('button', { name: /^Prilagodi plan/ })
    .click();
  await expect(page.locator('#plan-decision')).toBeVisible();
  expect(serverPlan(backend)).toBe(adapted);
  expect(serverPlan(backend)).toContain('"policyId":"hm-v2"');
});
