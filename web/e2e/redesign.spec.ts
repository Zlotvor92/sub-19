import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { createPlan, openFrom, openTi, tab } from './support/flows';

/* Regresija vizuelnog sistema (Quiet Athlete): struktura naslova po ekranu, bez horizontalnog skrola na 320–1440 px, mete dodira ≥ 44 px (osim tačaka na
   grafikonu i delova mape tela, koje imaju drugi put do iste radnje), „smanjeno kretanje“ gasi animacije, traka tabova prelazi sa dna na levu stranu na
   širokom ekranu, a svetla i tamna tema ne lome raspored. Ovo proverava ponašanje u pregledaču; kontrast boja drže tokeni (v. docs/redesign/QUIET_ATHLETE.md). */

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await installBackend(page);
  await createPlan(page);
});

const TABS = [
  { name: 'Danas', h1: 'Danas' },
  { name: 'Plan', h1: 'Tvoj plan' },
  { name: 'Napredak', h1: 'Napredak' },
  { name: 'Ti', h1: 'Ti' }
] as const;

/** Ekrani iznad taba, redom kojim ih čovek otvara. Svaki je jedan dodir od svog taba (dva od početnog ekrana). */
const SCREENS: ReadonlyArray<{ from: (typeof TABS)[number]['name']; row: RegExp; h1: string }> = [
  { from: 'Plan', row: /^Prilagodi plan/, h1: 'Prilagodi plan' },
  { from: 'Plan', row: /^Pregled celog plana/, h1: 'Cela priprema' },
  { from: 'Napredak', row: /^Forma i predikcija/, h1: 'Forma i predikcija' },
  { from: 'Napredak', row: /^Oporavak/, h1: 'Oporavak' },
  { from: 'Napredak', row: /^Bol/, h1: 'Bol' },
  { from: 'Napredak', row: /^Telesna masa/, h1: 'Telesna masa' },
  { from: 'Napredak', row: /^Analiza trke/, h1: 'Analiza trke' },
  { from: 'Ti', row: /^Moj profil/, h1: 'Moj profil' },
  { from: 'Ti', row: /^Zone i postavke treninga/, h1: 'Zone i postavke treninga' },
  { from: 'Ti', row: /^Povezani servisi/, h1: 'Povezani servisi' },
  { from: 'Ti', row: /^Obaveštenja/, h1: 'Obaveštenja' },
  { from: 'Ti', row: /^Izgled aplikacije/, h1: 'Izgled aplikacije' },
  { from: 'Ti', row: /^Privatnost i podaci/, h1: 'Privatnost i podaci' },
  { from: 'Ti', row: /^O aplikaciji/, h1: 'O aplikaciji' }
];

const overflowX = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Svako dugme/veza/polje u aktivnoj stranici koje je manje od 44 px u kraćoj dimenziji (SVG elementi izuzeti). */
const smallTargets = (page: Page): Promise<string[]> =>
  page.locator('.page.active').evaluate((root) => {
    const out: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement>(
      'button, a[href], summary, [role="button"], [role="slider"], input:not([type="hidden"]):not([type="file"]), select'
    )) {
      if (el.closest('svg') || el.closest('[hidden]')) continue;
      if (el.closest('.sr-only') || el.classList.contains('sr-only')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (Math.min(r.width, r.height) < 44)
        out.push(
          `${el.tagName}.${el.className} "${(el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`
        );
    }
    return out;
  });

test('svaki tab ima tačno jedan h1, a naslovi idu bez preskakanja nivoa', async ({ page }) => {
  for (const t of TABS) {
    await tab(page, t.name).click();
    const root = page.locator('.page.active');
    await expect(root.getByRole('heading', { level: 1 })).toHaveText(t.h1);
    await expect(root.getByRole('heading', { level: 1 })).toHaveCount(1);
    const levels = await root.evaluate((el) =>
      [...el.querySelectorAll('h1,h2,h3,h4')]
        .filter((h) => !h.closest('[hidden]'))
        .map((h) => Number(h.tagName[1]))
    );
    levels.reduce((prev, cur) => {
      expect(cur - prev, `${t.name}: skok sa h${prev} na h${cur}`).toBeLessThanOrEqual(1);
      return cur;
    }, 0);
  }
});

test('svaki ekran iznad taba ima tačno jedan vidljiv h1 i „Nazad“', async ({ page }) => {
  for (const s of SCREENS) {
    await openFrom(page, s.from, s.row);
    const root = page.locator('.page.active');
    const visible = root.locator('h1:visible');
    await expect(visible).toHaveCount(1);
    await expect(visible).toHaveText(s.h1);
    const levels = await root.evaluate((el) =>
      [...el.querySelectorAll('h1,h2,h3,h4')]
        .filter((h) => !h.closest('[hidden]'))
        .map((h) => Number(h.tagName[1]))
    );
    levels.reduce((prev, cur) => {
      expect(cur - prev, `${s.h1}: skok sa h${prev} na h${cur}`).toBeLessThanOrEqual(1);
      return cur;
    }, 0);
    await page.getByRole('button', { name: 'Nazad', exact: true }).click();
  }
});

for (const theme of ['light', 'dark'] as const)
  test(`nijedan ekran ne prelazi širinu prozora (${theme}, 320–1440 px)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    for (const width of [320, 390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const t of TABS) {
        await tab(page, t.name).click();
        expect(await overflowX(page), `${t.name} @ ${width}`).toBeLessThanOrEqual(0);
      }
      for (const s of SCREENS) {
        await openFrom(page, s.from, s.row);
        expect(await overflowX(page), `${s.h1} @ ${width}`).toBeLessThanOrEqual(0);
        await page.getByRole('button', { name: 'Nazad', exact: true }).click();
      }
    }
  });

test('mete dodira na telefonu: svako dugme i polje je visoko bar 44 px (grafikoni i mapa tela izuzeti)', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const t of TABS) {
    await tab(page, t.name).click();
    expect(await smallTargets(page), t.name).toEqual([]);
  }
  for (const s of SCREENS) {
    await openFrom(page, s.from, s.row);
    expect(await smallTargets(page), s.h1).toEqual([]);
    await page.getByRole('button', { name: 'Nazad', exact: true }).click();
  }
});

test('„smanjeno kretanje": kartice i trake se ne animiraju (trajanje ≈ 0)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await tab(page, 'Plan').click();
  await tab(page, 'Danas').click();
  const ms = await page.locator('#tcard').evaluate((el) => {
    const cs = getComputedStyle(el);
    return [cs.animationDuration, cs.transitionDuration].map(
      (d) => parseFloat(d) * (d.endsWith('ms') ? 1 : 1000)
    );
  });
  for (const d of ms) expect(d).toBeLessThan(1);
});

test('traka tabova: dole na telefonu, levo (96 px) na širokom ekranu; tekući tab je označen', async ({
  page
}) => {
  const bar = page.locator('#tabbar');
  await page.setViewportSize({ width: 390, height: 844 });
  let box = await bar.boundingBox();
  expect(box && box.y + box.height).toBeGreaterThanOrEqual(843);
  expect(box && box.width).toBeGreaterThanOrEqual(389);
  await page.setViewportSize({ width: 1440, height: 900 });
  box = await bar.boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.width).toBe(96);
  await expect(tab(page, 'Danas')).toHaveAttribute('aria-current', 'page');
});

test('traka tabova ne prekriva sadržaj: poslednji red svakog taba može da se doskroluje iznad nje', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 700 });
  for (const t of TABS) {
    await tab(page, t.name).click();
    const gap = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const bar = document.querySelector('#tabbar')?.getBoundingClientRect();
      const main = document.querySelector('.page.active');
      const last = [...(main?.querySelectorAll('*') ?? [])]
        .filter((e) => e.getBoundingClientRect().height > 0)
        .map((e) => e.getBoundingClientRect().bottom)
        .reduce((a, b) => Math.max(a, b), 0);
      return bar ? bar.top - last : 0;
    });
    expect(gap, t.name).toBeGreaterThanOrEqual(-1);
  }
});

test('Plan: traka ciklusa u Pregledu celog plana je jedna slika sa celom rečenicom', async ({
  page
}) => {
  await tab(page, 'Plan').click();
  await page.getByRole('button', { name: 'Pregled celog plana' }).click();
  await expect(page.getByRole('img', { name: /Ciklus: nedelja \d+ od \d+/ })).toBeVisible();
});

test('Ti → Izgled: tamna tema menja pozadinu i boju teksta, ne raspored', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await openTi(page, /^Izgled aplikacije/);
  await page.getByRole('button', { name: 'Tamna' }).click();
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(dark).not.toBe(light);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
});
