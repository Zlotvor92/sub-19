/* Serverske funkcije (api/) — pozivaju se sa lažnim `fetch`, `req` i `res`.
   Ništa ne ide na mrežu. Cilj su ponašanja koja se ne vide iz koda na prvi
   pogled: da slanje mejlova stane pre vremenskog limita i nastavi bez
   duplikata, da brisanje na intervals.icu ne bude 60 poziva u nizu, i da
   izveštaj ne izgubi korisnike preko prve stranice. */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readRepoFile } from './harness.mjs';

const ENV = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'srv',
  RESEND_API_KEY: 'rk',
  REPORT_FROM: 'a@b.c',
  REPORT_TO: 'vlasnik@b.c',
  ADMIN_EMAIL: 'vlasnik@b.c',
  CRON_SECRET: 'tajna',
  GEMINI_API_KEY: 'gk',
  /* Bez ovoga bi /api/analyze javljao „nepoznato poreklo" i ćutke preskakao
     obaveštenje „analiza je gotova" — v. sopstvenoPoreklo(). */
  VERCEL_URL: 'sub-19.vercel.app',
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

  test('nastavak od `posle` ne šalje duplikate i pokrije sve', async () => {
    const { default: handler } = await import('../api/broadcast.js?t=' + Date.now());
    const poslato = [];
    stubFetch(poslato);
    let posle = '', krugova = 0, kraj = false;
    while (!kraj && krugova < 20) {
      krugova++;
      const res = makeRes();
      await handler({ method: 'POST', headers: { authorization: 'Bearer tajna' }, body: { posalji: true, posle } }, res);
      if (res.body.sledeciPosle == null) kraj = true; else posle = res.body.sledeciPosle;
    }
    assert.ok(kraj, 'slanje se nije završilo');
    assert.equal(poslato.length, 250, `poslato ${poslato.length} umesto 250`);
    assert.equal(new Set(poslato).size, 250, 'neko je dobio mejl dva puta');
  });

  test('nov korisnik usred slanja ne pomera kursor — niko se ne preskoči', async () => {
    /* ZAŠTO OVO POSTOJI: kursor je ranije bio POZICIJA u sortiranoj listi
       („nastavi od 90."). Ali lista se između dva poziva čita iznova, a slanje
       na hiljade adresa traje desetinama minuta. Registruje se jedan korisnik
       čija adresa pada PRE tekućeg mesta — svi indeksi se pomere za jedan i
       tačno jedna osoba bude tiho preskočena. Brojevi na kraju izgledaju
       uredno; samo jedan čovek ne dobije mejl.
       Kursor po ADRESI to nema. */
    const { default: handler } = await import('../api/broadcast.js?t=' + Date.now());
    const poslato = [];
    let dodat = false;
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/admin/users')) {
        const page = +(u.match(/[?&]page=(\d+)/) || [])[1];
        let users = page === 1
          ? Array.from({ length: 200 }, (_, i) => ({ email: `k${String(i).padStart(3, '0')}@t.rs` }))
          : Array.from({ length: 50 }, (_, i) => ({ email: `k${String(200 + i).padStart(3, '0')}@t.rs` }));
        /* posle prvog kruga upada nova adresa koja se sortira PRE svih */
        if (dodat && page === 1) users = [{ email: 'aaa-novi@t.rs' }, ...users];
        return jsonRes(users);
      }
      if (u.includes('/auth/v1/user')) return jsonRes({ id: 'u1', email: ENV.ADMIN_EMAIL });
      if (u.includes('api.resend.com')) {
        await new Promise(r => setTimeout(r, 1));
        poslato.push(JSON.parse(opt.body).to);
        return jsonRes({ id: 'm' });
      }
      throw new Error('neočekivan poziv: ' + u);
    };
    let posle = '', krugova = 0, kraj = false;
    while (!kraj && krugova < 25) {
      krugova++;
      const res = makeRes();
      await handler({ method: 'POST', headers: { authorization: 'Bearer tajna' }, body: { posalji: true, posle } }, res);
      dodat = true;
      if (res.body.sledeciPosle == null) kraj = true; else posle = res.body.sledeciPosle;
    }
    assert.ok(kraj, 'slanje se nije završilo');
    assert.equal(new Set(poslato).size, poslato.length, 'neko je dobio mejl dva puta');
    /* Svih 250 prvobitnih mora da dobije mejl uprkos upadu nove adrese. */
    for (let i = 0; i < 250; i++) {
      const a = `k${String(i).padStart(3, '0')}@t.rs`;
      assert.ok(poslato.includes(a), `preskočen je ${a} — kursor se pomerio sa listom`);
    }
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
      if (u.includes('/rpc/check_and_bump_endpoint')) return jsonRes(1);
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
      if (u.includes('/rpc/check_and_bump_endpoint')) return jsonRes(1);
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

  test('api_usage se čita paginirano — inače korisnici tiho gube kolonu', async () => {
    /* Ista klasa greške koja je već ispravljena za `fetchUserList` i
       `fetchRawUserState`, a ovaj upit je tada promašen — i raste BRŽE od oba
       (jedan red po korisniku PO DANU). Bez `Range` zaglavlja PostgREST vrati
       do `max-rows` i tu stane, bez greške. */
    const { default: handler } = await import('../api/daily-report.js?t=' + Date.now());
    const opsezi = [];
    let poslatHtml = '';
    globalThis.fetch = async (url, opt) => {
      const u = String(url), h = (opt && opt.headers) || {};
      if (u.includes('app_stats')) return jsonRes([{ korisnika: 2 }]);
      if (u.includes('/auth/v1/admin/users')) {
        const page = +(u.match(/[?&]page=(\d+)/) || [])[1];
        return jsonRes(page === 1 ? [{ id: 'stari', email: 'stari@t.rs' }] : []);
      }
      if (u.includes('user_state')) return jsonRes([]);
      if (u.includes('api_usage')) {
        opsezi.push(h.Range);
        const od = +String(h.Range || '0-').split('-')[0];
        /* prva strana je PUNA (1000) → mora se tražiti i druga */
        if (od === 0) return jsonRes(Array.from({ length: 1000 }, (_, i) => ({ user_id: 'x' + i, day: '2026-08-01', calls: 1 })));
        if (od === 1000) return jsonRes([{ user_id: 'stari', day: '2026-07-30', calls: 3 }]);
        return jsonRes([]);
      }
      if (u.includes('api.resend.com')) { poslatHtml = JSON.parse(opt.body).html; return jsonRes({ id: 'm' }); }
      throw new Error('neočekivan poziv: ' + u);
    };
    const res = makeRes();
    await handler({ method: 'GET', headers: { authorization: 'Bearer tajna' } }, res);
    assert.equal(res.code, 200, JSON.stringify(res.body));
    assert.ok(opsezi.length >= 2, 'api_usage je čitan bez paginacije: ' + JSON.stringify(opsezi));
    assert.match(poslatHtml, /30\.07\.2026/, 'korisnik sa druge strane je ispao iz izveštaja');
  });

  test('user_state se sažima po strani, sirov blob se ne gomila', async () => {
    /* Paginacija je rešila `max-rows`, ali su svi redovi i dalje završavali u
       jednom nizu: 50 strana × 200 redova × do pola megabajta je red veličine
       sto megabajta u funkciji koja ima 60 s. Prvi korisnik preko te granice
       obara CEO izveštaj, i to greškom koja ne kaže zašto (OOM, ne HTTP).
       Ovde se meri posledica koja se može proveriti: ono što funkcija zadrži
       posle čitanja je IZVEDENA vrednost, ne `data` blob. */
    const { default: handler } = await import('../api/daily-report.js?t=' + Date.now());
    const ogroman = 'x'.repeat(200000);
    let poslatHtml = '';
    globalThis.fetch = async (url, opt) => {
      const u = String(url), h = (opt && opt.headers) || {};
      if (u.includes('app_stats')) return jsonRes([{ korisnika: 1 }]);
      if (u.includes('/auth/v1/admin/users')) {
        const page = +(u.match(/[?&]page=(\d+)/) || [])[1];
        return jsonRes(page === 1 ? [{ id: 'u1', email: 'a@t.rs' }] : []);
      }
      if (u.includes('user_state')) {
        const od = +String(h.Range || '0-').split('-')[0];
        if (od > 0) return jsonRes([]);
        return jsonRes([{
          user_id: 'u1', updated_at: '2026-08-01T00:00:00Z',
          data: { log: { a: { status: 'done', ts: '2026-08-01', km: 12 } }, smece: ogroman }
        }]);
      }
      if (u.includes('api_usage')) return jsonRes([]);
      if (u.includes('api.resend.com')) { poslatHtml = JSON.parse(opt.body).html; return jsonRes({ id: 'm' }); }
      throw new Error('neočekivan poziv: ' + u);
    };
    const res = makeRes();
    await handler({ method: 'GET', headers: { authorization: 'Bearer tajna' } }, res);
    assert.equal(res.code, 200, JSON.stringify(res.body));
    assert.match(poslatHtml, /01\.08\.2026/, 'izvedena aktivnost nije stigla do izveštaja');
    assert.ok(!poslatHtml.includes(ogroman), 'sirov blob je procurio u izveštaj');
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

/* ==================================================================
   Dnevni limit na intervals.icu endpointima

   Oba idu kroz naš server ka trećoj strani, a prijava je otvorena svakome
   sa Google nalogom — bez limita jedan korisnik može u petlji da gađa
   intervals.icu sa NAŠE IP adrese. Sama logika brojanja je u Postgresu
   (supabase/rate-limit.sql); ovde se proverava ono što je na serveru:
   da se limit uopšte pita, da se pita PRE poziva ka intervals.icu, i da
   otkaz brojača ne obori funkciju.
   ================================================================== */
describe('Dnevni limit — /api/wellness i /api/workouts', () => {
  const zahtev = {
    wellness: { athleteId: 'i123', token: 'tttttttttttt', oldest: '2026-07-01', newest: '2026-07-10' },
    workouts: { athleteId: 'i123', token: 'tttttttttttt', rezim: 'azuriraj',
                events: [{ date: '2026-07-01', externalId: 'sub19-g1d1', name: 'Lako', description: '- 5km' }] }
  };

  /* Lažni server: beleži redosled poziva i pušta RPC da odgovori kako test traži. */
  function stub(rpcOdgovor) {
    const redosled = [];
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) { redosled.push('auth'); return jsonRes({ id: 'u1' }); }
      if (u.includes('/rpc/check_and_bump_endpoint')) {
        redosled.push('limit');
        return rpcOdgovor(opt ? JSON.parse(opt.body) : {});
      }
      if (u.includes('intervals.icu')) {
        redosled.push('icu');
        return u.includes('/events') && opt && opt.method !== 'GET' ? jsonRes([{ id: 1 }]) : jsonRes([]);
      }
      throw new Error('neočekivan poziv: ' + u);
    };
    return redosled;
  }

  for (const put of ['wellness', 'workouts']) {
    test(`/api/${put} vraća 429 kad je limit potrošen`, async () => {
      const { default: handler } = await import(`../api/${put}.js?t=` + Date.now());
      const redosled = stub(() => jsonRes({ message: 'DAILY_LIMIT_EXCEEDED' }, false, 400));
      const res = makeRes();
      await handler({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: zahtev[put] }, res);
      assert.equal(res.code, 429, JSON.stringify(res.body));
      assert.match(String(res.body.error), /limit/i);
      assert.ok(!redosled.includes('icu'),
        'poziv ka intervals.icu je otišao IPAK — limit tada ne štiti ništa');
    });

    test(`/api/${put} pita limit PRE nego što pozove intervals.icu`, async () => {
      const { default: handler } = await import(`../api/${put}.js?t=` + Date.now());
      const redosled = stub(() => jsonRes(1));
      const res = makeRes();
      await handler({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: zahtev[put] }, res);
      assert.equal(res.code, 200, JSON.stringify(res.body));
      assert.ok(redosled.indexOf('limit') > -1, 'limit se uopšte ne pita');
      assert.ok(redosled.indexOf('limit') < redosled.indexOf('icu'),
        `redosled je ${redosled.join(' -> ')} — brojanje posle poziva ne sprečava ništa`);
    });

    test(`/api/${put} šalje svoje ime i svoj limit`, async () => {
      const { default: handler } = await import(`../api/${put}.js?t=` + Date.now());
      let telo = null;
      stub(b => { telo = b; return jsonRes(1); });
      await handler({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: zahtev[put] }, makeRes());
      assert.equal(telo.p_endpoint, put, 'endpoint se ne razlikuje — brojači bi se mešali');
      assert.ok(Number.isInteger(telo.p_limit) && telo.p_limit > 0, `p_limit = ${telo.p_limit}`);
    });

    test(`/api/${put} radi i kad brojač otkaže (SQL možda još nije pušten)`, async () => {
      const { default: handler } = await import(`../api/${put}.js?t=` + Date.now());
      const redosled = stub(() => jsonRes({ message: 'relation does not exist' }, false, 404));
      const res = makeRes();
      await handler({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: zahtev[put] }, res);
      assert.equal(res.code, 200, `otkaz brojača je oborio /api/${put}: ${JSON.stringify(res.body)}`);
      assert.ok(redosled.includes('icu'), 'zahtev nije prošao dalje');
    });
  }
});

describe('supabase/rate-limit.sql — ono što se ne sme izgubiti pri izmeni', () => {
  const sql = readFileSync(join(ROOT, 'supabase', 'rate-limit.sql'), 'utf8');
  const bezKomentara = sql.replace(/^\s*--.*$/gm, '');

  test('tabela ima RLS i NIJEDNU politiku', () => {
    /* Politika bi značila da korisnik sme sam do svog brojača — a ko sme da
       ga menja, sme i da ga vrati na nulu. */
    assert.match(bezKomentara, /enable row level security/i, 'RLS nije uključen');
    assert.ok(!/create\s+policy/i.test(bezKomentara), 'dodata je politika — brojač postaje dostupan korisniku');
  });

  test('funkcija je SECURITY DEFINER sa zaključanim search_path', () => {
    assert.match(bezKomentara, /security\s+definer/i);
    assert.match(bezKomentara, /set\s+search_path\s*=/i,
      'bez fiksnog search_path SECURITY DEFINER funkcija je vektor za podmetanje tabele');
  });

  test('uvećanje i provera su JEDNA naredba (inače se limit zaobilazi paralelnim pozivima)', () => {
    assert.match(bezKomentara, /on conflict[\s\S]{0,200}do update[\s\S]{0,200}returning/i);
  });

  test('EXECUTE se prvo skida svima, pa daje samo prijavljenima', () => {
    const revoke = bezKomentara.search(/revoke all on function/i);
    const grant = bezKomentara.search(/grant execute on function[\s\S]*?to authenticated/i);
    assert.ok(revoke > -1, 'nema revoke — Postgres podrazumevano daje EXECUTE svima');
    assert.ok(grant > -1, 'nema grant za authenticated');
    assert.ok(revoke < grant, 'revoke ide PRE grant-a, inače skida i ono što je upravo dato');
    assert.ok(!/to\s+anon/i.test(bezKomentara.slice(grant, grant + 120)), 'anon sme da zove funkciju');
  });

  test('prazna prijava se ne broji kao nula poziva', () => {
    assert.match(bezKomentara, /v_user is null[\s\S]{0,120}raise exception/i);
  });

  test('naziv endpointa je ograničen (inače nasumičan naziv = uvek nov brojač)', () => {
    assert.match(bezKomentara, /p_endpoint[\s\S]{0,80}~[\s\S]{0,40}\^\[a-z0-9_-\]/);
  });

  test('imena endpointa iz koda odgovaraju dozvoljenom obliku', () => {
    const oblik = /^[a-z0-9_-]{1,40}$/;
    for (const p of ['wellness', 'workouts']) {
      const izvor = readFileSync(join(ROOT, 'api', p + '.js'), 'utf8');
      const m = /limitPrekoracen\(auth\.token,\s*'([^']+)'/.exec(izvor);
      assert.ok(m, `api/${p}.js ne poziva limitPrekoracen`);
      assert.match(m[1], oblik, `naziv "${m[1]}" bi funkcija odbila`);
    }
  });

  test('postojeći brojači se ne diraju', () => {
    /* api_usage i bug_report_usage su odvojeni namerno: trošenje AI analiza
       ne sme da blokira povlačenje podataka sa sata. */
    assert.ok(!/\bapi_usage\b/.test(bezKomentara), 'skripta dira api_usage');
    assert.ok(!/\bbug_report_usage\b/.test(bezKomentara), 'skripta dira bug_report_usage');
    assert.ok(!/drop\s+(table|function)/i.test(bezKomentara), 'skripta nešto briše');
  });

  test('ponovno puštanje ne puca', () => {
    assert.match(bezKomentara, /create table if not exists/i);
    assert.match(bezKomentara, /create or replace function/i);
  });

  test('skripta NE sadrži poziv funkcije — poništio bi ceo batch', () => {
    /* SQL Editor pušta sve nalepljeno kao JEDNU transakciju. Funkcija baca
       NOT_AUTHENTICATED kad nema prijavljenog korisnika, a u SQL Editoru je
       auth.uid() uvek null — greška bi poništila i `create table` i
       `create function` iznad. Poruka pritom izgleda kao uspešna provera, pa
       se ne primeti da u bazi nema ničega. Ovo se već desilo jednom. */
    const izvrsni = bezKomentara
      .split(/\n/)
      .filter(r => /select\s+public\.check_and_bump_endpoint/i.test(r));
    assert.deepEqual(izvrsni, [],
      'skripta poziva check_and_bump_endpoint van komentara: ' + izvrsni.join(' | '));
  });
});

describe('OAuth povratna adresa se ne čita iz zaglavlja zahteva', () => {
  /* NAPAD: `redirect_uri` je išao u adresu za autorizaciju, a gradio se iz
     `x-forwarded-host` — dakle iz vrednosti koju šalje pozivalac. Podmetnuto
     zaglavlje bi vratilo korisnika (sa `code`-om u upitu) na tuđi server.
     intervals.icu to najverovatnije odbija jer proverava registrovanu adresu —
     ali odbrana ne sme da zavisi od tuđe validacije koju ne vidimo. */
  const POREKLA = ['ICU_REDIRECT_URI', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'];
  const pozovi = async (env, headers) => {
    const staro = {};
    for (const k of POREKLA) { staro[k] = process.env[k]; delete process.env[k]; }
    Object.assign(process.env, env);
    process.env.ICU_CLIENT_ID = 'cid';
    process.env.ICU_CLIENT_SECRET = 'cs';
    globalThis.fetch = async u => String(u).includes('/auth/v1/user')
      ? jsonRes({ id: 'u1', email: 'k@t.rs' }) : jsonRes({});
    const { default: h } = await import('../api/icu-oauth.js?t=' + Date.now());
    const res = makeRes();
    await h({
      method: 'GET',
      query: { akcija: 'url', state: 'abcdefgh12345678' },
      headers: Object.assign({ authorization: 'Bearer jwt' }, headers || {})
    }, res);
    for (const k of Object.keys(staro)) { if (staro[k] === undefined) delete process.env[k]; else process.env[k] = staro[k]; }
    return res;
  };

  test('podmetnut X-Forwarded-Host ne dolazi do redirect_uri-ja', async () => {
    const res = await pozovi({ VERCEL_URL: 'sub-19.vercel.app' }, {
      host: 'napadac.example', 'x-forwarded-host': 'napadac.example', 'x-forwarded-proto': 'http'
    });
    assert.equal(res.code, 200);
    assert.ok(!/napadac/.test(res.body.url), 'redirect_uri dolazi iz zaglavlja: ' + res.body.url);
    assert.match(res.body.url, /redirect_uri=https%3A%2F%2Fsub-19\.vercel\.app%2F/);
  });

  test('podešena vrednost ima prednost nad svim ostalim', async () => {
    const res = await pozovi({ ICU_REDIRECT_URI: 'https://moj.domen/', VERCEL_URL: 'x.vercel.app' },
      { 'x-forwarded-host': 'napadac.example' });
    assert.match(res.body.url, /redirect_uri=https%3A%2F%2Fmoj\.domen%2F/);
  });

  test('stabilan produkcijski domen ima prednost nad adresom deploya', async () => {
    /* OAuth traži DOSLOVNO poklapanje sa registrovanom adresom. `VERCEL_URL` je
       adresa pojedinačnog deploya i menja se pri svakom — da ide prva,
       povezivanje bi na produkciji pucalo posle svakog objavljivanja. */
    const res = await pozovi({
      VERCEL_PROJECT_PRODUCTION_URL: 'sub-19.vercel.app',
      VERCEL_URL: 'sub-19-git-nesto-xyz.vercel.app'
    });
    assert.match(res.body.url, /redirect_uri=https%3A%2F%2Fsub-19\.vercel\.app%2F/,
      'uzeta je adresa deploya umesto produkcijskog domena: ' + res.body.url);
  });

  test('bez poznate adrese vraća jasnu grešku, ne pogađa', async () => {
    const res = await pozovi({}, { host: 'napadac.example' });
    assert.equal(res.code, 501, 'izdata je adresa za autorizaciju bez poznatog porekla');
  });
});

describe('supabase/ai-posao.sql — stanje posla je serverov automat', () => {
  /* SQL se ovde ne izvršava (nema baze u testu) — proverava se da PRAVILA nisu
     nestala pri izmeni, isto kao za rate-limit.sql. Ono što ova pravila
     zatvaraju: korisnik ima anon ključ (javan po dizajnu) i svoj JWT, pa je
     `PATCH /rest/v1/ai_posao {"stanje":"radi"}` bio dovoljan da već završen
     posao vrati u red za obradu — a faza 'radi' ne troši dnevni limit. Petlja.
     Druga polovina: red se mogao napraviti direktno, mimo /api/analyze i
     njegovog brojača. */
  const sql = readRepoFile('supabase/ai-posao.sql');

  test('nazad na „radi" ne vodi nijedan prelaz', () => {
    assert.match(sql, /before update on public\.ai_posao/, 'nema okidača na izmenu');
    assert.match(sql, /new\.stanje = 'radi'[\s\S]{0,200}raise exception 'AI_POSAO_PONOVO'/,
      'povratak u stanje „radi" nije odbijen — dnevni limit se time zaobilazi');
  });

  test('dozvoljena su tačno dva prelaza koja server stvarno radi', () => {
    assert.match(sql, /old\.stanje = 'radi'\s+and new\.stanje = 'u_toku'/);
    assert.match(sql, /old\.stanje = 'u_toku' and new\.stanje in \('gotovo', 'greska'\)/);
    assert.match(sql, /raise exception 'AI_POSAO_PRELAZ'/, 'ostali prelazi nisu odbijeni');
  });

  test('vlasnik reda se ne može promeniti', () => {
    assert.match(sql, /new\.user_id <> old\.user_id[\s\S]{0,120}raise exception 'AI_POSAO_TUDJI'/);
  });

  test('nov red se rađa u stanju „radi" i nosi gornju granicu po danu', () => {
    assert.match(sql, /before insert on public\.ai_posao/, 'nema okidača na upis');
    assert.match(sql, /new\.stanje := 'radi'/, 'klijent sme da diktira početno stanje');
    assert.match(sql, /new\.user_id := auth\.uid\(\)/, 'red se može upisati u tuđe ime');
    assert.match(sql, /check_and_bump_endpoint\('ai_posao'/,
      'red se može napraviti mimo ijednog brojača');
    /* Mreža ispod limita iz koda ne sme da obori analizu ako rate-limit.sql
       još nije pušten — limit u kodu je i dalje na mestu. Handler mora da
       pokrije SVE načine na koje brojač može da nedostaje, ne samo jedan:
       funkcija, tabela, dozvola. */
    for (const kod of ['undefined_function', 'undefined_table', 'insufficient_privilege']) {
      assert.match(sql, new RegExp(`when [^\\n]*${kod}`),
        `nedostupan brojač (${kod}) obara pravljenje posla — dakle celu AI analizu`);
    }
    /* Ali DAILY_LIMIT_EXCEEDED mora da PROĐE — inače backstop ne postoji. */
    assert.doesNotMatch(sql, /when others then null/,
      '`when others` guta i prekoračenje limita, pa mreža ispod koda ne radi');
  });
});

describe('supabase/provera.sql — alat koji hvata razilaženje baze i repozitorijuma', () => {
  /* Šema živi na dva mesta koja se puštaju odvojeno: SQL rukom kroz Supabase
     editor, kod deployem. `provera.sql` je jedini način da se vidi da li su se
     razišli — ali on i sam može da ostane star, i to je gore od nemanja alata:
     daje lažnu potvrdu.

     Konkretno se već desilo: prva verzija tog upita očekivala je da SVIH šest
     funkcija bude `security definer`, pa je za `ai_posao_dodirni` i
     `ai_posao_prelaz` prijavila „PROVERI" — a one namerno nisu i ne treba da
     budu. Alarm je bio u alatu, ne u bazi.

     Zato se ovde očekivanja iz `provera.sql` porede sa onim što SQL fajlovi
     STVARNO deklarišu. */
  const izvuciFunkcije = (fajl) => {
    const s = readRepoFile('supabase/' + fajl);
    const out = {};
    for (const m of s.matchAll(/create or replace function public\.(\w+)\(([\s\S]*?)\bas \$\$/g)) {
      out[m[1]] = /security definer/.test(m[2]);
    }
    return out;
  };
  const stvarno = Object.assign({},
    izvuciFunkcije('ai-posao.sql'),
    izvuciFunkcije('api-usage.sql'),
    izvuciFunkcije('rate-limit.sql'));

  const provera = readRepoFile('supabase/provera.sql');
  const spisak = (naziv) => {
    const m = new RegExp(`${naziv} as \\(([\\s\\S]*?)\\)\\s*,?\\s*\\n`, 'm').exec(provera);
    assert.ok(m, `provera.sql nema spisak ${naziv}`);
    return (m[1].match(/'([a-z_]+)'/g) || []).map(x => x.replace(/'/g, ''));
  };

  test('spisak „mora biti security definer" odgovara SQL fajlovima', () => {
    for (const ime of spisak('ocekivano_def')) {
      assert.equal(stvarno[ime], true,
        `provera.sql traži security definer za ${ime}, a SQL ga tako ne definiše`);
    }
  });

  test('spisak „ne treba da bude security definer" odgovara SQL fajlovima', () => {
    for (const ime of spisak('ocekivano_obicno')) {
      assert.equal(stvarno[ime], false,
        `provera.sql očekuje običnu funkciju ${ime}, a SQL je definiše kao security definer`);
    }
  });

  test('nijedna funkcija iz SQL fajlova ne izostaje iz provere', () => {
    const pokriveno = new Set([...spisak('ocekivano_def'), ...spisak('ocekivano_obicno')]);
    const izostale = Object.keys(stvarno).filter(k => !pokriveno.has(k));
    assert.deepEqual(izostale, [],
      `provera.sql ne gleda: ${izostale.join(', ')} — te funkcije mogu tiho nestati iz baze`);
  });

  test('provera čita samo katalog, nijedan korisnički podatak', () => {
    /* Ispis se deli sa strancem (mnom) kad nešto ne radi. Ako bi upit ikad
       dodirnuo `user_state` ili `push_pretplata` kao IZVOR REDOVA, iz baze bi
       izašli tuđi zdravstveni podaci. Imena tabela smeju da se pominju kao
       tekst koji se proverava — `from`/`join` nad njima ne sme. */
    for (const t of ['user_state', 'push_pretplata', 'ai_posao', 'api_usage']) {
      assert.doesNotMatch(provera, new RegExp(`(from|join)\\s+(public\\.)?${t}\\b`, 'i'),
        `provera.sql čita redove iz ${t} — ispis bi nosio korisničke podatke`);
    }
  });
});

describe('requireUser je prepisan u 9 fajlova — provera ne sme da se razidje', () => {
  /* Zašto duplikat uopšte postoji: Vercel funkcije bez build koraka ne
     razrešavaju lokalne import-e (v. komentar u api/analyze.js), a deploy ide
     preko GitHub web editora. Zajednički modul bi to pokvario.

     Cena duplikata je tiho razilaženje: bezbednosna ispravka na jednom mestu
     ostavlja šest rupa, i to bez ijedne greške koja bi to prijavila. Zato se
     ovde poredi ono što je bezbednosno nosivo — SAMA PROVERA — dok se
     povratna vrednost sme razlikovati (svaki endpoint uzima što mu treba:
     userId / +email / +token). */
  /* Spisak je bio sedam, a fajlova sa `requireUser` je devet — `activities` i
     `push` su ispadali iz poređenja, dakle iz jedine stvari koja duplikat drži
     na okupu. Sada su svi. */
  const PUTANJE = ['analyze', 'wellness', 'workouts', 'auth', 'refresh', 'icu-oauth',
                   'report-bug', 'activities', 'push'];

  const telo = p => {
    const s = readFileSync(join(ROOT, 'api', p + '.js'), 'utf8');
    const m = /async function requireUser\(req\) \{[\s\S]*?\n\}/.exec(s);
    assert.ok(m, `api/${p}.js nema requireUser`);
    return m[0]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/return \{ ok: true[^}]*\};/, 'return { ok: true, … };')  /* povratna vrednost sme */
      .replace(/\s+/g, ' ').trim();
  };

  test('kratkotrajan keš postoji u svakoj kopiji i ne traje duže od 30 s', () => {
    /* Keš uklanja dodatan krug ka Supabase-u po svakom pozivu (sinhronizacija
       sa intervals.icu ih je plaćala četiri, anketa o analizi po jedan na tri
       sekunde). Prozor mora ostati kratak: token opozvan odjavom sme da važi
       najviše toliko. Za poređenje, preporučena lokalna provera potpisa JWT-a
       veruje tokenu ceo sat — ovo je strože. */
    for (const p of PUTANJE) {
      const s = readFileSync(join(ROOT, 'api', p + '.js'), 'utf8');
      const m = /const AUTH_KES_MS = (\d+);/.exec(s);
      assert.ok(m, `api/${p}.js nema keš potvrđenih tokena`);
      assert.ok(+m[1] <= 30000, `api/${p}.js drži token u kešu ${+m[1]} ms — predugo`);
      assert.match(s, /AUTH_KES\.get\(m\[1\]\)/, `api/${p}.js keš ne gleda SAM token kao ključ`);
    }
  });

  test('keš štedi mrežni krug, a ne menja odgovor', async () => {
    let poziva = 0;
    globalThis.fetch = async (u) => {
      if (String(u).includes('/auth/v1/user')) { poziva++; return jsonRes({ id: 'u9', email: 'k@t.rs' }); }
      return jsonRes({});
    };
    const { default: h } = await import('../api/wellness.js?t=' + Date.now());
    const zovi = async (token) => {
      const res = makeRes();
      await h({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body: {} }, res);
      return res;
    };
    /* Oba puta se stiže do iste greške (telo je prazno) — dakle prijava je
       prošla isto, samo je drugi put bez mrežnog kruga. */
    const a = await zovi('t1');
    const b = await zovi('t1');
    assert.equal(poziva, 1, 'drugi poziv sa istim tokenom je opet išao na mrežu');
    assert.deepEqual(b.body, a.body, 'keširana prijava daje drugačiji odgovor');
    /* Drugi token NE sme da pokupi tuđ keširan odgovor. */
    await zovi('t2');
    assert.equal(poziva, 2, 'drugi token je prošao na tuđem keširanom unosu');
  });

  test('provera prijave je bajt u bajt ista u svih 9', () => {
    const etalon = telo('analyze');
    for (const p of PUTANJE.slice(1)) {
      assert.equal(telo(p), etalon,
        `api/${p}.js ima DRUGAČIJU proveru prijave od api/analyze.js`);
    }
  });

  test('nijedna kopija ne propušta zahtev bez Authorization zaglavlja', () => {
    for (const p of PUTANJE) {
      const t = telo(p);
      assert.match(t, /\/\^Bearer\\s\+\(\.\+\)\$\/i/, `api/${p}.js ne traži Bearer token`);
      assert.match(t, /status: 401, error: 'Nedostaje prijava\.'/, `api/${p}.js ne odbija bez zaglavlja`);
      assert.match(t, /\/auth\/v1\/user/, `api/${p}.js ne proverava token kod Supabase-a`);
    }
  });
});

describe('Analiza se sama zaustavi pre Vercelovog noza', () => {
  /* PRIJAVA: „Server nije vratio ispravan odgovor (HTTP 504)" — i to tek kad su
     u zahtev usli i podaci po kilometru, koji produze i unos i razmisljanje.
     Kad Vercel presece funkciju na maxDuration, klijent dobije HTML stranicu
     umesto naseg JSON-a, pa poruka koju covek vidi vise nije nasa. */
  const src = readRepoFile('api/analyze.js');
  const cfg = JSON.parse(readRepoFile('vercel.json'));

  test('rok lanca je ISPOD Vercelovog maxDuration', () => {
    const rok = /const ROK_MS\s*=\s*(\d+)/.exec(src);
    assert.ok(rok, 'nema roka za ceo lanac');
    const maxD = cfg.functions['api/analyze.js'].maxDuration;
    assert.ok(+rok[1] / 1000 < maxD - 5,
      `rok ${+rok[1] / 1000} s nije bar 5 s ispod maxDuration ${maxD} s`);
  });

  test('poziv se prekida rokom, i ne krece kad roka vise nema', () => {
    /* Prekid mora da postoji, ali NE kao fiksni plafon: prva verzija je sekla
       na 24 s, a model realno trazi i preko trideset — pa se umesto Vercelovog
       504 dobijao nas, dakle ista nedostupna analiza samo brze. */
    assert.match(src, /signal: AbortSignal\.timeout\(ostalo\)/,
      'pokusaj ne dobija ceo preostali rok');
    assert.doesNotMatch(src, /const POKUSAJ_MS/, 'vracen je fiksni plafon po pokusaju');
    assert.match(src, /if \(ostalo <= 1500\)/, 'poziv krece i kad roka prakticno nema');
  });

  test('istek ne ponavlja ISTI model, ali sme na lakši', () => {
    /* Ponavljanje istog posle isteka samo pojede ostatak roka; lakši model je
       brži, pa u ostatku ume da stigne tamo gde puni nije. */
    assert.match(src, /const isteklo = [\s\S]*?sameRetry: false, tryFallback: true/,
      'istek se ne razlikuje od mrezne greske');
  });

  test('nijedan pokušaj ne kreće bez vremena da se i završi', () => {
    assert.match(src, /out\.sameRetry && kraj - Date\.now\(\) >= NAJMANJI_MS/,
      'ponavljanje krece i kad rok samo sto nije istekao');
    assert.match(src, /out\.tryFallback && kraj - Date\.now\(\) >= 8000/,
      'rezervni model se poziva i kad rok samo sto nije istekao');
  });

  test('izlazni budžet je srazmeran zadatku', () => {
    /* 8000 tokena je bilo daleko iznad potrebe (analiza je desetak recenica),
       a svaki dozvoljen token je i vreme. */
    const m = /maxOutputTokens: (\d+)/.exec(src);
    assert.ok(m, 'nema budzeta za izlaz');
    assert.ok(+m[1] <= 4000, `budzet je ${m[1]} tokena — to je opet esej, ne analiza`);
    assert.ok(+m[1] >= 1500, `budzet od ${m[1]} tokena ne ostavlja mesta ni za razmisljanje`);
  });

  test('klijent vise ne gubi rezultat na istek', () => {
    /* Ranije je klijent CEKAO odgovor, pa je istek znacio izgubljenu analizu i
       potrosenu kvotu. Sada posao ima svoj red u bazi i pokupi se kasnije, pa
       poruka o 504 vise nije ni potrebna. */
    const app = readRepoFile('app.js');
    assert.doesNotMatch(app, /jos nije deployovan na Vercel-u/, 'stara, netacna poruka je i dalje tu');
    assert.match(app, /posao:'start'/, 'analiza se i dalje pokrece sinhrono');
    assert.match(app, /aiPozovi\(Object\.assign\(\{posao:'radi'/, 'racun se ceka umesto da se pusti');
    assert.match(app, /async function aiPokupiSve\(\)/, 'nema pokupljanja zavrsenih analiza');
  });
});

describe('Analiza odvojena od cekanja', () => {
  /* Jedan zahtev je i dalje ogranicen na maxDuration — to se ne moze zaobici.
     Ali rezultat vise ne zivi u tom zahtevu nego u tabeli, pa se ne gubi ni kad
     veza pukne, ni kad telefon uspava stranicu, ni kad se app zatvori. */
  const src = readRepoFile('api/analyze.js');
  const app = readRepoFile('app.js');
  const sql = readRepoFile('supabase/ai-posao.sql');

  test('tri faze postoje', () => {
    for (const f of ['start', 'radi', 'citaj'])
      assert.match(src, new RegExp(`posao === '${f}'`), `nema faze '${f}'`);
  });

  /* ================================================================
     DNEVNI LIMIT — TESTIRA SE PONAŠANJE, NE OBLIK KODA.

     Ovde je ranije stajalo `assert.match(src, /if \(!vlasnik && posao !==
     'radi'\)/)` — dakle provera da u fajlu postoji određen niz znakova. Taj
     test je prolazio i dok je `{posao:'radi', trend:{…}}` pozivao model bez
     ijednog uvećanja brojača: uslov je bio tačno tamo gde ga je regularni
     izraz tražio, a pet redova niže je `handleTrend` izlazio pre svake brane.
     Rupa je nađena izvršnim pozivom, ne čitanjem — pa se tako i čuva.

     Lažni `fetch` broji dve stvari koje jedine znače nešto: koliko je puta
     pomeren dnevni brojač i koliko je puta pozvan model. ============= */
  function stubAnalyze(stanje) {
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) {
        return jsonRes({ id: 'u1', email: 'korisnik@t.rs', email_confirmed_at: '2026-01-01' });
      }
      if (u.includes('check_and_bump_api_usage')) {
        stanje.brojano++;
        if (stanje.preko) return { ok: false, status: 400, text: async () => JSON.stringify({ code: 'P0001', message: 'DAILY_LIMIT_EXCEEDED' }) };
        return jsonRes({});
      }
      if (u.includes('check_and_bump_endpoint')) { stanje.citanja++; return jsonRes({}); }
      if (u.includes('generativelanguage')) {
        stanje.model++;
        return jsonRes({ candidates: [{ content: { parts: [{ text: 'analiza' }] } }] });
      }
      /* ai_posao: PATCH nad nepostojećim redom vraća prazan niz — isto što i
         PostgREST. Tako se vidi da preuzimanje posla zaista štiti. */
      if (u.includes('/rest/v1/ai_posao')) {
        if (opt && opt.method === 'POST') return jsonRes([{ id: '11111111-1111-4111-8111-111111111111' }]);
        return jsonRes(stanje.redPostoji ? [{ id: 'x', stanje: 'radi' }] : []);
      }
      throw new Error('neočekivan poziv: ' + u);
    };
  }
  const novoStanje = () => ({ brojano: 0, model: 0, citanja: 0, preko: false, redPostoji: false });
  const zovi = async (telo) => {
    const { default: h } = await import('../api/analyze.js?t=' + Date.now());
    const res = makeRes();
    await h({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: telo }, res);
    return res;
  };
  const TREND = { cilj: 60, baseline: 50, treninzi: [], vdot: [] };
  const UUID_OK = '00000000-0000-4000-8000-000000000000';

  test('trend uz fazu posla se ODBIJA — inače je limit potpuno zaobiđen', async () => {
    const st = novoStanje(); stubAnalyze(st);
    const res = await zovi({ posao: 'radi', posaoId: UUID_OK, trend: TREND });
    assert.equal(res.code, 400, 'trend sa fazom posla je prošao');
    assert.equal(st.model, 0, 'MODEL JE POZVAN — dnevni limit je zaobiđen');
    assert.equal(st.brojano, 0);
  });

  test('obična trend analiza se broji u dnevni limit', async () => {
    const st = novoStanje(); stubAnalyze(st);
    const res = await zovi({ trend: TREND });
    assert.equal(res.code, 200);
    assert.equal(st.model, 1, 'model nije pozvan');
    assert.equal(st.brojano, 1, 'trend analiza se ne broji');
  });

  test('faza „radi" bez ispravnog ID-a posla se broji kao nov poziv', async () => {
    /* Preskakanje brojača sme da važi SAMO za nastavak posla koji je pri
       pokretanju već izbrojan. Bez toga je dovoljno reći „ja sam nastavak". */
    const st = novoStanje(); stubAnalyze(st);
    await zovi({ posao: 'radi', posaoId: 'nije-uuid', session: { desc: 'x' }, entered: { km: 1 } });
    assert.equal(st.brojano, 1, 'izmišljen ID posla je preskočio brojač');
  });

  test('faza „radi" sa ID-em koji ne postoji ne poziva model', async () => {
    const st = novoStanje(); stubAnalyze(st);   /* redPostoji=false → PATCH vrati [] */
    const res = await zovi({ posao: 'radi', posaoId: UUID_OK, session: { desc: 'x' }, entered: { km: 1 } });
    assert.equal(res.code, 200);
    assert.equal(res.body.vec, true, 'posao nije prepoznat kao već preuzet');
    assert.equal(st.model, 0, 'model je pozvan za posao koji ne postoji');
  });

  test('pravi nastavak posla NE troši drugi put dnevni limit', async () => {
    const st = novoStanje(); st.redPostoji = true; stubAnalyze(st);
    await zovi({ posao: 'radi', posaoId: UUID_OK, session: { desc: 'x' }, entered: { km: 1 } });
    assert.equal(st.model, 1, 'model nije pozvan za stvaran posao');
    assert.equal(st.brojano, 0, 'nastavak već izbrojanog posla se broji drugi put');
  });

  test('prekoračen limit ne pušta ni model ni posao', async () => {
    const st = novoStanje(); st.preko = true; stubAnalyze(st);
    const res = await zovi({ posao: 'start' });
    assert.equal(res.code, 429);
    assert.equal(st.model, 0);
  });

  test('čitanje rezultata ne troši kvotu analiza, ali ima svoj brojač', async () => {
    const st = novoStanje(); st.redPostoji = true; stubAnalyze(st);
    const res = await zovi({ posao: 'citaj', posaoId: UUID_OK });
    assert.equal(res.code, 200);
    assert.equal(st.brojano, 0, 'čitanje troši dnevni limit analiza');
    assert.equal(st.model, 0, 'čitanje je pozvalo model');
    assert.equal(st.citanja, 1, 'čitanje nema nikakav brojač');
  });

  test('posao se ne moze pokrenuti dvaput', () => {
    /* Dva paralelna pokusaja bi inace pozvala model dvaput za isti red. */
    assert.match(src, /'\?id=eq\.' \+ id \+ '&stanje=eq\.radi'/, 'preuzimanje nije uslovljeno stanjem');
    assert.match(src, /stanje: 'u_toku'/, 'red se ne oznacava kao preuzet');
  });

  test('tabela ide kroz RLS i korisnikov token, ne kroz service_role', () => {
    assert.match(sql, /alter table public\.ai_posao enable row level security/);
    assert.match(sql, /using \(auth\.uid\(\) = user_id\)/, 'nema ogranicenja na sopstvene redove');
    /* Trazi se UPOTREBA kljuca, ne pomen reci — komentar koji objasnjava zasto
       se service_role NE koristi je upravo ono sto zelimo da ostane. */
    assert.doesNotMatch(src, /process\.env\.[A-Z_]*SERVICE_ROLE/, 'server zaobilazi RLS');
    assert.match(src, /Authorization: 'Bearer ' \+ auth\.token/, 'tabela se ne cita korisnikovim tokenom');
  });

  test('ID posla se proverava pre svake upotrebe', () => {
    assert.match(src, /const UUID = \//, 'nema oblika za ID');
    assert.match(src, /if \(!UUID\.test\(posaoId\)\)/, 'ID ide u upit bez provere');
  });

  test('klijent pamti posao, pa ga preziveli restart pokupi', () => {
    assert.match(app, /l\.aiPosao=\{id:/, 'posao se ne pamti — restart bi ga izgubio');
    assert.match(app, /aiPokupiSve\(\);/, 'zavrsene analize se ne pokupljaju');
    /* Kartica mora da pokaze da posao traje, inace covek klikne ponovo. */
    assert.match(app, /Nova analiza je u toku/, 'nema stanja „u toku" na kartici');
  });

  test('stanje „u toku" ima prednost i kad STARA analiza postoji', () => {
    /* PRIJAVA: „ako zatvorim aplikaciju vrati na staru analizu". Prva verzija je
       stanje pokazivala samo kad starog teksta NEMA — a „Analiziraj ponovo" je
       po definiciji slucaj u kom ga ima, pa je posle povratka izgledalo kao da
       se nista nije ni pokrenulo. */
    const m = /if\(l\.aiPosao&&l\.aiPosao\.id\)\{([\s\S]*?)\n  \}/.exec(app);
    assert.ok(m, 'nema grane za posao u toku');
    assert.doesNotMatch(m[0].split('{')[0], /aiText/,
      'stanje „u toku" je i dalje uslovljeno nepostojanjem starog teksta');
    assert.match(m[1], /prethodna analiza/, 'stari tekst se gubi umesto da se oznaci');
    /* Dok posao traje NEMA dugmeta — inace bi se poslovi gomilali. */
    assert.doesNotMatch(m[1], /ai-again/, 'moze se pokrenuti jos jedna analiza preko one koja traje');
  });

  test('brojac analiza raste tek kad tekst STVARNO stigne', () => {
    /* Neuspeo posao ne sme da potrosi jednu od dve po treningu. */
    const m = /if\(st==='gotovo'\)\{([\s\S]*?)\n  \}/.exec(app);
    assert.ok(m, 'nema grane za uspesno pokupljen rezultat');
    assert.match(m[1], /l\.aiCount=\(l\.aiCount\|\|0\)\+1/, 'brojac se ne povecava na uspeh');
  });

  test('uputstvo modelu zatvara greske koje su se stvarno desile', () => {
    assert.match(src, /6a\. OCENU DEKUPLOVANJA UZIMAS|6a\. OCENU DEKUPLOVANJA UZIMAŠ/,
      'nema pravila da ocena ide po skali');
    assert.match(src, /NE SMES u istom tekstu|NE SMEŠ u istom tekstu/,
      'nema zabrane protivrecnih tvrdnji');
    assert.match(src, /prvi broj mora biti MANJI od drugog/, 'nema provere smera porasta');
    assert.match(src, /"radni deo" postoji SAMO na kvalitetnim sesijama/,
      'nema zabrane „radnog dela" na laganom');
    assert.match(src, /thinkingLevel: 'medium'/, 'razmisljanje je i dalje spusteno na low');
  });
});
