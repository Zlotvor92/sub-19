import { expect, test } from '@playwright/test';
import {
  enableFlags,
  fixToday,
  group,
  installBackend,
  pauseReview,
  raceStep,
  seedSession,
  serverGen,
  serverPlan,
  SYNC,
  tab,
  weekNumbersIn
} from './lib';

/* UGAO 6 — početnik maraton v2 → HM v2: napomene nedelje ciljnog plana (focus) nose broj nedelje v2 (`frame.index`,
   halfMarathon/v2/week.ts:730) umesto kalendarskog (offset + index). Proverava se šta korisnik vidi u Plan tabu. */

test('predaja: početnik maraton v2 → HM v2 — brojevi nedelja u napomenama nedelja ciljnog plana', async ({
  page
}, info) => {
  await fixToday(page);
  await seedSession(page);
  await enableFlags(page, { generatorV2Marathon: true, generatorV2HalfMarathon: true, generatorV2TenK: true });
  const backend = await installBackend(page);
  await page.goto('/');
  await raceStep(page, 'Maraton', '2026-05-10', /Plan maratona v2: 16 nedelja/);
  await page.getByRole('button', { name: 'Imam rezultat' }).click();
  await page.getByLabel('minuti').fill(process.env['BEG_MIN'] ?? '46');
  await page.getByLabel('sekunde').fill(process.env['BEG_SEC'] ?? '0');
  await page.getByLabel('Datum rezultata').fill('2026-01-10');
  await page.getByRole('button', { name: 'Dalje' }).click();
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await page.getByLabel('Nedeljna kilometraža').fill(process.env['BEG_KM'] ?? '40');
  await page.getByLabel('Najduže skorašnje trčanje (km)').fill('18');
  await page.getByRole('button', { name: 'Početnik', exact: true }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  for (const d of ['Uto', 'Čet', 'Sub', 'Ned'])
    await group(page, 'Dani trčanja').getByRole('button', { name: d, exact: true }).click();
  await group(page, 'Dan dugog trčanja').getByRole('button', { name: 'Ned', exact: true }).click();
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  const rejected = page.getByRole('status').filter({ hasText: 'Plan nije napravljen' });
  if (await rejected.count()) {
    console.log(`odbijeno: ${await rejected.innerText()}`);
    test.skip(true, 'ulaz odbijen');
  }
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect.poll(() => serverPlan(backend), SYNC).toContain('"policyId":"marathon-v2"');
  const src = serverGen(backend)!;
  console.log(`izvor: experience=${JSON.stringify((src['marathonV2'] as { input?: { experience?: string } }).input?.experience)}`);

  await pauseReview(page, '2026-01-27', '2025-12-24');
  const preview = page.locator('#plan-change-preview');
  await expect(preview.getByRole('heading', { name: 'Pregled promene' })).toBeVisible();
  console.log(`pregled: ${(await preview.innerText()).slice(0, 600)}`);
  await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect.poll(() => serverPlan(backend), SYNC).toContain('Prilagođavanje 2026-01-27: pauza');
  const decision = page.locator('#plan-decision');
  await expect(decision).toBeVisible();
  console.log(`odluka: ${await decision.innerText()}`);
  const title = process.env['BEG_TITLE'] ?? 'Kraća distanca: Polumaraton istog datuma';
  await decision.getByRole('button', { name: `Pregledaj opciju: ${title}` }).click();
  await preview.getByRole('button', { name: 'Primeni prikazanu promenu' }).click();
  await expect.poll(() => serverPlan(backend), SYNC).toContain(`"summary":"${title}"`);
  const g = serverGen(backend)!;
  const prefix = (g['hmV2Prefix'] ?? g['tenKV2Prefix']) as { offset: number };
  const weeks = g['weeks'] as Array<{ w: number; focus?: string }>;
  const hm = (g['hmV2'] ?? g['tenKV2']) as { input: { experience?: string; weekOffset?: number } };
  const bad = weeks
    .filter((w) => w.w > prefix.offset && w.focus)
    .flatMap((w) => weekNumbersIn(w.focus!).filter((n) => n !== w.w).map((n) => ({ calWeek: w.w, says: n, focus: w.focus })));
  console.log(
    `cilj: experience=${hm.input.experience} weekOffset=${hm.input.weekOffset} offset=${prefix.offset}; napomene sa brojem ≠ kalendarskog: ${JSON.stringify(bad)}`
  );
  await info.attach('focus', { body: Buffer.from(JSON.stringify({ weeks: weeks.map((w) => ({ w: w.w, focus: w.focus })), bad }, null, 2)), contentType: 'application/json' });
  // Ekran: Plan tab, nedelja posle tekuće (kalendarska offset+1 = prva nedelja cilja v2).
  await page.reload();
  await tab(page, 'Plan').click();
  await page.getByRole('button', { name: 'Sledeća nedelja' }).click();
  await expect(page.locator('#week-h')).toContainText(`Nedelja ${prefix.offset + 1} od`);
  const visible = await page.locator('.page.active').innerText();
  const shownBad = bad.filter((b) => visible.includes(b.focus!.slice(0, 30)));
  console.log(`na ekranu (Nedelja ${prefix.offset + 1}): ${JSON.stringify(shownBad.map((b) => b.focus))}`);
  await page.screenshot({ path: `${process.env['SHOT_DIR'] ?? '.'}/beginner-hm-week${prefix.offset + 1}.png`, fullPage: true });
  await info.attach('plan', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  // Dan (utorak) te nedelje: ekran dana prikazuje napomenu nedelje.
  await page.locator('.page.active').getByRole('button', { name: /^Utorak/ }).first().click();
  await page.getByRole('button', { name: 'Nazad', exact: true }).waitFor();
  await page.getByText('Zašto ovaj trening').waitFor({ timeout: 15_000 }).catch(() => undefined);
  await page.getByText('Zašto ovaj trening').scrollIntoViewIfNeeded().catch(() => undefined);
  const dayText = await page.locator('.screen, .page.active').last().innerText();
  const onDay = bad.filter((b) => dayText.includes(b.focus!.slice(0, 30)));
  console.log(`na ekranu dana: ${JSON.stringify(onDay.map((b) => b.focus))}`);
  await page.getByText(/Fokus nedelje/).screenshot({ path: `${process.env['SHOT_DIR'] ?? '.'}/beginner-hm-day.png` }).catch(() => page.screenshot({ path: `${process.env['SHOT_DIR'] ?? '.'}/beginner-hm-day.png` }));
  expect(bad).toEqual([]);
});
