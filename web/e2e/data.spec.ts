import { expect, test, type Page } from '@playwright/test';
import { fixToday, installBackend, seedSession, type Backend } from './support/backend';
import { createPlan, openSetting } from './support/flows';

/* Kritični tokovi podataka (nisu među 14, ali ih zahteva definicija završenosti): izvoz/uvoz backupa i brisanje naloga. */

let backend: Backend;
test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await seedSession(page);
  backend = await installBackend(page);
  await createPlan(page);
});

const openSection = openSetting;

async function completeToday(page: Page, km: string): Promise<void> {
  await page.getByRole('button', { name: 'Završi trening' }).click();
  await page.getByLabel(/Distanca \(km\)/).fill(km);
  await page.getByLabel(/^Vreme/).fill('4233');
  await page.getByLabel(/^Vreme/).blur();
}

test('backup: izvoz daje ispravan fajl; uvoz ga vraća; pokvaren fajl se odbija bez promene podataka', async ({
  page
}) => {
  await completeToday(page, '8,6');
  await openSection(page, 'Nalog', 'Podaci');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Izvezi backup' }).click()
  ]);
  expect(download.suggestedFilename()).toBe('sub19-backup-2026-01-14.json');
  const path = await download.path();
  const fs = await import('node:fs/promises');
  const exported = JSON.parse(await fs.readFile(path, 'utf8')) as {
    app: string;
    state: {
      v: number;
      genPlan: unknown;
      log: Record<string, { km?: number; status?: string }>;
    };
  };
  expect(exported.app).toBe('SUB-19');
  expect(exported.state.v).toBe(11);
  expect(exported.state.genPlan).toBeTruthy();
  // tokeni integracija NIKAD ne idu u backup
  expect(exported.state).not.toHaveProperty('strava');
  expect(exported.state).not.toHaveProperty('icu');
  const [id, entry] = Object.entries(exported.state.log)[0] ?? ['', {}];
  expect(entry).toMatchObject({ status: 'done', km: 8.6 });

  // uvoz izmenjenog backup-a (isti plan, drugačiji unos) PREPISUJE podatke posle potvrde
  const edited = {
    ...exported,
    state: { ...exported.state, log: { [id]: { ...entry, km: 9.9 } } }
  };
  await page.locator('#s-file').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(edited))
  });
  await expect(page.getByText(/^Uvoz će PREPISATI postojeće podatke\./)).toBeVisible();
  await expect(page.locator('#confirm-text')).toContainText('U fajlu: 1 trening');
  await page.getByRole('button', { name: 'Da', exact: true }).click();
  await expect(page.getByLabel(/Distanca \(km\)/)).toHaveValue('9,9');
  await expect.poll(() => JSON.stringify(backend.row?.data ?? {})).toContain('"km":9.9');

  // fajl koji nije backup: poruka, a ništa se ne menja
  const alerts: string[] = [];
  page.on('dialog', (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  await openSection(page, 'Nalog', 'Podaci');
  await page.locator('#s-file').setInputFiles({
    name: 'nije.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"nešto":"drugo"}')
  });
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toMatch(/^Fajl nije prepoznat kao backup ove aplikacije/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByLabel(/Distanca \(km\)/)).toHaveValue('9,9');
});

test('backup: ručno izmenjen fajl sa opasnim identifikatorom se odbija (XSS vektor kroz ID)', async ({
  page
}) => {
  const alerts: string[] = [];
  page.on('dialog', (d) => {
    alerts.push(d.message());
    void d.dismiss();
  });
  await openSection(page, 'Nalog', 'Podaci');
  await page.locator('#s-file').setInputFiles({
    name: 'zlo.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        app: 'SUB-19',
        state: { v: 11, log: { '"><img src=x onerror=alert(1)>': { status: 'done' } } }
      })
    )
  });
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toMatch(/neispravan identifikator/);
  expect(await page.evaluate(() => localStorage.getItem('sub19-v1'))).not.toContain('onerror');
});

test('brisanje naloga: dugme je zaključano dok se ne ukuca potvrda; greška servera NE briše lokalne podatke; uspeh briše sve', async ({
  page
}) => {
  await openSection(page, 'Nalog', 'Nalog');
  await page.getByText('Brisanje naloga', { exact: true }).click();
  await page.getByRole('button', { name: 'Obriši nalog' }).click();
  const sheet = page.getByRole('dialog');
  const go = sheet.getByRole('button', { name: 'Obriši nalog' });
  await expect(go).toBeDisabled();
  await sheet.getByLabel('Potvrda brisanja').fill('obrisi nalo');
  await expect(go).toBeDisabled();
  await sheet.getByLabel('Potvrda brisanja').fill('obriši nalog'); // Š→S, mala slova — isto poredi i server
  await expect(go).toBeEnabled();

  // server odbija: ostaje sve što je bilo
  backend.api.set('/api/delete-account', () => ({
    status: 500,
    body: { error: 'Brisanje podataka nije uspelo — nalog nije obrisan.' }
  }));
  await go.click();
  await expect(sheet.getByRole('alert')).toHaveText(
    'Brisanje podataka nije uspelo — nalog nije obrisan.'
  );
  expect(await page.evaluate(() => localStorage.getItem('sub19-v1'))).toContain('genPlan');

  // server briše: lokalno se zaboravlja sve, kapija se vraća sa porukom
  backend.api.set('/api/delete-account', (r) => {
    expect(r.body).toEqual({ potvrda: 'OBRISI NALOG' });
    return { body: { ok: true } };
  });
  await go.click();
  await expect(page.getByRole('heading', { name: 'Prijavi se da nastaviš' })).toBeVisible();
  await expect(page.getByText('Nalog i svi podaci su obrisani.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sub19-v1'))).toBeNull();
  const session = await page.evaluate(() => localStorage.getItem('sub19_sb'));
  expect(session === null || (JSON.parse(session) as { access: unknown }).access === null).toBe(
    true
  );
});
