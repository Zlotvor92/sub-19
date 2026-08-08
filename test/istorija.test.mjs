/* RANIJE VERZIJE — VRAĆANJE UNAZAD SA SERVERA

   Pitanje na koje ovaj skup odgovara: da li backup fajl još štiti od nečega od
   čega server ne štiti?

   Server je do sada bio ogledalo — `user_state` je jedan red koji se prepisuje
   u mestu, pa je verno prenosio i grešku. Sa istorijom verzija to prestaje da
   važi, ali samo ako vraćanje radi TAČNO isto što i „Uzmi sa servera": zadrži
   veze sa Stravom i intervals.icu-om (na serveru stoje bez tokena), propusti
   kroz migraciju, i tek onda zameni stanje. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const DANAS = '2026-08-08T09:00:00Z';
const app = () => loadApp({ now: DANAS });

function prijavljen(a) {
  a.evalIn(`SB.userId='u-1'; SB.access='tok'; SB.refresh='r';
            SB.expiresAt=Date.now()+3600000; SB.deviceId='d1'; navigator.onLine=true;`);
}

/* Stanje kakvo stoji NA SERVERU: prošlo je kroz sbPayload, dakle bez tokena. */
const SERVERSKO = {
  /* NAMERNO nije `n1d1`: ti identifikatori su potpis vlasnikovog seeda
     (STARI_SEED_POTPIS), pa ih `uskladiVlasnickePodatke` čisti iz tuđeg
     naloga. Prva verzija ovog skupa je koristila baš njih i test je padao —
     ali zato što je zaštita RADILA. Za posebnu zamku v. dole. */
  v: 10, log: { 'n5d3': { status: 'done', km: 8, sec: 2400 } },
  knee: [], kg: [], pred: {}, predLock: {}, vdotLog: [], t3k: [], moves: {}, alts: {},
  genPlan: null, wellness: {}, vreme: null, zajed: { vidljiv: false, nadimak: '' },
  strava: { lastSync: 1, athlete: 'A V', scope: 'read' }, icu: { lastSync: 1 }, ui: {}
};

describe('Spisak verzija', () => {

  test('povlači se bez `data` — spisak ne sme da vuče 40 punih stanja', () => {
    /* Jedno stanje je desetine kilobajta. Da spisak nosi i sadržaj, otvaranje
       ekrana bi povuklo nekoliko stotina kilobajta da bi se prikazalo 40
       datuma. Sadržaj se povlači tek za verziju koja se stvarno vraća. */
    const izvor = readRepoFile('app.js');
    const blok = /async function istorijaUcitaj\(\)\{[\s\S]*?\n\}/.exec(izvor);
    assert.ok(blok, 'istorijaUcitaj nije nađena');
    assert.match(blok[0], /select=id,napravljeno,app_version,device_id/,
      'spisak povlači i sadržaj verzija');
    assert.ok(!/select=\*/.test(blok[0]), 'spisak povlači sve kolone');
  });

  test('traži SAMO svoje verzije', () => {
    const a = app();
    prijavljen(a);
    a.setFetch(async () => ({ ok: true, status: 200, json: async () => ([]), text: async () => '' }));
    return a.call('istorijaUcitaj').then(() => {
      const [url] = a.calls.fetches[0];
      assert.match(String(url), /user_id=eq\.u-1/, 'ne ograničava se na sopstveni nalog');
    });
  });

  test('van mreže javi grešku umesto da baci', async () => {
    const a = app();
    prijavljen(a);
    a.setFetch(async () => { throw new TypeError('Failed to fetch'); });
    await a.call('istorijaUcitaj');
    assert.equal(a.evalIn('IST.greska'), 'mreza');
  });
});

describe('Vraćanje verzije', () => {

  const stub = (a, data) => a.setFetch(async (url, opt) => {
    if (String(url).includes('user_state_istorija')) {
      return { ok: true, status: 200, text: async () => '',
        json: async () => (data === null ? [] : [{ data }]) };
    }
    return { ok: true, status: 200, text: async () => '',
      json: async () => ([{ updated_at: '2026-08-08T09:00:00Z' }]) };
  });

  test('veze sa Stravom i intervals.icu ostaju NETAKNUTE', async () => {
    /* Srž stvari. Na serveru te veze stoje bez tokena — token je pristupni
       podatak i nikad ne napušta uređaj. Da se preuzmu odande, vraćanje bi te
       otkačilo sa oba servisa, a to sa greškom koju ispravljaš nema veze. */
    const a = app();
    prijavljen(a);
    a.evalIn(`S.strava={access:'AT', refresh:'RT', expiresAt:9e12, athlete:'A V'};
              S.icu={athleteId:'i1', token:'ICU', lastSync:5};`);
    stub(a, SERVERSKO);
    const r = await a.call('istorijaVrati', '7');
    assert.equal(r.ok, true, r.greska);
    assert.equal(a.evalIn('S.strava.access'), 'AT', 'Strava token je izgubljen');
    assert.equal(a.evalIn('S.icu.token'), 'ICU', 'intervals.icu ključ je izgubljen');
  });

  test('stanje se stvarno zameni', async () => {
    const a = app();
    prijavljen(a);
    a.evalIn(`S.log={'n5d3':{status:'skipped'}, 'n6d5':{status:'done', km:99}}`);
    stub(a, SERVERSKO);
    assert.equal((await a.call('istorijaVrati', '7')).ok, true);
    assert.equal(a.evalIn(`S.log['n5d3'].status`), 'done');
    assert.equal(a.evalIn(`S.log['n6d5']`), undefined, 'ostalo je nešto iz starog stanja');
  });

  test('verzija iz NOVIJE šeme se odbija, a stanje ostaje netaknuto', async () => {
    /* migrate() vraća null za šemu iz budućnosti. Bez ove provere bi `S`
       postao null i aplikacija bi se raspala do restarta. */
    const a = app();
    prijavljen(a);
    a.evalIn(`S.log={'n5d3':{status:'done', km:5}}`);
    stub(a, Object.assign({}, SERVERSKO, { v: 99 }));
    const r = await a.call('istorijaVrati', '7');
    assert.equal(r.ok, false);
    assert.match(r.greska, /novije šeme/);
    assert.equal(a.evalIn(`S.log['n5d3'].km`), 5, 'stanje je dirnuto iako vraćanje nije uspelo');
  });

  test('verzija koje nema ne ruši ništa', async () => {
    const a = app();
    prijavljen(a);
    stub(a, null);
    const r = await a.call('istorijaVrati', '7');
    assert.equal(r.ok, false);
    assert.match(r.greska, /više ne postoji/);
  });

  test('van mreže vrati poruku, ne bacanje', async () => {
    const a = app();
    prijavljen(a);
    a.setFetch(async () => { throw new TypeError('Failed to fetch'); });
    const r = await a.call('istorijaVrati', '7');
    assert.equal(r.ok, false);
    assert.match(r.greska, /Nema veze/);
  });

  test('vraćena verzija sa TUĐIM seedom se očisti', async () => {
    /* Stara verzija aplikacije je vlasnikov seed gurala i u tuđ Supabase red.
       Isto pravilo koje čuva „Uzmi sa servera" mora da važi i ovde, inače bi
       vraćanje unazad vratilo i tuđi plan. Otkriveno slučajno: prva verzija
       ovog skupa je koristila baš te identifikatore i test je pao — jer je
       zaštita radila. */
    const a = app();
    prijavljen(a);
    stub(a, Object.assign({}, SERVERSKO, {
      log: { 'n1d1': { status: 'done', km: 8 }, 'n1d3': { status: 'done', km: 6 } }
    }));
    assert.equal((await a.call('istorijaVrati', '7')).ok, true);
    assert.equal(a.evalIn(`S.log['n1d1']`), undefined, 'tuđi seed je vraćen sa verzijom');
    assert.equal(a.evalIn(`S.log['n1d3']`), undefined, 'tuđi seed je vraćen sa verzijom');
  });

  test('a verzija u kojoj ima i SVOJIH unosa ostaje netaknuta', async () => {
    /* Čišćenje je namerno konzervativno: briše ugrađeni plan samo ako na njemu
       nema NIJEDNOG sopstvenog unosa. Čim ima jedan, ne dira se ništa — bolje
       zadržati tuđi seed nego obrisati nečiji trening. */
    const a = app();
    prijavljen(a);
    stub(a, Object.assign({}, SERVERSKO, {
      log: { 'n1d1': { status: 'done', km: 8 }, 'n5d3': { status: 'done', km: 7 } }
    }));
    assert.equal((await a.call('istorijaVrati', '7')).ok, true);
    assert.equal(a.evalIn(`S.log['n5d3'].km`), 7, 'obrisan je sopstveni unos');
    assert.equal(a.evalIn(`S.log['n1d1'].km`), 8, 'čišćenje je postalo agresivno');
  });

  test('vraćeno stanje se ODMAH gura na server', async () => {
    /* Inače bi čovek zatvorio aplikaciju misleći da je gotovo, a upis bi čekao
       četiri sekunde koje mu niko ne garantuje. Taj upis usput pravi verziju
       od zatečenog stanja, pa se i vraćanje može poništiti. */
    const a = app();
    prijavljen(a);
    stub(a, SERVERSKO);
    await a.call('istorijaVrati', '7');
    await new Promise(r => setTimeout(r, 20));
    assert.ok(a.calls.fetches.some(([u, o]) =>
      String(u).includes('/rest/v1/user_state') && o && o.method === 'POST'),
      'vraćeno stanje nije poslato na server');
  });
});

describe('Backup više nije jedina kopija', () => {

  test('prijavljenom se backup više ne traži', () => {
    /* Sedmodnevni ritam je bio iz vremena kad je telefon bio jedina kopija.
       Podsetnik koji traži nešto što više ne štiti ni od čega uči čoveka da ne
       čita podsetnike. */
    const a = app();
    a.evalIn(`S.ui.firstRun='2026-01-01'; S.ui.lastBackup=null;`);
    assert.equal(a.call('backupDue', '2026-08-08'), true, 'neprijavljenom se i dalje traži');
    prijavljen(a);
    assert.equal(a.call('backupDue', '2026-08-08'), false, 'prijavljenom se backup i dalje traži');
  });

  test('neprijavljenom Podešavanja i dalje kažu da je backup jedina kopija', () => {
    const a = app();
    a.evalIn(`S.ui.firstRun='2026-01-01'`);
    a.call('openSettings');
    const h = a.evalIn(`$('#sheet').innerHTML`) || '';
    assert.match(h, /samo na ovom uređaju/);
    assert.ok(!/Ranije verzije/.test(h), 'nudi se istorija verzija bez naloga');
  });

  test('prijavljenom Podešavanja nude ranije verzije', () => {
    const a = app();
    prijavljen(a);
    a.call('openSettings');
    const h = a.evalIn(`$('#sheet').innerHTML`) || '';
    assert.match(h, /Ranije verzije/);
    assert.match(h, /Brisanje naloga briše i istoriju/,
      'ne kaže se da posle brisanja naloga povratka nema');
  });

  test('izvoz backupa ostaje dostupan u oba slučaja', () => {
    /* Server pokriva grešku, ali ne pokriva „hoću kopiju van aplikacije".
       Dugme se zato ne uklanja, samo prestaje da se traži. */
    for (const prijava of [false, true]) {
      const a = app();
      if (prijava) prijavljen(a);
      a.call('openSettings');
      assert.match(a.evalIn(`$('#sheet').innerHTML`) || '', /id="s-exp"/,
        `izvoz backupa je nestao (prijavljen: ${prijava})`);
    }
  });
});

describe('Šema istorije prati kod', () => {

  test('tabela je u spisku za brisanje naloga na sva tri mesta', () => {
    for (const f of ['api/delete-account.js', 'api/broadcast.js', 'supabase/brisi-nalog.sql']) {
      assert.match(readRepoFile(f), /user_state_istorija/, `${f} ne briše istoriju`);
    }
  });

  test('okidač NIKAD ne sme da obori sinhronizaciju', () => {
    /* Istorija je mreža ispod, ne uslov. Da okidač pukne, prestala bi
       sinhronizacija — a to je gore od nemanja istorije. */
    const sql = readRepoFile('supabase/istorija.sql');
    const fn = /create or replace function public\.user_state_zapamti\(\)[\s\S]*?\$\$;/.exec(sql);
    assert.ok(fn, 'funkcija okidača nije nađena');
    assert.match(fn[0], /exception when others then/,
      'okidač nema hvatanje izuzetka — greška u istoriji obara upis stanja');
  });

  test('kroz RLS niko ne piše u istoriju', () => {
    /* Istorija koju korisnik može da obriše iz aplikacije ne štiti od greške
       napravljene U APLIKACIJI. */
    const sql = readRepoFile('supabase/istorija.sql');
    const politike = [...sql.matchAll(/create policy \w+ on public\.user_state_istorija for (\w+)/g)]
      .map(m => m[1]);
    assert.deepEqual(politike, ['select'], `postoji politika za upis: ${politike}`);
    assert.match(sql, /grant select on public\.user_state_istorija to authenticated;/);
    assert.match(sql, /revoke all on public\.user_state_istorija from anon;/);
  });

  test('politika privatnosti pominje ranije verzije i njihovo brisanje', () => {
    const p = readRepoFile('privacy.html');
    assert.match(p, /Ranije verzije/);
    assert.match(p, /Earlier versions/);
    assert.match(p, /Brisanje naloga briše i njih/);
  });
});
