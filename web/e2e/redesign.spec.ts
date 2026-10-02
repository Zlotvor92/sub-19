import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from './support/backend';
import { createPlan, tab } from './support/flows';

/* Regresija redizajna: struktura naslova po ekranu, bez horizontalnog skrola na 390/768/1024/1440, mete dodira ≥ 44 px
   (osim tačaka na grafikonu i delova mape tela, koje imaju drugi put do iste radnje), „smanjeno kretanje" gasi animacije,
   a traka tabova prelazi sa dna na levu stranu na širokom ekranu. */

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  await installBackend(page);
  await createPlan(page);
});

const TABS = [
  { name: 'Danas', h1: 'Danas' },
  { name: 'Plan', h1: 'Plan' },
  { name: 'Oporavak', h1: 'Oporavak' },
  { name: 'Trka', h1: 'Napredak' }
] as const;

const overflowX = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('svaki ekran ima tačno jedan h1, a paneli h2/h3 bez preskakanja nivoa', async ({ page }) => {
  for (const t of TABS) {
    await tab(page, t.name).click();
    const root = page.locator('.page.active');
    await expect(root.getByRole('heading', { level: 1 })).toHaveText(t.h1);
    await expect(root.getByRole('heading', { level: 1 })).toHaveCount(1);
    const levels = await root.evaluate((el) =>
      [...el.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]))
    );
    levels.reduce((prev, cur) => {
      expect(cur - prev, `${t.name}: skok sa h${prev} na h${cur}`).toBeLessThanOrEqual(1);
      return cur;
    }, 0);
  }
});

test('nijedan ekran ne prelazi širinu prozora (nema horizontalnog skrola)', async ({ page }) => {
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const t of TABS) {
      await tab(page, t.name).click();
      expect(await overflowX(page), `${t.name} @ ${width}`).toBeLessThanOrEqual(0);
    }
  }
});

test('mete dodira na telefonu: svako dugme i polje je visoko bar 44 px (grafikoni i mapa tela izuzeti)', async ({
  page
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const t of TABS) {
    await tab(page, t.name).click();
    const small = await page.locator('.page.active').evaluate((root) => {
      const out: string[] = [];
      for (const el of root.querySelectorAll<HTMLElement>(
        'button, a[href], summary, [role="button"], [role="slider"]'
      )) {
        if (el.closest('svg')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (Math.min(r.width, r.height) < 44)
          out.push(
            `${el.tagName}.${el.className} "${(el.textContent ?? '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`
          );
      }
      return out;
    });
    expect(small, t.name).toEqual([]);
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

test('zaglavlje: traka ciklusa je jedno dugme sa celom rečenicom i vodi na plan', async ({
  page
}) => {
  await tab(page, 'Danas').click();
  const rail = page.locator('.rail');
  await expect(rail).toHaveAttribute('aria-label', /^Ciklus: nedelja \d+ od \d+, faza .*do trke/);
  await rail.click();
  await expect(tab(page, 'Plan')).toHaveAttribute('aria-current', 'page');
});
