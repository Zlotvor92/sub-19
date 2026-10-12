import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { adaptGeneratedPlan } from '../src/domain/plan/adapt';
import type { GenPlanState, LogEntry } from '../src/domain/state';
import type { PlanGenerationInput, PlanGenerationResult } from '../src/domain/training/types';
import { fixToday, installBackend, seedSession } from './support/backend';
import { back, openAdjust, tab } from './support/flows';

interface LockedProfile {
  id: string;
  label: string;
  input: PlanGenerationInput;
  event: { kind: string; breakDays?: number };
  eventToday: string;
}
interface Persisted {
  genPlan?: GenPlanState;
  log?: Record<string, LogEntry>;
}
const root = resolve(process.cwd(), '../docs/qa/generator-ab');
const profiles = JSON.parse(readFileSync(resolve(root, 'inputs.json'), 'utf8')) as LockedProfile[];
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
const raceLabel = (m: number) =>
  ({ 5000: '5K', 10000: '10K', 21097.5: 'Polumaraton', 42195: 'Maraton' })[m]!;
const pbLabel = (m: number) =>
  ({ 5000: '5 km', 10000: '10 km', 21097.5: 'Polumaraton', 42195: 'Maraton' })[m]!;
const intensityLabel = { kons: 'Konzervativno', std: 'Standardno', agr: 'Agresivno' };

async function fillTime(page: Page, seconds: number, hours: boolean): Promise<void> {
  if (hours)
    await page.getByLabel('sati', { exact: true }).fill(String(Math.floor(seconds / 3600)));
  await page
    .getByLabel('minuti', { exact: true })
    .fill(String(hours ? Math.floor(seconds / 60) % 60 : Math.floor(seconds / 60)));
  await page.getByLabel('sekunde', { exact: true }).fill(String(seconds % 60));
}

/** Every locked input goes through the actual wizard. Only authentication is seeded. */
async function lockedWizard(page: Page, input: PlanGenerationInput): Promise<void> {
  const wizard = page.getByRole('dialog', { name: 'Pravljenje plana' });
  await expect(wizard).toBeVisible();
  await expect(async () => {
    await group(page, 'Ciljna distanca')
      .getByRole('button', { name: raceLabel(input.raceDistM!), exact: true })
      .click({ timeout: 2000 });
    await page.getByLabel('Datum trke').fill(input.raceDate, { timeout: 2000 });
    await expect(page.getByRole('button', { name: 'Dalje' })).toBeEnabled({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Dalje' }).click();
  await group(page, 'Distanca rezultata')
    .getByRole('button', { name: pbLabel(input.pb.distM), exact: true })
    .click();
  await fillTime(page, input.pb.sec, input.pb.distM >= 21097.5);
  await page.getByLabel('Datum rezultata').fill(input.pb.date!);
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByLabel('Nedeljna kilometraža', { exact: true }).fill(String(input.weeklyKm));
  await group(page, 'Redovno trčanje')
    .getByRole('button', { name: input.trainedRecently ? 'Da, redovno' : 'Ne / tek počinjem' })
    .click();
  await page.getByText('Tvoja trenutna baza — opciono', { exact: true }).click();
  await page.getByLabel('Skorašnja ponovljiva dužina (km)').fill(String(input.recentLongRunKm));
  await page
    .getByLabel('Nedelja redovnog trčanja u kontinuitetu')
    .fill(String(input.consistentWeeks));
  await page.getByLabel('Skorašnja pauza (nedelja)').fill(String(input.breakWeeks));
  await page
    .getByLabel('Iskustvo sa intervalima i tempo treningom')
    .selectOption(input.qualityExperience!);
  await group(page, 'Dana trčanja nedeljno')
    .getByRole('button', { name: String(input.runDays), exact: true })
    .click();
  await group(page, 'Dan za dugo trčanje')
    .getByRole('button', { name: 'Ned', exact: true })
    .click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  await group(page, 'Kvalitetnih treninga nedeljno')
    .getByRole('button', { name: String(input.quality), exact: true })
    .click();
  await group(page, 'Težina kvalitetnog rada')
    .getByRole('button', { name: intensityLabel[input.intensity], exact: true })
    .click();
  await group(page, 'Tempo rasta obima')
    .getByRole('button', { name: intensityLabel[input.volIntensity!], exact: true })
    .click();
  await fillTime(page, input.goalSec!, input.raceDistM! >= 21097.5);
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(wizard).toBeHidden();
}

async function attachJson(info: TestInfo, name: string, value: unknown): Promise<void> {
  await info.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2)),
    contentType: 'application/json'
  });
}
async function screenshot(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
}

// CI command uses --workers=2. One independent browser context per locked synthetic athlete.
test.describe('locked inputs: current purpose- and dose-aware wizard and persistence flows', () => {
  test.describe.configure({ mode: 'parallel', timeout: 90_000 });
  for (const profile of profiles) {
    test(`${profile.id}: ${profile.label}`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await fixToday(page, `${profile.input.startDate}T09:00:00Z`);
      await seedSession(page, {
        email: `${profile.id.toLowerCase()}@sub20.test`,
        userId: profile.id
      });
      const backend = await installBackend(page);
      const state = (): Persisted => backend.row?.data ?? {};
      const revisions = () =>
        (state().genPlan?.['planRevisions'] ?? []) as Array<{ reason: string; summary: string }>;
      // Historical raw/blind plans and earlier segment outputs stay frozen. The current
      // generator output (purpose + quality dose + HM progression) is separate evidence.
      const current = JSON.parse(
        readFileSync(resolve(root, `../hm-progression/${profile.id}.json`), 'utf8')
      ) as { plan: PlanGenerationResult };
      const expected = adaptGeneratedPlan(current.plan)!;
      // Empty scheduling arrays are genuine wizard serialization, absent from the locked domain input.
      const wizardInput = { ...profile.input, qDows: [], runDows: [] };
      expected.ulaz = wizardInput;
      await page.goto('/');
      await lockedWizard(page, profile.input);
      await expect.poll(() => state().genPlan?.ulaz).toEqual(wizardInput);
      await attachJson(info, `${profile.id}-wizard-input`, state().genPlan?.ulaz);
      await attachJson(info, `${profile.id}-full-browser-generated-plan`, state().genPlan);
      expect(state().genPlan).toEqual(expected);
      await tab(page, 'Plan').click();
      await expect(
        page.getByRole('heading', { name: `Nedelja 1 od ${expected.weeks.length}` })
      ).toBeVisible();
      await screenshot(page, info, `${profile.id}-initial-plan`);
      await page.getByRole('button', { name: 'Sledeća nedelja' }).click();
      await expect(
        page.getByRole('heading', { name: `Nedelja 2 od ${expected.weeks.length}` })
      ).toBeVisible();
      await page.getByRole('button', { name: 'Prethodna nedelja' }).click();
      await page.reload();
      await tab(page, 'Plan').click();
      expect(state().genPlan).toEqual(expected);

      await fixToday(page, `${profile.eventToday}T09:00:00Z`);
      await page.reload();
      await openAdjust(page);
      await page.getByLabel('Šta želiš da prilagodiš?').selectOption('return');
      const breakDays = profile.event.kind === 'return' ? profile.event.breakDays! : 14;
      await attachJson(info, `${profile.id}-browser-event-scope`, {
        specificDomainEvent: profile.event,
        browserPersistenceEvent: { kind: 'confirmed-return', breakDays },
        controlledCommonReturn: profile.event.kind !== 'return',
        today: profile.eventToday
      });
      await page.getByLabel('Trajanje pauze').selectOption(String(breakDays));
      await page
        .getByLabel('Ponovljiva baza pre pauze (km/ned)')
        .fill(String(profile.input.weeklyKm));
      await page
        .getByLabel('Ponovljiva dužina pre pauze (km, opciono)')
        .fill(String(profile.input.recentLongRunKm));
      await page.getByRole('button', { name: 'Pregledaj predlog', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Potvrdi da si zaista pravio pauzu');
      expect(state().genPlan).toEqual(expected);
      await page.getByRole('checkbox', { name: /Potvrđujem da sam pravio navedenu pauzu/ }).check();
      await page.getByRole('button', { name: 'Pregledaj predlog', exact: true }).click();
      const preview = page.locator('#plan-change-preview');
      // The locked U08 HM race has only eight remaining calendar weeks: minimum is ten.
      if (profile.id === 'U08') {
        await expect(page.getByRole('alert')).toContainText(
          'Preostalo vreme ne podržava novi pun ciklus'
        );
        await expect(page.getByRole('alert')).toContainText('Datum trke nije automatski pomeren');
        await expect(preview).toHaveCount(0);
        expect(state().genPlan).toEqual(expected);
        expect(revisions()).toHaveLength(0);
        await screenshot(page, info, `${profile.id}-expected-short-cycle-block`);
        await page.reload();
        await openAdjust(page);
        expect(state().genPlan).toEqual(expected);
        expect(revisions()).toHaveLength(0);
        await attachJson(info, `${profile.id}-blocked-persisted-state`, state());
        expect(errors).toEqual([]);
        return;
      }
      await expect(preview.getByRole('heading', { name: 'Pregled promene' })).toBeVisible();
      await expect(
        preview.getByRole('table', { name: 'Preostali km pre i posle promene' })
      ).toBeVisible();
      await expect(preview.getByText(/kvalitetan rad .*→ 0,0 min/).first()).toBeVisible();
      expect(state().genPlan).toEqual(expected);
      expect(revisions()).toHaveLength(0);
      await screenshot(page, info, `${profile.id}-confirmed-return-preview`);
      await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
      await expect.poll(() => revisions().length).toBe(1);
      expect(revisions()[0].reason).toBe('execution');
      expect(revisions()[0].summary).toContain(`Povratak posle ${breakDays} dana`);
      expect(state().genPlan?.weeks).not.toEqual(expected.weeks);
      await attachJson(info, `${profile.id}-full-return-plan`, state().genPlan);
      const applied = copy(state().genPlan);
      await page.reload();
      await openAdjust(page);
      await expect(page.getByRole('button', { name: /^Pregledaj vraćanje:/ })).toHaveCount(1);
      expect(state().genPlan).toEqual(applied);
      await screenshot(page, info, `${profile.id}-persisted-history`);

      // Enter a real run through a prescribed day row. This also works on profiles whose Wednesday is rest.
      await back(page).click();
      await tab(page, 'Plan').click();
      await page
        .locator('.page.active .plan-row')
        .filter({ hasText: /\d(?:[,.]\d+)? km/ })
        .first()
        .click();
      await expect(page.getByRole('group', { name: 'Status treninga' })).toBeVisible();
      const runId = (await page.locator('.f-grid[data-day]').getAttribute('data-day'))!;
      await group(page, 'Status treninga')
        .getByRole('button', { name: 'Odrađen', exact: true })
        .click();
      await page.getByLabel(/Distanca \(km\)/).fill('6,2');
      await page.getByLabel(/^Vreme/).fill('3400');
      await page.getByLabel(/^Vreme/).blur();
      await expect
        .poll(() => state().log?.[runId])
        .toMatchObject({ status: 'done', km: 6.2, sec: 2040 });
      const logBeforeRestore = copy(state().log);
      await back(page).click();
      await openAdjust(page);
      await page.getByRole('button', { name: /^Pregledaj vraćanje:/ }).click();
      await expect(preview.getByRole('heading', { name: 'Pregled promene' })).toBeVisible();
      expect(revisions()).toHaveLength(1);
      expect(state().log).toEqual(logBeforeRestore);
      await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
      await expect.poll(() => revisions().length).toBe(2);
      expect(revisions()[1].reason).toBe('restore');
      expect(state().log).toEqual(logBeforeRestore);
      await page.reload();
      await tab(page, 'Plan').click();
      await page.locator('.page.active .plan-row.s-done').first().click();
      await expect(page.getByLabel(/Distanca \(km\)/)).toHaveValue('6,2');
      await expect(page.getByLabel(/^Vreme/)).toHaveValue('34:00');
      expect(state().log).toEqual(logBeforeRestore);
      await back(page).click();
      await openAdjust(page);
      await expect(page.getByRole('button', { name: /^Pregledaj vraćanje:/ })).toHaveCount(2);
      await screenshot(page, info, `${profile.id}-restore-history-and-log`);
      await attachJson(info, `${profile.id}-full-restored-state`, state());
      expect(errors).toEqual([]);
    });
  }
});
