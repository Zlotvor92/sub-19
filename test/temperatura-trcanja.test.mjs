/* TEMPERATURA TRČANJA — IZ PROGNOZE, NE SA ZGLOBA

   ZAŠTO OVAJ FAJL POSTOJI

   Aplikacija je za isto trčanje umela da pokaže dva broja. Kartica vremena je
   za 09.08. u 20:00 crtala 30 °C (osećaj 29) iz Open-Meteo prognoze, a AI
   analiza istog dana pisala „test na 3 km na ekstremnoj temperaturi od 33 °C".
   Nijedan od ta dva nije bio bug u računu: 33 je stvarno očitanje, samo sa
   senzora na ručnom satu, koji stoji uz kožu i sistematski čita 2-5 °C više od
   vazduha. Model to nije mogao da zna — u promptu je stajalo golo
   „Temperatura: 33°C" — pa je na tome sagradio ocenu sa rečju „ekstremnoj".

   Ispravka ima dva dela, i oba se ovde drže zatvorenim:
     1. IZVOR. Temperatura odrađenog trčanja je Open-Meteo vrednost za sat u kom
        se trčalo. Očitanje sa sata ostaje samo kao rezerva.
     2. OZNAKA. Kad rezerva ipak radi, i ekran i model to moraju znati. Broj bez
        porekla je i bio ceo problem, pa rezerva bez oznake ne bi bila popravka
        nego ista greška sa drugim brojem.

   Zamke su pisane tako da padnu ako se bilo koji od ta dva dela izgubi. */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const DAN = '2026-08-09';
const app = (o = {}) => loadApp({ now: DAN + 'T21:00:00Z', ...o });

/* Prognoza kakvu `vremeCist` ostavlja u `S.vreme.sati`: ključ je 'YYYY-MM-DDTHH'.
   Brojevi su iz prijavljenog slučaja — 20 h je 30 °C uz osećaj 29. */
function saPrognozom(a, sati) {
  const zapis = {};
  Object.keys(sati).forEach(h => { zapis[DAN + 'T' + h] = sati[h]; });
  a.evalIn(`S.vreme={at:Date.now(), lat:44.8, lon:20.5, sati:${JSON.stringify(zapis)}}`);
}

describe('Sat u kom se trčalo', () => {

  test('kratko trčanje ostaje u satu polaska', () => {
    const a = app();
    assert.equal(a.call('satTrcanja', { satTrk: 9, sec: 1800 }), 9);
  });

  test('dugo trčanje se meri po SREDINI, ne po polasku', () => {
    /* U 8:00 krenuto dvočasovno trčanje se najvećim delom odvija u 9 i 10 h.
       Avgust ume da doda 4-5 °C između 8 i 10 — uzeti sat polaska znači
       sistematski potceniti toplotu baš na treninzima gde ona najviše boli. */
    const a = app();
    assert.equal(a.call('satTrcanja', { satTrk: 8, sec: 7200 }), 9);
  });

  test('bez sata sa uvoza pada na sat treninga iz Podešavanja', () => {
    /* Ručan unos nema `satTrk`. Pretpostavka mora biti ISTA ona po kojoj
       kartica vremena crta prognozu — inače bi ekran i analiza gledali dva
       različita sata istog dana. */
    const a = app();
    a.evalIn("S.ui.satTreninga=7;");
    assert.equal(a.call('satTrcanja', {}), 7);
    assert.equal(a.call('satTrcanja', { satTrk: null, sec: 3600 }), 7);
  });

  test('ne prelazi u sledeći dan', () => {
    /* Ključ u kešu je 'datum + sat'; sat 24 ne postoji i vratio bi null, pa bi
       kasno večernje dugo trčanje tiho ostalo bez temperature. */
    const a = app();
    assert.equal(a.call('satTrcanja', { satTrk: 23, sec: 7200 }), 23);
    assert.equal(a.call('satTrcanja', { satTrk: 0, sec: 60 }), 0);
  });

  test('besmislen `satTrk` iz backupa ne prolazi', () => {
    const a = app();
    a.evalIn("S.ui.satTreninga=18;");
    for (const loš of [{ satTrk: 25 }, { satTrk: -3 }, { satTrk: 'devet' }, { satTrk: NaN }])
      assert.equal(a.call('satTrcanja', loš), 18, `prošlo: ${JSON.stringify(loš)}`);
  });
});

describe('Odakle dolazi temperatura odrađenog trčanja', () => {

  test('PRIJAVLJEN SLUČAJ: prognoza pobeđuje očitanje sa sata', () => {
    /* Ovo je cela poenta izmene. Sat je zabeležio 33, prognoza za taj sat kaže
       30 — mora izaći 30, sa oznakom da je iz prognoze. */
    const a = app();
    saPrognozom(a, { '20': { temp: 30, osecaj: 29 } });
    const t = a.call('tempTrcanja', { satTrk: 20, sec: 1200, temp: 33 }, DAN);
    assert.equal(t.temp, 30, 'i dalje se uzima očitanje sa sata');
    assert.equal(t.osecaj, 29);
    assert.equal(t.izvor, 'om');
    assert.equal(t.sat, 20);
  });

  test('bez prognoze za taj sat pada na sat — ali OZNAČENO', () => {
    const a = app();
    saPrognozom(a, { '20': { temp: 30, osecaj: 29 } });
    /* Trčano u 6 h, prognoza pokriva samo 20 h. */
    const t = a.call('tempTrcanja', { satTrk: 6, sec: 1800, temp: 33 }, DAN);
    assert.equal(t.temp, 33);
    assert.equal(t.izvor, 'sat', 'zglobno očitanje se predstavlja kao prognoza');
  });

  test('bez lokacije uopšte — i dalje označena rezerva', () => {
    const a = app();   /* S.vreme ostaje prazno */
    const t = a.call('tempTrcanja', { satTrk: 9, sec: 1800, temp: 31 }, DAN);
    assert.equal(t.izvor, 'sat');
    assert.equal(t.temp, 31);
  });

  test('kad nema nijednog izvora, nema ni broja', () => {
    const a = app();
    assert.equal(a.call('tempTrcanja', { satTrk: 9, sec: 1800 }, DAN), null);
    assert.equal(a.call('tempTrcanja', null, DAN), null);
  });

  test('„oseća se" sa sata NE ulazi u prognozu i obrnuto', () => {
    /* `icu.osecaSe` je izvedeno iz istog zglobnog očitanja. Ako bi se zalepilo
       na Open-Meteo temperaturu, dobio bi se par „30 °C, oseća se 36" — dva
       broja iz dva sveta koja tvrde da opisuju isti trenutak. */
    const a = app();
    saPrognozom(a, { '20': { temp: 30, osecaj: 29 } });
    const izPrognoze = a.call('tempTrcanja', { satTrk: 20, sec: 1200, temp: 33, icu: { osecaSe: 36 } }, DAN);
    assert.equal(izPrognoze.osecaj, 29, 'osećaj sa sata se zalepio na temperaturu iz prognoze');

    const izSata = a.call('tempTrcanja', { satTrk: 6, sec: 1200, temp: 33, icu: { osecaSe: 36 } }, DAN);
    assert.equal(izSata.osecaj, 36, 'kad je izvor sat, njegov osećaj sme i treba');
  });

  test('prognoza bez temperature nije prognoza', () => {
    /* Open-Meteo ume da vrati sat sa `null` poljima. Tada se ide na rezervu,
       a ne „temp: null uz izvor om" — to bi bio broj koji ne postoji, označen
       kao pouzdan. */
    const a = app();
    saPrognozom(a, { '20': { temp: null, osecaj: null } });
    const t = a.call('tempTrcanja', { satTrk: 20, sec: 1200, temp: 33 }, DAN);
    assert.equal(t.izvor, 'sat');
    assert.equal(t.temp, 33);
  });
});

describe('Keš prognoze mora pokrivati i prošlost', () => {

  test('poziv ka Open-Meteo traži i prošle dane', async () => {
    /* Bez `past_days` keš drži samo današnji i naredna dva dana. Svako trčanje
       analizirano dan kasnije bi tada padalo na očitanje sa sata — mehanizam bi
       postojao a gotovo nikad ne bi radio. Zato se traži URL, ne izvorni kod:
       konstanta se lako preimenuje, ponašanje ne. */
    const a = app();
    a.evalIn("S.ui.geo={lat:44.8, lon:20.5};");
    let trazeno = null;
    a.ctx.fetch = async (u) => {
      trazeno = String(u);
      return { ok: true, json: async () => ({ hourly: { time: [DAN + 'T20:00'], temperature_2m: [30], apparent_temperature: [29], relative_humidity_2m: [24], wind_speed_10m: [8], precipitation_probability: [0] } }) };
    };
    const r = await a.call('vremePovuci', true);
    assert.ok(r.ok, 'povlačenje nije uspelo: ' + JSON.stringify(r));
    assert.match(trazeno, /[?&]past_days=\d+/, 'prognoza se traži samo unapred');
    const past = +/[?&]past_days=(\d+)/.exec(trazeno)[1];
    assert.ok(past >= 3, `past_days=${past} je prekratko da pokrije trčanje od pre par dana`);
  });
});

/* ============================================================
   ŠTA STVARNO STIGNE DO MODELA

   Ovaj blok je prvo bio pisan kao `assert.match(izvorniKod, /…/)`. Namerno
   kvarenje je pokazalo zašto to ne valja: ternar `t.izvor === 'sat' ? A : B`
   prepravljen u `false ? A : B` šalje modelu POGREŠNU granu, a sve tražene
   niske i dalje stoje u fajlu — svi testovi zeleni, ponašanje pokvareno. Isto
   upozorenje stoji i u test/README.md.

   Zato se ovde poziva pravi `handler`, sa lažnim `fetch`-om koji presretne
   poziv ka modelu i sačuva TEKST koji mu je poslat.
   ============================================================ */
describe('Šta stiže do modela', () => {

  const ENV = {
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    GEMINI_API_KEY: 'gk',
    VERCEL_URL: 'sub-19.vercel.app'
  };
  const origFetch = globalThis.fetch;
  const origEnv = {};
  beforeEach(() => { for (const k of Object.keys(ENV)) { origEnv[k] = process.env[k]; process.env[k] = ENV[k]; } });
  afterEach(() => {
    globalThis.fetch = origFetch;
    for (const k of Object.keys(ENV)) { if (origEnv[k] === undefined) delete process.env[k]; else process.env[k] = origEnv[k]; }
  });

  /* Pozove /api/analyze i vrati ceo tekst koji je otišao modelu. */
  async function promptZa(entered, session = { desc: '6×800 m', kind: 'int' }) {
    let poslato = '';
    globalThis.fetch = async (url, opt) => {
      const u = String(url);
      if (u.includes('/auth/v1/user'))
        return { ok: true, status: 200, json: async () => ({ id: 'u1', email: 'k@t.rs', email_confirmed_at: '2026-01-01' }) };
      if (u.includes('generativelanguage')) {
        poslato = String((opt && opt.body) || '');
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'analiza' }] } }] }) };
      }
      return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
    };
    const { default: h } = await import('../api/analyze.js?t=' + Date.now() + Math.random());
    const res = { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
    await h({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: { session, entered } }, res);
    assert.ok(poslato, 'model uopšte nije pozvan (odgovor: ' + JSON.stringify(res.body) + ')');
    /* Pravila su u `systemInstruction`, podaci sesije u `contents` — zamke
       gledaju obe strane, jer je poenta baš u tome da se slože. */
    const b = JSON.parse(poslato);
    const sys = (b.systemInstruction && b.systemInstruction.parts || []).map(p => p.text).join('\n');
    const usr = (b.contents || []).map(c => (c.parts || []).map(p => p.text).join(' ')).join('\n');
    return sys + '\n' + usr;
  }

  test('vrednost iz prognoze se modelu predstavlja kao temperatura vazduha', async () => {
    const p = await promptZa({ km: 9, temp: { temp: 30, osecaj: 29, sat: 20, izvor: 'om' } });
    assert.match(p, /30°C/, 'temperature nema u zahtevu');
    assert.match(p, /Temperatura vazduha u 20:00/, 'ne kaže se da je iz prognoze za sat trčanja');
    assert.match(p, /oseća se kao 29°C/);
    assert.doesNotMatch(p, /SENZOR NA RUČNOM SATU/, 'prognoza je označena kao očitanje sa sata');
  });

  test('vrednost sa sata nosi izričito upozorenje', async () => {
    const p = await promptZa({ km: 9, temp: { temp: 33, osecaj: null, sat: 20, izvor: 'sat' } });
    assert.match(p, /SENZOR NA RUČNOM SATU/, 'zglobno očitanje ide modelu bez oznake porekla');
    assert.match(p, /2-5 °C više/, 'modelu se ne kaže koliko senzor odstupa');
    assert.match(p, /ne nazivaj je ekstremnom/, 'nema zabrane reči koja je i bila problem');
  });

  test('stari klijent koji šalje go broj ne ostaje bez temperature, ali ni bez ograde', async () => {
    /* Offline kopija koja još nije osvežena šalje `temp: 31`. Ako bi se takav
       oblik odbacio, ti korisnici bi tiho izgubili toplotni kontekst. */
    const p = await promptZa({ km: 9, temp: 31 });
    assert.match(p, /31°C/, 'stari oblik je odbačen — korisnik je izgubio temperaturu');
    assert.match(p, /nepoznat izvor/, 'stari oblik prolazi bez ograde o poreklu');
  });

  test('bez temperature model ne dobija nikakav njen trag', async () => {
    const p = await promptZa({ km: 9 });
    assert.doesNotMatch(p, /Temperatura: /);
    assert.doesNotMatch(p, /Temperatura vazduha/);
  });

  test('temperatura PO KILOMETRU se više ne šalje', async () => {
    /* Dolazi iz Strava `temp` toka — isti zglobni senzor, samo u dvadeset
       redova. Pored jedne merodavne vrednosti iz prognoze to bi bio drugi
       izvor koji se s njom ne slaže, i to brojniji. */
    const p = await promptZa({
      km: 3, temp: { temp: 30, osecaj: 29, sat: 20, izvor: 'om' },
      perKm: [{ km: 1, paceSec: 240, hr: 150, temp: 33 }, { km: 2, paceSec: 238, hr: 158, temp: 35 }]
    });
    assert.match(p, /PODACI PO KILOMETRU/, 'blok po kilometru je nestao — zamka je zastarela');
    assert.doesNotMatch(p, /33°C/, 'po-km temperatura sa sata se opet šalje');
    assert.doesNotMatch(p, /35°C/);
  });

  test('„oseća se" sa intervals.icu se više ne šalje', async () => {
    /* Izvedeno je iz istog `average_temp` sa zgloba. Pored Open-Meteo osećaja
       to su dva broja za isti trenutak, iz dva različita sveta. */
    const p = await promptZa({
      km: 9, temp: { temp: 30, osecaj: 29, sat: 20, izvor: 'om' },
      icu: { gapSec: 250, osecaSe: 36, efikasnost: 1.8 }
    });
    assert.match(p, /GAP cele sesije/, 'icu blok je nestao — zamka je zastarela');
    assert.doesNotMatch(p, /36°C/, 'osećaj izveden iz zglobnog očitanja i dalje ide modelu');
  });

  test('pravilo o toploti razlikuje izvore', async () => {
    const p = await promptZa({ km: 9, temp: { temp: 30, osecaj: 29, sat: 20, izvor: 'om' } });
    const pravilo = /7\. TOPLOTA[^\n]*/.exec(p);
    assert.ok(pravilo, 'pravila o toploti nema u zahtevu');
    assert.match(pravilo[0], /ekstremno/i, 'pravilo ne pominje reč koja je i bila problem');
    assert.match(pravilo[0], /ru[čc]nom satu|zglobn/i, 'pravilo ne razlikuje izvore');
  });
});

describe('Prikaz u aplikaciji koristi isti izvor kao analiza', () => {

  test('kartica „Sa sata" piše odakle je temperatura', () => {
    const a = app();
    saPrognozom(a, { '20': { temp: 30, osecaj: 29 } });
    const redovi = a.call('metrikaSata', { satTrk: 20, sec: 1200, temp: 33 }, DAN);
    const red = redovi.find(r => r[0] === 'temperatura');
    assert.ok(red, 'nema reda sa temperaturom');
    assert.match(red[1], /30/, 'i dalje se crta očitanje sa sata');
    assert.doesNotMatch(red[1], /33/, 'zglobno očitanje je ostalo na kartici');
    assert.match(red[1], /prognoza/, 'red ne kaže odakle je broj');
  });

  test('kad radi rezerva, kartica to kaže', () => {
    const a = app();
    const redovi = a.call('metrikaSata', { satTrk: 6, sec: 1200, temp: 33 }, DAN);
    const red = redovi.find(r => r[0] === 'temperatura');
    assert.match(red[1], /33/);
    assert.match(red[1], /sa sata/, 'rezerva se predstavlja kao prognoza');
  });

  test('poređenje sa ranijim treninzima objašnjava mešane izvore', () => {
    /* Kartica niže redove iz raznih nedelja. Novije trčanje ima prognozu,
       starije (van prozora) samo sat — bez rečenice o tome, razlika u IZVORU
       čita se kao razlika u vremenu. */
    const a = app();
    const mesano = a.call('napomenaTemp', [{ temp: 30, tempIzvor: 'om' }, { temp: 33, tempIzvor: 'sat' }]);
    assert.match(mesano, /2-5 °C/, 'ne objašnjava zašto se ta dva broja ne porede');

    const samoSat = a.call('napomenaTemp', [{ temp: 33, tempIzvor: 'sat' }]);
    assert.match(samoSat, /sa sata/);

    assert.equal(a.call('napomenaTemp', [{ temp: null, tempIzvor: null }]), '',
      'napomena se javlja i kad temperature uopšte nema');
    assert.equal(a.call('napomenaTemp', []), '');
  });
});

describe('Sat trčanja stiže sa oba izvora', () => {

  test('intervals.icu sažetak nosi sat, ne samo datum', () => {
    /* `sazetak()` je do sada radio `start_date_local.slice(0,10)` i bacao vreme.
       Bez sata se temperatura nema gde tražiti u prognozi. */
    const src = readRepoFile('api/icu.js');
    assert.match(src, /sat: sh \? \+sh\[1\] : null/, 'icu sažetak ne vraća sat početka');
  });

  test('Strava uvoz upisuje sat u dnevnik', () => {
    const src = readRepoFile('app.js');
    assert.match(src, /l\.satTrk=\+sh\[1\]/, 'Strava putanja ne pamti sat trčanja');
  });

  test('sat se čita iz stringa, ne kroz new Date()', () => {
    /* Strava i intervals.icu vraćaju LOKALNO vreme trkača uz završno „Z".
       `new Date(...)` bi ga protumačio kao UTC i pomerio za zonu — trčanje u
       9 h iz Beograda postalo bi 11 h, i tražila bi se pogrešna prognoza. */
    for (const f of ['app.js', 'api/icu.js'])
      assert.match(readRepoFile(f), /\/\^\\d\{4\}-\\d\\d-\\d\\dT\(\\d\\d\)\//,
        `${f} ne čita sat iz stringa`);
  });
});
