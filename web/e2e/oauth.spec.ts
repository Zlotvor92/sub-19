import { expect, test, type Page } from '@playwright/test';
import {
  SUPABASE,
  fixToday,
  installBackend,
  jwt,
  seedSession,
  type Backend
} from './support/backend';

/* Claude konektor: Supabase OAuth server šalje korisnika na `/?authorization_id=…` (Authorization Path `/`); aplikacija pita ko traži
   pristup, korisnik odluči, a pregledač ide nazad u Claude (sa kodom ili sa `access_denied`). */

const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
const ID = 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z';
const AUTHZ = `${SUPABASE}/auth/v1/oauth/authorizations/${ID}`;

function claudeRequest(backend: Backend): void {
  backend.api.set(AUTHZ, () => ({
    body: {
      authorization_id: ID,
      redirect_uri: CLAUDE,
      client: { id: 'c1', name: 'Claude', uri: '', logo_uri: '' },
      user: { id: 'u-e2e', email: 'e2e@sub20.test' },
      scope: 'email'
    }
  }));
  backend.api.set(`${AUTHZ}/consent`, (r) => ({
    body: {
      redirect_url:
        (r.body as { action?: string }).action === 'approve'
          ? `${CLAUDE}?code=KOD&state=S`
          : `${CLAUDE}?error=access_denied&state=S`
    }
  }));
}

/** Claude-ova povratna adresa: test samo proverava da je pregledač stigao tamo. */
async function stubClaude(page: Page): Promise<void> {
  await page.route('https://claude.ai/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<p>claude</p>' })
  );
}

test.beforeEach(async ({ page }) => {
  await fixToday(page);
  await stubClaude(page);
});

test('prijavljen korisnik: ekran odobrenja umesto čarobnjaka, Dozvoli vraća u Claude sa kodom', async ({
  page
}) => {
  const backend = await installBackend(page);
  claudeRequest(backend);
  await seedSession(page);
  await page.goto(`/?authorization_id=${ID}`);
  await expect(
    page.getByRole('heading', { name: 'Claude traži pristup zdravstvenim podacima' })
  ).toBeVisible();
  await expect(page.getByText(/e2e@sub20\.test/)).toBeVisible();
  // upit je uklonjen iz adrese; čarobnjak (nema plana) ne prekriva odobrenje
  expect(new URL(page.url()).search).toBe('');
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Dozvoli' }).click();
  await page.waitForURL(`${CLAUDE}?code=KOD&state=S`);
  const consent = backend.requests.filter((r) => r.url === `${AUTHZ}/consent`);
  expect(consent).toEqual([
    { method: 'POST', url: `${AUTHZ}/consent`, body: { action: 'approve' } }
  ]);
});

test.describe('neprijavljen, u pregledaču na telefonu', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
  });

  test('prijava bez instalacije, povratak sa Google-a otvara odobrenje; Odbij vraća u Claude', async ({
    page
  }) => {
    const backend = await installBackend(page);
    claudeRequest(backend);
    await page.route(`${SUPABASE}/auth/v1/authorize**`, async (route) => {
      const back = new URL(route.request().url()).searchParams.get('redirect_to') ?? '';
      await route.fulfill({
        status: 302,
        headers: {
          location: `${back}#access_token=${jwt('e2e@sub20.test')}&refresh_token=RT&expires_in=3600&token_type=bearer`
        }
      });
    });
    await page.goto(`/?authorization_id=${ID}`);
    // kapija ne traži instalaciju: prijava je za Claude, u ovom pregledaču
    await expect(page.getByRole('heading', { name: 'Prijavi se da nastaviš' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prvo instaliraj sub20' })).toHaveCount(0);
    expect(backend.count('/oauth/authorizations')).toBe(0);

    await page.getByRole('button', { name: 'Prijavi se Google nalogom' }).click();
    await expect(
      page.getByRole('heading', { name: 'Claude traži pristup zdravstvenim podacima' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Odbij' }).click();
    await page.waitForURL(`${CLAUDE}?error=access_denied&state=S`);
  });
});

test('bez zahteva za odobrenje aplikacija se otvara kao i uvek', async ({ page }) => {
  const backend = await installBackend(page);
  await seedSession(page);
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Pravljenje plana' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Pristup za Claude' })).toHaveCount(0);
  expect(backend.count('/oauth/authorizations')).toBe(0);
});
