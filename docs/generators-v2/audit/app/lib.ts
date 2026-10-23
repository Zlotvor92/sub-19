import { expect, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession } from '../../../../web/e2e/support/backend';
import { tab } from '../../../../web/e2e/support/flows';

/* Ugao 6 — zajednički koraci istraživačkih E2E (kopija obrazaca iz web/e2e/*-v2.spec.ts i handoff-v2.spec.ts; web/ se ne
   menja). Datum je fiksan (2026-01-14), ulazi su fiksni — nema slučajnosti, svaki tok je ponovljiv. */

export { fixToday, installBackend, seedSession, tab };
export const STATE_KEY = 'sub19-v1:account:u-e2e';
export const SYNC = { timeout: 15_000 };
export type Backend = Awaited<ReturnType<typeof installBackend>>;
export type Flags = Partial<
  Record<
    'generatorV2FiveK' | 'generatorV2TenK' | 'generatorV2HalfMarathon' | 'generatorV2Marathon',
    boolean
  >
>;

export async function enableFlags(page: Page, flags: Flags, key = STATE_KEY): Promise<void> {
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
    { key, flags }
  );
}

export const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
export const serverPlan = (backend: Backend): string =>
  JSON.stringify((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null);
export const serverGen = (backend: Backend): Record<string, unknown> | null =>
  ((backend.row?.data as { genPlan?: unknown } | undefined)?.genPlan ?? null) as Record<
    string,
    unknown
  > | null;

export type Dist = '5K' | '10K' | 'Polumaraton' | 'Maraton';
export const V2KEY: Record<Dist, string> = {
  '5K': 'fiveKV2',
  '10K': 'tenKV2',
  Polumaraton: 'hmV2',
  Maraton: 'marathonV2'
};
export const POLICY: Record<Dist, string> = {
  '5K': '5k-v2',
  '10K': '10k-v2',
  Polumaraton: 'hm-v2',
  Maraton: 'marathon-v2'
};
export const FLAG: Record<Dist, keyof Flags> = {
  '5K': 'generatorV2FiveK',
  '10K': 'generatorV2TenK',
  Polumaraton: 'generatorV2HalfMarathon',
  Maraton: 'generatorV2Marathon'
};

/** Fiksni realni ulazi po distanci (isti kao u postojećim E2E v2). */
export const INPUT: Record<
  Dist,
  {
    date: string;
    shown: RegExp;
    pb: [string, string];
    km: string;
    long?: string;
    days: string[];
    goal: [string, string, string?];
  }
> = {
  '5K': {
    date: '2026-04-12',
    shown: /Plan 5K v2: 12 nedelja/,
    pb: ['22', '30'],
    km: '32',
    days: ['Uto', 'Čet', 'Sub', 'Ned'],
    goal: ['21', '30']
  },
  '10K': {
    date: '2026-04-12',
    shown: /Plan 10K v2: 12 nedelja/,
    pb: ['45', '0'],
    km: '40',
    days: ['Uto', 'Čet', 'Sub', 'Ned'],
    goal: ['43', '0']
  },
  Polumaraton: {
    date: '2026-04-12',
    shown: /Plan polumaratona v2: 12 nedelja/,
    pb: ['45', '0'],
    km: '40',
    long: '16',
    days: ['Uto', 'Čet', 'Sub', 'Ned'],
    goal: ['40', '0', '1']
  },
  Maraton: {
    date: '2026-05-10',
    shown: /Plan maratona v2: 16 nedelja/,
    pb: ['45', '0'],
    km: '45',
    long: '18',
    days: ['Uto', 'Čet', 'Sub', 'Ned'],
    goal: ['30', '0', '3']
  }
};

export async function raceStep(page: Page, dist: Dist, date: string, shown: RegExp): Promise<void> {
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  await expect(async () => {
    await group(page, 'Ciljna distanca')
      .getByRole('button', { name: dist, exact: true })
      .click({ timeout: 2000 });
    await page.getByLabel('Datum trke').fill(date, { timeout: 2000 });
    await expect(page.getByText(shown)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Dalje' }).click();
}

/** Čarobnjak v2 sa rezultatom 10 km (5K: rezultat 5 km), dan dugog nedelja. */
export async function v2Wizard(page: Page, dist: Dist): Promise<void> {
  const i = INPUT[dist];
  await raceStep(page, dist, i.date, i.shown);
  await page.getByRole('button', { name: 'Imam rezultat' }).click();
  await page.getByLabel('minuti').fill(i.pb[0]);
  await page.getByLabel('sekunde').fill(i.pb[1]);
  await page.getByLabel('Datum rezultata').fill('2026-01-10');
  await page.getByRole('button', { name: 'Dalje' }).click();
  if (dist !== '5K') await page.getByRole('button', { name: 'Da', exact: true }).click();
  await page.getByLabel('Nedeljna kilometraža').fill(i.km);
  if (i.long) await page.getByLabel('Najduže skorašnje trčanje (km)').fill(i.long);
  await page.getByRole('button', { name: 'Trčim redovno' }).click();
  await page.getByRole('button', { name: 'Dalje' }).click();
  const g = group(page, 'Dani trčanja');
  for (const d of i.days) await g.getByRole('button', { name: d, exact: true }).click();
  if (dist !== '5K')
    await group(page, 'Dan dugog trčanja')
      .getByRole('button', { name: 'Ned', exact: true })
      .click();
  if (i.goal[2]) await page.getByLabel('sati').fill(i.goal[2]);
  await page.getByLabel('minuti').fill(i.goal[0]);
  await page.getByLabel('sekunde').fill(i.goal[1]);
  await page.getByRole('button', { name: 'Napravi plan' }).click();
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Glavna navigacija' })).toBeVisible();
}

/** Prijavljena pauza do `today` u Prilagodi plan (pregled). */
export async function pauseReview(page: Page, today: string, from: string): Promise<void> {
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

/** Nedeljni stubići grafikona Plan taba: broj nedelje → planirani km (kako ih korisnik vidi). */
export async function chartBars(page: Page): Promise<Map<number, number>> {
  await page.getByRole('button', { name: 'Pregled celog plana' }).click();
  const hits = page.locator('rect.wk-hit');
  await expect(hits.first()).toBeAttached();
  const labels = await hits.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  const out = new Map<number, number>();
  for (const l of labels) {
    const m = /^Nedelja (\d+): plan ([\d.,]+) km/.exec(l);
    if (m) out.set(Number(m[1]), Number(m[2].replace(/\./g, '').replace(',', '.')));
  }
  await page.getByRole('button', { name: 'Nazad', exact: true }).click();
  return out;
}

/** Brojevi nedelja koje stoje u vidljivom tekstu („nedelja 3", „nedelje 3", „u nedelji 3", „Nedelja 3"). */
export function weekNumbersIn(text: string): number[] {
  return [...text.matchAll(/[Nn]edelj[aeiu]\s+(\d+)(?!\s*(?:km|dana|min|kvalitet))/g)].map((m) => Number(m[1]));
}

/** Seme stanja pre učitavanja (bez prekidača) — čist nalog. */
export async function plainUser(page: Page, today = '2026-01-14T09:00:00'): Promise<Backend> {
  await fixToday(page, today);
  await seedSession(page);
  return installBackend(page);
}
