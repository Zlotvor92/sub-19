import { readFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { back, openAdjust, openTi, runWizard } from '../../../../web/e2e/support/flows';
import {
  chartBars,
  enableFlags,
  FLAG,
  fixToday,
  group,
  installBackend,
  pauseReview,
  POLICY,
  seedSession,
  serverGen,
  serverPlan,
  STATE_KEY,
  SYNC,
  tab,
  V2KEY,
  v2Wizard,
  weekNumbersIn,
  type Backend,
  type Dist
} from './lib';

/* UGAO 6 — istraživački E2E (kod 670700e). Rupe iz tabele pokrivenosti (REPORT.md): prekidač (vlasnik / ostali),
   isključen prekidač = v1 za 4 distance, maraton v2 → 10K v2 i → 5K v2, brojevi na ekranu = domenski plan, promena
   cilja v2, izvoz/uvoz backupa sa planom v2, mali ekran, broj nedelje posle predaje u tekstu prilagođavanja. */

const OWNER = '0403f8fb-a643-4d4e-843d-f71199a0d6f9';
const DISTS: Dist[] = ['5K', '10K', 'Polumaraton', 'Maraton'];

async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}
async function note(info: TestInfo, name: string, value: unknown): Promise<void> {
  console.log(`[${info.title}] ${name}: ${JSON.stringify(value)}`);
  await info.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2)),
    contentType: 'application/json'
  });
}
function errorsOf(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/* ---------------------------------------------------------------- 1. prekidač: vlasnik vidi, ostali ne */

test('prekidač: vlasnik vidi 4 prekidača v2 (isključena), običan korisnik ne vidi sekciju', async ({
  page
}, info) => {
  await fixToday(page, '2026-10-01T09:00:00');
  await seedSession(page, { email: 'vlasnik@sub20.test', userId: OWNER });
  await installBackend(page);
  await page.goto('/');
  await openTi(page, /^Zone i postavke treninga/);
  for (const id of ['set-fivek-v2', 'set-tenk-v2', 'set-hm-v2', 'set-marathon-v2']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
    await expect(page.locator(`#${id}`)).not.toBeChecked();
  }
  await shot(page, info, 'owner-toggles');
});

test('prekidač: običan korisnik (sa planom v1) ne vidi „Generator plana"', async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await installBackend(page);
  await page.goto('/');
  await runWizard(page);
  await openTi(page, /^Zone i postavke treninga/);
  await expect(page.getByText('Generator plana')).toHaveCount(0);
  await expect(page.locator('#set-hm-v2, #set-marathon-v2, #set-fivek-v2, #set-tenk-v2')).toHaveCount(0);
});

/* ---------------------------------------------------------------- 2. isključen prekidač = v1 (sve 4 distance) */

for (const dist of DISTS) {
  test(`prekidač isključen: ${dist} iz čarobnjaka je v1 (bez objekta v2)`, async ({ page }, info) => {
    await fixToday(page);
    await seedSession(page);
    await enableFlags(page, {}); // nijedan prekidač
    const backend = await installBackend(page);
    await page.goto('/');
    await runWizard(page, {
      dist,
      raceDate: dist === 'Maraton' ? '2026-05-10' : '2026-04-12',
      pbDist: dist === '5K' ? '5 km' : '10 km',
      pbMin: dist === '5K' ? '22' : '45',
      pbSec: '0',
      weeklyKm: dist === 'Maraton' ? '50' : '40'
    });
    await expect.poll(() => serverPlan(backend), SYNC).toContain('"policyId"');
    const g = serverGen(backend)!;
    const meta = g['meta'] as Record<string, unknown>;
    await note(info, 'policy', { policyId: meta['policyId'], policyVersion: meta['policyVersion'] });
    expect(String(meta['policyId'])).toMatch(/-v1$/);
    expect(V2KEY[dist] in g).toBe(false);
  });
}

/* ---------------------------------------------------------------- 3. brojevi na ekranu = domenski plan */

for (const dist of DISTS) {
  test(`brojevi: ${dist} v2 — stubići nedelja i km dana na Plan tabu = plan v2`, async ({ page }, info) => {
    const errors = errorsOf(page);
    await fixToday(page);
    await seedSession(page);
    await enableFlags(page, { [FLAG[dist]]: true });
    const backend = await installBackend(page);
    await page.goto('/');
    await v2Wizard(page, dist);
    await expect.poll(() => serverPlan(backend), SYNC).toContain(`"policyId":"${POLICY[dist]}"`);
    const g = serverGen(backend)!;
    const v2 = g[V2KEY[dist]] as {
      weeks: Array<{ index: number; plannedKm: number; days: Array<{ role: string; date: string; workout: { km: number } }> }>;
    };
    const stored = g['weeks'] as Array<{ w: number; days: Array<{ km?: number; dow: number }> }>;
    await tab(page, 'Plan').click();
    await expect(page.getByRole('heading', { name: `Nedelja 1 od ${stored.length}` })).toBeVisible();
    const bars = await chartBars(page);
    const diffs: unknown[] = [];
    for (const w of v2.weeks) {
      const ui = bars.get(w.index);
      if (ui === undefined || Math.abs(ui - Math.round(w.plannedKm * 10 + 1e-9) / 10) > 0.001)
        diffs.push({ week: w.index, domainPlannedKm: w.plannedKm, ui });
    }
    // Dani: km upisanog plana (ono što ekran crta) = km radionice v2, po datumu.
    const dayDiffs: unknown[] = [];
    for (const [wi, w] of v2.weeks.entries())
      for (const d of w.days) {
        const sw = stored[wi];
        const dow = Math.round(
          (Date.parse(`${d.date}T00:00:00Z`) - Date.parse(`${(sw as unknown as { start: string }).start}T00:00:00Z`)) /
            86_400_000
        );
        const sd = sw.days.find((x) => x.dow === dow);
        if (!sd || Math.abs((sd.km ?? 0) - d.workout.km) > 0.05)
          dayDiffs.push({ week: w.index, date: d.date, role: d.role, domain: d.workout.km, stored: sd?.km });
      }
    // Dugi tekuće nedelje u telu nedelje (redovi) = najduži dan v2 nedelje 1.
    const long1 = Math.max(...v2.weeks[0].days.filter((d) => d.role !== 'race').map((d) => d.workout.km));
    const rowsText = (await page.locator('.page.active .plan-row').allInnerTexts()).join(' | ');
    await note(info, 'bars-vs-domain', { weeks: v2.weeks.length, diffs, dayDiffs, long1, rowsSample: rowsText.slice(0, 400) });
    await shot(page, info, `${dist}-plan`);
    expect(diffs).toEqual([]);
    expect(dayDiffs).toEqual([]);
    expect(rowsText).toContain(String(long1).replace('.', ','));
    expect(errors).toEqual([]);
  });
}

/* ---------------------------------------------------------------- 4. promena cilja v2 */

const NEW_GOAL: Record<Dist, string> = {
  '5K': '21:00',
  '10K': '42:00',
  Polumaraton: '1:38:00',
  Maraton: '3:25:00'
};
for (const dist of DISTS) {
  test(`promena cilja: ${dist} v2 — Ti → Cilj → Promeni cilj → potvrda → revizija, plan ostaje v2, posle osvežavanja`, async ({
    page
  }, info) => {
    const errors = errorsOf(page);
    await fixToday(page);
    await seedSession(page);
    await enableFlags(page, { [FLAG[dist]]: true });
    const backend = await installBackend(page);
    await page.goto('/');
    await v2Wizard(page, dist);
    await expect.poll(() => serverPlan(backend), SYNC).toContain(`"policyId":"${POLICY[dist]}"`);
    const weeksBefore = JSON.stringify((serverGen(backend)![V2KEY[dist]] as { weeks: unknown }).weeks);
    await openTi(page, /^Trenutni cilj/);
    await expect(page.locator('#v2-unsupported-goal')).toHaveCount(0);
    const alerts: string[] = [];
    page.on('dialog', (d) => {
      alerts.push(d.message());
      void d.dismiss();
    });
    await page.getByLabel('Novo ciljno vreme').fill(NEW_GOAL[dist]);
    await page.getByRole('button', { name: 'Promeni cilj' }).click();
    const confirm = page.locator('#confirm-text');
    await expect(confirm).toBeVisible();
    const confirmText = await confirm.innerText();
    await note(info, 'confirm', { confirmText, alerts });
    await page.getByRole('button', { name: 'Da', exact: true }).click();
    await expect.poll(() => serverPlan(backend), SYNC).toContain('"reason":"goal"');
    const g = serverGen(backend)!;
    expect((g['meta'] as Record<string, unknown>)['policyId']).toBe(POLICY[dist]);
    // Promena cilja v2 ne menja treninge (tekst potvrde to tvrdi).
    const weeksAfter = JSON.stringify((g[V2KEY[dist]] as { weeks: unknown }).weeks);
    await note(info, 'weeks-same', weeksBefore === weeksAfter);
    await page.reload();
    await tab(page, 'Ti').click();
    await openTi(page, /^Trenutni cilj/);
    const goalShown = await page.locator('.goal-big').innerText();
    await note(info, 'goal-shown', goalShown);
    await shot(page, info, `${dist}-goal`);
    expect(goalShown).toContain(NEW_GOAL[dist]);
    expect(weeksAfter).toBe(weeksBefore);
    expect(errors).toEqual([]);
  });
}

/* ---------------------------------------------------------------- 5. izvoz/uvoz backupa sa planom v2 */

for (const dist of ['Polumaraton', 'Maraton'] as Dist[]) {
  test(`backup: ${dist} v2 — izvoz → uvoz → isti plan, Prilagodi plan i dalje v2`, async ({ page }, info) => {
    const errors = errorsOf(page);
    await fixToday(page);
    await seedSession(page);
    await enableFlags(page, { [FLAG[dist]]: true });
    const backend = await installBackend(page);
    await page.goto('/');
    await v2Wizard(page, dist);
    await expect.poll(() => serverPlan(backend), SYNC).toContain(`"policyId":"${POLICY[dist]}"`);
    const before = serverPlan(backend);
    await openTi(page, /^Privatnost i podaci/);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Izvezi backup' }).click()
    ]);
    const exported = JSON.parse(await readFile((await download.path())!, 'utf8')) as {
      state: { genPlan: unknown };
    };
    expect(JSON.stringify(exported.state.genPlan)).toBe(before);
    // Uvoz u isti nalog (prepisuje); plan iz fajla mora ostati bajt-isti.
    await page.locator('#s-file').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(exported))
    });
    await page.getByRole('button', { name: 'Da', exact: true }).click();
    await expect(page.getByText('Backup je uvezen.')).toBeVisible();
    await page.reload();
    const local = await page.evaluate((k) => JSON.stringify(JSON.parse(localStorage.getItem(k)!).genPlan), STATE_KEY);
    await note(info, 'same', { local: local === before, server: serverPlan(backend) === before });
    expect(local).toBe(before);
    await openAdjust(page);
    await expect(page.locator('#v2-unsupported')).toHaveCount(0);
    await expect(page.locator('#plan-change-preview')).toContainText('bez novih činjenica');
    expect(errors).toEqual([]);
  });
}

/* ---------------------------------------------------------------- 6. maraton v2 → 10K v2 i → 5K v2 */

async function marathonPlan(page: Page, backend: Backend, feel = false): Promise<void> {
  await page.goto('/');
  if (feel) {
    // Po osećaju: lak tempo 5:15, 50 km, najduže 24 km, 4 dana — HM/10K v1 traže rezultat.
    const { raceStep } = await import('./lib');
    await raceStep(page, 'Maraton', '2026-05-10', /Plan maratona v2: 16 nedelja/);
    await page.getByRole('button', { name: 'Nemam skoriji rezultat' }).click();
    await page.getByLabel('minuti').fill('5');
    await page.getByLabel('sekunde').fill('15');
    await page.getByRole('button', { name: 'Dalje' }).click();
    await page.getByRole('button', { name: 'Da', exact: true }).click();
    await page.getByLabel('Nedeljna kilometraža').fill('50');
    await page.getByLabel('Najduže skorašnje trčanje (km)').fill('24');
    await page.getByRole('button', { name: 'Trčim redovno' }).click();
    await page.getByRole('button', { name: 'Dalje' }).click();
    for (const d of ['Uto', 'Čet', 'Sub', 'Ned'])
      await group(page, 'Dani trčanja').getByRole('button', { name: d, exact: true }).click();
    await group(page, 'Dan dugog trčanja').getByRole('button', { name: 'Ned', exact: true }).click();
    await page.getByRole('button', { name: 'Napravi plan' }).click();
    await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
    await expect.poll(() => serverPlan(backend), SYNC).toContain('"policyId":"marathon-v2"');
    return;
  }
  // Isti ulaz kao handoff-v2 (b): 10 km 38:00, 50 km, najduže 24 km, 4 dana, cilj 3:10:00.
  const { raceStep } = await import('./lib');
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
  for (const d of ['Uto', 'Čet', 'Sub', 'Ned'])
    await group(page, 'Dani trčanja').getByRole('button', { name: d, exact: true }).click();
  await group(page, 'Dan dugog trčanja').getByRole('button', { name: 'Ned', exact: true }).click();
  await page.getByLabel('sati').fill('3');
  await page.getByLabel('minuti').fill('10');
  await page.getByLabel('sekunde').fill('0');
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect.poll(() => serverPlan(backend), SYNC).toContain('"policyId":"marathon-v2"');
}

const TARGETS: Array<{ name: string; flags: Record<string, boolean>; title: string; policy: string; prefix: string; v2: string; feel?: boolean; today?: string; from?: string }> = [
  {
    name: '10K v2 (po osećaju, HM v2 isključen)',
    feel: true,
    flags: { generatorV2Marathon: true, generatorV2TenK: true },
    title: 'Kraća distanca: 10K istog datuma',
    policy: '10k-v2',
    prefix: 'tenKV2Prefix',
    v2: 'tenKV2'
  },
  {
    name: '5K v2 (po osećaju, HM i 10K v2 isključeni) — 5K se ne nudi',
    feel: true,
    flags: { generatorV2Marathon: true, generatorV2FiveK: true },
    title: 'Kraća distanca: 5K istog datuma',
    policy: '5k-v2',
    prefix: 'fiveKV2Prefix',
    v2: 'fiveKV2'
  },
  {
    name: 'HM v2 → zatim pauza u planu HM (broj nedelje u tekstu)',
    flags: { generatorV2Marathon: true, generatorV2HalfMarathon: true },
    title: 'Kraća distanca: Polumaraton istog datuma',
    policy: 'hm-v2',
    prefix: 'hmV2Prefix',
    v2: 'hmV2'
  }
];

for (const t of TARGETS) {
  test(`predaja: maraton v2 → ${t.name}`, async ({ page }, info) => {
    const errors = errorsOf(page);
    await fixToday(page);
    await seedSession(page);
    await enableFlags(page, t.flags);
    const backend = await installBackend(page);
    await marathonPlan(page, backend, t.feel);
    const today = t.today ?? '2026-01-27';
    const day = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
    const curWeek = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse('2026-01-19T00:00:00Z')) / (7 * 86_400_000)) + 1;
    await pauseReview(page, today, t.from ?? '2025-12-24');
    const preview = page.locator('#plan-change-preview');
    await expect(preview.getByRole('heading', { name: 'Pregled promene' })).toBeVisible();
    await note(info, 'pause-preview', await preview.innerText());
    await expect(preview.getByRole('note')).toContainText(
      'Posle ovog prilagođavanja plan nije puna priprema za maraton'
    );
    await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
    await expect.poll(() => serverPlan(backend), SYNC).toContain(`Prilagođavanje ${today}: pauza`);
    const decision = page.locator('#plan-decision');
    await expect(decision).toBeVisible();
    const decisionText = await decision.innerText();
    await note(info, 'decision', decisionText);
    await shot(page, info, 'decision');
    if (t.policy === '5k-v2') {
      // Maraton v2 kao izvor nudi samo HM pa 10K (marathon/v2/app/preparation.ts:30 SHORTER) — 5K se ne nudi ni kao nedostupan.
      await expect(decision.getByRole('button', { name: /5K/ })).toHaveCount(0);
      expect(decisionText).not.toContain('5K');
      return;
    }
    await decision.getByRole('button', { name: `Pregledaj opciju: ${t.title}` }).click();
    await expect(preview).toContainText(t.title);
    await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
    await expect.poll(() => serverPlan(backend), SYNC).toContain(`"summary":"${t.title}"`);
    await expect(page.locator('#handoff-applied').getByRole('status')).toContainText('Plan je promenjen');
    const g = serverGen(backend)!;
    expect((g['meta'] as Record<string, unknown>)['policyId']).toBe(t.policy);
    const prefix = g[t.prefix] as { offset: number; weeks: unknown[] };
    const weeks = g['weeks'] as Array<{ w: number }>;
    await note(info, 'prefix', { offset: prefix?.offset, prefixWeeks: prefix?.weeks.length, total: weeks.length, ws: weeks.map((w) => w.w) });
    expect(prefix.offset).toBe(prefix.weeks.length);
    expect(weeks.map((w) => w.w)).toEqual(weeks.map((_, i) => i + 1));
    // Kalendar: tekuća nedelja (2026-01-27, druga nedelja plana od 2026-01-19) = Nedelja 2 od N.
    await page.reload();
    await tab(page, 'Plan').click();
    await expect(page.locator('.page.active').getByRole('heading', { name: `Nedelja ${curWeek} od ${weeks.length}` })).toBeVisible();
    // Stubići nedelja ciljnog plana = plannedKm v2 uz pomak.
    const bars = await chartBars(page);
    const v2 = g[t.v2] as { weeks: Array<{ index: number; plannedKm: number }> };
    const bad = v2.weeks
      .filter((w) => Math.abs((bars.get(prefix.offset + w.index) ?? -1) - Math.round(w.plannedKm * 10 + 1e-9) / 10) > 0.001)
      .map((w) => ({ v2: w.index, cal: prefix.offset + w.index, domain: w.plannedKm, ui: bars.get(prefix.offset + w.index) }));
    await note(info, 'bars', { bad });
    expect(bad).toEqual([]);
    await shot(page, info, 'target-plan');

    // Prilagođavanje ciljnog plana (pauza 4 dana): brojevi nedelja na ekranu moraju biti kalendarski (≥ offset+1).
    await fixToday(page, `${day(today, 8)}T09:00:00`);
    await page.reload();
    await tab(page, 'Plan').click();
    await page.locator('.page.active').getByRole('button', { name: /^Prilagodi plan/ }).click();
    await page.getByLabel('Pauza od').fill(day(today, -1));
    await page.getByLabel('Pauza do').fill(day(today, 8));
    await page.getByRole('button', { name: 'Dodaj pauzu' }).click();
    await expect(preview.getByRole('heading', { name: 'Pregled promene' })).toBeVisible();
    const pv = await preview.innerText();
    const table = preview.getByRole('table', { name: 'Promenjene nedelje' });
    const rowWeeks = (await table.count())
      ? (await table.locator('tbody th').allInnerTexts()).map(Number)
      : [];
    const textWeeks = weekNumbersIn(pv);
    await note(info, 'adapt-preview', { rowWeeks, textWeeks, offset: prefix.offset, pv });
    await shot(page, info, 'target-adapt-preview');
    expect(rowWeeks.every((w) => w > prefix.offset && w <= weeks.length)).toBe(true);
    expect(textWeeks.every((w) => w > prefix.offset && w <= weeks.length)).toBe(true);
    expect(errors).toEqual([]);
  });
}

/* ---------------------------------------------------------------- 7. mali ekran (320 × 568) */

test('telefon 320×568: HM v2 plan, pregled pauze, odluka kraće distance — bez vodoravnog pomeranja stranice', async ({
  page
}, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await fixToday(page);
  await seedSession(page);
  await enableFlags(page, { generatorV2HalfMarathon: true, generatorV2FiveK: true });
  const backend = await installBackend(page);
  await page.goto('/');
  await v2Wizard(page, 'Polumaraton');
  await expect.poll(() => serverPlan(backend), SYNC).toContain('"policyId":"hm-v2"');
  const overflow = async (where: string) => {
    const r = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      wide: [...document.querySelectorAll('.page.active *, .screen *')]
        .filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && b.right > window.innerWidth + 1 && !e.closest('[style*="overflow"]');
        })
        .slice(0, 5)
        .map((e) => `${e.tagName}.${(e as HTMLElement).className}`)
    }));
    await note(info, `overflow-${where}`, r);
    await shot(page, info, `320-${where}`);
    return r;
  };
  await tab(page, 'Plan').click();
  const a = await overflow('plan');
  await pauseReview(page, '2026-01-20', '2025-12-17');
  await expect(page.locator('#plan-change-preview')).toBeVisible();
  const b = await overflow('preview');
  await page.locator('#plan-change-preview').getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect(page.locator('#plan-decision')).toBeVisible();
  const c = await overflow('decision');
  for (const r of [a, b, c]) {
    expect(r.scroll).toBeLessThanOrEqual(r.client);
    expect(r.wide).toEqual([]);
  }
});
