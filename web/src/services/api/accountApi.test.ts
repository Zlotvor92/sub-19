import { describe, expect, it } from 'vitest';
import { createAccountApi, normalizeConfirmation, DELETE_CONFIRMATION } from './accountApi';
import { createAppApi } from './appApi';

/* parity: openObrisiNalogSheet, openBugSheet (app.js), api/delete-account.js, api/report-bug.js. */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function make(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
  token = 'TOK'
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const api = createAccountApi(
    createAppApi({
      fetcher: (url, init) => {
        calls.push({ url, init: init ?? {} });
        return Promise.resolve(handler(url, init ?? {}));
      },
      session: { token: () => Promise.resolve(token) }
    })
  );
  return { api, calls };
}

describe('nalog i podrška', () => {
  it('potvrda: Š→S, velika slova, razmaci — isto što server poredi', () => {
    expect(normalizeConfirmation('  obriši   nalog ')).toBe(DELETE_CONFIRMATION);
    expect(normalizeConfirmation('OBRIŠI NALOG')).toBe(DELETE_CONFIRMATION);
    expect(normalizeConfirmation('obrisi nalo')).not.toBe(DELETE_CONFIRMATION);
  });

  it('brisanje: šalje JWT i potvrdu; uspeh i greška servera se razlikuju', async () => {
    const ok = make(() => json(200, { ok: true, obrisano: ['a'] }));
    expect(await ok.api.deleteAccount(DELETE_CONFIRMATION)).toEqual({ ok: true });
    expect(ok.calls[0]?.url).toBe('/api/delete-account');
    expect((ok.calls[0]?.init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer TOK'
    );
    expect(JSON.parse(ok.calls[0]?.init.body as string)).toEqual({ potvrda: 'OBRISI NALOG' });

    const bad = make(() =>
      json(500, { error: 'Brisanje podataka nije uspelo — nalog nije obrisan.' })
    );
    expect(await bad.api.deleteAccount(DELETE_CONFIRMATION)).toEqual({
      ok: false,
      error: 'Brisanje podataka nije uspelo — nalog nije obrisan.'
    });
    const refused = make(() => json(200, { ok: false, error: 'Potvrda nije ispravna.' }));
    expect(await refused.api.deleteAccount('x')).toEqual({
      ok: false,
      error: 'Potvrda nije ispravna.'
    });
  });

  it('bez prijave se ništa ne šalje', async () => {
    const m = make(() => json(200, { ok: true }), '');
    expect(await m.api.deleteAccount(DELETE_CONFIRMATION)).toEqual({
      ok: false,
      error: 'Moraš biti prijavljen.'
    });
    expect(
      await m.api.reportBug('x', { version: '1', tab: 'danas', userAgent: 'u' })
    ).toMatchObject({ ok: false });
    expect(m.calls).toHaveLength(0);
  });

  it('prijava greške: telo nosi opis i kontekst; HTML umesto JSON-a je razumljiva greška, ne izuzetak', async () => {
    const m = make(() => json(200, { ok: true }));
    expect(
      await m.api.reportBug('ne radi', { version: '283', tab: 'plan', userAgent: 'UA' })
    ).toEqual({ ok: true });
    expect(JSON.parse(m.calls[0]?.init.body as string)).toEqual({
      description: 'ne radi',
      context: { version: '283', tab: 'plan', userAgent: 'UA' }
    });
    const html = make(
      () => new Response('<html>A server error has occurred</html>', { status: 200 })
    );
    expect(await html.api.reportBug('x', { version: '1', tab: 'a', userAgent: 'u' })).toEqual({
      ok: false,
      error: 'Server nije vratio ispravan odgovor.'
    });
    const offline = make(() => {
      throw new Error('net');
    });
    expect(await offline.api.reportBug('x', { version: '1', tab: 'a', userAgent: 'u' })).toEqual({
      ok: false,
      error: 'Nema veze sa serverom.'
    });
  });
});
