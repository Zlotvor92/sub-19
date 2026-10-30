import { describe, expect, it, vi } from 'vitest';
import { CLAUDE_CALLBACK, createOAuthServerApi, isClaudeRedirect } from './oauthServer';

const SB = 'https://p.supabase.co';
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function setup(response: Response, token = 'tok') {
  const fetcher = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(response));
  const api = createOAuthServerApi({
    fetcher,
    session: { token: () => Promise.resolve(token) },
    supabaseUrl: SB,
    anonKey: 'anon'
  });
  return { api, fetcher };
}

describe('Claude konektor: odobrenje preko Supabase OAuth servera', () => {
  it('detalji zahteva: putanja, ključ i token sesije aplikacije', async () => {
    const { api, fetcher } = setup(
      json({
        authorization_id: 'a1',
        redirect_uri: CLAUDE_CALLBACK,
        client: { id: 'c', name: 'Claude', uri: '', logo_uri: '' },
        user: { id: 'u', email: 'k@t.rs' },
        scope: 'email'
      })
    );
    const r = await api.details('a1');
    expect(r).toMatchObject({
      ok: true,
      data: { kind: 'consent', clientName: 'Claude', redirectUri: CLAUDE_CALLBACK, email: 'k@t.rs' }
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(`${SB}/auth/v1/oauth/authorizations/a1`);
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer tok' });
  });

  it('ranije odobren zahtev: Supabase odmah daje povratnu adresu', async () => {
    const { api } = setup(json({ redirect_url: `${CLAUDE_CALLBACK}?code=x&state=y` }));
    expect(await api.details('a1')).toMatchObject({
      ok: true,
      data: { kind: 'redirect', url: `${CLAUDE_CALLBACK}?code=x&state=y` }
    });
  });

  it('odluka ide kao POST {action} na /consent i vraća adresu povratka', async () => {
    const { api, fetcher } = setup(json({ redirect_url: `${CLAUDE_CALLBACK}?code=x` }));
    expect(await api.decide('a1', 'approve')).toMatchObject({
      ok: true,
      data: `${CLAUDE_CALLBACK}?code=x`
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(`${SB}/auth/v1/oauth/authorizations/a1/consent`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ action: 'approve' });
  });

  it('ID se kodira: ne može da promeni putanju poziva', async () => {
    const { api, fetcher } = setup(json({ redirect_url: CLAUDE_CALLBACK }));
    await api.decide('a/../../admin', 'deny');
    expect(fetcher.mock.calls[0]![0]).toBe(
      `${SB}/auth/v1/oauth/authorizations/a%2F..%2F..%2Fadmin/consent`
    );
  });

  it('bez sesije se ništa ne šalje', async () => {
    const { api, fetcher } = setup(json({}), '');
    expect(await api.details('a1')).toMatchObject({ ok: false, status: 401 });
    expect(await api.decide('a1', 'approve')).toMatchObject({ ok: false, status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('istekao zahtev: greška sa statusom (ekran tada kaže da se povezivanje pokrene ponovo)', async () => {
    const { api } = setup(json({ msg: 'not found' }, 404));
    expect(await api.details('a1')).toMatchObject({ ok: false, status: 404 });
  });

  it('samo Claude-ova povratna adresa je Claude (domen nije dovoljan)', () => {
    expect(isClaudeRedirect(CLAUDE_CALLBACK)).toBe(true);
    expect(isClaudeRedirect(`${CLAUDE_CALLBACK}?code=1`)).toBe(true);
    expect(isClaudeRedirect('https://claude.ai/drugo')).toBe(false);
    expect(isClaudeRedirect('https://claude.ai.zlo.com/api/mcp/auth_callback')).toBe(false);
    expect(isClaudeRedirect('http://localhost:3000/callback')).toBe(false);
  });
});
