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
import { readRepoFile } from './repo.mjs';

const DAN = '2026-08-09';

/* Prognoza kakvu `vremeCist` ostavlja u `S.vreme.sati`: ključ je 'YYYY-MM-DDTHH'.
   Brojevi su iz prijavljenog slučaja — 20 h je 30 °C uz osećaj 29. */
function saPrognozom(a, sati) {
  const zapis = {};
  Object.keys(sati).forEach(h => { zapis[DAN + 'T' + h] = sati[h]; });
  a.evalIn(`S.vreme={at:Date.now(), lat:44.8, lon:20.5, sati:${JSON.stringify(zapis)}}`);
}

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

describe('Sat trčanja stiže sa oba izvora', () => {

  test('intervals.icu sažetak nosi sat, ne samo datum', () => {
    /* `sazetak()` je do sada radio `start_date_local.slice(0,10)` i bacao vreme.
       Bez sata se temperatura nema gde tražiti u prognozi. */
    const src = readRepoFile('api/icu.js');
    assert.match(src, /sat: sh \? \+sh\[1\] : null/, 'icu sažetak ne vraća sat početka');
  });
});
