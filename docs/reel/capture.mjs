/* SNIMCI EKRANA ZA REEL I ZA MANIFEST — iz PRAVE aplikacije (izgrađene i servirane na :4173), sa izmišljenim demo podacima iz generatora plana
   (`demo-state.json`: plan 5K, 12 nedelja, bez ijednog ličnog podatka). Vreme je zamrznuto na sredu 4. 11. 2026.
   Pokretanje:  (cd web && npm run build && npx vite preview --port 4173 --strictPort &)  pa  node docs/reel/capture.mjs
   Piše:
     docs/reel/assets/{head,<ekran>-body,tabbar-<ekran>,sheet}.png   (390 × 844 pri DSF 3 — za animaciju reela)
     web/public/screenshot-{danas,plan,oporavak,trka}.webp           (720 × 1558 — za manifest) */
import { chromium } from '../../web/node_modules/@playwright/test/index.mjs';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, 'assets');
const PUBLIC = join(HERE, '../../web/public');
mkdirSync(ASSETS, { recursive: true });

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (email, sub = 'u-demo') => `${b64({ alg: 'none' })}.${b64({ sub, email })}.sig`;
const TODAY = '2026-11-04';
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function demoState() {
  const s = JSON.parse(readFileSync(join(HERE, 'demo-state.json'), 'utf8'));
  const paceFor = { lako: 322, lr: 326, tempo: 262, int: 258, rw: 340 };
  let n = 0;
  for (const w of s.genPlan.weeks) for (const d of w.days) {
    const date = addDays(w.start, d.dow);
    if (d.rest || d.km == null || !d.id || date >= TODAY) continue;
    n++;
    if (n % 11 === 0) { s.log[d.id] = { status: 'skip' }; continue; }
    const p = (paceFor[d.tag] || 320) + ((n * 7) % 9) - 3;
    s.log[d.id] = { status: 'done', km: d.km, sec: Math.round(d.km * p), hr: 148 + (n % 14), runDate: date, ts: date };
  }
  for (const r of s.genPlan.pred) if (r.w <= 5) s.pred[r.id] = Math.round(r.pt + 1 - r.w * 1.2);
  s.vdotLog = [
    { id: 'g1_0', ts: '2026-10-02', measured: 48.3, prev: 48.1, vdot: 48.2, delta: 0.1, alpha: 0.4 },
    { id: 'g2_1', ts: '2026-10-09', measured: 48.9, prev: 48.2, vdot: 48.5, delta: 0.3, alpha: 0.4 },
    { id: 'g3_1', ts: '2026-10-16', measured: 49.0, prev: 48.5, vdot: 48.7, delta: 0.2, alpha: 0.4 },
    { id: 'g4_1', ts: '2026-10-23', measured: 49.4, prev: 48.7, vdot: 49.0, delta: 0.3, alpha: 0.4 },
    { id: 'g5_1', ts: '2026-10-30', measured: 49.5, prev: 49.0, vdot: 49.2, delta: 0.2, alpha: 0.4 }
  ];
  s.kg = [{ date: '2026-10-02', kg: 71.4 }, { date: '2026-10-20', kg: 70.6 }, { date: '2026-11-02', kg: 70.1 }];
  s.ui.firstRun = '2026-09-28';
  /* jutros: HRV ispod osnove, kratak san — da ekran Oporavak ima šta da kaže */
  s.wellness = {};
  for (let i = 10; i >= 0; i--) {
    const d = addDays(TODAY, -i);
    s.wellness[d] = { datum: d, hrv: i === 0 ? 49 : 60 + (i % 3), pulsUMiru: i === 0 ? 52 : 46, sanH: i === 0 ? 5.6 : 7.3, sanOcena: 61, tezina: null, ctl: 42, atl: 55, svezina: i === 0 ? -13 : -2 };
  }
  return s;
}

async function boot(browser, { w, h, dsf }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(TODAY + 'T07:30:00'));
  const st = JSON.stringify(demoState());
  await ctx.addInitScript(([sess, state]) => {
    try {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1'); sessionStorage.setItem('sub20-uvod', '1');
      localStorage.setItem('sub19_sb', JSON.stringify(sess));
      localStorage.setItem('sub19-v1', state);
    } catch { /* bez skladišta nema demo stanja */ }
  }, [{ access: jwt('demo@sub20.test'), refresh: 'R1', expiresAt: Date.now() + 3600000, email: 'demo@sub20.test', userId: 'u-demo', slika: null, ime: 'Demo', seenAt: null, deviceId: 'dDEMO' }, st]);
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const handler = async (route) => {
    const req = route.request(); const url = req.url(); const method = req.method();
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let status = 200, body = {};
    if (url.includes('/auth/v1/token')) body = { access_token: jwt('demo@sub20.test'), refresh_token: 'R2', expires_in: 3600 };
    else if (url.includes('/auth/v1/user')) body = { user_metadata: {} };
    else if (url.includes('/rest/v1/user_state_istorija')) body = [];
    else if (url.includes('/rest/v1/user_state')) { if (method === 'GET') body = []; else { status = 201; body = [{ updated_at: new Date().toISOString() }]; } }
    else if (url.includes('/rest/v1/zajednica')) body = [];
    await route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  };
  await ctx.route(/^https:\/\/[^/]+\.supabase\.co\//, handler);
  await ctx.route(/^https:\/\/www\.strava\.com\/(?!oauth)/, handler);
  await ctx.route(/^https:\/\/api\.open-meteo\.com\//, handler);
  await ctx.route((u) => u.pathname.startsWith('/api/'), handler);
  await page.goto('http://localhost:4173/');
  await page.waitForTimeout(1800);
  return { ctx, page };
}

const NAME = { danas: 'Danas', plan: 'Plan', opor: 'Oporavak', pred: 'Trka' };
const OUTNAME = { danas: 'danas', plan: 'plan', opor: 'oporavak', pred: 'trka' };
const goTab = async (page, id) => {
  await page.getByRole('navigation', { name: 'Glavna navigacija' }).getByRole('button', { name: NAME[id] }).click();
  await page.waitForTimeout(1300);
};
const SELECTORS = {
  danas: { title: '.screen-head', panel: '#tcard', pace: '#tcard .pace', facts: '#tcard .focus-main', profile: '#tcard .sprof', cycle: 'section[aria-labelledby=cyc-h]' },
  plan: { summary: '#pl-sum-h', chart: '.chart-card', phases: '.phase-block', planbar: '.planbar' },
  opor: { ready: '.ready', answer: '.ready .rd-a', todo: '.ready .rd-do', sigs: '.ready .sigs', load: 'section[aria-labelledby=ld-h]' },
  pred: { verdict: '.verdict', answer: '.verdict .vd-a', journey: '.verdict .journey', trend: 'section[aria-labelledby=vt-h]', times: 'section[aria-labelledby=rt-h]' }
};
const toWebp = (png, webp) => { execFileSync('convert', [png, '-quality', '84', webp]); unlinkSync(png); };

const browser = await chromium.launch({ executablePath: process.env.SUB20_CHROMIUM ?? '/opt/pw-browsers/chromium' });
try {
  /* 1) manifest: 360 × 779 pri DSF 2 = 720 × 1558 */
  {
    const { ctx, page } = await boot(browser, { w: 360, h: 779, dsf: 2 });
    for (const id of Object.keys(NAME)) {
      if (id !== 'danas') await goTab(page, id);
      const png = join(PUBLIC, `screenshot-${OUTNAME[id]}.png`);
      await page.screenshot({ path: png });
      toWebp(png, join(PUBLIC, `screenshot-${OUTNAME[id]}.webp`));
      console.log('✓ manifest', OUTNAME[id]);
    }
    await ctx.close();
  }
  /* 2) reel: delovi telefona pri DSF 3 (zaglavlje, sadržaj bez zaglavlja i trake, traka tabova po ekranu, list treninga) */
  {
    const { ctx, page } = await boot(browser, { w: 390, h: 844, dsf: 3 });
    await page.locator('.app-head').screenshot({ path: join(ASSETS, 'head.png') });
    const boxes = {};
    for (const id of Object.keys(NAME)) {
      if (id !== 'danas') await goTab(page, id);
      await page.locator('#tabbar').screenshot({ path: join(ASSETS, `tabbar-${id}.png`) });
      /* položaji (CSS px, u odnosu na vrh `main`) elemenata koje animacija označava */
      boxes[id] = await page.evaluate((sel) => {
        const main = document.querySelector('main').getBoundingClientRect();
        const out = {};
        for (const [k, q] of Object.entries(sel)) {
          const el = document.querySelector(`.page.active ${q}`);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          out[k] = { x: r.left - main.left, y: r.top - main.top, w: r.width, h: r.height };
        }
        return out;
      }, SELECTORS[id]);
      await page.addStyleTag({ content: '.app-head,#tabbar{visibility:hidden!important}' });
      await page.locator('main').screenshot({ path: join(ASSETS, `${id}-body.png`) });
      await page.evaluate(() => { for (const s of document.querySelectorAll('style')) if (s.textContent?.includes('visibility:hidden!important') && s.textContent.includes('.app-head')) s.remove(); });
      console.log('✓ reel', id);
    }
    writeFileSync(join(ASSETS, 'boxes.json'), JSON.stringify(boxes, null, 1));
    await goTab(page, 'danas');
    await page.getByRole('button', { name: 'Detalji treninga' }).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(ASSETS, 'sheet.png') });
    await ctx.close();
  }
} finally {
  await browser.close();
}
