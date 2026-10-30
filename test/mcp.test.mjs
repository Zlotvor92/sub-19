/* /api/mcp — MCP server za Claude (samo čitanje zdravstvenih podataka).

   Šta se čuva: da bez tokena Claude dobije 401 sa pokazivačem na metapodatke
   (inače ne zna gde je prijava), da token aplikacije (bez `client_id`) ne
   prolazi, i da iz baze izlazi SAMO `data->wellness` — plan, dnevnik i beleške
   ne smeju ni da se zatraže. Ništa ne ide na mrežu. */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'srv' };
const UID = '00000000-0000-4000-8000-000000000001';

function makeRes() {
  const r = { code: null, body: undefined, headers: {}, ended: false };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.end = () => { r.ended = true; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}
const jsonRes = (body, ok = true, status = 200) => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });
const jwtSa = telo => ['e30', Buffer.from(JSON.stringify(telo)).toString('base64url'), 'potpis'].join('.');
const OAUTH = jwtSa({ sub: UID, client_id: 'claude' });

const origFetch = globalThis.fetch;
const origEnv = {};
let pozivi;
let wellness;
beforeEach(() => {
  for (const k of Object.keys(ENV)) { origEnv[k] = process.env[k]; process.env[k] = ENV[k]; }
  pozivi = [];
  wellness = {
    '2026-10-01': { datum: '2026-10-01', hrv: 61, pulsUMiru: 48, sanH: 7.5, sanOcena: 82, tezina: 71.2, ctl: 40, atl: 45, svezina: -5 },
    '2026-10-05': { datum: '2026-10-05', hrv: 55, pulsUMiru: 50, sanH: 6.1, sanOcena: null, tezina: null, ctl: 41, atl: 50, svezina: -9 },
    '2026-09-01': { datum: '2026-09-01', hrv: 70, pulsUMiru: 46, sanH: 8, sanOcena: 90, tezina: 70.8, ctl: 38, atl: 30, svezina: 8 }
  };
  globalThis.fetch = async (url, opt) => {
    const u = String(url);
    pozivi.push({ url: u, opt });
    if (u.endsWith('/auth/v1/user')) return jsonRes({ id: UID, email: 'k@t.rs' });
    if (u.includes('/rest/v1/user_state')) return jsonRes([{ wellness }]);
    throw new Error('neočekivan poziv ' + u);
  };
});
afterEach(() => {
  globalThis.fetch = origFetch;
  for (const k of Object.keys(ENV)) {
    if (origEnv[k] === undefined) delete process.env[k]; else process.env[k] = origEnv[k];
  }
});

const handler = async () => (await import('../api/mcp.js?t=' + Date.now())).default;
async function rpc(telo, token = OAUTH) {
  const h = await handler();
  const res = makeRes();
  const headers = { host: 'sub-19.vercel.app' };
  if (token) headers.authorization = 'Bearer ' + token;
  await h({ method: 'POST', headers, query: {}, body: telo }, res);
  return res;
}
const poziv = (name, args, id = 3) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
const podaci = res => JSON.parse(res.body.result.content[0].text);

describe('/api/mcp — prijava', () => {
  test('bez tokena: 401 sa pokazivačem na metapodatke (inače Claude ne nađe prijavu)', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, null);
    assert.equal(res.code, 401);
    assert.match(res.headers['WWW-Authenticate'],
      /^Bearer resource_metadata="https:\/\/sub-19\.vercel\.app\/api\/mcp\?metadata", scope="email"$/);
    assert.equal(pozivi.length, 0);
  });

  test('metapodaci: resurs je tačna adresa servera, prijava je Supabase Auth, bez `openid`', async () => {
    const h = await handler();
    const res = makeRes();
    await h({ method: 'GET', headers: { host: 'sub-19.vercel.app' }, query: { metadata: '' } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.resource, 'https://sub-19.vercel.app/api/mcp');
    assert.deepEqual(res.body.authorization_servers, ['https://x.supabase.co/auth/v1']);
    assert.deepEqual(res.body.scopes_supported, ['email']);
  });

  test('token aplikacije (bez `client_id`) se odbija pre mreže — putanja je samo za konektor', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, jwtSa({ sub: UID, role: 'authenticated' }));
    assert.equal(res.code, 401);
    assert.match(res.headers['WWW-Authenticate'], /error="invalid_token"/);
    assert.equal(pozivi.length, 0);
  });

  test('token koji Supabase odbije daje 401 invalid_token (Claude tada osvežava token)', async () => {
    globalThis.fetch = async () => jsonRes({}, false, 401);
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.equal(res.code, 401);
    assert.match(res.headers['WWW-Authenticate'], /error="invalid_token"/);
  });

  test('Supabase Auth ne odgovara: 503, ne 401 (prolazan kvar ne sme da ruši vezu)', async () => {
    globalThis.fetch = async () => { throw new Error('mreža'); };
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    assert.equal(res.code, 503);
  });

  test('token se proverava kod Supabase Auth javnim ključem, ne service_role', async () => {
    await rpc({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const auth = pozivi.find(p => p.url.endsWith('/auth/v1/user'));
    assert.equal(auth.opt.headers.apikey, 'anon');
    assert.equal(auth.opt.headers.Authorization, 'Bearer ' + OAUTH);
  });

  test('GET bez upita i ostale metode: 405', async () => {
    const h = await handler();
    for (const method of ['GET', 'DELETE', 'PUT']) {
      const res = makeRes();
      await h({ method, headers: {}, query: {} }, res);
      assert.equal(res.code, 405, method);
    }
  });
});

describe('/api/mcp — protokol', () => {
  test('initialize: vraća traženu verziju ako je podržana, inače najnoviju; nudi samo alate', async () => {
    const a = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    assert.equal(a.code, 200);
    assert.equal(a.body.result.protocolVersion, '2025-06-18');
    assert.deepEqual(Object.keys(a.body.result.capabilities), ['tools']);
    const b = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2099-01-01' } });
    assert.equal(b.body.result.protocolVersion, '2025-11-25');
  });

  test('obaveštenje: 202 bez tela', async () => {
    const res = await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' });
    assert.equal(res.code, 202);
    assert.equal(res.ended, true);
  });

  test('tools/list: jedan alat, označen kao samo čitanje', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const alati = res.body.result.tools;
    assert.deepEqual(alati.map(t => t.name), ['zdravstveni_podaci']);
    assert.equal(alati[0].annotations.readOnlyHint, true);
    assert.equal(alati[0].annotations.destructiveHint, false);
  });

  test('nepoznat metod i nepoznat alat su JSON-RPC greške', async () => {
    const a = await rpc({ jsonrpc: '2.0', id: 9, method: 'resources/list' });
    assert.equal(a.body.error.code, -32601);
    const b = await rpc(poziv('obrisi_sve', {}));
    assert.equal(b.body.error.code, -32602);
    assert.ok(!pozivi.some(p => p.url.includes('/rest/v1/')), 'nepoznat alat je čitao bazu');
  });
});

describe('/api/mcp — zdravstveni_podaci', () => {
  test('iz baze se traži SAMO data->wellness, service_role ključem, za korisnika iz tokena', async () => {
    await rpc(poziv('zdravstveni_podaci', { od: '2026-09-01', do: '2026-10-31' }));
    const baza = pozivi.filter(p => p.url.includes('/rest/v1/'));
    assert.equal(baza.length, 1);
    const url = new URL(baza[0].url);
    assert.equal(url.pathname, '/rest/v1/user_state');
    assert.equal(url.searchParams.get('select'), 'wellness:data->wellness');
    assert.equal(url.searchParams.get('user_id'), 'eq.' + UID);
    assert.equal(baza[0].opt.headers.Authorization, 'Bearer srv');
    assert.equal(baza[0].opt.method ?? 'GET', 'GET');
  });

  test('vraća dane u opsegu, sortirane, sa jedinicama u nazivima polja', async () => {
    const res = await rpc(poziv('zdravstveni_podaci', { od: '2026-10-01', do: '2026-10-31' }));
    const d = podaci(res);
    assert.equal(d.broj_dana, 2);
    assert.deepEqual(d.dani.map(x => x.datum), ['2026-10-01', '2026-10-05']);
    assert.deepEqual(d.dani[0], {
      datum: '2026-10-01', hrv_ms: 61, puls_u_miru_bpm: 48, san_sati: 7.5, san_ocena: 82,
      tezina_kg: 71.2, ctl: 40, atl: 45, svezina: -5
    });
    assert.equal(d.dani[1].san_ocena, null);
  });

  test('bez argumenata: poslednjih 30 dana zaključno sa danas', async () => {
    const d = podaci(await rpc(poziv('zdravstveni_podaci', {})));
    const raspon = (Date.parse(d.do) - Date.parse(d.od)) / 86400000;
    assert.equal(raspon, 29);
  });

  test('neispravan ili preširok opseg je greška alata, bez čitanja baze', async () => {
    for (const args of [{ od: '2026-13-01' }, { do: 'juče' }, { od: '2026-10-05', do: '2026-10-01' }, { od: '2025-01-01', do: '2026-10-01' }]) {
      const res = await rpc(poziv('zdravstveni_podaci', args));
      assert.equal(res.body.result.isError, true, JSON.stringify(args));
    }
    assert.ok(!pozivi.some(p => p.url.includes('/rest/v1/')));
  });

  test('korisnik bez stanja ili bez merenja: prazan spisak, ne greška', async () => {
    globalThis.fetch = async (url) => String(url).endsWith('/auth/v1/user') ? jsonRes({ id: UID }) : jsonRes([]);
    const d = podaci(await rpc(poziv('zdravstveni_podaci', {})));
    assert.equal(d.broj_dana, 0);
    assert.deepEqual(d.dani, []);
  });

  test('baza ne odgovara: greška alata, a ne pad funkcije', async () => {
    globalThis.fetch = async (url) => String(url).endsWith('/auth/v1/user') ? jsonRes({ id: UID }) : jsonRes({}, false, 500);
    const res = await rpc(poziv('zdravstveni_podaci', {}));
    assert.equal(res.code, 200);
    assert.equal(res.body.result.isError, true);
  });
});
