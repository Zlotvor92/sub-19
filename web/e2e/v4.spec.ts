import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { back, logToday, runWizard, tab, type PlanInput } from './support/flows';
import { installV4 } from './support/v4';

/* F9 KORAK 7 — V4 POD UPALJENOM ZASTAVICOM (mreža lažirana: `support/v4.ts`). Za sve četiri distance: čarobnjak →
   plan pravi V4 (upis u `plan_v4`, `genPlan` ostaje prazan) → Plan tab, nedelja i dan → premeštanje (manual-edit) →
   ručna izmena dana → unos trčanja (sutradan, prvi dan plana). Sa ugašenom zastavicom isti čarobnjak pravi v2 plan. */

const INPUTS: Record<string, PlanInput> = {
  '5K': {
    dist: '5K',
    raceDate: '2026-04-12',
    pbDist: '5 km',
    pbMin: '22',
    pbSec: '30',
    weeklyKm: '32',
    days: ['Čet', 'Sub', 'Ned']
  },
  '10K': {
    dist: '10K',
    raceDate: '2026-04-12',
    pbDist: '10 km',
    pbMin: '45',
    pbSec: '0',
    weeklyKm: '40',
    days: ['Uto', 'Čet', 'Sub', 'Ned']
  },
  Polumaraton: {
    dist: 'Polumaraton',
    raceDate: '2026-04-26',
    pbDist: '10 km',
    pbMin: '45',
    pbSec: '0',
    weeklyKm: '40',
    days: ['Uto', 'Čet', 'Sub', 'Ned']
  },
  Maraton: {
    dist: 'Maraton',
    raceDate: '2026-05-10',
    pbDist: '10 km',
    pbMin: '45',
    pbSec: '0',
    weeklyKm: '45',
    days: ['Uto', 'Čet', 'Sub', 'Ned']
  }
};

const SYNC = { timeout: 15_000 };

async function emptyAccount(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('__e2e_v4')) return;
    sessionStorage.setItem('__e2e_v4', '1');
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
          novo: null
        }
      })
    );
  }, 'sub19-v1:account:u-e2e');
}

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await emptyAccount(page);
});

for (const [name, input] of Object.entries(INPUTS)) {
  test(`V4 ${name}: čarobnjak → plan_v4 → nedelja/dan → premeštanje → izmena → unos trčanja`, async ({
    page
  }) => {
    const backend = await installBackend(page);
    const v4 = installV4(backend);
    await page.goto('/');
    await expect.poll(() => backend.count('/rest/v1/plan_v4?', 'GET'), SYNC).toBeGreaterThan(0);
    await runWizard(page, input);
    await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();

    // plan je napravio V4 i upisan je u plan_v4; stari genPlan se ne dira
    await expect.poll(() => v4.row?.rev ?? 0, SYNC).toBe(1);
    expect(v4.row?.doc.weeks.length ?? 0).toBeGreaterThan(4);
    expect((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null).toBeNull();

    // nedelja i dan
    await tab(page, 'Plan').click();
    const plan = page.locator('.page.active');
    await expect(plan.locator('.plan-row').first()).toBeVisible();
    await plan.locator('.plan-row:not(.s-rest)').first().click();
    await expect(back(page)).toBeVisible();
    await back(page).click();

    // premeštanje: dva poslednja dana prve nedelje (budući) → nov rev + manual-edit
    await tab(page, 'Plan').click();
    await page
      .locator('.page.active')
      .getByRole('button', { name: /^Pomeri treninge/ })
      .click();
    const sheet = page.getByRole('dialog');
    const rows = sheet.locator('button.swap-row');
    const n = await rows.count();
    expect(n).toBeGreaterThan(1);
    await rows.nth(n - 1).click();
    await rows.nth(n - 2).click();
    await expect.poll(() => v4.row?.rev ?? 0, SYNC).toBe(2);
    await expect.poll(() => v4.events.map((e) => e.vrsta), SYNC).toContain('manual-edit');
    await expect(sheet.getByText(/pomeren sa/).first()).toBeVisible();
    expect(
      Object.keys(
        ((backend.row?.data as { moves?: Record<string, unknown> } | undefined)?.moves ??
          {}) as object
      )
    ).toHaveLength(0);
    // „Vrati raspored nedelje na plan" pod V4 → nov rev, nema više pomerenih dana
    await sheet.getByRole('button', { name: 'Vrati raspored nedelje na plan' }).click();
    await page.getByRole('button', { name: 'Da', exact: true }).click();
    await expect.poll(() => v4.row?.rev ?? 0, SYNC).toBe(3);
    await expect(sheet.getByText(/pomeren sa/)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();

    // ručna izmena dana: kilometraža 5 → dan je „manual" u planu V4
    await tab(page, 'Plan').click();
    await page.locator('.page.active .plan-row:not(.s-rest)').last().click();
    await page.getByRole('button', { name: /^Zameni ili skrati/ }).click();
    const alt = page.getByRole('dialog');
    await alt.getByLabel('Kilometraža').fill('5');
    await alt.getByRole('button', { name: 'Sačuvaj' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect.poll(() => v4.row?.rev ?? 0, SYNC).toBe(4);
    // vraćanje ručne izmene (dan dobija trening iz plana)
    await page.getByRole('button', { name: /^Zameni ili skrati/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Vrati na plan' }).click();
    await page.getByRole('button', { name: 'Da', exact: true }).click();
    await expect.poll(() => v4.row?.rev ?? 0, SYNC).toBe(5);
    await back(page).click();

    // unos trčanja: sutradan je prvi dan plana (motor počinje sutra)
    await page.clock.setFixedTime(new Date('2026-01-15T09:00:00'));
    await page.reload();
    await tab(page, 'Danas').click();
    await logToday(page, { km: '8,0', time: '4400' });
    await expect
      .poll(
        () =>
          Object.values(
            ((backend.row?.data as { log?: Record<string, { km?: number }> } | undefined)?.log ??
              {}) as Record<string, { km?: number }>
          )[0]?.km,
        SYNC
      )
      .toBe(8);
    expect(v4.row?.rev).toBe(5); // unos trčanja ne menja plan
  });
}

test('V4 ugašen (nema reda u v4_pristup): isti čarobnjak pravi v2 plan, plan_v4 se ne piše', async ({
  page
}) => {
  const backend = await installBackend(page);
  const v4 = installV4(backend, false);
  await page.goto('/');
  await expect.poll(() => backend.count('/rest/v1/v4_pristup'), SYNC).toBeGreaterThan(0);
  await runWizard(page, INPUTS['10K']);
  await expect
    .poll(
      () =>
        JSON.stringify((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null),
      SYNC
    )
    .toContain('"policyId":"10k-v2"');
  expect(v4.row).toBeNull();
  expect(backend.count('/rest/v1/plan_v4?')).toBe(0);
});

test('V4: trčanje/hodanje (ne mogu 30 min) za 10K se ne odbija — plan uz upozorenje', async ({
  page
}) => {
  const backend = await installBackend(page);
  const v4 = installV4(backend);
  await page.goto('/');
  await expect.poll(() => backend.count('/rest/v1/plan_v4?', 'GET'), SYNC).toBeGreaterThan(0);
  const input = { ...INPUTS['10K'], weeklyKm: '8', run30: 'Ne još' as const };
  await runWizard(page, input);
  await expect.poll(() => v4.row?.rev ?? 0, SYNC).toBe(1);
  await tab(page, 'Plan').click();
  await expect(page.locator('.page.active .plan-warn')).toBeVisible();
});
