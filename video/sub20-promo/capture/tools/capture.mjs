/* SNIMCI EKRANA ZA PROMO — iz PRAVE aplikacije (web/dist servirana na :4173) sa demo stanjem (demo-state.mjs).
   Vreme je zamrznuto na sredu 4. 11. 2026, 07:30. Mreža ka Supabase/Strava/Open-Meteo/api je presretnuta (prazni odgovori).
   Pokretanje:  (cd web && npm run build && npx vite preview --port 4173 --strictPort &)
                node --import ./register.mjs capture.mjs
   Piše u ../screens/:  <ekran>.png (ceo kadar telefona), <ekran>-body.png (sadržaj bez zaglavlja i trake tabova),
                         <ekran>--<deo>.png (isečci ključnih elemenata), head.png, tabbar-<tab>.png, <ekran>.txt (vidljiv tekst). */
import { chromium } from '../../../../web/node_modules/@playwright/test/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoState, TODAY } from './demo-state.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '../screens');
mkdirSync(OUT, { recursive: true });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (email, sub = 'u-demo') => `${b64({ alg: 'none' })}.${b64({ sub, email })}.sig`;

async function boot(browser, variant) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block', colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(TODAY + 'T07:30:00'));
  await ctx.addInitScript(([sess, state]) => {
    try {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1'); sessionStorage.setItem('sub20-uvod', '1');
      localStorage.setItem('sub19_sb', JSON.stringify(sess));
      localStorage.setItem('sub19-v1', state);
      localStorage.setItem('sub20-tema', 'light');
    } catch { /* bez skladišta nema demo stanja */ }
  }, [{ access: jwt('demo@sub20.test'), refresh: 'R1', expiresAt: Date.now() + 3600000, email: 'demo@sub20.test', userId: 'u-demo', slika: null, ime: 'Demo', seenAt: null, deviceId: 'dDEMO' }, JSON.stringify(demoState(variant))]);
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const handler = async (route) => {
    const req = route.request(); const url = req.url(); const method = req.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let status = 200, body = {};
    if (url.includes('/auth/v1/token')) body = { access_token: jwt('demo@sub20.test'), refresh_token: 'R2', expires_in: 3600 };
    else if (url.includes('/auth/v1/user')) body = { user_metadata: {} };
    else if (url.includes('/rest/v1/user_state_istorija')) body = [];
    else if (url.includes('/rest/v1/user_state')) { if (method === 'GET') body = []; else { status = 201; body = [{ updated_at: new Date().toISOString() }]; } }
    else if (url.includes('/rest/v1/')) body = [];
    await route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  };
  await ctx.route(/^https:\/\/[^/]+\.supabase\.co\//, handler);
  await ctx.route(/^https:\/\/www\.strava\.com\//, handler);
  await ctx.route(/^https:\/\/api\.open-meteo\.com\//, handler);
  await ctx.route((u) => u.pathname.startsWith('/api/'), handler);
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(1800);
  return { ctx, page };
}

const tab = async (page, id) => { await page.locator(`#tabbar button[data-pg="${id}"]`).click(); await page.waitForTimeout(900); };
const back = async (page) => { await page.locator('.page.active .backbtn').first().click(); await page.waitForTimeout(700); };
const openRow = async (page, text) => { await page.locator('.page.active').getByRole('button', { name: new RegExp(text) }).first().click(); await page.waitForTimeout(900); };

async function shoot(page, name, crops = {}) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  writeFileSync(join(OUT, `${name}.txt`), await page.locator('.page.active').innerText());
  /* traka tabova je fiksna i inače prekrije donji deo isečka */
  await page.addStyleTag({ content: '#tabbar{visibility:hidden!important}' });
  for (const [k, sel] of Object.entries(crops)) {
    const el = page.locator(`.page.active ${sel}`).first();
    if (await el.count()) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: join(OUT, `${name}--${k}.png`) }); }
    else console.warn(`  ! ${name}: nema ${sel}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.addStyleTag({ content: '.appbar,#tabbar{visibility:hidden!important}' });
  await page.locator('main').screenshot({ path: join(OUT, `${name}-body.png`) });
  await page.evaluate(() => { for (const s of document.querySelectorAll('style')) if (s.textContent?.includes('visibility:hidden!important')) s.remove(); });
  console.log('✓', name);
}

const browser = await chromium.launch({ executablePath: process.env.SUB20_CHROMIUM ?? '/opt/pw-browsers/chromium' });
try {
  /* 1) odmoran dan: Danas i Plan bez upozorenja oporavka */
  {
    const { ctx, page } = await boot(browser, { tired: false });
    await shoot(page, 'danas-odmoran', { kartica: '#tcard', nedelja: '.week-line' });
    await tab(page, 'plan');
    await shoot(page, 'plan-odmoran', { nedelja: '.rows[aria-labelledby="week-h"]', km: '.weekkm' });
    await ctx.close();
  }
  /* 2) jutros HRV pada i san je kratak */
  const { ctx, page } = await boot(browser, { tired: true });
  await page.locator('.page.active .appbar').screenshot({ path: join(OUT, 'head.png') });
  for (const t of ['danas', 'plan', 'napredak', 'ti']) { await tab(page, t); await page.locator('#tabbar').screenshot({ path: join(OUT, `tabbar-${t}.png`) }); }

  await tab(page, 'danas');
  await shoot(page, 'danas', { kartica: '#tcard', nedelja: '.week-line' });
  await page.getByRole('button', { name: 'Detalji treninga' }).click(); await page.waitForTimeout(900);
  await shoot(page, 'detalji', {});
  await back(page);

  await tab(page, 'plan');
  await shoot(page, 'plan', { nedelja: '.rows[aria-labelledby="week-h"]', km: '.weekkm' });
  await page.getByRole('button', { name: 'Pregled celog plana' }).click(); await page.waitForTimeout(900);
  await shoot(page, 'plan-ceo', { grafik: 'svg.wk-chart' });
  await back(page);

  await tab(page, 'napredak');
  await shoot(page, 'napredak', { vdot: 'button.duo' });
  await openRow(page, 'Forma i predikcija');
  await shoot(page, 'forma', { odgovor: 'section.verdict', distance: 'ul.rtimes' });
  await back(page);
  await openRow(page, 'Oporavak');
  await shoot(page, 'oporavak', { stanje: 'section.ready', acwr: '.acwr' });
  await back(page);
  await openRow(page, 'Analiza trke');
  const sum = page.locator('.page.active .race-data details summary').first();
  if (await sum.count()) { await sum.click(); await page.waitForTimeout(400); }
  await shoot(page, 'trka', { prolazi: '.race-data details', tabela: '.race-data table' });
  await back(page);
  await ctx.close();
} finally {
  await browser.close();
}
