import { describe, expect, it } from 'vitest';
import { createAppApi } from '../api/appApi';
import { createStravaApi, type StravaLink } from './stravaApi';

/* parity: ensureToken, stApi, handleOAuthReturn (app.js). */

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function make(
  link: StravaLink | null,
  route: (url: string, init: RequestInit) => Response | Promise<Response>,
  now = Date.UTC(2026, 1, 1)
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let cur = link;
  const fetcher = (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init: init ?? {} });
    return Promise.resolve(route(url, init ?? {}));
  };
  const api = createStravaApi({
    fetcher,
    appApi: createAppApi({ fetcher, session: { token: () => Promise.resolve('JWT') } }),
    link: { get: () => cur, set: (v) => (cur = v) },
    now: () => now
  });
  return { api, calls, link: () => cur };
}

const fresh = (now = Date.UTC(2026, 1, 1)): StravaLink => ({
  access: 'AT',
  refresh: 'RT',
  expiresAt: Math.floor(now / 1000) + 3600
});

describe('Strava API', () => {
  it('nije povezana: nijedan poziv se ne šalje', async () => {
    const m = make(null, () => json(200, []));
    expect(await m.api.get('/athlete')).toMatchObject({ ok: false, error: 'Strava nije povezana' });
    expect(m.calls).toHaveLength(0);
  });

  it('važeći token: poziv ide direktno na strava.com sa Bearer-om, bez osvežavanja', async () => {
    const m = make(fresh(), () => json(200, [{ id: 1 }]));
    const r = await m.api.get('/athlete/activities?page=1');
    expect(r).toMatchObject({ ok: true, data: [{ id: 1 }] });
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0]?.url).toBe('https://www.strava.com/api/v3/athlete/activities?page=1');
    expect((m.calls[0]?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer AT');
  });

  it('token ističe za manje od 5 min: osvežava se preko /api/auth (sa JWT-om), nova veza se čuva', async () => {
    const now = Date.UTC(2026, 1, 1);
    const m = make(
      { access: 'OLD', refresh: 'RT', expiresAt: Math.floor(now / 1000) + 100 },
      (url) =>
        url === '/api/auth'
          ? json(200, {
              access_token: 'NEW',
              refresh_token: 'RT2',
              expires_at: Math.floor(now / 1000) + 21600
            })
          : json(200, { ok: 1 })
    );
    expect(await m.api.get('/athlete')).toMatchObject({ ok: true });
    expect(m.calls.map((c) => c.url)).toEqual([
      '/api/auth',
      'https://www.strava.com/api/v3/athlete'
    ]);
    expect((m.calls[0]?.init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer JWT'
    );
    expect(JSON.parse(m.calls[0]?.init.body as string)).toEqual({ refresh_token: 'RT' });
    expect(m.link()).toMatchObject({ access: 'NEW', refresh: 'RT2' });
    expect((m.calls[1]?.init.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer NEW'
    );
  });

  it('osvežavanje ne uspe: poruka sa razlogom, Strava se ne zove', async () => {
    const m = make({ access: 'OLD', refresh: 'RT', expiresAt: 1 }, () =>
      json(500, { error: 'Strava je pala' })
    );
    expect(await m.api.get('/athlete')).toEqual({
      ok: false,
      kind: 'http',
      error: 'Osvežavanje Strava tokena nije uspelo — Strava je pala'
    });
    expect(m.calls).toHaveLength(1);
  });

  it('401: jedan prinudni refresh pa ponavljanje; ako i tad 401, greška (nema petlje)', async () => {
    const now = Date.UTC(2026, 1, 1);
    let strava = 0;
    const m = make(fresh(now), (url) => {
      if (url === '/api/auth')
        return json(200, {
          access_token: 'NEW',
          refresh_token: 'RT2',
          expires_at: Math.floor(now / 1000) + 21600
        });
      strava++;
      return strava === 1 ? json(401, { message: 'Authorization Error' }) : json(200, { ok: 1 });
    });
    expect(await m.api.get('/athlete')).toMatchObject({ ok: true });
    expect(m.calls.map((c) => c.url.replace('https://www.strava.com/api/v3', ''))).toEqual([
      '/athlete',
      '/api/auth',
      '/athlete'
    ]);

    const stuck = make(fresh(now), (url) =>
      url === '/api/auth'
        ? json(200, { access_token: 'N', expires_at: Math.floor(now / 1000) + 21600 })
        : json(401, { message: 'Authorization Error' })
    );
    expect(await stuck.api.get('/athlete')).toMatchObject({
      ok: false,
      status: 401,
      error: 'Strava 401 — Authorization Error'
    });
    expect(stuck.calls.filter((c) => c.url === '/api/auth')).toHaveLength(1);
  });

  it('429 ima svoju poruku; ostale greške nose status i poruku Strave', async () => {
    const limited = make(fresh(), () => json(429, { message: 'Rate Limit Exceeded' }));
    expect(await limited.api.get('/x')).toMatchObject({
      ok: false,
      status: 429,
      error: expect.stringMatching(
        /^Strava rate limit \(429\) — sačekaj do isteka 15-min prozora/
      ) as string
    });
    const broken = make(fresh(), () =>
      json(404, { message: 'Record Not Found', errors: [{ code: 'invalid' }] })
    );
    expect(await broken.api.get('/x')).toMatchObject({
      ok: false,
      error: 'Strava 404 — Record Not Found · [{"code":"invalid"}]'
    });
    const html = make(fresh(), () => new Response('<html>oops</html>', { status: 200 }));
    expect(await html.api.get('/x')).toMatchObject({ ok: false, kind: 'parse' });
    const offline = make(fresh(), () => {
      throw new Error('net');
    });
    expect(await offline.api.get('/x')).toMatchObject({ ok: false, kind: 'network' });
  });

  it('razmena koda: tokeni i ime sportiste se čuvaju; greška servera se vraća kao poruka', async () => {
    const ok = make(null, (url) => {
      expect(url).toBe('/api/auth?code=ABC%20D');
      return json(200, {
        access_token: 'A',
        refresh_token: 'R',
        expires_at: 123,
        athlete: { firstname: 'Mika', lastname: 'Mikić' }
      });
    });
    expect(await ok.api.exchange('ABC D', 'read,activity:read_all')).toEqual({
      ok: true,
      athlete: 'Mika Mikić'
    });
    expect(ok.link()).toEqual({
      access: 'A',
      refresh: 'R',
      expiresAt: 123,
      athlete: 'Mika Mikić',
      scope: 'read,activity:read_all',
      lastSync: 0
    });
    const bad = make(null, () => json(400, { message: 'Bad Request' }));
    expect(await bad.api.exchange('x', '')).toEqual({ ok: false, error: 'Bad Request' });
    expect(bad.link()).toBeNull();
  });
});
