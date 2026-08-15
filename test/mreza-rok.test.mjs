/* MREŽA KOJA VISI, A NE ODBIJA

   `fetch` nema podrazumevan rok. To nije ivični slučaj nego najčešće stanje
   mreže koje trkač zaista ima: telefon je SPOJEN, a saobraćaj ne prolazi —
   metro, lift, wifi sa captive portalom, podrum stadiona, slab signal na stazi.
   `fetch` tada NE odbija: visi, ponekad minutima.

   POSLEDICA NIJE BIO SPOR EKRAN NEGO TRAJNO ZAKLJUČAVANJE. Svaka sinhronizacija
   u app.js diže zastavicu „u toku" (`ZAJ.ucitava`, `IST.ucitava`, `SB_BUSY`,
   `TR_POVLACIM`) i spušta je tek kad se obećanje razreši — `finally` ne pomaže,
   jer se i on čeka. Dok `fetch` visi, zastavica stoji podignuta, svaki sledeći
   pokušaj izlazi na prvom redu, a grana sa greškom — ona u kojoj JESTE dugme
   „Pokušaj ponovo" — nikad se ne iscrta. Instalirana PWA stoji otvorena danima,
   pa „zauvek" ovde znači doslovno.

   ZAŠTO SE MERI IZVRŠAVANJEM. Provera nad izvorom („ima li `signal:`", „ima li
   `AbortSignal`") prolazila bi i kad je rok postavljen na pogrešnom mestu, i
   kad je omotač zaobiđen na jednom pozivu od trideset. Zamke ispod puštaju
   mrežu koja stvarno visi i gledaju šta se DESI sa stanjem aplikacije.

   Lažni `fetch` ispod visi zauvek KAD SIGNALA NEMA. To je namerno: bez
   popravke ove zamke ne prolaze zato što padnu na drugoj grani, nego zato što
   stanje ostane zaključano — dakle padaju iz istog razloga iz kog je nalaz i
   postojao. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const pauza = ms => new Promise(r => setTimeout(r, ms));

/* Mreža koja se ponaša kao pregledač: visi dok je ne prekine `signal`. */
function mrezaKojaVisi(zabelezi) {
  return (u, o) => new Promise((_, odbij) => {
    if (zabelezi) zabelezi(String(u), o);
    const s = o && o.signal;
    if (!s) return;                       /* bez roka — visi zauvek, kao pre popravke */
    const pukni = () => odbij(Object.assign(new Error('The operation was aborted.'),
                                            { name: 'TimeoutError' }));
    if (s.aborted) return pukni();
    s.addEventListener('abort', pukni);
  });
}

/* Prijavljen korisnik sa uključenom Zajednicom — bez toga `zajUcitaj` izlazi
   na prvom redu i zamka ne bi ništa merila. */
function prijavljen(a) {
  a.evalIn(`
    SB.userId='u1'; SB.access='tok'; SB.refresh='r'; SB.expiresAt=Date.now()+3600e3;
    S.zajed={vidljiv:true};
  `);
  assert.equal(a.evalIn('sbAuthed()'), true, 'priprema: sesija nije prihvaćena');
}

describe('Zastavica „u toku" se spušta i kad mreža ćuti', () => {

  test('Zajednica se ne zaključa na „Povlačim spisak…"', async () => {
    /* IZMERENO PRE POPRAVKE: `ZAJ.ucitava` ostaje `true` i posle pet minuta,
       `ZAJ.greska` ostaje `null`, ekran stoji na „Povlačim spisak…" i nema
       nijedno dugme — do ponovnog učitavanja strane. */
    const a = loadApp();
    prijavljen(a);
    a.evalIn('MREZA_ROK.brz = 60');
    a.setFetch(mrezaKojaVisi());

    a.evalIn(`ACTIVE='zajed'; zajUcitaj();`);
    await pauza(250);

    assert.equal(a.evalIn('ZAJ.ucitava'), false,
      'zastavica je i dalje podignuta — svaki sledeći pokušaj izlazi na prvom redu');
    assert.equal(a.evalIn('ZAJ.greska'), 'mreza',
      'neuspeh nije zabeležen, pa se grana sa dugmetom „Pokušaj ponovo" ne iscrtava');

    a.evalIn('renderZajednica()');
    assert.match(a.evalIn(`document.querySelector('#pg-zajed').innerHTML`), /zaj-opet/,
      'čovek nema nijedno dugme kojim bi pokušao ponovo');
  });

  test('drugi pokušaj posle utihle mreže zaista izađe na mrežu', async () => {
    /* Spuštena zastavica ne vredi ništa ako `zajMozdaOsvezi` i dalje odustaje. */
    const a = loadApp();
    prijavljen(a);
    a.evalIn('MREZA_ROK.brz = 60');
    let pozivi = 0;
    a.setFetch(mrezaKojaVisi(() => { pozivi++; }));

    a.evalIn('zajUcitaj()');
    await pauza(250);
    const posle1 = pozivi;
    assert.ok(posle1 > 0, 'priprema: prvi pokušaj nije ni izašao');

    a.evalIn('zajUcitaj()');
    await pauza(250);
    assert.ok(pozivi > posle1, 'drugi pokušaj je odbijen zbog zaostale zastavice');
  });

  test('istorija verzija se ne zaključa iz istog razloga', async () => {
    const a = loadApp();
    prijavljen(a);
    a.evalIn('MREZA_ROK.brz = 60');
    a.setFetch(mrezaKojaVisi());

    a.evalIn('istorijaUcitaj()');
    await pauza(250);
    assert.equal(a.evalIn('IST.ucitava'), false, 'IST.ucitava je ostala podignuta');
  });
});

describe('Rok se bira po odredištu', () => {

  test('sopstvene /api putanje dobijaju DUŽI rok od Supabase-a', async () => {
    /* Naše funkcije imaju `maxDuration` 60 s i same paze na svoj rok (v.
       `ROK_MS` u api/analyze.js). Klijentski rok kraći od toga sekao bi pozive
       koji uredno rade — jedna sinhronizacija sa intervals.icu legitimno traje
       i pola minuta. Zamka drži baš taj odnos, ne konkretne brojeve. */
    const a = loadApp();
    a.evalIn('MREZA_ROK.brz = 60; MREZA_ROK.dug = 5000;');
    a.setFetch(mrezaKojaVisi());

    a.evalIn('__brzPukao=false; __dugPukao=false;');
    a.evalIn(`fetchRok('https://x.supabase.co/rest/v1/nesto').then(()=>{},()=>{ __brzPukao=true; });`);
    a.evalIn(`fetchRok('/api/icu',{method:'POST'}).then(()=>{},()=>{ __dugPukao=true; });`);
    await pauza(250);
    const brzPukao = a.evalIn('__brzPukao'), dugPukao = a.evalIn('__dugPukao');

    assert.equal(brzPukao, true, 'Supabase poziv nije prekinut ni posle isteka kratkog roka');
    assert.equal(dugPukao, false,
      'poziv ka sopstvenoj /api putanji je presečen pre nego što je server stigao da odgovori');
  });

  test('pozivalac koji sam donese `signal` zadržava svoj', async () => {
    /* Lanac pokušaja ka modelu u api/analyze.js radi baš tako; pravilo mora da
       važi i ovde, inače bi omotač tiho gazio tuđu odluku. */
    const a = loadApp();
    let dobijen = null;
    a.setFetch(async (u, o) => { dobijen = o.signal; return { ok: true }; });
    a.evalIn(`__moj = AbortSignal.timeout(99999); fetchRok('/api/push', {signal: __moj});`);
    await pauza(20);
    assert.equal(dobijen, a.evalIn('__moj'), 'omotač je pregazio signal koji je pozivalac doneo');
  });
});

describe('Serverske funkcije ne izlaze na mrežu bez roka', () => {
  /* Ovde se ne meri stanje ekrana nego SAM ZAHTEV: šta je funkcija prosledila
     `fetch`-u. To je posmatrljivo ponašanje, ne oblik izvora — provera pada i
     kad omotač postoji ali ga jedan poziv zaobilazi.

     Zašto je važno: bez roka zastao upstream troši ceo `maxDuration` (60 s), a
     tada Vercel vraća SVOJU HTML stranicu 504 umesto našeg JSON-a. Klijent na
     nju radi `response.json()` i čovek dobija „...is not valid JSON" — poruku
     koju ne kontrolišemo, o kvaru koji nismo imenovali. Ista klasa greške je
     već jednom rešena za poziv modela (v. `ROK_MS` u api/analyze.js); ovo drži
     da rešenje ne ostane samo tamo. */

  /* PRVA VERZIJA OVE ZAMKE NIJE MOGLA DA PADNE, i to je uhvaćeno tek namernim
     kvarenjem koda: bez podešenog okruženja `requireUser` odustaje PRE ijednog
     poziva (nema SUPABASE_URL), pa je spisak poziva bez roka ostajao prazan i
     `deepEqual([], [])` je prolazio i kad je rok obrisan iz fajla. Zato sada
     stoje DVE tvrdnje — da je poziva UOPŠTE bilo, i da nijedan nije bez roka.
     Prazan spisak je od sada pad, ne prolaz. */
  const ENV = {
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'srv',
    GEMINI_API_KEY: 'gk',
    RESEND_API_KEY: 'rk',
    REPORT_FROM: 'a@b.c', REPORT_TO: 'v@b.c', ADMIN_EMAIL: 'v@b.c',
    CRON_SECRET: 'tajna',
    STRAVA_CLIENT_ID: 'ci', STRAVA_CLIENT_SECRET: 'cs',
    ICU_CLIENT_ID: 'ii', ICU_CLIENT_SECRET: 'is',
    VERCEL_URL: 'sub-19.vercel.app'
  };

  const PUTANJE = ['analyze', 'auth', 'broadcast', 'daily-report', 'delete-account',
                   'icu', 'icu-oauth', 'push', 'report-bug'];

  for (const ime of PUTANJE) {
    test(`api/${ime}.js prosleđuje signal svakom izlaznom pozivu`, async () => {
      const mod = await import(`../api/${ime}.js`);
      assert.ok(typeof mod.default === 'function', `api/${ime}.js nema handler`);

      const svi = [], bezSignala = [];
      const stariFetch = globalThis.fetch;
      const staroEnv = {};
      for (const k of Object.keys(ENV)) { staroEnv[k] = process.env[k]; process.env[k] = ENV[k]; }
      globalThis.fetch = async (u, o) => {
        svi.push(String(u));
        if (!o || !o.signal) bezSignala.push(String(u));
        /* Odgovor koji je „dovoljno Response" za svakog pozivaoca. */
        return { ok: true, status: 200, headers: { get: () => null },
                 json: async () => ({ id: 'u1', email: 'k@t.rs' }), text: async () => '{}' };
      };
      try {
        /* Cilj nije da funkcija uspe nego da se vidi ČIME izlazi na mrežu.
           Provera prijave je i sama izlazak (ka Supabase-u), pa je bar jedan
           poziv zajemčen za svaku putanju koja je uopšte štiti. */
        const req = {
          method: 'POST',
          headers: { authorization: 'Bearer tajna', 'content-type': 'application/json' },
          body: { sta: 'wellness', athleteId: 'a1', posao: 'citaj' },
          query: {}
        };
        const res = {
          statusCode: 200, _telo: null,
          status(c) { this.statusCode = c; return this; },
          json(v) { this._telo = v; return this; },
          send(v) { this._telo = v; return this; },
          setHeader() { return this; },
          end() { return this; }
        };
        await mod.default(req, res);
      } catch (e) { /* pad funkcije nije predmet ove zamke */ }
      finally {
        globalThis.fetch = stariFetch;
        for (const k of Object.keys(ENV)) {
          if (staroEnv[k] === undefined) delete process.env[k]; else process.env[k] = staroEnv[k];
        }
      }

      assert.ok(svi.length > 0,
        'funkcija nije izašla na mrežu — zamka bi prolazila prazna, pa ne bi čuvala ništa');
      assert.deepEqual(bezSignala, [],
        `izlazni poziv bez roka: ${bezSignala.join(', ')}`);
    });
  }
});
