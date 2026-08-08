/* Serverske funkcije (api/) — pozivaju se sa lažnim `fetch`, `req` i `res`.
   Ništa ne ide na mrežu. Cilj su ponašanja koja se ne vide iz koda na prvi
   pogled: da slanje mejlova stane pre vremenskog limita i nastavi bez
   duplikata, da brisanje na intervals.icu ne bude 60 poziva u nizu, i da
   izveštaj ne izgubi korisnike preko prve stranice. */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createECDH, randomBytes } from 'node:crypto';
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
  ADMIN_2FA: 'lozinka-za-razorno',
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
    /* Granica krugova je SAMO osigurač protiv beskonačne petlje, ne merilo.
       Bila je 20, uz rok od 30 ms po pozivu — pa je na opterećenoj mašini u
       jedan poziv stalo manje mejlova, 250 nije stalo u 20 krugova i test je
       povremeno padao bez ijedne greške u kodu. Test koji ume da padne sam od
       sebe truje ceo skup: sledeći put kad padne, poveruje se da je opet
       „samo mašina". Broj je zato podignut daleko iznad svake razumne
       potrebe; ono što se stvarno tvrdi je ispod — bez duplikata i svih 250. */
    let posle = '', krugova = 0, kraj = false;
    while (!kraj && krugova < 400) {
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
    const { default: handler } = await import('../api/icu.js?t=' + Date.now());
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
        sta: 'workouts', athleteId: 'i123', token: 'tttttttttttt', rezim: 'zameni',
        events: [{ date: '2026-07-01', externalId: 'sub19-g1d1', name: 'Lako', description: '- 5km' }]
      }
    }, res);
    assert.equal(res.code, 200, JSON.stringify(res.body));
    assert.equal(obrisani.length, 40, 'nisu obrisani svi naši događaji');
    assert.ok(maxIstovremeno > 1, 'brisanje je i dalje strogo sekvencijalno');
    assert.ok(maxIstovremeno <= 5, `previše istovremenih zahteva (${maxIstovremeno})`);
  });

  test('briše ISKLJUČIVO događaje sa našim prefiksom', async () => {
    const { default: handler } = await import('../api/icu.js?t=' + Date.now());
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
        sta: 'workouts', athleteId: 'i123', token: 'tttttttttttt', rezim: 'zameni',
        events: [{ date: '2026-07-01', externalId: 'sub19-g1d1', name: 'Lako', description: '- 5km' }]
      }
    }, res);
    assert.equal(obrisani.length, 1, 'obrisano je nešto što nije naše');
    assert.ok(obrisani[0].endsWith('/events/1'));
  });

  test('odbija neispravan externalId (ne sme da piše van svog prostora)', async () => {
    const { default: handler } = await import('../api/icu.js?t=' + Date.now());
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

describe('/api/auth — obe grane Strava OAuth-a', () => {
  /* Spojeno iz api/auth.js + api/refresh.js (Vercel Hobby: najvise 12
     funkcija). Grananje ide po metodi, pa se cuva da obe i dalje traze
     prijavu i da GET nije poceo da prima refresh token ni obrnuto. */
  const zovi = async (over) => {
    const { default: handler } = await import('../api/auth.js?t=' + Date.now() + Math.random());
    const res = makeRes();
    await handler({ method: 'GET', headers: {}, query: {}, body: {}, ...over }, res);
    return res;
  };

  test('POST grana (osvežavanje) i dalje traži prijavu', async () => {
    globalThis.fetch = async () => jsonRes({}, false, 401);
    const res = await zovi({ method: 'POST', headers: { 'content-type': 'application/json' },
                             body: { refresh_token: 'r' } });
    assert.equal(res.code, 401, `dobijeno ${res.code}: ${JSON.stringify(res.body)}`);
  });

  test('POST bez Content-Type: application/json se odbija', async () => {
    /* Zatvara <form> POST sa tudjeg sajta — bez ovog zaglavlja bi tudja
       stranica mogla da pozove putanju koja koristi nas client_secret. */
    globalThis.fetch = async () => jsonRes({ id: 'u1' });
    const res = await zovi({ method: 'POST', headers: { authorization: 'Bearer t' },
                             body: { refresh_token: 'r' } });
    assert.equal(res.code, 415);
  });

  test('GET šalje authorization_code, POST šalje refresh_token', async () => {
    /* Bez Strava kljuceva `kaStravi` vrati 500 pre nego sto ista posalje —
       tada bi test proveravao poruku o nedostajucoj env varijabli umesto
       grananja. */
    process.env.STRAVA_CLIENT_ID = 'ci'; process.env.STRAVA_CLIENT_SECRET = 'cs';
    /* Da se dve grane ne pobrkaju posle spajanja: Strava bi na pogrešan
       grant_type vratila grešku koju bi korisnik video kao „veza ne radi". */
    let poslato = null;
    globalThis.fetch = async (url, opt) => {
      if (String(url).includes('/auth/v1/user')) return jsonRes({ id: 'u1' });
      poslato = JSON.parse(opt.body);
      return jsonRes({ access_token: 'a' });
    };
    await zovi({ headers: { authorization: 'Bearer t' }, query: { code: 'abc123' } });
    assert.equal(poslato.grant_type, 'authorization_code');
    assert.equal(poslato.code, 'abc123');

    await zovi({ method: 'POST', headers: { authorization: 'Bearer t', 'content-type': 'application/json' },
                 body: { refresh_token: 'RT' } });
    assert.equal(poslato.grant_type, 'refresh_token');
    assert.equal(poslato.refresh_token, 'RT');
  });

  test('ostale metode se odbijaju', async () => {
    for (const m of ['PUT', 'DELETE', 'PATCH']) {
      assert.equal((await zovi({ method: m })).code, 405, `${m} je prošao`);
    }
  });
});

describe('Sve api/ putanje traže prijavu ili tajnu', () => {
  const putanje = ['analyze', 'auth', 'icu-oauth', 'report-bug', 'icu'];
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
  /* `sta` bira granu u spojenom api/icu.js — bez njega dispecer vrati 400
     pre nego sto ijedna provera limita bude pozvana. */
  const zahtev = {
    wellness: { sta: 'wellness', athleteId: 'i123', token: 'tttttttttttt', oldest: '2026-07-01', newest: '2026-07-10' },
    workouts: { sta: 'workouts', athleteId: 'i123', token: 'tttttttttttt', rezim: 'azuriraj',
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
      const { default: handler } = await import('../api/icu.js?t=' + Date.now() + Math.random());
      const redosled = stub(() => jsonRes({ message: 'DAILY_LIMIT_EXCEEDED' }, false, 400));
      const res = makeRes();
      await handler({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: zahtev[put] }, res);
      assert.equal(res.code, 429, JSON.stringify(res.body));
      assert.match(String(res.body.error), /limit/i);
      assert.ok(!redosled.includes('icu'),
        'poziv ka intervals.icu je otišao IPAK — limit tada ne štiti ništa');
    });

    test(`/api/${put} pita limit PRE nego što pozove intervals.icu`, async () => {
      const { default: handler } = await import('../api/icu.js?t=' + Date.now() + Math.random());
      const redosled = stub(() => jsonRes(1));
      const res = makeRes();
      await handler({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: zahtev[put] }, res);
      assert.equal(res.code, 200, JSON.stringify(res.body));
      assert.ok(redosled.indexOf('limit') > -1, 'limit se uopšte ne pita');
      assert.ok(redosled.indexOf('limit') < redosled.indexOf('icu'),
        `redosled je ${redosled.join(' -> ')} — brojanje posle poziva ne sprečava ništa`);
    });

    test(`/api/${put} šalje svoje ime i svoj limit`, async () => {
      const { default: handler } = await import('../api/icu.js?t=' + Date.now() + Math.random());
      let telo = null;
      stub(b => { telo = b; return jsonRes(1); });
      await handler({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: zahtev[put] }, makeRes());
      assert.equal(telo.p_endpoint, put, 'endpoint se ne razlikuje — brojači bi se mešali');
      assert.ok(Number.isInteger(telo.p_limit) && telo.p_limit > 0, `p_limit = ${telo.p_limit}`);
    });

    test(`/api/${put} radi i kad brojač otkaže (SQL možda još nije pušten)`, async () => {
      const { default: handler } = await import('../api/icu.js?t=' + Date.now() + Math.random());
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

  /* NALAZ S-2 — naziv mora biti SA SPISKA, ne samo ispravnog oblika.

     Ranije je stajala provera azbuke (`^[a-z0-9_-]{1,40}$`) uz komentar da bez
     nje „pozivalac sa izmišljenim nazivom svaki put dobija NOV red". Tačno — ali
     provera azbuke to nije sprečavala: slučajan string je i dalje ispravnog
     oblika, a naziv je deo primarnog ključa. Mereno na Postgresu: 5000 poziva sa
     `x1`…`x5000` → 5000 redova, 744 kB, nijedan izuzetak. Tabelu niko ne može ni
     da pročita, pa se to ne bi ni videlo dok se baza ne napuni — a tada prestaje
     da radi SVIMA. */
  test('NALAZ S-2: naziv endpointa mora biti sa spiska, ne samo ispravnog oblika', () => {
    assert.doesNotMatch(bezKomentara, /p_endpoint[\s\S]{0,80}~[\s\S]{0,40}\^\[a-z0-9_-\]/,
      'provera je opet samo po azbuci — slučajan naziv i dalje pravi nov red');
    assert.match(bezKomentara, /p_endpoint\s+not\s+in\s*\(/i,
      'rate-limit.sql ne nabraja dozvoljene nazive endpointa');
  });

  test('NALAZ S-2: svaki brojač iz koda stoji na spisku u SQL-u', () => {
    /* Suprotan smer iste greške: dodat brojač u kodu, a spisak u SQL-u ne — poziv
       tada pada sa BAD_ENDPOINT i limit ne radi. Zato se spisak i kod porede. */
    const sql = readRepoFile('supabase/rate-limit.sql');
    const dozvoljeni = new Set(
      [...(/p_endpoint\s+not\s+in\s*\(([\s\S]*?)\)\s*then/i.exec(sql) || [, ''])[1]
        .matchAll(/'([a-z0-9_-]+)'/g)].map(m => m[1]));
    assert.ok(dozvoljeni.size >= 8, `spisak je premali: ${[...dozvoljeni]}`);

    const izKoda = new Set();
    for (const f of readdirSync(join(ROOT, 'api')).filter(x => x.endsWith('.js'))) {
      const src = readFileSync(join(ROOT, 'api', f), 'utf8');
      for (const m of src.matchAll(/(?:limitPrekoracen|razornoDozvoljeno)\([^,]+,\s*'([a-z0-9_-]+)'/g)) izKoda.add(m[1]);
      for (const m of src.matchAll(/p_endpoint:\s*'([a-z0-9_-]+)'/g)) izKoda.add(m[1]);
    }
    /* i naziv koji okidač u bazi koristi */
    for (const m of readRepoFile('supabase/ai-posao.sql').matchAll(/check_and_bump_endpoint\('([a-z0-9_-]+)'/g)) izKoda.add(m[1]);

    assert.ok(izKoda.size >= 8, `nije nađen nijedan brojač u kodu: ${[...izKoda]}`);
    const nema = [...izKoda].filter(x => !dozvoljeni.has(x));
    assert.deepEqual(nema, [],
      `brojač postoji u kodu a nije na spisku u rate-limit.sql, pa poziv pada sa BAD_ENDPOINT: ${nema}`);
  });

  test('imena endpointa iz koda odgovaraju dozvoljenom obliku', () => {
    /* Sve tri grane su u api/icu.js posle spajanja, pa se imena vade odatle —
       i tvrdi se da ih ima TRI RAZLICITA. Da se dve grane izjednace, trosenje
       jedne bi blokiralo drugu, a to se ne bi videlo kao greska. */
    const oblik = /^[a-z0-9_-]{1,40}$/;
    const izvor = readFileSync(join(ROOT, 'api', 'icu.js'), 'utf8');
    const imena = [...izvor.matchAll(/limitPrekoracen\(auth\.token,\s*'([^']+)'/g)].map(m => m[1]);
    assert.equal(imena.length, 3, `ocekuju se tri brojaca, nadjeno ${imena.length}: ${imena}`);
    assert.equal(new Set(imena).size, 3, `dve grane dele isti brojac: ${imena}`);
    for (const ime of imena) assert.match(ime, oblik, `naziv "${ime}" bi funkcija odbila`);
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
  /* Spisak fajlova je bio zakucan na tri, pa je `push_pretplata_dodirni` godinu
     dana stajala van svake provere — mogla je da nestane iz baze bez ijednog
     traga. Sada su svi fajlovi koji uopšte definišu funkciju. */
  const stvarno = Object.assign({},
    izvuciFunkcije('ai-posao.sql'),
    izvuciFunkcije('api-usage.sql'),
    izvuciFunkcije('rate-limit.sql'),
    izvuciFunkcije('push.sql'),
    izvuciFunkcije('zajednica.sql'),
    izvuciFunkcije('istorija.sql'));

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
    for (const t of ['user_state', 'push_pretplata', 'ai_posao', 'api_usage',
                     'zajednica_profil']) {
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
  /* Spisak se ČITA SA DISKA, ne prepisuje rukom. Ranije je bio zakucan i
     zaostajao dvaput: prvo su `activities` i `push` ispadali iz poređenja —
     dakle iz jedine stvari koja duplikat drži na okupu — a onda je spajanje
     `refresh` u `auth` ostavilo ime fajla koji više ne postoji. Izveden spisak
     ne može da zaostane: nov endpoint sa `requireUser` ulazi sam. */
  const PUTANJE = readdirSync(join(ROOT, 'api'))
    .filter(f => f.endsWith('.js'))
    .filter(f => /async function requireUser\(req\)/.test(readFileSync(join(ROOT, 'api', f), 'utf8')))
    .map(f => f.replace(/\.js$/, ''))
    .sort();

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
    const { default: h } = await import('../api/icu.js?t=' + Date.now());
    const zovi = async (token) => {
      const res = makeRes();
      await h({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body: { sta: 'wellness' } }, res);
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

  test('provera prijave je bajt u bajt ista u svakoj kopiji', () => {
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

/* ============================================================
   /api/delete-account — brisanje naloga na zahtev korisnika.

   Putanja drži service_role ključ u ruci, pa je najvažnije pitanje ČIJI se
   nalog briše, a odmah zatim REDOSLED: podaci pa nalog, nikad obrnuto.
   ============================================================ */
describe('/api/delete-account — brisanje naloga', () => {
  const IZVOR = readRepoFile('api/delete-account.js');
  const KORISNIK = 'u-moj';
  const TOKEN = 'tok-moj';

  /* Beleži svaki poziv da bi se moglo tvrditi šta je obrisano i kojim redom. */
  function stubFetch({ tabelaPada = null, nalogPada = false, tabela404 = null } = {}) {
    const pozivi = [];
    globalThis.fetch = async (url, opt) => {
      const u = String(url), metod = (opt && opt.method) || 'GET';
      pozivi.push(metod + ' ' + u);
      if (u.includes('/auth/v1/user')) return jsonRes({ id: KORISNIK, email: 'ja@t.rs' });
      if (u.includes('/auth/v1/admin/users/')) {
        return nalogPada ? jsonRes({ error: 'ne' }, false, 500) : jsonRes({}, true, 200);
      }
      const m = /\/rest\/v1\/([a-z_]+)\?/.exec(u);
      if (m) {
        if (tabelaPada === m[1]) return jsonRes({ error: 'ne' }, false, 500);
        if (tabela404 === m[1])  return jsonRes({ error: 'nema' }, false, 404);
        return jsonRes({}, true, 200);
      }
      throw new Error('neocekivan poziv: ' + u);
    };
    return pozivi;
  }

  const zovi = async (over = {}) => {
    const { default: handler } = await import('../api/delete-account.js?t=' + Date.now() + Math.random());
    const res = makeRes();
    await handler({
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + TOKEN },
      body: { potvrda: 'OBRISI NALOG' },
      ...over
    }, res);
    return res;
  };

  test('samo POST', async () => {
    stubFetch();
    const res = await zovi({ method: 'GET' });
    assert.equal(res.code, 405);
    assert.equal(res.headers.Allow, 'POST');
  });

  test('bez Content-Type: application/json ne prolazi', async () => {
    /* Zatvara <form> POST sa tuđeg sajta — takav zahtev ne može postaviti ovo
       zaglavlje bez preflight provere, a preflight ne odobravamo. */
    stubFetch();
    const res = await zovi({ headers: { authorization: 'Bearer ' + TOKEN } });
    assert.equal(res.code, 415);
  });

  test('bez prijave ne prolazi', async () => {
    stubFetch();
    const res = await zovi({ headers: { 'content-type': 'application/json' } });
    assert.equal(res.code, 401);
  });

  test('bez tačne potvrde ništa se ne briše', async () => {
    const pozivi = stubFetch();
    for (const p of [undefined, '', 'da', 'OBRISI', 'obrisi nalog molim']) {
      const res = await zovi({ body: { potvrda: p } });
      assert.equal(res.code, 400, 'prošlo je sa potvrdom: ' + JSON.stringify(p));
    }
    assert.equal(pozivi.filter(x => x.startsWith('DELETE')).length, 0,
      'obrisano je nešto iako potvrda nije data');
  });

  test('potvrda se prima i sa kvačicom i malim slovima', async () => {
    /* Čovek je kuca rukom; „obriši nalog" i „OBRISI NALOG" su ista namera. */
    for (const p of ['OBRIŠI NALOG', 'obriši nalog', '  Obrisi   Nalog  ']) {
      stubFetch();
      const res = await zovi({ body: { potvrda: p } });
      assert.equal(res.code, 200, 'odbijena potvrda: ' + JSON.stringify(p));
    }
  });

  test('briše SVE tabele pa tek onda nalog', async () => {
    const pozivi = stubFetch();
    const res = await zovi();
    assert.equal(res.code, 200);
    assert.equal(res.body.ok, true);

    const tabele = pozivi.filter(x => x.includes('/rest/v1/')).map(x => /\/rest\/v1\/([a-z_]+)\?/.exec(x)[1]);
    for (const t of ['user_state', 'push_pretplata', 'ai_posao', 'api_usage', 'bug_report_usage', 'endpoint_usage']) {
      assert.ok(tabele.includes(t), 'tabela nije obrisana: ' + t);
    }
    const zadnjaTabela = pozivi.findLastIndex(x => x.includes('/rest/v1/'));
    const nalog = pozivi.findIndex(x => x.includes('/auth/v1/admin/users/'));
    assert.ok(nalog > zadnjaTabela, 'nalog je obrisan PRE podataka');
  });

  test('ne briše nalog čiji id stigne u telu zahteva', () => {
    /* NAJVAŽNIJI TEST U FAJLU. Sa service_role ključem, čitanje bilo kakvog
       identifikatora iz tela značilo bi brisanje tuđeg naloga jednim poljem
       u JSON-u. Tvrdi se nad izvorom jer je jedini siguran oblik „ovoga
       ovde nema": telo se dodiruje samo zbog `potvrda`. */
    const telo = /body\s*=\s*typeof req\.body[\s\S]*?export|body\s*=\s*typeof req\.body[\s\S]*$/.exec(IZVOR);
    assert.ok(telo, 'ne nalazim gde se čita telo zahteva');
    assert.doesNotMatch(IZVOR, /body\.(user_?[Ii]d|id|email|nalog)/,
      'iz tela zahteva se čita identifikator naloga');
    /* A brisanje ide isključivo po `auth.userId` iz proverenog tokena. */
    assert.match(IZVOR, /user_id=eq\.'\s*\+\s*encodeURIComponent\(auth\.userId\)/,
      'brisanje redova ne ide po korisniku iz tokena');
    assert.match(IZVOR, /admin\/users\/'\s*\+\s*encodeURIComponent\(auth\.userId\)/,
      'brisanje naloga ne ide po korisniku iz tokena');
  });

  test('kad brisanje podataka padne, nalog OSTAJE', async () => {
    /* Obrnut redosled je najgori ishod: čovek izgubi pristup, podaci ostanu,
       i više se ne može ni prijaviti da pokuša ponovo. */
    const pozivi = stubFetch({ tabelaPada: 'ai_posao' });
    const res = await zovi();
    assert.equal(res.code, 502);
    assert.match(res.body.error, /NIJE obrisan/);
    assert.equal(pozivi.filter(x => x.includes('/auth/v1/admin/users/')).length, 0,
      'nalog je obrisan iako podaci nisu');
  });

  test('tabela koja ne postoji (404) ne prekida brisanje', async () => {
    /* rate-limit.sql se pušta rukom; dok nije pušten, endpoint_usage ne
       postoji. To nije razlog da čovek ne može da obriše nalog. */
    const pozivi = stubFetch({ tabela404: 'endpoint_usage' });
    const res = await zovi();
    assert.equal(res.code, 200);
    assert.ok(pozivi.some(x => x.includes('/auth/v1/admin/users/')), 'nalog nije obrisan');
    assert.ok(!res.body.obrisano.includes('endpoint_usage'),
      'tabela koje nema prijavljena je kao obrisana');
  });

  test('kad brisanje naloga padne, to se ne prijavljuje kao uspeh', async () => {
    stubFetch({ nalogPada: true });
    const res = await zovi();
    assert.equal(res.code, 502);
    assert.match(res.body.error, /nalog nije/i);
  });

  test('spisak tabela pokriva sve iz supabase/*.sql', () => {
    /* Tabela koja se doda u šemu a ne i ovde preživi brisanje naloga i
       ostane siroče sa user_id-jem koji više ne postoji. */
    const uKodu = new Set((/const TABELE = \[([\s\S]*?)\]/.exec(IZVOR)[1].match(/'([a-z_]+)'/g) || [])
      .map(s => s.replace(/'/g, '')));
    const sql = readdirSync(join(ROOT, 'supabase'))
      .filter(f => f.endsWith('.sql'))
      .map(f => readFileSync(join(ROOT, 'supabase', f), 'utf8')).join('\n');
    const uSemi = new Map();
    const re = /create table if not exists public\.([a-z_]+)\s*\(([\s\S]*?)\n\);/g;
    let m;
    while ((m = re.exec(sql))) {
      if (/\buser_id\b/.test(m[2])) uSemi.set(m[1], /user_id[\s\S]{0,200}?on delete cascade/.test(m[2]));
    }
    assert.ok(uSemi.size >= 4, 'nisam našao tabele u supabase/*.sql — regex je zastareo');
    /* PRAVILO: tabela sa `user_id` mora ILI biti u spisku za eksplicitno
       brisanje, ILI imati `on delete cascade`. Bez jednog od toga red preživi
       brisanje naloga i ostane siroče sa identifikatorom koji ne postoji.

       Ranije se tražio SAMO spisak. To je bilo prestrogo i jednom je već
       zasmetalo: `nalog_za_brisanje` NAMERNO nije u spisku. On se briše PRE
       samog naloga, pa bi — da je u spisku — oznaka nestala i pre nego što se
       vidi da li je brisanje naloga uspelo. Nalog bi ostao zabranjen zauvek,
       bez ijednog zapisa zašto. Cascade to rešava sam, i to tek POSLE naloga. */
    for (const [t, cascade] of uSemi) {
      assert.ok(uKodu.has(t) || cascade,
        `tabela ${t} ima user_id, a nije ni u TABELE spisku ni pod on delete cascade`);
    }
    /* user_state je pravljena rukom pre nego što je šema ušla u repozitorijum,
       pa je u SQL-u nema — ali mora biti u spisku. */
    assert.ok(uKodu.has('user_state'), 'user_state nije u TABELE spisku');
  });

  test('tekst potvrde je isti u aplikaciji i na serveru', () => {
    /* Da se raziđu, dugme bi radilo a server bi ćutke odbijao svaki zahtev. */
    const server = /const POTVRDA = '([^']+)'/.exec(IZVOR);
    const klijent = /const DEL_POTVRDA='([^']+)'/.exec(readRepoFile('app.js'));
    assert.ok(server && klijent, 'ne nalazim tekst potvrde na obe strane');
    assert.equal(server[1], klijent[1]);
  });
});

/* ============================================================
   /api/broadcast {admin:…} — vlasnikov spisak i brisanje TUDJEG naloga.

   Bilo je u zasebnom api/admin-users.js. Spojeno u broadcast jer Vercel Hobby
   plan dozvoljava najvise 12 serverless funkcija po deployu — trinaesta obara
   CEO build, pa se ne objavi ni jedna izmena.

   Ova putanja drzi service_role kljuc I cita ciji se nalog brise iz zahteva —
   suprotno od delete-account.js. To je opravdano samo dok kapija drzi, pa je
   ona i jedina stvar koju ovi testovi cuvaju.
   ============================================================ */
describe('/api/broadcast {admin} — kapija vlasnika', () => {
  const IZVOR = readRepoFile('api/broadcast.js');
  const VLASNIK = { id: 'v1', email: ENV.ADMIN_EMAIL, email_confirmed_at: '2026-01-01' };

  /* Podrazumevano „oznaka je postojala"; test koji meri suprotno je podmeće. */
  let oznakaPrazna = false;
  function stub(korisnik, { obrisiPada = null, oznakaPada = false, brojacPada = false } = {}) {
    const pozivi = [];
    globalThis.fetch = async (url, opt) => {
      const u = String(url), metod = (opt && opt.method) || 'GET';
      pozivi.push(metod + ' ' + u);
      if (u.includes('/auth/v1/user')) {
        return korisnik ? jsonRes(korisnik) : jsonRes({ error: 'nema' }, false, 401);
      }
      if (/\/auth\/v1\/admin\/users\/([^?]+)$/.test(u)) {
        const id = /\/auth\/v1\/admin\/users\/([^?]+)$/.exec(u)[1];
        if (id === 'nepostojeci') return jsonRes({ error: 'nema' }, false, 404);
        return jsonRes({ id, email: id + '@t.rs' });
      }
      if (u.includes('/auth/v1/admin/users')) {
        return jsonRes([VLASNIK, { id: 'k1', email: 'prvi@t.rs', last_sign_in_at: '2026-08-01' }]);
      }
      if (u.includes('/rest/v1/rpc/check_and_bump_endpoint')) {
        return brojacPada ? jsonRes({ message: 'nema' }, false, 500) : jsonRes(1);
      }
      if (u.includes('/rest/v1/nalog_za_brisanje')) {
        if (oznakaPada) return jsonRes({ error: 'ne' }, false, 500);
        /* DELETE vraća OBRISANE redove (Prefer: return=representation). Prazan
           niz znači „oznake nije bilo" i po tome `ponisti` odlučuje da li sme
           da skine zabranu — v. nalaz B-1. Podrazumevano ovde stoji jedan red,
           dakle „oznaka je postojala"; test koji meri suprotno je podmeće sam. */
        if (opt && opt.method === 'DELETE') return jsonRes(oznakaPrazna ? [] : [{ user_id: 'k1', email: 'prvi@t.rs' }]);
        return jsonRes([]);
      }
      if (u.includes('api.resend.com')) return jsonRes({ id: 'mejl' });
      const m = /\/rest\/v1\/([a-z_]+)\?/.exec(u);
      if (m) return obrisiPada === m[1] ? jsonRes({ error: 'ne' }, false, 500) : jsonRes([]);
      throw new Error('neocekivan poziv: ' + u);
    };
    return pozivi;
  }

  const zovi = async (telo, over = {}) => {
    const { default: handler } = await import('../api/broadcast.js?t=' + Date.now() + Math.random());
    const res = makeRes();
    await handler({
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: telo, ...over
    }, res);
    return res;
  };

  test('obican korisnik ne dobija spisak — i ne saznaje da putanja postoji', async () => {
    /* 404, ne 403: „zabranjeno" je potvrda da nesto postoji. */
    stub({ id: 'k1', email: 'neko@t.rs', email_confirmed_at: '2026-01-01' });
    const res = await zovi({ admin: 'lista' });
    assert.equal(res.code, 404);
    assert.doesNotMatch(JSON.stringify(res.body), /korisnic/i, 'odgovor odaje da putanja lista korisnike');
  });

  test('bez prijave ne prolazi', async () => {
    stub(null);
    assert.equal((await zovi({ admin: 'lista' })).code, 404);
    assert.equal((await zovi({ admin: 'lista' }, { headers: {} })).code, 404);
  });

  test('NEPOTVRDJENA vlasnikova adresa ne otvara kapiju', async () => {
    /* Na Supabase podesavanju bez obavezne potvrde mejla, svako se moze
       registrovati vlasnikovom adresom i dobiti token sa email_confirmed_at:
       null. Bez ove provere bi time dobio spisak svih korisnika i pravo da ih
       brise. Ista zamka je vec zatvorena u broadcast.js. */
    stub({ id: 'x', email: ENV.ADMIN_EMAIL, email_confirmed_at: null });
    assert.equal((await zovi({ admin: 'lista' })).code, 404);
  });

  test('vlasnik dobija spisak, sa oznakom koji je njegov', async () => {
    stub(VLASNIK);
    const res = await zovi({ admin: 'lista' });
    assert.equal(res.code, 200);
    const k = res.body.korisnici;
    assert.equal(k.length, 2);
    assert.equal(k.find(x => x.id === 'v1').jaSam, true);
    assert.equal(k.find(x => x.id === 'k1').jaSam, false);
  });

  test('vlasnik NE moze sebe da obrise odavde', async () => {
    /* Izgubio bi pristup spisku i ne bi mogao ni da povrati stanje. Za svoj
       nalog postoji Podesavanja → Nalog → Brisanje naloga, sa potvrdom
       kucanjem. */
    const pozivi = stub(VLASNIK);
    const res = await zovi({ admin: 'obrisi', obrisiId: 'v1' });
    assert.equal(res.code, 400);
    assert.match(res.body.error, /Podešavanja/);
    assert.equal(pozivi.filter(x => x.startsWith('DELETE')).length, 0, 'nesto je obrisano');
  });

  const LOZ = ENV.ADMIN_2FA;

  test('nepostojeci id ne prolazi kao uspeh', async () => {
    /* Bez provere postojanja bi pogresan id oznacio nepostojeci nalog i vratio
       „ok" — izgledalo bi kao da je neko obrisan a nije. */
    const pozivi = stub(VLASNIK);
    const res = await zovi({ admin: 'obrisi', obrisiId: 'nepostojeci', lozinka: LOZ });
    assert.equal(res.code, 404);
    assert.equal(pozivi.filter(x => x.includes('nalog_za_brisanje')).length, 0);
  });

  test('NE brise odmah — zabrani i oznaci', async () => {
    /* Jedan HTTP poziv koji nepovratno brise tudj nalog je, u rukama nekoga ko
       je preuzeo vlasnikovu sesiju, alat za unistenje svih korisnika. Sada
       pristup prestaje odmah, a podaci se uklanjaju tek posle roka. */
    const pozivi = stub(VLASNIK);
    const res = await zovi({ admin: 'obrisi', obrisiId: 'k1', lozinka: LOZ });
    assert.equal(res.code, 200);
    assert.equal(res.body.odlozeno, true);
    assert.ok(res.body.izvrsiPosle, 'nije vracen rok');
    assert.ok(new Date(res.body.izvrsiPosle).getTime() > Date.now(), 'rok je u proslosti');
    assert.equal(pozivi.filter(x => x.startsWith('DELETE') && x.includes('/auth/v1/admin/users/')).length, 0,
      'nalog je obrisan odmah');
    assert.equal(pozivi.filter(x => x.startsWith('DELETE') && x.includes('/rest/v1/user_state?')).length, 0,
      'podaci su obrisani odmah');
    assert.ok(pozivi.some(x => x.startsWith('PUT') && x.includes('/auth/v1/admin/users/')), 'nalog nije zabranjen');
    assert.ok(pozivi.some(x => x.includes('nalog_za_brisanje')), 'nalog nije oznacen');
  });

  test('kad oznaka ne prodje, zabrana se SKIDA', async () => {
    /* Inace bi nalog ostao zakljucan zauvek, bez ijednog zapisa zasto —
       polovicno stanje koje niko ne bi umeo da razmrsi. */
    const pozivi = stub(VLASNIK, { oznakaPada: true });
    const res = await zovi({ admin: 'obrisi', obrisiId: 'k1', lozinka: LOZ });
    assert.equal(res.code, 502);
    assert.match(res.body.error, /Zabrana je skinuta/);
    const putovi = pozivi.filter(x => x.startsWith('PUT') && x.includes('/auth/v1/admin/users/'));
    assert.equal(putovi.length, 2, 'zabrana nije skinuta posle neuspele oznake');
  });

  test('ponistavanje skida i oznaku i zabranu, BEZ lozinke', async () => {
    /* Ko je upravo primio obavestenje da mu je neko obrisao naloge mora da ih
       vrati bez ijedne prepreke. Vracanje na staro nije razorna radnja. */
    const pozivi = stub(VLASNIK);
    const res = await zovi({ admin: 'ponisti', obrisiId: 'k1' });
    assert.equal(res.code, 200);
    assert.ok(pozivi.some(x => x.startsWith('DELETE') && x.includes('nalog_za_brisanje')), 'oznaka nije uklonjena');
    assert.ok(pozivi.some(x => x.startsWith('PUT') && x.includes('/auth/v1/admin/users/')), 'zabrana nije skinuta');
  });

  test('NALAZ B-1: bez oznake za brisanje, `ponisti` ne skida zabranu', async () => {
    /* Ova grana namerno nema drugi faktor — oporavak mora da bude bez trenja.
       Ali PostgREST-u je DELETE koji ne nađe nijedan red uspeh (204), pa je
       bezuslovno skidanje zabrane ispod njega značilo da poziv sa proizvoljnim
       id-em skida zabranu sa BILO KOG naloga, uključujući onaj zabranjen zbog
       zloupotrebe. Napadaču sa vlasnikovom sesijom je to bio jedini razoran
       potez bez lozinke — a suprotan smer (`ban` sa `ukini:true`) lozinku traži. */
    oznakaPrazna = true;
    try {
      const pozivi = stub(VLASNIK);
      const res = await zovi({ admin: 'ponisti', obrisiId: 'ma-koji-zabranjen' });
      assert.equal(res.code, 404, 'poništavanje bez oznake je prošlo kao uspeh');
      assert.equal(pozivi.filter(x => x.startsWith('PUT') && x.includes('/auth/v1/admin/users/')).length, 0,
        'zabrana je skinuta iako nalog nije bio označen za brisanje');
    } finally { oznakaPrazna = false; }
  });

  /* NALAZ A-1 — pogrešna lozinka mora da se BROJI i da se PRIJAVI.

     Bilo je: prvo lozinka, pa brojač, pa (posle uspeha) mejl. Sva tri sloja su
     radila, ali tek posle TAČNE lozinke — pa pogrešna nije trošila ništa, nije
     slala ništa i nije ostavljala trag. Napadač sa ukradenom vlasnikovom
     sesijom, dakle upravo onaj zbog kog drugi faktor postoji, imao je onoliko
     pokušaja koliko mu treba.

     Zato se meri BROJANJE i PRIJAVA na neuspehu, a ne samo to da neuspeh
     vrati 401. Poređenje konstantnog trajanja štiti od merenja vremena, ne od
     broja pokušaja. */
  test('NALAZ A-1: pogrešna lozinka troši brojač pokušaja', async () => {
    for (const radnja of [{ admin: 'obrisi', obrisiId: 'k1' }, { admin: 'ban', banId: 'k1' }]) {
      const pozivi = stub(VLASNIK);
      const res = await zovi({ ...radnja, lozinka: 'pogresna-lozinka-xx' });
      assert.equal(res.code, 401, JSON.stringify(radnja) + ' nije odbijena');
      const brojanja = pozivi.filter(x => x.includes('check_and_bump_endpoint'));
      assert.ok(brojanja.length > 0,
        'pogrešan pokušaj (' + radnja.admin + ') nije izbrojan — lozinka se pogađa bez ograničenja');
    }
  });

  test('NALAZ A-1: pogrešna lozinka šalje mejl vlasniku', async () => {
    for (const radnja of [{ admin: 'obrisi', obrisiId: 'k1' }, { admin: 'ban', banId: 'k1' }]) {
      const pozivi = stub(VLASNIK);
      await zovi({ ...radnja, lozinka: 'pogresna-lozinka-xx' });
      assert.ok(pozivi.some(x => x.includes('api.resend.com')),
        'napad grubom silom na drugi faktor prolazi nemo — vlasnik ne sazna ništa');
    }
  });

  test('NALAZ A-1: sama lozinka NIKAD ne ide u mejl', async () => {
    /* Poslala bi napadačev pokušaj u sanduče — a pri promašaju za jedan znak i
       samu pravu lozinku. */
    let telo = '';
    const pozivi = stub(VLASNIK);
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url, opt) => {
      if (String(url).includes('api.resend.com')) telo += String((opt && opt.body) || '');
      return origFetch(url, opt);
    };
    await zovi({ admin: 'obrisi', obrisiId: 'k1', lozinka: 'tajna-koja-ne-sme-da-izadje' });
    assert.ok(telo.length > 0, 'mejl nije ni poslat — druga zamka pokriva to');
    assert.ok(!telo.includes('tajna-koja-ne-sme-da-izadje'), 'pokušana lozinka je poslata mejlom');
    assert.ok(!telo.includes(LOZ), 'prava lozinka je poslata mejlom');
  });

  test('NALAZ A-1: brojač pokušaja se troši i kad je lozinka TAČNA', async () => {
    /* Da se troši samo na neuspeh, napadač bi imao neograničeno mnogo neuspelih
       pokušaja — brojač bi merio nešto što nije napad. */
    const pozivi = stub(VLASNIK);
    await zovi({ admin: 'ban', banId: 'k1', lozinka: LOZ });
    const brojanja = pozivi.filter(x => x.includes('check_and_bump_endpoint'));
    assert.ok(brojanja.length >= 2,
      'uspešna radnja troši samo brojač radnji, ne i brojač pokušaja: ' + brojanja.length);
  });

  test('zabrana i skidanje zabrane idu na isti nalog', async () => {
    /* GoTrue nema zasebnu „unban" putanju — skidanje je ista izmena sa
       ban_duration:'none'. Test cuva da se te dve stvari ne raziđu. */
    let poslato = null;
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return jsonRes(VLASNIK);
      if (/\/auth\/v1\/admin\/users\//.test(u) && opt && opt.method === 'PUT') {
        poslato = JSON.parse(opt.body);
        return jsonRes({ id: 'k1', email: 'prvi@t.rs' });
      }
      if (u.includes('/rest/v1/rpc/check_and_bump_endpoint')) return jsonRes(1);
      if (u.includes('api.resend.com')) return jsonRes({ id: 'mejl' });
      throw new Error('neocekivan poziv: ' + u);
    };
    let res = await zovi({ admin: 'ban', banId: 'k1', lozinka: ENV.ADMIN_2FA });
    assert.equal(res.code, 200);
    assert.equal(res.body.zabranjen, true);
    assert.notEqual(poslato.ban_duration, 'none', 'zabrana je poslata kao skidanje');

    res = await zovi({ admin: 'ban', banId: 'k1', ukini: true, lozinka: ENV.ADMIN_2FA });
    assert.equal(res.code, 200);
    assert.equal(res.body.zabranjen, false);
    assert.equal(poslato.ban_duration, 'none', 'skidanje zabrane nije poslato kao none');
  });

  test('vlasnik NE moze sebe da zabrani', async () => {
    /* Isti razlog kao kod brisanja: zakljucao bi se van sopstvene aplikacije. */
    const pozivi = stub(VLASNIK);
    const res = await zovi({ admin: 'ban', banId: 'v1' });
    assert.equal(res.code, 400);
    assert.equal(pozivi.filter(x => x.startsWith('PUT')).length, 0);
  });

  test('spisak pokazuje ko je zabranjen', async () => {
    /* `banned_until` posle skidanja zabrane ume da ostane kao datum u
       PROSLOSTI, zavisno od verzije GoTrue-a — zato se poredi sa sadasnjim
       trenutkom, a ne samo proverava postojanje polja. */
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return jsonRes(VLASNIK);
      if (u.includes('/auth/v1/admin/users')) return jsonRes([
        { id: 'a', email: 'a@t.rs', banned_until: '2099-01-01T00:00:00Z' },
        { id: 'b', email: 'b@t.rs', banned_until: '2020-01-01T00:00:00Z' },
        { id: 'c', email: 'c@t.rs', banned_until: null }
      ]);
      if (u.includes('/rest/v1/user_state')) return jsonRes([]);
      throw new Error('neocekivan poziv: ' + u);
    };
    const k = (await zovi({ admin: 'lista' })).body.korisnici;
    assert.equal(k.find(x => x.id === 'a').zabranjen, true, 'aktivna zabrana nije prikazana');
    assert.equal(k.find(x => x.id === 'b').zabranjen, false, 'istekla zabrana je prikazana kao aktivna');
    assert.equal(k.find(x => x.id === 'c').zabranjen, false);
  });

  /* ---------- TRI SLOJA OKO RAZORNIH RADNJI ----------
     Ko preuzme vlasnikov Google nalog dobija spisak svih e-adresa i, do sada,
     mogucnost da svakome obrise nalog jednim pozivom. Ove zamke cuvaju da
     nijedan od tri sloja ne otkaze U POGRESNOM SMERU. */

  test('bez lozinke se razorne radnje ODBIJAJU', async () => {
    for (const telo of [{ admin: 'obrisi', obrisiId: 'k1' }, { admin: 'ban', banId: 'k1' }]) {
      stub(VLASNIK);
      const res = await zovi(telo);
      assert.equal(res.code, 401, `${telo.admin} je prosao bez lozinke`);
    }
  });

  test('pogresna lozinka ne prolazi', async () => {
    stub(VLASNIK);
    const res = await zovi({ admin: 'obrisi', obrisiId: 'k1', lozinka: 'skoro-tacna-lozinka' });
    assert.equal(res.code, 401);
  });

  test('kad ADMIN_2FA nije podesen, radnje se ODBIJAJU — ne propustaju', async () => {
    /* Bezbednosna provera koja se sama iskljuci kad nije podesena ne stiti ni
       od cega, a izgleda kao da stiti. Ovo je najvaznija od cetiri zamke. */
    const staro = process.env.ADMIN_2FA;
    delete process.env.ADMIN_2FA;
    try {
      const pozivi = stub(VLASNIK);
      const res = await zovi({ admin: 'obrisi', obrisiId: 'k1', lozinka: 'bilo sta' });
      assert.equal(res.code, 500);
      assert.match(res.body.error, /ADMIN_2FA/);
      assert.equal(pozivi.filter(x => x.includes('nalog_za_brisanje')).length, 0,
        'nalog je oznacen iako drugi faktor nije podesen');
    } finally { process.env.ADMIN_2FA = staro; }
  });

  test('kad brojac ogranicenja ne radi, radnja se ODBIJA', async () => {
    /* Suprotno od limitPrekoracen u api/analyze.js, koja namerno PROPUSTA:
       tamo limit ne sme da obori analizu, ovde je limit granica stete i brojac
       koji ne radi znaci da granice nema. */
    const pozivi = stub(VLASNIK, { brojacPada: true });
    const res = await zovi({ admin: 'obrisi', obrisiId: 'k1', lozinka: ENV.ADMIN_2FA });
    assert.equal(res.code, 503);
    assert.equal(pozivi.filter(x => x.includes('nalog_za_brisanje')).length, 0);
  });

  test('brojac se gadja VLASNIKOVIM tokenom, ne service_role kljucem', async () => {
    /* Brojac broji po auth.uid(). Sa service_role kljucem je auth.uid() null,
       pa brojanje nema kome da se pripise i limit tiho ne postoji. */
    let zaglavlje = null;
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return jsonRes(VLASNIK);
      if (u.includes('/rest/v1/rpc/check_and_bump_endpoint')) {
        zaglavlje = (opt.headers || {}).Authorization;
        return jsonRes(1);
      }
      if (/\/auth\/v1\/admin\/users\//.test(u)) return jsonRes({ id: 'k1', email: 'prvi@t.rs' });
      if (u.includes('nalog_za_brisanje')) return jsonRes([]);
      if (u.includes('api.resend.com')) return jsonRes({ id: 'm' });
      throw new Error('neocekivan poziv: ' + u);
    };
    const res = await zovi({ admin: 'obrisi', obrisiId: 'k1', lozinka: ENV.ADMIN_2FA });
    assert.equal(res.code, 200);
    assert.equal(zaglavlje, 'Bearer t', `brojac je gadjan sa: ${zaglavlje}`);
    assert.notEqual(zaglavlje, 'Bearer srv', 'brojac je gadjan service_role kljucem');
  });

  test('vlasnik dobije mejl o svakoj razornoj radnji', async () => {
    /* Ako ovo stigne a ti nisi nista radio, znas u istom minutu. */
    const pozivi = stub(VLASNIK);
    await zovi({ admin: 'obrisi', obrisiId: 'k1', lozinka: ENV.ADMIN_2FA });
    assert.ok(pozivi.some(x => x.includes('api.resend.com')), 'obavestenje nije poslato');
  });

  test('neuspelo obavestenje NE obara radnju', async () => {
    /* Mejl koji ne prodje ne sme da pretvori obavljenu radnju u gresku —
       covek bi je ponovio misleci da nije prosla. */
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return jsonRes(VLASNIK);
      if (u.includes('/rest/v1/rpc/check_and_bump_endpoint')) return jsonRes(1);
      if (/\/auth\/v1\/admin\/users\//.test(u)) return jsonRes({ id: 'k1', email: 'prvi@t.rs' });
      if (u.includes('nalog_za_brisanje')) return jsonRes([]);
      if (u.includes('api.resend.com')) throw new Error('Resend pao');
      throw new Error('neocekivan poziv: ' + u);
    };
    const res = await zovi({ admin: 'obrisi', obrisiId: 'k1', lozinka: ENV.ADMIN_2FA });
    assert.equal(res.code, 200, 'radnja je prijavljena kao neuspela zbog mejla');
  });

  test('izazov i spisak NE traze lozinku', async () => {
    /* Drugi faktor stiti od nepovratnog. Da se trazi i za citanje spiska,
       vlasnik bi ga kucao svaki put i naucio da ga kuca bez razmisljanja —
       cime prestaje da bude drugi faktor. */
    stub(VLASNIK);
    assert.equal((await zovi({ admin: 'lista' })).code, 200);
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return jsonRes(VLASNIK);
      if (u.includes('zajednica_izazov')) return jsonRes([{ id: 1, tekst: 'x' }]);
      throw new Error('neocekivan poziv: ' + u);
    };
    assert.equal((await zovi({ admin: 'izazov', tekst: 'Novi izazov nedelje' })).code, 200);
  });

  test('aplikacija salje lozinku uz razorne radnje, i NE cuva je', () => {
    /* Da se lozinka pamti u localStorage-u, stajala bi na istom uredjaju kao i
       sesija — a ceo smisao drugog faktora je da napadac sa ukradenom sesijom
       nema i njega. */
    const klijent = readRepoFile('app.js');
    for (const radnja of ["admin:'obrisi'", "admin:'ban'"]) {
      const m = new RegExp(radnja.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "[^}]*lozinka:ADMIN_LOZ");
      assert.match(klijent, m, `${radnja} se salje bez lozinke`);
    }
    assert.match(klijent, /let ADMIN_LOZ = '';/, 'lozinka se ne drzi u promenljivoj');
    assert.ok(!/localStorage[^\n]*ADMIN_LOZ|ADMIN_LOZ[^\n]*localStorage/.test(klijent),
      'lozinka se upisuje u localStorage');
    /* Ponistavanje NE sme da trazi lozinku — v. serverski test iznad. */
    assert.ok(!/admin:'ponisti'[^}]*lozinka/.test(klijent),
      'ponistavanje trazi lozinku, iako nije razorna radnja');
  });

  test('spisak tabela je ISTI kao u delete-account.js', () => {
    /* Dva mesta brisu isti skup podataka. Kad se raziđu, jedna putanja ostavi
       redove koje druga uklanja — i to se ne vidi ni iz jedne od njih. */
    const izvuci = (src) => (/const TABELE = \[([\s\S]*?)\]/.exec(src)[1].match(/'([a-z_]+)'/g) || [])
      .map(s => s.replace(/'/g, '')).sort();
    assert.deepEqual(izvuci(IZVOR), izvuci(readRepoFile('api/delete-account.js')));
  });

  /* ---------- IZAZOV NEDELJE ----------
     Jedini upis u aplikaciji koji menja nesto sto vide SVI korisnici. Tabela
     zajednica_izazov nema politiku za upis, pa je ova putanja jedina — i to
     je tacno ono sto ovi testovi cuvaju. */
  function stubIzazov(korisnik, { padne = false } = {}) {
    const pozivi = [];
    globalThis.fetch = async (url, opt) => {
      const u = String(url), metod = (opt && opt.method) || 'GET';
      pozivi.push({ metod, u, telo: opt && opt.body ? JSON.parse(opt.body) : null });
      if (u.includes('/auth/v1/user')) {
        return korisnik ? jsonRes(korisnik) : jsonRes({ error: 'nema' }, false, 401);
      }
      if (u.includes('/rest/v1/zajednica_izazov')) {
        return padne ? jsonRes({ error: 'ne' }, false, 500) : jsonRes([{ id: 1, tekst: 'x' }]);
      }
      throw new Error('neocekivan poziv: ' + u);
    };
    return pozivi;
  }

  test('izazov menja SAMO vlasnik — tudj token dobija 404, ne 403', async () => {
    /* 403 bi bio potvrda da putanja postoji. Isto pravilo kao za spisak. */
    stubIzazov({ id: 'k9', email: 'neko@drugi.rs', email_confirmed_at: '2026-01-01' });
    const res = await zovi({ admin: 'izazov', tekst: 'Moj izazov svima' });
    assert.equal(res.code, 404);
  });

  test('CRON_SECRET ne sme da promeni izazov', async () => {
    /* Zakazani posao sme da posalje obavestenje; ne sme da prepise tekst koji
       svi vide. Kapija admin grane namerno NE gleda tajnu. */
    /* Tajna se salje TACNO onako kako je kod cita: `Authorization: Bearer`.
       Prva verzija ovog testa slala je zaglavlje `x-cron-secret`, koje kod
       uopste ne gleda — pa je test prolazio i kad kapija propusti cron. */
    stubIzazov(null);
    const res = await zovi({ admin: 'izazov', tekst: 'Podmetnuto' },
      { headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ENV.CRON_SECRET } });
    assert.equal(res.code, 404);
  });

  test('vlasnik upisuje, i to u red broj 1', async () => {
    const pozivi = stubIzazov(VLASNIK);
    const res = await zovi({ admin: 'izazov', tekst: 'Odradi sve treninge po planu.' });
    assert.equal(res.code, 200);
    const upis = pozivi.find(x => x.u.includes('zajednica_izazov') && x.metod === 'POST');
    assert.ok(upis, 'nije bilo upisa');
    assert.equal(upis.telo.id, 1, 'upisuje se u neki drugi red, a red je samo jedan');
    assert.equal(upis.telo.tekst, 'Odradi sve treninge po planu.');
  });

  test('predugacak i prekratak tekst se odbijaju PRE upisa', async () => {
    /* Baza to ionako odbija (`check`), ali bi covek dobio sirovu gresku iz
       Postgresa umesto recenice — i to tek posle poziva. */
    for (const [tekst, sta] of [['', 'prazan'], ['ab', 'dva znaka'], ['x'.repeat(161), '161 znak']]) {
      const pozivi = stubIzazov(VLASNIK);
      const res = await zovi({ admin: 'izazov', tekst });
      assert.equal(res.code, 400, `${sta} je prosao`);
      assert.ok(!pozivi.some(x => x.u.includes('zajednica_izazov')), `${sta}: ipak je gadjana baza`);
    }
  });

  test('granice teksta su iste kao `check` u supabase/zajednica.sql', async () => {
    const sql = readRepoFile('supabase/zajednica.sql');
    const m = /char_length\(btrim\(tekst\)\) between (\d+) and (\d+)/.exec(sql);
    assert.ok(m, 'ne nalazim ogranicenje teksta u zajednica.sql');
    const uKodu = /tekst\.length < (\d+) \|\| tekst\.length > (\d+)/.exec(IZVOR);
    assert.ok(uKodu, 'ne nalazim proveru duzine u broadcast.js');
    assert.equal(uKodu[1], m[1], 'donja granica se razisla');
    assert.equal(uKodu[2], m[2], 'gornja granica se razisla');
  });

  test('kad baza odbije upis, to se ne prijavljuje kao uspeh', async () => {
    stubIzazov(VLASNIK, { padne: true });
    const res = await zovi({ admin: 'izazov', tekst: 'Nesto sasvim novo' });
    assert.equal(res.code, 502);
  });
});

/* OBJAVA — tekst mejla i push poruke kao parametar.

   Do sada je tekst bio ugrađen u `telo()`, pa je svaka nova objava značila
   prepisivanje te funkcije: stari tekst bi nestao i posle se ne bi znalo šta
   je kome poslato. Ovde se meri ono što se pri toj promeni najlakše pokvari —
   da pogrešno ime ne pošalje ništa, i da nastavak slanja ne pređe na drugi
   tekst na pola posla. */
describe('/api/broadcast — koji tekst se šalje', () => {
  function stub(poslato) {
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/admin/users')) {
        const page = +(u.match(/[?&]page=(\d+)/) || [])[1];
        return jsonRes(page === 1 ? [{ email: 'a@t.rs' }, { email: 'b@t.rs' }] : []);
      }
      if (u.includes('/auth/v1/user')) return jsonRes({ id: 'u1', email: ENV.ADMIN_EMAIL });
      if (u.includes('api.resend.com')) { poslato.push(JSON.parse(opt.body)); return jsonRes({ id: 'm' }); }
      throw new Error('neočekivan poziv: ' + u);
    };
  }
  const zovi = async body => {
    const { default: handler } = await import('../api/broadcast.js?t=' + Date.now() + Math.random());
    const poslato = []; stub(poslato);
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer tajna' }, body }, res);
    return { res, poslato };
  };

  test('bez `poruka` ostaje uputstvo — stariji poziv ne menja značenje', async () => {
    const { res } = await zovi({});
    assert.equal(res.code, 200);
    assert.equal(res.body.poruka, 'uputstvo');
    assert.match(res.body.naslov, /uputstvo/i);
  });

  test('imenovana poruka menja i naslov i telo', async () => {
    const { res, poslato } = await zovi({ posalji: true, poruka: 'zajednica' });
    assert.equal(res.code, 200);
    assert.equal(poslato.length, 2);
    assert.match(poslato[0].subject, /Zajednica/);
    assert.match(poslato[0].html, /Zajednica/);
    assert.doesNotMatch(poslato[0].html, /uputstvo za aplikaciju/,
      'telo je ostalo staro iako je naslov nov');
  });

  test('nepoznato ime NE ŠALJE NIŠTA — ni pod „pa vrati se na podrazumevano"', async () => {
    /* Slanje pogrešnog teksta hiljadi ljudi se ne može opozvati, pa jedno
       slovo u imenu mora da bude greška, a ne tiho slanje uputstva. */
    const { res, poslato } = await zovi({ posalji: true, poruka: 'zajednicaa' });
    assert.equal(res.code, 400);
    assert.deepEqual(poslato, [], 'poslalo je uprkos nepoznatom imenu');
    assert.ok(Array.isArray(res.body.poznate) && res.body.poznate.includes('zajednica'),
      'greška ne kaže koja imena postoje');
  });

  test('odgovor vraća ime poruke, da nastavak ne pređe na drugi tekst', async () => {
    /* Slanje ide u više poziva. Da se ime ne vraća, drugi poziv bi bez njega
       poslao uputstvo ostatku ljudi — a prva polovina bi već imala objavu. */
    const { res } = await zovi({ posalji: true, poruka: 'zajednica' });
    assert.equal(res.body.poruka, 'zajednica');
  });

  test('suvi poziv pokazuje pravo telo, ne samo naslov', async () => {
    const { res, poslato } = await zovi({ poruka: 'zajednica' });
    assert.equal(res.body.probno, true);
    assert.deepEqual(poslato, []);
    assert.match(String(res.body.primer), /Zajednica/);
    /* Ono što se u objavi obećava mora i da piše u njoj: da ništa od merenja
       ne izlazi iz naloga. */
    assert.match(String(res.body.primer), /HRV/);
  });
});

/* JEDNOKRATNI PUSH SVIMA (/api/push {akcija:'objava'}).

   Jutarnji podsetnik ide svima, ali uvek o planu. Ovo je isti obilazak
   pretplata sa tekstom kao parametrom — i sa UŽOM kapijom: samo vlasnik,
   nikad CRON_SECRET. Zakazan posao sme da pošalje podsetnik; ne sme svima da
   pošalje proizvoljan tekst. */
describe('/api/push {akcija:"objava"} — kapija i slanje', () => {
  const IZVOR = readRepoFile('api/push.js');

  /* Par ključeva SAMO ZA TEST — bez pravog para push telo ne može da se
     šifruje, pa bi slanje „palo" iz razloga koji nema veze sa objavom.
     Sama kriptografija se proverava u test/push.test.mjs, gde se poslato i
     dešifruje; ovde je samo da petlja stigne do kraja. */
  const VAPID = {
    VAPID_PUBLIC_KEY: 'BKehPjxi6lJF9-yuESqsl5DQ8rqsfWJcvHnCKYrGqkn83dNsWyvT_ve7_R_HufZ8kqWf9rdUfPw9d9aKfW6Rda8',
    VAPID_PRIVATE_KEY: 'MJ0ol-TwaRrXjQyblH4pmmsZSncM0Ig-pPQQziVb4WM',
    VAPID_SUBJECT: 'mailto:a@b.c'
  };
  const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const pretplatnik = () => {
    const e = createECDH('prime256v1'); e.generateKeys();
    return { p256dh: b64u(e.getPublicKey()), auth: b64u(randomBytes(16)) };
  };
  beforeEach(() => { for (const k of Object.keys(VAPID)) process.env[k] = VAPID[k]; });
  afterEach(() => { for (const k of Object.keys(VAPID)) delete process.env[k]; });

  function stub(poslato, korisnik) {
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return jsonRes(korisnik);
      if (u.includes('push_pretplata')) {
        if (opt && opt.method === 'DELETE') return jsonRes({});
        if (/id=gt\./.test(u)) return jsonRes([]);
        return jsonRes([
          Object.assign({ id: 1, user_id: 'a', endpoint: 'https://fcm.googleapis.com/fcm/send/1' }, pretplatnik()),
          Object.assign({ id: 2, user_id: 'b', endpoint: 'https://fcm.googleapis.com/fcm/send/2' }, pretplatnik())
        ]);
      }
      if (u.startsWith('https://fcm.googleapis.com/fcm/send/')) { poslato.push(u); return { ok: true, status: 201 }; }
      throw new Error('neočekivan poziv: ' + u);
    };
  }
  const zovi = async (body, korisnik = { id: 'v', email: ENV.ADMIN_EMAIL, email_confirmed_at: '2026-01-01' }) => {
    const { default: handler } = await import('../api/push.js?t=' + Date.now() + Math.random());
    const poslato = []; stub(poslato, korisnik);
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body }, res);
    return { res, poslato };
  };

  test('tuđ nalog dobija 404, ne 403 — i ne šalje ništa', async () => {
    /* „Zabranjeno" je potvrda da putanja postoji. */
    const { res, poslato } = await zovi({ akcija: 'objava', objava: 'zajednica', posalji: true },
      { id: 'x', email: 'neko@drugi.rs', email_confirmed_at: '2026-01-01' });
    assert.equal(res.code, 404);
    assert.deepEqual(poslato, []);
  });

  test('NEPOTVRĐENA adresa vlasnika ne prolazi', async () => {
    /* Supabase izda token sa nepotvrđenom adresom ako je Email provider
       uključen a potvrda isključena — pa bi neko ko se registruje vlasnikovom
       adresom, bez pristupa njoj, poslao obaveštenje svim korisnicima. */
    const { res, poslato } = await zovi({ akcija: 'objava', objava: 'zajednica', posalji: true },
      { id: 'v', email: ENV.ADMIN_EMAIL, email_confirmed_at: null, confirmed_at: null });
    assert.equal(res.code, 404);
    assert.deepEqual(poslato, []);
  });

  test('CRON_SECRET NE otvara objavu — samo jutarnji podsetnik', async () => {
    const { default: handler } = await import('../api/push.js?t=' + Date.now() + Math.random());
    const poslato = []; stub(poslato, { id: 'x', email: 'niko@t.rs' });
    const res = makeRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer ' + ENV.CRON_SECRET },
      body: { akcija: 'objava', objava: 'zajednica', posalji: true } }, res);
    assert.equal(res.code, 404, 'zakazan posao može svima da pošalje proizvoljan tekst');
    assert.deepEqual(poslato, []);
  });

  test('bez `posalji` je suv poziv — pokaže tekst, ne pošalje', async () => {
    const { res, poslato } = await zovi({ akcija: 'objava', objava: 'zajednica' });
    assert.equal(res.code, 200);
    assert.equal(res.body.probno, true);
    assert.match(res.body.poruka.naslov, /Zajednica/);
    assert.deepEqual(poslato, [], 'suv poziv je ipak poslao');
  });

  test('nepoznata objava ne šalje ništa', async () => {
    const { res, poslato } = await zovi({ akcija: 'objava', objava: 'nema-je', posalji: true });
    assert.equal(res.code, 400);
    assert.deepEqual(poslato, []);
    assert.ok(res.body.poznate.includes('zajednica'));
  });

  test('šalje svakom uređaju i vraća broj', async () => {
    const { res, poslato } = await zovi({ akcija: 'objava', objava: 'zajednica', posalji: true });
    assert.equal(res.code, 200);
    assert.equal(res.body.poslato, 2);
    assert.deepEqual(poslato.slice().sort(), ['https://fcm.googleapis.com/fcm/send/1', 'https://fcm.googleapis.com/fcm/send/2']);
  });

  test('nastavak ide po id-u, ne po poziciji u listi', async () => {
    /* Pozicija bi se pomerila čim se između dva poziva prijavi nov uređaj, pa
       bi tačno jedan čovek bio TIHO preskočen. */
    assert.match(IZVOR, /id=gt\./, 'nastavak ne filtrira po id-u');
    assert.doesNotMatch(IZVOR, /objavaSvima[\s\S]{0,900}?offset=/i,
      'objava se nastavlja po pomeraju u listi');
  });

  test('objava ne gleda `najave` — to je raspored plana, ne pristanak', async () => {
    /* „Danas nema treninga" nije razlog da čovek ne sazna da postoji nov
       ekran. Ko obaveštenja ne želi, nema pretplatu pa ga ovde ni nema. */
    const blok = /async function objavaSvima[\s\S]*?\n}/.exec(IZVOR)[0];
    assert.doesNotMatch(blok, /najave/, 'objava se filtrira po rasporedu plana');
  });
});

/* NALAZ L-1 — OAuth putanje bez limita.

   `supabase/rate-limit.sql` postoji doslovno zato što jedan prijavljen korisnik
   može u petlji da gađa spoljni servis SA NAŠE IP ADRESE, a posledice snosi
   vlasnik. `api/icu.js` je tu odbranu dobio; `/api/auth` i `/api/icu-oauth`
   nisu — a one uz to troše i naš `client_secret`.

   Ne dobija tuđe podatke. Dobija iscrpljenu kvotu naše Strava aplikacije i
   blokadu našeg `client_id`-a, čime sinhronizacija prestaje da radi SVIMA.

   NALAZ P-3 je u istom bloku: `SETTINGS:WRITE` se tražio a nije se koristio. */
describe('NALAZ L-1 i P-3 — limiti na OAuth putanjama i najmanja dozvola', () => {
  function stub(trag, limitPrekoracen = false) {
    globalThis.fetch = async url => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return jsonRes({ id: 'k1', email: 'obican@t.rs' });
      if (u.includes('/rest/v1/rpc/check_and_bump_endpoint')) {
        trag.brojac++;
        return limitPrekoracen
          ? jsonRes({ code: 'P0001', message: 'DAILY_LIMIT_EXCEEDED' }, false, 400)
          : jsonRes(1);
      }
      if (u.includes('strava.com/oauth/token')) { trag.spolja++; return jsonRes({ access_token: 'x', refresh_token: 'y', expires_at: 1 }); }
      if (u.includes('intervals.icu/api/oauth/token')) {
        trag.spolja++; return jsonRes({ access_token: 'x', athlete: { id: 1, name: 'n' } });
      }
      throw new Error('neočekivan poziv: ' + u);
    };
  }
  const zoviAuth = async (trag, over = {}) => {
    const { default: h } = await import('../api/auth.js?t=' + Date.now() + Math.random());
    const res = makeRes();
    await h({ method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: { refresh_token: 'rt' }, ...over }, res);
    return res;
  };
  const zoviIcu = async () => {
    const { default: h } = await import('../api/icu-oauth.js?t=' + Date.now() + Math.random());
    const res = makeRes();
    await h({ method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: { code: 'abcdefghij' } }, res);
    return res;
  };

  test('/api/auth broji svaki poziv ka Stravi', async () => {
    const trag = { brojac: 0, spolja: 0 };
    stub(trag);
    const res = await zoviAuth(trag);
    assert.equal(res.code, 200);
    assert.equal(trag.brojac, 1, 'poziv ka Stravi našim client_secret-om nije izbrojan');
  });

  test('/api/auth vraća 429 kad je limit dostignut, i NE zove Stravu', async () => {
    const trag = { brojac: 0, spolja: 0 };
    stub(trag, true);
    const res = await zoviAuth(trag);
    assert.equal(res.code, 429);
    assert.equal(trag.spolja, 0, 'Strava je pozvana iako je limit dostignut');
  });

  test('/api/icu-oauth broji razmenu koda', async () => {
    const trag = { brojac: 0, spolja: 0 };
    stub(trag);
    const res = await zoviIcu();
    assert.equal(res.code, 200);
    assert.equal(trag.brojac, 1, 'razmena koda nije izbrojana');
  });

  test('/api/icu-oauth vraća 429 kad je limit dostignut, i NE zove intervals.icu', async () => {
    const trag = { brojac: 0, spolja: 0 };
    stub(trag, true);
    const res = await zoviIcu();
    assert.equal(res.code, 429);
    assert.equal(trag.spolja, 0, 'intervals.icu je pozvan iako je limit dostignut');
  });

  test('brojač koji ne radi PROPUŠTA — ovo nije razorna radnja', async () => {
    /* Suprotno od admin radnji u broadcast.js, gde brojač koji ne radi znači da
       granice nema pa se radnja odbija. Ovde bi odbijanje oborilo prijavu na
       Stravu zbog baze — a SQL možda još nije ni pušten. */
    const trag = { brojac: 0, spolja: 0 };
    globalThis.fetch = async url => {
      const u = String(url);
      if (u.includes('/auth/v1/user')) return jsonRes({ id: 'k1', email: 'o@t.rs' });
      if (u.includes('/rest/v1/rpc/')) throw new Error('baza nedostupna');
      if (u.includes('strava.com/oauth/token')) { trag.spolja++; return jsonRes({ access_token: 'x' }); }
      throw new Error('neočekivan poziv: ' + u);
    };
    const res = await zoviAuth(trag);
    assert.equal(res.code, 200, 'otkaz brojača je oborio osvežavanje Strava tokena');
    assert.equal(trag.spolja, 1);
  });

  test('NALAZ P-3: ne traži se dozvola koja se ne koristi', async () => {
    const izvor = readRepoFile('api/icu-oauth.js');
    const m = /const SCOPE = '([^']*)'/.exec(izvor);
    assert.ok(m, 'nema SCOPE u icu-oauth.js');
    const opsezi = m[1].split(',');
    /* Za svaku traženu dozvolu mora da postoji poziv koji je koristi. */
    const svudje = ['api/icu.js', 'api/icu-oauth.js', 'app.js'].map(readRepoFile).join('\n');
    if (opsezi.includes('SETTINGS:WRITE')) {
      assert.match(svudje, /sport-settings|athlete\/[^'"]*\/settings/,
        'SETTINGS:WRITE se traži od korisnika, a nijedan poziv ga ne koristi');
    }
    assert.ok(opsezi.includes('ACTIVITY:READ') && opsezi.includes('WELLNESS:READ')
      && opsezi.includes('CALENDAR:WRITE'), 'nedostaje dozvola koja se STVARNO koristi: ' + m[1]);
  });
});

/* POLITIKA PRIVATNOSTI MORA DA OPISUJE SVET KOJI POSTOJI.

   Ovo nisu tehnički propusti nego netačne izjave prema korisniku — i, za razliku
   od koda, ništa ih ne otkriva samo od sebe. Zato se ovde politika poredi sa
   kodom, u OBA smera:

     P-1  Politika je za Gemini pisala „sažetak trčanja bez imena i bez
          e-adrese". Stvarno se šalju i HRV, puls u miru, san i svežina — a kod
          trend-analize do 90 dana tih merenja i beleške sa treninga. Uz to,
          `api/analyze.js` sam u zaglavlju kaže da Google na besplatnom nivou
          koristi sadržaj zahteva i odgovora; politika to nije pominjala.
     P-2  Politika je pisala „podacima pristupaš samo ti", a `/api/daily-report`
          svakog jutra service_role ključem čita stanje SVAKOG korisnika i
          vlasniku šalje tabelu sa e-adresom, kilometražom i imenom sa Strave.
     P-3  Tražio se `SETTINGS:WRITE` koji nijedan poziv ne koristi, a politika je
          tvrdila da se koristi za upis praga tempa.

   Zamka gleda ono što se lako raziđe: kad kod počne da šalje nov podatak spolja,
   politika mora da se pomeri sa njim. */
describe('Politika privatnosti prati serverski kod', () => {
  const PRIVACY = readRepoFile('privacy.html');

  test('NALAZ P-1: red o Gemini-ju pominje jutarnja merenja', () => {
    const analyze = readRepoFile('api/analyze.js');
    /* Prvo se potvrdi da kod to STVARNO šalje — inače zamka meri zastarelu
       pretpostavku i tiho prestane da vredi. */
    assert.match(analyze, /Oporavak tog jutra/, 'analyze.js više ne šalje oporavak — zamka je zastarela');
    assert.match(analyze, /OPORAVAK PO DANIMA/, 'analyze.js više ne šalje istoriju oporavka');

    for (const jezik of [/Google \(Gemini\)<\/td><td>([^<]*(?:<b>[^<]*<\/b>[^<]*)*)</g]) {
      const redovi = [...PRIVACY.matchAll(jezik)].map(m => m[1]);
      assert.ok(redovi.length >= 2, `red o Gemini-ju ne postoji na oba jezika: ${redovi.length}`);
      for (const r of redovi)
        assert.match(r, /HRV/, `politika kaže da Gemini dobija samo „${r.trim().slice(0, 60)}", a dobija i jutarnja merenja`);
    }
  });

  test('NALAZ P-1: politika pominje besplatan nivo Gemini-ja', () => {
    const analyze = readRepoFile('api/analyze.js');
    assert.match(analyze, /besplatn|free tier/i, 'analyze.js više ne pominje nivo — zamka je zastarela');
    assert.match(PRIVACY, /besplatnom nivou/, 'srpski deo ne pominje besplatan nivo');
    assert.match(PRIVACY, /free tier/i, 'engleski deo ne pominje besplatan nivo');
  });

  test('NALAZ P-2: dnevni izveštaj vlasniku je objavljen u politici', () => {
    const dr = readRepoFile('api/daily-report.js');
    assert.match(dr, /user_state\?select=user_id,data/, 'daily-report više ne čita sirovo stanje — zamka je zastarela');
    assert.match(dr, /stravaAthlete/, 'daily-report više ne šalje ime sa Strave');
    assert.match(PRIVACY, /Dnevni izveštaj vlasniku/i, 'politika ne opisuje dnevni izveštaj');
    assert.match(PRIVACY, /Daily report to the app owner/i, 'engleski deo ne opisuje dnevni izveštaj');
    /* I da više NE tvrdi suprotno. */
    assert.doesNotMatch(PRIVACY, /pristupaš samo ti/,
      'politika i dalje tvrdi „podacima pristupaš samo ti"');
    assert.doesNotMatch(PRIVACY, /so that only\s*\n?you can read it/,
      'engleski deo i dalje tvrdi „only you can read it"');
  });

  test('NALAZ P-2: izveštaj NE nosi sirovo stanje — i politika to kaže', () => {
    /* Ono što politika obećava mora da bude istina i u kodu: izveštaj su
       izvedeni pokazatelji, ne kopija dnevnika. */
    const dr = readRepoFile('api/daily-report.js');
    for (const polje of ['knee', 'wellness', 'note']) {
      const uHtml = new RegExp('buildHtml[\\s\\S]*?' + polje + '[\\s\\S]{0,40}esc\\(');
      assert.ok(!uHtml.test(dr), `izveštaj iscrtava ${polje} — politika tvrdi da ga nema`);
    }
    assert.match(PRIVACY, /Šta u njemu NE stoji/, 'politika ne kaže šta izveštaj ne sadrži');
  });

  test('NALAZ P-3: svaka tražena intervals.icu dozvola je opisana u politici', () => {
    const m = /const SCOPE = '([^']*)'/.exec(readRepoFile('api/icu-oauth.js'));
    assert.ok(m, 'nema SCOPE u icu-oauth.js');
    for (const opseg of m[1].split(',')) {
      const koliko = (PRIVACY.match(new RegExp('<code>' + opseg.replace(':', ':') + '</code>', 'g')) || []).length;
      assert.ok(koliko >= 2, `dozvola ${opseg} se traži, a nije opisana na oba jezika (nađeno ${koliko})`);
    }
    /* I obrnuto: politika ne sme da opisuje dozvolu koja se ne traži. */
    for (const opseg of ['SETTINGS:WRITE', 'ACTIVITY:WRITE', 'WELLNESS:WRITE']) {
      if (!m[1].includes(opseg))
        assert.ok(!PRIVACY.includes('<code>' + opseg + '</code>'),
          `politika opisuje ${opseg}, a kod ga ne traži`);
    }
  });
});

/* ŠEMA — ONO ŠTO SE VIDI TEK NA PRODUKCIJI.

   `provera.sql` je posle proširenja prijavio dve stvari koje nijedan test nije
   mogao da vidi iz repozitorijuma: `ai_posao` i `push_pretplata` su jedine dve
   tabele bez `revoke … from anon`, i `user_state` je imao tri kompleta politika
   sa istim izrazom. Ovde se čuva prvo — drugo se ne može tvrditi iz fajlova,
   pa ga hvata `provera.sql`. */
describe('Šema — svaka tabela sa podacima uskraćuje pristup anon ključu', () => {
  const SQL = readdirSync(join(ROOT, 'supabase'))
    .filter(f => f.endsWith('.sql') && f !== 'provera.sql')
    .map(f => [f, readFileSync(join(ROOT, 'supabase', f), 'utf8')]);
  const sve = SQL.map(([, s]) => s).join('\n');

  test('svaka tabela koju kod čita ima `revoke … from anon`', () => {
    /* RLS gleda REDOVE; `grant` je sloj ispod njega, i razlika nije teorijska:
       `TRUNCATE` je privilegija nad TABELOM i RLS ga ne dodiruje. */
    const tabele = ['user_state', 'user_state_istorija', 'zajednica_profil',
      'zajednica_izazov', 'push_pretplata', 'ai_posao', 'nalog_za_brisanje',
      'endpoint_usage', 'api_usage', 'bug_report_usage'];
    const bez = tabele.filter(t =>
      !new RegExp('revoke\\s+all\\s+on\\s+(?:table\\s+)?public\\.' + t + '\\b[^;]*from[^;]*anon', 'i').test(sve));
    assert.deepEqual(bez, [], `nema \`revoke … from anon\`: ${bez.join(', ')}`);
  });

  test('svaka tabela koju kod čita ima uključen RLS', () => {
    const tabele = ['user_state', 'user_state_istorija', 'zajednica_profil',
      'zajednica_izazov', 'push_pretplata', 'ai_posao', 'nalog_za_brisanje'];
    const bez = tabele.filter(t =>
      !new RegExp('alter\\s+table\\s+public\\.' + t + '\\s+enable\\s+row\\s+level\\s+security', 'i').test(sve));
    assert.deepEqual(bez, [], `RLS nije uključen u SQL-u: ${bez.join(', ')}`);
  });

  test('provera.sql gleda i grantove i izraze politika, ne samo postojanje', () => {
    /* Ono što je propustilo `using (true)` nad user_state. */
    const p = readRepoFile('supabase/provera.sql');
    assert.match(p, /\bqual\b/, 'provera ne čita izraz politike');
    assert.match(p, /with_check/, 'provera ne čita with_check');
    assert.match(p, /role_table_grants/, 'provera ne gleda grantove za anon');
    assert.match(p, /having count\(\*\) > 1/i, 'provera ne hvata više politika za istu radnju');
  });

  test('namerni izuzeci su IMENOVANI u provera.sql, ne prećutani', () => {
    /* `zajednica_izazov` je jedan red vidljiv svima — to je svrha tabele, pa
       `using (true)` tu jeste ispravno. Ali provera koja viče na namerno stanje
       nauči čoveka da je ignoriše, pa posle propusti i ono pravo. */
    const p = readRepoFile('supabase/provera.sql');
    assert.match(p, /tablename = 'zajednica_izazov' and cmd = 'SELECT'/,
      'izuzetak za izazov nije imenovan — provera će ga prijavljivati kao rupu');
    /* A ono što se STVARNO mora čuvati i dalje se proverava. */
    assert.match(p, /izazov · nijedna politika za upis/,
      'izgubljena je provera da izazov nema politiku za upis');
  });
});
