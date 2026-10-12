import { expect, test } from '@playwright/test';
import { resolvePlan } from '../src/domain/plan/resolve';
import { getPlanRevisions } from '../src/domain/plan/versions';
import type { GenPlanState, PersistedState } from '../src/domain/state';
import { matchPlanRows, type StoredPredRow } from '../src/domain/training/adaptation/matching';
import { fixToday, installBackend, seedSession } from './support/backend';
import { back, createPlan, logToday, openAdjust, TEN_K } from './support/flows';

/** Every mutation uses the real wizard/UI. Backend/domain reads observe saved state only.
 * Mock auth/backend: no live-service sync or watch-export claim; no plan/log/overlay injection. */
test('return apply/reload/restore/reload preserves future alt, moved date, measured lock and actuals', async ({
  page
}, info) => {
  test.setTimeout(120_000);
  await fixToday(page);
  await seedSession(page);
  const backend = await installBackend(page);
  const state = (): Partial<PersistedState> => backend.row?.data ?? {};
  const plan = (): GenPlanState => {
    const current = state().genPlan;
    if (!current) throw new Error('Wizard plan has not reached the backend');
    return current;
  };
  const resolved = () =>
    resolvePlan(plan().weeks, { alts: state().alts ?? {}, moves: state().moves ?? {} });
  const rows = () => plan().pred.filter((r): r is StoredPredRow => typeof r.id === 'string');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await createPlan(page, {
    ...TEN_K,
    pbDate: '2025-12-20',
    history: {
      longRunKm: '12',
      consistentWeeks: '24',
      breakWeeks: '0',
      qualityExperience: 'experienced'
    }
  });
  await expect.poll(() => state().genPlan?.weeks.length ?? 0).toBeGreaterThan(2);
  // Public day links open the same Details screen as Plan/Danas; no injected navigation state.
  const openDay = async (id: string): Promise<void> => {
    await page.goto(`/?dan=${encodeURIComponent(id)}`);
    await expect(back(page)).toBeVisible();
    await expect(page.locator(`.f-grid[data-day="${id}"]`)).toBeVisible();
  };
  const futureWeek = resolved().weeks[1];
  const manualDay = futureWeek.days.find((d) => d.tag === 'lako' && !d.test);
  const swapTarget = futureWeek.days.find((d) => d.rest && !d.test && d.id !== manualDay?.id);
  const measuredDay = resolved().weeks[2].days.find(
    (d) => !!d.session && (d.tag === 'int' || d.tag === 'tempo') && !d.test
  );
  if (!manualDay || !swapTarget || !measuredDay)
    throw new Error('Wizard must deliver a future easy slot, rest slot and quality session');
  expect(manualDay.date > '2026-01-14').toBe(true);
  expect(measuredDay.date > '2026-01-14').toBe(true);

  await openDay(manualDay.id);
  await page.getByRole('button', { name: /^Zameni ili skrati/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Kilometraža').fill('4.2');
  await sheet.getByLabel('Opis', { exact: true }).fill('Final QA manual 4.2 km easy');
  await sheet.getByRole('button', { name: 'Sačuvaj', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect.poll(() => state().alts?.[manualDay.id]?.km).toBe(4.2);
  await page.getByRole('button', { name: /^Pomeri na drugi dan/ }).click();
  await expect(sheet.getByText(/Izabrano:/)).toBeVisible();
  const targetIndex = futureWeek.days
    .filter((d) => !d.test)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .findIndex((d) => d.id === swapTarget.id);
  await sheet.locator('button.swap-row').nth(targetIndex).click();
  await expect.poll(() => state().moves?.[manualDay.id]).toBe(swapTarget.date);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();

  await openDay(measuredDay.id);
  const work = page.getByRole('group', { name: 'Radni deo — ostvaren tempo' });
  const measuredId = await work.locator('[data-wseg]').first().getAttribute('data-wseg');
  if (!measuredId) throw new Error('Quality session must expose a prediction row');
  await work.getByLabel('Ostvaren tempo radnog dela').first().fill('411');
  await work.getByLabel('Ostvaren tempo radnog dela').first().blur();
  await expect.poll(() => state().pred?.[measuredId]).toBe(251);
  await expect.poll(() => state().predLock?.[measuredId]).toBe(true);

  // Actual km/sec and done status exist BEFORE return apply.
  await back(page).click();
  await page
    .getByRole('navigation', { name: 'Glavna navigacija' })
    .getByRole('button', { name: 'Danas', exact: true })
    .click();
  await logToday(page, { km: '6,2', time: '3400' });
  const doneId = await page.locator('.f-grid').getAttribute('data-day');
  if (!doneId) throw new Error('Today must expose an entry ID');
  await expect.poll(() => state().log?.[doneId]?.sec).toBe(2040);
  expect(state().log?.[doneId]).toMatchObject({ status: 'done', km: 6.2, sec: 2040 });

  const protectedIds = [manualDay.id, measuredDay.id, doneId];
  const capture = (ids: string[]) => {
    const gp = plan();
    const matched = matchPlanRows(
      resolvePlan(gp.weeks, { alts: {}, moves: state().moves ?? {} }).weeks,
      rows()
    );
    return structuredClone({
      days: Object.fromEntries(
        ids.map((id) => [id, gp.weeks.flatMap((w) => w.days).find((d) => d.id === id)])
      ),
      qs: Object.fromEntries(ids.map((id) => [id, gp.qs?.[id]])),
      predictionRows: Object.fromEntries(ids.map((id) => [id, matched.get(id)])),
      manualAlt: state().alts?.[manualDay.id],
      moves: state().moves,
      measured: state().pred?.[measuredId],
      measuredLock: state().predLock?.[measuredId],
      measuredRow: rows().find((r) => r.id === measuredId),
      log: state().log,
      dates: Object.fromEntries(ids.map((id) => [id, resolved().byId.get(id)?.date]))
    });
  };
  const baseline = capture(protectedIds);
  expect(baseline.manualAlt).toMatchObject({ km: 4.2, desc: 'Final QA manual 4.2 km easy' });
  expect(baseline.dates[manualDay.id]).toBe(swapTarget.date);
  const assertBaselineSurvives = () => {
    const current = capture(protectedIds);
    expect({ ...current, log: baseline.log }).toEqual(baseline);
    for (const [id, entry] of Object.entries(baseline.log ?? {}))
      expect(state().log?.[id]).toEqual(entry);
  };
  await back(page).click();
  await openAdjust(page);
  await page.getByLabel('Šta želiš da prilagodiš?').selectOption('return');
  await page.getByLabel('Trajanje pauze').selectOption('14');
  await page.getByRole('checkbox', { name: /Potvrđujem da sam pravio navedenu pauzu/ }).check();
  await page.getByLabel('Ponovljiva baza pre pauze (km/ned)').fill('40');
  await page.getByLabel('Ponovljiva dužina pre pauze (km, opciono)').fill('12');
  await page.getByRole('button', { name: 'Pregledaj predlog', exact: true }).click();
  const preview = page.locator('#plan-change-preview');
  await expect(preview.getByRole('heading', { name: 'Pregled promene' })).toBeVisible();
  expect(getPlanRevisions(plan())).toHaveLength(0);
  assertBaselineSurvives();
  await info.attach('protected-before-apply', {
    body: Buffer.from(JSON.stringify(baseline, null, 2)),
    contentType: 'application/json'
  });
  await info.attach('protected-return-preview', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect.poll(() => getPlanRevisions(plan()).length).toBe(1);
  expect(getPlanRevisions(plan())[0].reason).toBe('execution');
  assertBaselineSurvives();
  await page.reload();
  await openAdjust(page);
  await expect(page.getByRole('button', { name: /^Pregledaj vraćanje:/ })).toHaveCount(1);
  assertBaselineSurvives();

  const assertUi = async () => {
    await openDay(manualDay.id);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('izmenjen');
    await expect(
      page.getByText('Final QA manual 4.2 km easy', { exact: true }).first()
    ).toBeVisible();
    await openDay(measuredDay.id);
    await expect(page.getByLabel('Ostvaren tempo radnog dela').first()).toHaveValue('4:11');
    await openDay(doneId);
    await expect(page.getByRole('button', { name: 'Odrađen', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByLabel(/Distanca \(km\)/)).toHaveValue('6,2');
    await expect(page.getByLabel(/^Vreme/)).toHaveValue('34:00');
  };
  await assertUi();
  await info.attach('protected-after-apply', {
    body: Buffer.from(JSON.stringify(capture(protectedIds), null, 2)),
    contentType: 'application/json'
  });
  // An actual entered AFTER apply must also survive restoring its predecessor.
  const secondDone = resolved().dated.find(
    (d) => !d.rest && !d.test && d.tag !== 'snaga' && d.date < '2026-01-14' && d.id !== doneId
  );
  if (!secondDone) throw new Error('Wizard must have an earlier runnable day');
  await openDay(secondDone.id);
  await page.getByRole('button', { name: 'Odrađen', exact: true }).click();
  await page.getByLabel(/Distanca \(km\)/).fill('7,1');
  await page.getByLabel(/^Vreme/).fill('3800');
  await page.getByLabel(/^Vreme/).blur();
  await expect.poll(() => state().log?.[secondDone.id]?.sec).toBe(2280);
  expect(state().log?.[secondDone.id]).toMatchObject({ status: 'done', km: 7.1, sec: 2280 });
  const beforeRestore = capture([...protectedIds, secondDone.id]);
  await back(page).click();
  await openAdjust(page);
  await page.getByRole('button', { name: /^Pregledaj vraćanje:/ }).click();
  await expect(preview.getByRole('heading', { name: 'Pregled promene' })).toBeVisible();
  expect(getPlanRevisions(plan())).toHaveLength(1);
  expect(capture([...protectedIds, secondDone.id])).toEqual(beforeRestore);
  await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect.poll(() => getPlanRevisions(plan()).length).toBe(2);
  expect(getPlanRevisions(plan())[1].reason).toBe('restore');
  expect(capture([...protectedIds, secondDone.id])).toEqual(beforeRestore);
  await page.reload();
  await openAdjust(page);
  await expect(page.getByRole('button', { name: /^Pregledaj vraćanje:/ })).toHaveCount(2);
  expect(capture([...protectedIds, secondDone.id])).toEqual(beforeRestore);
  await assertUi();
  await openDay(secondDone.id);
  await expect(page.getByLabel(/Distanca \(km\)/)).toHaveValue('7,1');
  await expect(page.getByLabel(/^Vreme/)).toHaveValue('38:00');
  await info.attach('protected-after-restore', {
    body: Buffer.from(JSON.stringify(capture([...protectedIds, secondDone.id]), null, 2)),
    contentType: 'application/json'
  });
  await info.attach('protected-restored-actual', {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png'
  });
  expect(errors).toEqual([]);
});
