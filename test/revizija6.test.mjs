/* ŠESTA REVIZIJA — šest nalaza, šest zamki.

   Svaka zamka ovde je pisana po pravilu iz test/README.md: napisana je, pa je
   kod NAMERNO pokvaren da se potvrdi da zaista pukne. Uz svaku stoji koja je
   izmena obara — da sledeći čovek ne mora da pogađa šta ona čuva.

   Zajedničko svim šest nalaza: nijedan nije bio pokriven. Ceo paket od 1246
   provera ostajao je zelen i pre i posle ispravke svakog od njih. Zato ovaj
   fajl ne testira ISPRAVKE nego GRANICE koje su ispravke uspostavile. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const SB_SESIJA = JSON.stringify({
  access: 't', refresh: 'r', expiresAt: Date.now() + 3600e3,
  email: 'x@t.rs', userId: '0403f8fb-a643-4d4e-843d-f71199a0d6f9',
  seenAt: null, deviceId: 'd1'
});

const OSNOVNO = {
  v: 10, log: {}, knee: [], kg: [], pred: {}, predLock: {}, vdotLog: [], t3k: [],
  vreme: null, moves: {}, alts: {}, genPlan: null, wellness: {}, icu: null,
  zajed: { vidljiv: false, nadimak: '' }, ui: { firstRun: '2026-06-22' }
};

/* 2026-08-14 je petak, dan `n8d5` (tempo 10 km) — dakle dan koji se tog dana
   stvarno crta na ekranu Danas. Bez toga zamka meri prazan hod. */
const NA_DAN_N8D5 = '2026-08-14T09:00:00Z';

function saStanjem(mut, opts = {}) {
  const st = JSON.parse(JSON.stringify(OSNOVNO));
  mut(st);
  return loadApp({
    now: NA_DAN_N8D5,
    seedLocalStorage: { 'sub19-v1': JSON.stringify(st), sub19_sb: SB_SESIJA },
    ...opts
  });
}

/* ============================================================
   N-1 · OPIS DANA KOJI NIJE TEKST NE SME DA OBORI POKRETANJE
   ============================================================ */
describe('N-1 · Uvezen opis dana koji nije niska', () => {

  /* ŠTA SE DEŠAVALO: `sessBreakdown` radi `desc.match(...)` nad `d.desc`, koji
     `rebuildDateIndex` uzima iz `S.alts[id].desc`. Broj umesto niske baca
     TypeError iz `dayCard` -> `renderDanas` -> `setPage`, a
     `setPage(pocetnaStrana())` je ČETVRTA izvršna linija pokretanja: sve posle
     nje — traka o oštećenom stanju, `sbInit`, sinhronizacije, praćenje novog
     service workera — ne izvrši se uopšte, i to trajno, jer `loadState()`
     uspeva pa se spasilačka traka nikad ne pali.
     OBARA JE: uklanjanje `o.alts=cistAlts(o.alts)` iz `migrate()` ILI vraćanje
     `const desc=d.desc||''` u `sessCore`/`sessBreakdown`/`sessNote`. */

  for (const [opis, lose] of [
    ['broj',       123],
    ['objekat',    { a: 1 }],
    ['niz',        ['x']],
    ['logička',    true]
  ]) {
    test(`aplikacija se pokreće i kad je alts.desc ${opis}`, () => {
      const a = saStanjem(s => { s.alts = { n8d5: { tag: 'tempo', km: 10, desc: lose } }; });
      assert.equal(a.get('UCITAVANJE_PALO'), null, 'stanje je proglašeno oštećenim');
      assert.equal(a.evalIn('(BY_DATE[TODAY]||{}).id'), 'n8d5', 'zamka ne gleda dan koji se crta');
      /* Da je pokretanje puklo, `loadApp` bi bacio i dovde se ne bi stiglo —
         ali tvrdimo i da je ekran ZAISTA iscrtan, ne samo da nije puklo. */
      assert.ok(a.evalIn(`$('#pg-danas').innerHTML.length`) > 200, 'ekran Danas je prazan');
    });
  }

  test('cistAlts pretvara opis u nisku, ne odbacuje ceo unos', () => {
    /* Izmena tipa treninga je korisnikova odluka; gubi se samo neupotrebljiv
       opis, ne i sama izmena. */
    const a = saStanjem(s => { s.alts = { n8d5: { tag: 'lako', km: 6, desc: 123 } }; });
    assert.equal(a.evalIn('S.alts.n8d5.tag'), 'lako', 'izmena dana je izgubljena');
    assert.equal(a.evalIn('S.alts.n8d5.desc'), '', 'opis nije sveden na nisku');
    assert.equal(a.evalIn("BY_ID['n8d5'].tag"), 'lako');
  });

  test('nepoznat tag ruši unos — inače dan ostaje u nemogućem stanju', () => {
    /* `safeTag`/`tagName` bi ga prikazali kao prazninu, a `d.rest` bi bio
       netačan: dan koji nije ni trening ni odmor. */
    const a = saStanjem(s => { s.alts = { n8d5: { tag: '<img src=x>', km: 5, desc: 'x' } }; });
    assert.equal(a.evalIn('S.alts.n8d5'), undefined, 'nepoznat tip treninga je prošao');
  });

  test('kilometraža koja nije broj ne stiže do ekrana kao „NaN km"', () => {
    const a = saStanjem(s => { s.alts = { n8d5: { tag: 'tempo', km: 'abc', desc: 'Tempo' } }; });
    assert.equal(a.evalIn('S.alts.n8d5.km'), null, 'nebrojevna kilometraža je prošla kroz migrate');
    assert.doesNotMatch(a.evalIn(`$('#pg-danas').innerHTML`), /NaN/, 'NaN je na ekranu');
  });

  test('fmtNum/fmtKm na nebrojevnu vrednost daju „—", ne „NaN"', () => {
    /* Drugi sloj, za sve ostale pozivaoce koji broj dobijaju iz trećeg izvora.
       Isti dogovor koji `fmtClock` već primenjuje. */
    const a = loadApp();
    for (const v of [null, undefined, NaN, Infinity, 'abc', {}, [], true])
      assert.equal(a.call('fmtKm', v), '—', `fmtKm(${JSON.stringify(v)})`);
    /* a ispravni brojevi se ne diraju */
    assert.equal(a.call('fmtNum', 0, 0), '0');
    assert.equal(a.call('fmtNum', 10.5, 1), '10,5');
    assert.equal(a.call('fmtKm', 12), '12');
  });

  test('opis koji nije tekst nestaje, ne postaje „NaN" ni „[object Object]"', () => {
    /* Prvi oblik `tekstOpisa` je radio `String(x)`, pa je na ekranu umesto pada
       stajalo doslovno „NaN". Sprečen pad nije ispravka ako umesto njega ostane
       smeće koje izgleda kao podatak — isto pravilo koje `cistWellness` već
       primenjuje na brojeve. Uhvaćeno fuzzom nad prikazom, ne čitanjem. */
    const a = loadApp();
    for (const v of [NaN, {}, [], 123, true, null, undefined]) {
      a.ctx.__d = { tag: 'tempo', km: 10, desc: v };
      const out = a.evalIn('sessCore(__d)');
      assert.doesNotMatch(String(out), /NaN|\[object Object\]/,
        `sessCore je propustio smeće za desc=${JSON.stringify(v)}`);
    }
    assert.equal(a.call('tekstOpisa', 'Tempo — 6 km'), 'Tempo — 6 km', 'ispravan opis je izgubljen');
  });

  test('validanGenPlan odbija dan čiji opis nije niska', () => {
    /* Ta funkcija POSTOJI da „pokvaren ili ručno izmenjen backup" ne obori
       aplikaciju posle zamene S — a `desc` je bio jedino polje koje ide u
       `desc.match()` a nije bilo na spisku. */
    const a = loadApp();
    const dobar = {
      meta: { start: '2026-08-10' },
      weeks: [{ w: 1, start: '2026-08-10', days: [{ dow: 4, id: 'g1d5', km: 10, desc: 'Tempo' }] }],
      pred: [], qs: {}
    };
    assert.equal(a.call('validanGenPlan', dobar), true, 'ispravan plan je odbijen');
    const los = JSON.parse(JSON.stringify(dobar));
    los.weeks[0].days[0].desc = 777;
    assert.equal(a.call('validanGenPlan', los), false, 'opis koji nije niska je prošao');
  });

  test('i ako takav genPlan ipak zatekne uređaj, aplikacija se pokreće', () => {
    /* Drugi sloj: `validanGenPlan` čuva UVOZ, ali stanje može stići i sa
       servera, i može biti zatečeno od ranije. */
    const a = saStanjem(s => {
      s.genPlan = {
        meta: { start: '2026-08-10', raceDate: '2026-09-20' },
        weeks: [{ w: 1, start: '2026-08-10', days: [{ dow: 4, id: 'g1d5', km: 10, desc: 777, tag: 'tempo' }] }],
        pred: [], qs: {}
      };
    });
    assert.equal(a.evalIn('(BY_DATE[TODAY]||{}).id'), 'g1d5');
    assert.ok(a.evalIn(`$('#pg-danas').innerHTML.length`) > 200, 'ekran Danas je prazan');
  });
});

/* ============================================================
   N-2 · GRANICE ZONA IDU UZ RASPODELU KOJU SU PROIZVELE
   ============================================================ */
describe('N-2 · Zone jednog treninga naspram zona naloga', () => {

  const STRAVA = [
    { min: 0, max: 130 }, { min: 131, max: 150 }, { min: 151, max: 165 },
    { min: 166, max: 178 }, { min: 179, max: null }
  ];
  /* Trening uvezen sa intervals.icu: vreme po zonama i granice po kojima je
     ono izračunato, oboje iz istog zapisa. */
  const LOG = {
    km: 9, sec: 2700,
    icu: { zonePuls: [300, 1500, 600, 200, 100, 0, 0],
           zoneGranice: [122, 141, 153, 165, 175, 185, 200] }
  };

  /* Pravi handler `api/analyze.js` sa lažnim `fetch`-om — isti obrazac kao u
     zone-pulsa.test.mjs. Vraća ceo prompt (sistemsko uputstvo + poruka). */
  async function promptZa(telo) {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon';
    process.env.GEMINI_API_KEY = 'k';
    let poslato = null;
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/user'))
        return { ok: true, status: 200, json: async () => ({ id: 'u1', email: 'k@t.rs', email_confirmed_at: '2026-01-01' }) };
      if (u.includes('generativelanguage')) {
        poslato = String((opt && opt.body) || '');
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'a' }] } }] }) };
      }
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { default: h } = await import('../api/analyze.js?t=' + Date.now() + Math.random());
    const res = { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    await h({ method: 'POST', headers: { authorization: 'Bearer jwt' },
              body: { session: { desc: '9 km lako', tag: 'lako' }, entered: { km: 9 }, ...telo } }, res);
    assert.ok(poslato, 'model nije pozvan: ' + JSON.stringify(res.body));
    const b = JSON.parse(poslato);
    return ((b.systemInstruction && b.systemInstruction.parts || []).map(p => p.text).join('\n')
          + '\n' + (b.contents || []).map(c => (c.parts || []).map(p => p.text).join(' ')).join('\n'));
  }

  /* Veza bez `SETTINGS:READ` — nema `S.icu.hrZones`, pa `zoneIzvor()` pada na
     Stravine zone. To NIJE rub: v257/v258 postoje baš zbog tog stanja. */
  const bezDozvoleZaZone = a => a.evalIn(
    `S.strava={hrZones:${JSON.stringify(STRAVA)}};
     S.icu={athleteId:'i1', token:'t', scope:'ACTIVITY:READ,WELLNESS:READ'};`);

  test('zoneRaspodela vraća i granice po kojima je računala', () => {
    /* Bez ovog polja pozivalac mora da ih traži sam, preko `zoneIzvor()` — i
       tako je nastao ceo nalaz.
       OBARA JE: uklanjanje `zone` iz povratne vrednosti `zoneRaspodela`. */
    const a = loadApp(); bezDozvoleZaZone(a);
    const r = a.call('zoneRaspodela', LOG);
    assert.ok(r, 'raspodele nema');
    assert.equal(r.redovi.length, 7);
    assert.ok(Array.isArray(r.zone), 'granice ne idu uz raspodelu');
    assert.equal(r.zone.length, 7, 'vraćene granice nisu one po kojima je računato');
    assert.equal(r.zone[3].min, 154, 'Z4 ne počinje tamo gde icu kaže');
    assert.equal(r.zone[3].max, 165);
  });

  test('zone TRENINGA su icu zone i kad su zone NALOGA Stravine', () => {
    /* Jezgro nalaza. Procenti su računati po sedam icu zona; da uz njih ode
       spisak od pet Stravinih, „Z4 7 %" (icu prag 154–165) model bi pročitao
       kao Stravin VO2max 166–178.
       OBARA JE: vraćanje `hrZones: zoneIzvor().zone` u AI payload. */
    const a = loadApp(); bezDozvoleZaZone(a);
    const naloga = a.call('zoneIzvor');
    const treninga = a.call('zoneZaTrening', LOG);
    assert.equal(naloga.izvor, 'strava', 'pretpostavka zamke ne stoji');
    assert.equal(naloga.zone.length, 5);
    assert.equal(treninga.izvor, 'icu', 'trening je dobio zone naloga umesto svojih');
    assert.equal(treninga.zone.length, 7);
  });

  test('broj zona koje se šalju modelu se poklapa sa brojem redova raspodele', () => {
    /* Ovo je uslov koji api/analyze.js proverava da bi smeo da kaže „po zonama
       navedenim na vrhu". Kad se poklapa, tvrdnja je tačna. */
    const a = loadApp(); bezDozvoleZaZone(a);
    const r = a.call('zoneRaspodela', LOG);
    const zt = a.call('zoneZaTrening', LOG);
    assert.equal(zt.zone.length, r.redovi.length,
      'model bi dobio raspodelu po jednom sistemu i nazive po drugom');
  });

  test('AI zahtev zaista koristi zone treninga, ne zone naloga', () => {
    /* Tvrdnja nad oblikom koda, i to namerno: payload se gradi unutar rukovaoca
       klika u `vezAnalize`, koji se iz harness-a ne može pozvati. Sve ostalo u
       ovom bloku je izvršno; ovo pribija jedino mesto koje nije. Ako se poziv
       ikad vrati na `zoneIzvor()`, ceo nalaz se vraća sa njim. */
    const src = readRepoFile('app.js');
    assert.match(src, /hrZones:\s*zoneZaTrening\(l\)\.zone/,
      'AI zahtev opet šalje zone naloga umesto zona tog treninga');
    assert.match(src, /hrZonesIzvor:\s*zoneZaTrening\(l\)\.izvor/,
      'izvor zona se ne slaže sa granicama koje se šalju');
  });

  test('bez raspodele se i dalje koriste zone naloga', () => {
    /* Trening bez vremena po zonama (ručan unos, Strava putanja) nema svoje
       granice — tada su merodavne one iz Podešavanja, kao i do sada. */
    const a = loadApp(); bezDozvoleZaZone(a);
    const zt = a.call('zoneZaTrening', { km: 9, sec: 2700 });
    assert.equal(zt.izvor, 'strava');
    assert.equal(zt.zone.length, 5);
  });

  test('server ne kaže „po zonama navedenim na vrhu" kad se ne poklapa', async () => {
    /* Druga brava, na serveru — za starije offline kopije koje i dalje šalju
       `zoneUdeo` uz zone naloga i ne znaju za razliku. Prva verzija ove zamke
       nije mogla da padne (gledala je samo klijenta), pa je uklanjanje provere
       u api/analyze.js prolazilo neprimećeno. Zato ide kroz PRAVI handler. */
    const p = await promptZa({
      hrZones: STRAVA, hrZonesIzvor: 'strava',        /* 5 zona naloga */
      entered: { km: 9, zoneUdeo: { ukupno: 2700, redovi: [
        { n: 1, sec: 300, pct: 11 }, { n: 2, sec: 1500, pct: 56 },
        { n: 3, sec: 600, pct: 22 }, { n: 4, sec: 200, pct: 7 },
        { n: 5, sec: 100, pct: 4 },  { n: 6, sec: 0, pct: 0 },
        { n: 7, sec: 0, pct: 0 } ] } }                /* 7 redova raspodele */
    });
    assert.match(p, /NISU one navedene na vrhu/,
      'model je dobio raspodelu po sedam zona kao da su Stravinih pet');
    assert.match(p, /NE imenuj zone/, 'nema zabrane imenovanja');
    assert.doesNotMatch(p, /PULSA \(po zonama navedenim na vrhu\)/,
      'tvrdnja koja povezuje dva različita sistema je prošla');
  });

  test('a kad se poklapa, tvrdnja o zonama sa vrha ostaje', async () => {
    /* Bez ovoga bi zamka iznad prošla i da je rečenica uklonjena za sve. */
    const p = await promptZa({
      hrZones: STRAVA, hrZonesIzvor: 'strava',
      entered: { km: 9, zoneUdeo: { ukupno: 2700, redovi: [
        { n: 1, sec: 300, pct: 11 }, { n: 2, sec: 1500, pct: 56 },
        { n: 3, sec: 600, pct: 22 }, { n: 4, sec: 200, pct: 7 },
        { n: 5, sec: 100, pct: 4 } ] } }              /* 5 redova = 5 zona */
    });
    assert.match(p, /PULSA \(po zonama navedenim na vrhu\)/,
      'uporediva raspodela je izgubila vezu sa zonama');
    assert.doesNotMatch(p, /NISU one navedene na vrhu/);
  });

  test('kartica „Po zonama" ne upućuje na Podešavanja kad granice nisu odatle', () => {
    /* Dve kartice na istom ekranu su tvrdile različite stvari o istom broju:
       raspodela po icu granicama, a ispod nje uputstvo da se te granice vide u
       „Tvoje zone pulsa", gde je stajao Stravin spisak. */
    const a = loadApp(); bezDozvoleZaZone(a);
    const html = a.call('karticaZona', LOG);
    assert.match(html, /uz sam taj trening/, 'kartica i dalje tvrdi da su granice iz Podešavanja');
    assert.doesNotMatch(html, /Tvoje zone pulsa/,
      'upućuje na spisak koji pokazuje druge granice');
  });

  test('a kad se granice POKLAPAJU sa Podešavanjima, kartica i dalje upućuje tamo', () => {
    const a = loadApp();
    const ICU7 = a.call('zoneIzGranica', [122, 141, 153, 165, 175, 185, 200]);
    a.ctx.__z = ICU7;
    a.evalIn('S.strava=null; S.icu={athleteId:"i1",token:"t",hrZones:__z};');
    const html = a.call('karticaZona', LOG);
    assert.match(html, /Tvoje zone pulsa/, 'izgubljena je uputa na Podešavanja kad je tačna');
  });
});

/* ============================================================
   N-3 · VEZE SU PO UREĐAJU I NE PUTUJU KROZ FAJL
   ============================================================ */
describe('N-3 · Uvoz backupa i tuđi tokeni', () => {

  /* ŠTA SE DEŠAVALO: `st.strava||S.strava` je čuvao postojeću vezu samo ako je
     fajl svoju NE nosi. Backupi napravljeni pre ispravke u `backupPayload`
     nose intervals.icu OAuth token, a on ne ističe — uvoz tuđeg takvog fajla
     davao je trajan pristup tuđim zdravstvenim podacima i pravo pisanja u tuđ
     kalendar.
     OBARA JE: vraćanje `st.strava=st.strava||S.strava` u `importBackup`. */

  function uvezi(fajl, mojeVeze) {
    const a = loadApp({ confirmReturns: true });
    a.ctx.__v = mojeVeze;
    a.evalIn('S.strava=__v.strava; S.icu=__v.icu; save();');
    a.ctx.__tekst = JSON.stringify(fajl);
    a.evalIn('FileReader = class { readAsText(){ this.result=__tekst; this.onload(); } };');
    a.call('importBackup', { name: 'backup.json' });
    return a;
  }

  const MOJE = {
    strava: { access: 'MOJ_STRAVA', refresh: 'R', athlete: { id: 1 } },
    icu: { athleteId: 'i111', token: 'MOJ_ICU' }
  };
  const TUDJ_FAJL = {
    app: 'SUB-19',
    state: Object.assign({}, OSNOVNO, {
      log: { n1d1: { status: 'done', km: 7 } },
      strava: { access: 'TUDJ_STRAVA', refresh: 'TR', athlete: { id: 99999 } },
      icu: { athleteId: 'i99999', token: 'TUDJ_ICU' }
    })
  };

  test('tokeni iz fajla se NE upisuju — postojeća veza ostaje', () => {
    const a = uvezi(TUDJ_FAJL, MOJE);
    assert.equal(a.evalIn('S.strava.access'), 'MOJ_STRAVA', 'tuđ Strava token je upisan');
    assert.equal(a.evalIn('S.icu.token'), 'MOJ_ICU', 'tuđ intervals.icu token je upisan');
    assert.equal(a.evalIn('S.icu.athleteId'), 'i111', 'tuđ ID sportiste je upisan');
    assert.equal(a.evalIn('S.strava.athlete.id'), 1);
  });

  test('ni u localStorage ne završi ništa tuđe', () => {
    const a = uvezi(TUDJ_FAJL, MOJE);
    const sirovo = a.ls.getItem('sub19-v1');
    assert.doesNotMatch(sirovo, /TUDJ_STRAVA/, 'tuđ token je upisan na disk');
    assert.doesNotMatch(sirovo, /TUDJ_ICU/, 'tuđ token je upisan na disk');
  });

  test('a sami podaci iz fajla se uvoze — uvoz mora da radi', () => {
    const a = uvezi(TUDJ_FAJL, MOJE);
    assert.equal(a.evalIn('Object.keys(S.log).length'), 1, 'uvoz nije ni prošao');
    assert.equal(a.evalIn('S.log.n1d1.km'), 7);
  });

  test('ko nema svoju vezu, posle uvoza je i dalje nema (ne dobija tuđu)', () => {
    const a = uvezi(TUDJ_FAJL, { strava: null, icu: null });
    assert.equal(a.evalIn('S.strava'), null);
    assert.equal(a.evalIn('S.icu'), null);
    assert.equal(a.call('icuPovezan'), false, 'uvoz je „povezao" tuđ nalog');
  });
});

/* ============================================================
   N-4 · KOORDINATE NE IDU NA SERVER
   ============================================================ */
describe('N-4 · Koordinate naspram obećanja iz privacy.html', () => {

  /* privacy.html, odeljak „Šta se NIKAD ne šalje na server": koordinate
     „ne upisuju se u bazu". `sbPayload` ih je slao u `user_state.data`, i to
     dvaput — kroz `ui.geo` i kroz `vreme.lat/lon`.
     OBARA JE: uklanjanje `delete c.ui.geo` / `delete c.vreme` iz `sbPayload`. */

  const saKoordinatama = a => a.evalIn(`
    S.ui.geo={lat:44.81, lon:20.46};
    S.vreme={at:Date.now(), lat:44.81, lon:20.46, sati:{'2026-08-11T18':{temp:31,osecaj:33}}};`);

  test('sbPayload ne nosi koordinate ni u jednom polju', () => {
    const a = loadApp(); saKoordinatama(a);
    const json = a.evalIn('JSON.stringify(sbPayload(S))');
    assert.doesNotMatch(json, /44\.81/, 'koordinate idu u user_state.data');
    assert.doesNotMatch(json, /20\.46/, 'koordinate idu u user_state.data');
    const p = a.call('sbPayload', a.evalIn('S'));
    assert.equal(p.ui.geo, undefined, 'ui.geo se sinhronizuje');
    assert.equal(p.vreme, undefined, 'keš prognoze se sinhronizuje');
  });

  test('pozadinski upis koristi isti payload, pa ni on ne nosi koordinate', () => {
    /* `pozadinskiZakazi` piše `sbPayload(S)` u IndexedDB, odakle ga service
       worker gura na server i kad je aplikacija zatvorena. Da je taj put imao
       svoj payload, ispravka bi pokrivala samo polovinu. */
    const src = readRepoFile('app.js');
    assert.match(src, /idbUpisi\('stanje',\s*\{[^}]*podaci:\s*sbPayload\(S\)/,
      'pozadinski red ne ide kroz sbPayload');
  });

  test('a u backup fajlu koordinate OSTAJU — tako i piše u politici', () => {
    const a = loadApp(); saKoordinatama(a);
    const b = a.call('backupPayload');
    assert.equal(b.ui.geo.lat, 44.81, 'backup je izgubio lokaciju');
  });

  test('povlačenje sa servera ne gasi lokaciju na uređaju', () => {
    /* Sa servera sada stiže `geo:null`. Bez zadržavanja lokalne vrednosti bi
       jedno „Uzmi sa servera" tiho ugasilo karticu vremena. */
    const a = loadApp(); saKoordinatama(a);
    a.ctx.__sa = Object.assign({}, OSNOVNO, { ui: { firstRun: '2026-06-22' } });
    a.evalIn('primiStanjeSaServera(migrate(__sa))');
    assert.equal(a.evalIn('S.ui.geo && S.ui.geo.lat'), 44.81, 'lokacija je izgubljena pri povlačenju');
    assert.ok(a.evalIn('!!S.vreme'), 'keš prognoze je izgubljen pri povlačenju');
  });

  test('politika privatnosti i dalje tvrdi da koordinate ne idu u bazu', () => {
    /* Zamka gleda i dokument, jer je nalaz bio razilaženje koda i obećanja —
       ispravka sme da ide u bilo kom smeru, ali ta dva moraju da se slažu. */
    const p = readRepoFile('privacy.html');
    assert.match(p, /koordinate<\/strong> ostaju <strong>isključivo na tvom uređaju/);
    assert.match(p, /coordinates<\/strong> stay <strong>on your device only/);
  });
});

/* ============================================================
   N-5 · RUČNE MIGRACIJE — POKLAPANJE U OBA SMERA
   ============================================================ */
describe('N-5 · app_stats i inventar baze', () => {

  /* Telo SAME NAREDBE, ne prve pojave tih reči u fajlu. Prva verzija je
     tražila `indexOf('create or replace view')`, a taj niz stoji i u komentaru
     u zaglavlju — pa je „telo" počinjalo od komentara i obe zamke su ostajale
     zelene i kad se kolona ukloni iz definicije. Treći put ista greška u ovom
     fajlu (v. politika privatnosti, pa `prosek_treninga`): tvrdnja nad tekstom
     mora da bude vezana za mesto, ne za pojavu niza. */
  function teloPogleda() {
    const s = readRepoFile('supabase/app-stats.sql');
    const m = /^create or replace view public\.app_stats as$/m.exec(s);
    assert.ok(m, 'naredba `create or replace view public.app_stats as` nije nađena');
    const od = m.index;
    const doIdx = s.indexOf(';', od);
    assert.ok(doIdx > od, 'definicija pogleda nije zatvorena tačka-zarezom');
    return s.slice(od, doIdx + 1);
  }


  test('svaki naziv iz baze koji kod čita ima svoj fajl u supabase/', () => {
    /* `app_stats` je godinu dana postojao samo u bazi: kod ga je čitao svakog
       jutra, a nijedan fajl ga nije opisivao. Ovo je opšti oblik te provere. */
    const izvor = ['api/analyze.js', 'api/auth.js', 'api/broadcast.js', 'api/daily-report.js',
                   'api/delete-account.js', 'api/icu-oauth.js', 'api/icu.js', 'api/push.js',
                   'api/report-bug.js', 'app.js'].map(readRepoFile).join('\n');
    const sql = ['ai-posao', 'admin-brisanje', 'api-usage', 'app-stats', 'brisi-nalog',
                 'inventar', 'istorija', 'provera', 'push', 'rate-limit', 'user-state',
                 'zajednica'].map(f => readRepoFile(`supabase/${f}.sql`)).join('\n');
    const nazivi = new Set();
    for (const m of izvor.matchAll(/\/rest\/v1\/(?:rpc\/)?([a-z_][a-z0-9_]*)/g)) nazivi.add(m[1]);
    assert.ok(nazivi.size >= 8, `pretraga nije našla nazive (${nazivi.size})`);
    for (const n of nazivi)
      assert.ok(sql.includes(n), `kod čita "${n}", a nijedan supabase/*.sql ga ne pominje`);
  });

  test('svaka kolona koju app_stats čita opisana je u user-state.sql', () => {
    /* NAĐENO TEK KAD JE DEFINICIJA PREPISANA IZ ŽIVE BAZE: pogled računa
       `novih_7d` iz `user_state.created_at`, a `user-state.sql` tu kolonu nije
       pominjao nigde. Tabela napravljena iz repozitorijuma bila bi tiho
       nepotpuna, a `create or replace view` nad njom bi pukao sa „column
       created_at does not exist".
       Isto razilaženje kao i sam `app_stats`, samo jedan sloj dublje — zato
       zamka gleda ODNOS između ta dva fajla, ne samo postojanje svakog. */
    const tabela = readRepoFile('supabase/user-state.sql');
    const telo = teloPogleda();
    const kolone = new Set();
    for (const m of telo.matchAll(/\b(updated_at|created_at|device_id|app_version|data|user_id)\b/g))
      kolone.add(m[1]);
    assert.ok(kolone.has('created_at'), 'zamka ne meri ništa — created_at se više ne koristi');
    for (const k of kolone)
      assert.ok(new RegExp(`\\b${k}\\b`).test(tabela),
        `app_stats čita user_state.${k}, a user-state.sql tu kolonu ne opisuje`);
  });

  test('definicija pogleda je prepisana iz baze, ne rekonstruisana', () => {
    /* Prva verzija ovog fajla bila je rekonstrukcija iz koda i razilazila se u
       tri stvari (dve kolone manje, pogrešan izvor za `korisnika` i `novih_7d`).
       Ove dve kolone niko ne čita — baš zato su dokaz da je definicija
       prepisana, a ne izvedena iz onoga što `daily-report.js` koristi. */
    /* SAMO TELO UPITA. Prva verzija ove zamke gledala je ceo fajl, a oba
       naziva stoje i u komentaru iznad („DVE KOLONE KOJE NIKO NE ČITA") — pa
       je uklanjanje kolone iz same definicije prolazilo neprimećeno. Isti
       propust kao kod provere teksta politike; zato se ovde reže telo. */
    const telo = teloPogleda();
    assert.match(telo, /prosek_treninga/, 'definicija ne odgovara zatečenoj u bazi');
    assert.match(telo, /prosek_vdot_unosa/, 'definicija ne odgovara zatečenoj u bazi');
    assert.match(telo, /from public\.user_state;/,
      'pogled više ne čita user_state — proveri da li se definicija promenila');
  });

  test('inventar.sql vidi i poglede, ne samo tabele', () => {
    /* `relkind in ('r','p')` je hvatao tabele; pogled je 'v'. Provera koja ne
       vidi ceo razred objekata ne čuva ništa. */
    const s = readRepoFile('supabase/inventar.sql');
    assert.match(s, /relkind in \('v','m'\)/, 'pogledi i dalje izmiču inventaru');
    assert.match(s, /'pogled:app_stats'/, 'app_stats nije na spisku očekivanog');
  });

  test('izostanak statistike ne obara odložena brisanja naloga', () => {
    /* `izvrsiOdlozenaBrisanja()` se poziva POSLE statistike. Dok je ona radila
       `return 502`, brisanja se ne bi izvršila nijedan dan — i to bez ijedne
       poruke, jer je izveštaj koji bi to javio isti onaj koji nije poslat. */
    const s = readRepoFile('api/daily-report.js');
    const telo = s.slice(s.indexOf('export default async function handler'));
    const iStats = telo.indexOf('fetchStats(url, svcKey)');
    const iBrisanja = telo.indexOf('izvrsiOdlozenaBrisanja(url, svcKey)');
    assert.ok(iStats > 0 && iBrisanja > iStats, 'redosled koraka se promenio — proveri zamku');
    assert.doesNotMatch(telo.slice(iStats, iBrisanja), /return res\.status\(502\)/,
      'statistika i dalje obara ceo posao pre brisanja naloga');
    assert.match(telo, /catch \(e\) \{ errors\.stats = e\.message; \}/,
      'statistika ne otkazuje kao ostali koraci');
  });

  test('neuspela statistika se VIDI, ne prikazuje se kao šest nula', () => {
    const s = readRepoFile('api/daily-report.js');
    assert.match(s, /Statistika nije učitana/, 'nula bez broja izgleda kao činjenica');
    assert.match(s, /statistika nije učitana/, 'naslov mejla i dalje tvrdi „0 korisnika"');
  });
});

/* ============================================================
   N-6 · POLITIKA IMENUJE POSREDNIKA
   ============================================================ */
describe('N-6 · intervals.icu ključ prolazi kroz naš server', () => {

  test('kod zaista šalje ključ na /api/icu, ne pravo servisu', () => {
    /* Ne može drugačije — intervals.icu ne šalje CORS zaglavlja (v. zaglavlje
       api/icu.js). Zamka postoji da politika ne bi tvrdila suprotno. */
    const src = readRepoFile('app.js');
    assert.match(src, /function icuVeza\(\)\{[^}]*S\.icu\.token/, 'icuVeza se promenila');
    assert.match(src, /fetch\('\/api\/icu'[\s\S]{0,400}?\.\.\.icuVeza\(\)/,
      'ključ više ne ide kroz naš server — proveri da politika to prati');
  });

  test('politika to i kaže, u oba jezika', () => {
    /* PRVA VERZIJA OVE ZAMKE NIJE MOGLA DA PADNE: tražila je „kroz naš … server"
       bilo gde u fajlu, a ta reč postoji i u odeljku o lokaciji („koordinate ne
       prolaze kroz naš server"). Uklanjanje rečenice o intervals.icu je zato
       prolazilo neprimećeno. Sad se traži tvrdnja VEZANA ZA KLJUČ. */
    const p = readRepoFile('privacy.html');
    const sr = /intervals\.icu token \/ API ključ<\/strong>[\s\S]{0,120}?kroz naš[\s\S]{0,20}?server/;
    const en = /intervals\.icu token \/ API key<\/strong>[\s\S]{0,120}?through our[\s\S]{0,20}?server/;
    assert.match(p, sr, 'srpska verzija ne kaže da ključ prolazi kroz naš server');
    assert.match(p, en, 'engleska verzija ne kaže da ključ prolazi kroz naš server');
    /* i da razlog stoji uz tvrdnju — inače izgleda kao propust, a nije */
    assert.match(p, /CORS/, 'nije rečeno ZAŠTO ključ ide preko servera');
  });
});
