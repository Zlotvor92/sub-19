/* Serverske funkcije (api/) — pozivaju se sa lažnim `fetch`, `req` i `res`.
   Ništa ne ide na mrežu. Cilj su ponašanja koja se ne vide iz koda na prvi
   pogled: da slanje mejlova stane pre vremenskog limita i nastavi bez
   duplikata, da brisanje na intervals.icu ne bude 60 poziva u nizu, i da
   izveštaj ne izgubi korisnike preko prve stranice. */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const ENV = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'srv',
  RESEND_API_KEY: 'rk',
  REPORT_FROM: 'a@b.c',
  REPORT_TO: 'vlasnik@b.c',
  ADMIN_EMAIL: 'vlasnik@b.c',
  CRON_SECRET: 'tajna',
  /* tempo i rok se u testu spustaju — inace bi 250 mejlova x 600 ms trajalo
     minutima; produkcijske vrednosti su podrazumevane u samom kodu */
  BROADCAST_PAUZA_MS: '0',
  BROADCAST_ROK_MS: '30'
};

function makeRes() {
  const r = { code: null, body: null, headers: {} };
  r.status = c => { r.code = c; return r; };
  r.json = b => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  return r;
}

const origFetch = globalThis.fetch;
const origEnv = {};
beforeEach(() => {
  for (const k of Object.keys(ENV)) { origEnv[k] = process.env[k]; process.env[k] = ENV[k]; }
});
afterEach(() => {
  globalThis.fetch = origFetch;
  for (const k of Object.keys(ENV)) {
    if (origEnv[k] === undefined) delete process.env[k]; else process.env[k] = origEnv[k];
  }
});

const jsonRes = (body, ok = true, status = 200) => ({
  ok, status,
  json: async () => body,
  text: async () => JSON.stringify(body)
});

describe('/api/broadcast — slanje u više poziva', () => {
  /* 250 korisnika; jedan poziv ne sme da pokuša sve odjednom. */
  function stubFetch(poslato) {
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/admin/users')) {
        const page = +(u.match(/[?&]page=(\d+)/) || [])[1];
        const users = page === 1
          ? Array.from({ length: 200 }, (_, i) => ({ email: `k${String(i).padStart(3, '0')}@t.rs` }))
          : Array.from({ length: 50 }, (_, i) => ({ email: `k${String(200 + i).padStart(3, '0')}@t.rs` }));
        return jsonRes(users);
      }
      if (u.includes('/auth/v1/user')) return jsonRes({ id: 'u1', email: ENV.ADMIN_EMAIL });
      if (u.includes('api.resend.com')) {
        /* 1 ms po mejlu — dovoljno da rok (BROADCAST_ROK_MS=30) stvarno
           preseče petlju, pa se testira ono što se u produkciji i dešava */
        await new Promise(r => setTimeout(r, 1));
        poslato.push(JSON.parse(opt.body).to);
        return jsonRes({ id: 'm' });
      }
      throw new Error('neočekivan poziv: ' + u);
    };
  }

  test('suvi poziv ne šalje ništa i vraća stabilno sortiranu listu', async () => {
    const { default: handler } = await import('../api/broadcast.js?t=' + Date.now());
    const poslato = [];
    stubFetch(poslato);
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer tajna' }, body: {} }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.probno, true);
    assert.equal(res.body.primalaca, 250);
    assert.equal(poslato.length, 0, 'suvi poziv je ipak poslao mejlove');
    const s = res.body.primaoci;
    assert.deepEqual(Array.from(s), Array.from(s).slice().sort(),
      'lista mora biti sortirana — inače nastavak preskoči ili ponovi nekoga');
  });

  test('stane pre vremenskog limita i vrati `sledeciOd`', async () => {
    const { default: handler } = await import('../api/broadcast.js?t=' + Date.now());
    const poslato = [];
    stubFetch(poslato);
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer tajna' }, body: { posalji: true } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.ukupno, 250);
    assert.ok(res.body.poslato > 0, 'ništa nije poslato');
    assert.ok(res.body.poslato < 250, 'poslalo je svih 250 u jednom pozivu — limit se ignoriše');
    assert.equal(res.body.sledeciOd, res.body.poslato, 'nastavak ne pokazuje na sledećeg neposlatog');
  });

  test('nastavak od `od` ne šalje duplikate i pokrije sve', async () => {
    const { default: handler } = await import('../api/broadcast.js?t=' + Date.now());
    const poslato = [];
    stubFetch(poslato);
    let od = 0, krugova = 0;
    while (od != null && krugova < 20) {
      krugova++;
      const res = makeRes();
      await handler({ method: 'POST', headers: { authorization: 'Bearer tajna' }, body: { posalji: true, od } }, res);
      od = res.body.sledeciOd;
    }
    assert.equal(od, null, 'slanje se nije završilo');
    assert.equal(poslato.length, 250, `poslato ${poslato.length} umesto 250`);
    assert.equal(new Set(poslato).size, 250, 'neko je dobio mejl dva puta');
  });

  test('bez CRON_SECRET-a i bez vlasnika vraća 401', async () => {
    const { default: handler } = await import('../api/broadcast.js?t=' + Date.now());
    globalThis.fetch = async () => jsonRes({ id: 'u1', email: 'neko.drugi@t.rs' });
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer pogresno' }, body: {} }, res);
    assert.equal(res.code, 401);
  });

  test('`samoNa` ne može da pošalje na adresu koja nije korisnik', async () => {
    const { default: handler } = await import('../api/broadcast.js?t=' + Date.now());
    const poslato = [];
    stubFetch(poslato);
    const res = makeRes();
    await handler({
      method: 'POST', headers: { authorization: 'Bearer tajna' },
      body: { posalji: true, samoNa: ['napadac@zlo.rs'] }
    }, res);
    assert.equal(poslato.length, 0, 'poslato na adresu van baze korisnika');
  });
});

describe('/api/workouts — brisanje pre ponovnog slanja', () => {
  test('režim "zameni" briše paralelno, ne 60 poziva u nizu', async () => {
    const { default: handler } = await import('../api/workouts.js?t=' + Date.now());
    let uToku = 0, maxIstovremeno = 0;
    const obrisani = [];
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return jsonRes({ id: 'u1' });
      if (u.includes('/events?')) {
        return jsonRes(Array.from({ length: 40 }, (_, i) => ({ id: i + 1, external_id: 'sub19-g1d' + i })));
      }
      if (opt && opt.method === 'DELETE') {
        uToku++; maxIstovremeno = Math.max(maxIstovremeno, uToku);
        await new Promise(r => setTimeout(r, 5));
        uToku--;
        obrisani.push(u);
        return jsonRes({});
      }
      if (u.includes('/events/bulk')) return jsonRes([{ id: 1 }]);
      throw new Error('neočekivan poziv: ' + u);
    };
    const res = makeRes();
    await handler({
      method: 'POST', headers: { authorization: 'Bearer jwt' },
      body: {
        athleteId: 'i123', token: 'tttttttttttt', rezim: 'zameni',
        events: [{ date: '2026-07-01', externalId: 'sub19-g1d1', name: 'Lako', description: '- 5km' }]
      }
    }, res);
    assert.equal(res.code, 200, JSON.stringify(res.body));
    assert.equal(obrisani.length, 40, 'nisu obrisani svi naši događaji');
    assert.ok(maxIstovremeno > 1, 'brisanje je i dalje strogo sekvencijalno');
    assert.ok(maxIstovremeno <= 5, `previše istovremenih zahteva (${maxIstovremeno})`);
  });

  test('briše ISKLJUČIVO događaje sa našim prefiksom', async () => {
    const { default: handler } = await import('../api/workouts.js?t=' + Date.now());
    const obrisani = [];
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return jsonRes({ id: 'u1' });
      if (u.includes('/events?')) return jsonRes([
        { id: 1, external_id: 'sub19-g1d1' },
        { id: 2, external_id: 'tudje-nesto' },
        { id: 3, external_id: null },
        { id: 4 }
      ]);
      if (opt && opt.method === 'DELETE') { obrisani.push(u); return jsonRes({}); }
      if (u.includes('/events/bulk')) return jsonRes([{ id: 1 }]);
      throw new Error('neočekivan poziv: ' + u);
    };
    const res = makeRes();
    await handler({
      method: 'POST', headers: { authorization: 'Bearer jwt' },
      body: {
        athleteId: 'i123', token: 'tttttttttttt', rezim: 'zameni',
        events: [{ date: '2026-07-01', externalId: 'sub19-g1d1', name: 'Lako', description: '- 5km' }]
      }
    }, res);
    assert.equal(obrisani.length, 1, 'obrisano je nešto što nije naše');
    assert.ok(obrisani[0].endsWith('/events/1'));
  });

  test('odbija neispravan externalId (ne sme da piše van svog prostora)', async () => {
    const { default: handler } = await import('../api/workouts.js?t=' + Date.now());
    globalThis.fetch = async () => jsonRes({ id: 'u1' });
    const res = makeRes();
    await handler({
      method: 'POST', headers: { authorization: 'Bearer jwt' },
      body: {
        athleteId: 'i123', token: 'tttttttttttt',
        events: [{ date: '2026-07-01', externalId: 'tudje-x', name: 'x', description: 'y' }]
      }
    }, res);
    assert.equal(res.code, 400);
  });
});

describe('/api/daily-report — paginacija', () => {
  test('čita sve stranice user_state, ne samo prvu', async () => {
    const { default: handler } = await import('../api/daily-report.js?t=' + Date.now());
    let poslatMejl = null;
    const trazeniOpsezi = [];
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('app_stats')) return jsonRes([{ korisnika: 250 }]);
      if (u.includes('user_state')) {
        const range = opt.headers.Range;
        trazeniOpsezi.push(range);
        const od = +range.split('-')[0];
        const n = od < 200 ? 200 : (od < 400 ? 200 : 50);
        return { ok: true, status: 206, json: async () => Array.from({ length: n }, (_, i) => ({ user_id: 'u' + (od + i), data: { log: {} } })) };
      }
      if (u.includes('api_usage')) return jsonRes([]);
      if (u.includes('/auth/v1/admin/users')) {
        const page = +(u.match(/[?&]page=(\d+)/) || [])[1];
        return jsonRes(page === 1
          ? Array.from({ length: 200 }, (_, i) => ({ id: 'u' + i, email: 'k' + i + '@t.rs' }))
          : Array.from({ length: 50 }, (_, i) => ({ id: 'u' + (200 + i), email: 'k' + (200 + i) + '@t.rs' })));
      }
      if (u.includes('api.resend.com')) { poslatMejl = JSON.parse(opt.body); return jsonRes({ id: 'm' }); }
      throw new Error('neočekivan poziv: ' + u);
    };
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer tajna' } }, res);
    assert.equal(res.code, 200, JSON.stringify(res.body));
    assert.ok(trazeniOpsezi.length >= 3, `tražene stranice: ${trazeniOpsezi}`);
    assert.equal(trazeniOpsezi[0], '0-199');
    assert.equal(trazeniOpsezi[1], '200-399');
    assert.ok(poslatMejl, 'mejl nije poslat');
    /* svih 250 korisnika mora biti u tabeli izveštaja */
    assert.ok(poslatMejl.html.includes('k249@t.rs'), 'poslednji korisnik nije u izveštaju');
  });

  test('bez ispravnog CRON_SECRET-a vraća 401', async () => {
    const { default: handler } = await import('../api/daily-report.js?t=' + Date.now());
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer pogresno' } }, res);
    assert.equal(res.code, 401);
  });
});

describe('Sve api/ putanje traže prijavu ili tajnu', () => {
  const putanje = ['analyze', 'auth', 'icu-oauth', 'refresh', 'report-bug', 'wellness', 'workouts'];
  for (const p of putanje) {
    test(`/api/${p} odbija zahtev bez Authorization zaglavlja`, async () => {
      const { default: handler } = await import(`../api/${p}.js?t=` + Date.now());
      globalThis.fetch = async () => jsonRes({}, false, 401);
      const res = makeRes();
      await handler({ method: p === 'auth' ? 'GET' : 'POST', headers: {}, query: {}, body: {} }, res);
      assert.ok([401, 415].includes(res.code),
        `/api/${p} je vratio ${res.code} umesto 401 (dobijeno: ${JSON.stringify(res.body)})`);
    });
  }
});
