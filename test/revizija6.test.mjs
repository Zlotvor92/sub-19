/* ŠESTA REVIZIJA — šest nalaza, šest zamki.

   Svaka zamka ovde je pisana po pravilu iz test/README.md: napisana je, pa je
   kod NAMERNO pokvaren da se potvrdi da zaista pukne. Uz svaku stoji koja je
   izmena obara — da sledeći čovek ne mora da pogađa šta ona čuva.

   Zajedničko svim šest nalaza: nijedan nije bio pokriven. Ceo paket od 1246
   provera ostajao je zelen i pre i posle ispravke svakog od njih. Zato ovaj
   fajl ne testira ISPRAVKE nego GRANICE koje su ispravke uspostavile. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile } from './repo.mjs';

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
    S.vreme={at:Date.now(), lat:44.81, lon:20.46, sati:{'2026-11-10T18':{temp:31,osecaj:33}}};`);

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

  test('neuspela statistika se VIDI, ne prikazuje se kao nula', async () => {
    /* Ovde je do sada stajala provera regularnim izrazom nad izvornim kodom
       (dve niske u fajlu). Takav test kaže samo da kod IZGLEDA očekivano — a
       otkad brojevi u zaglavlju dolaze iz VIŠE izvora, „šest nula" nije više ni
       tačan opis kvara: `app_stats` može da padne a da brojevi „Aktivnih",
       koji se računaju u samom izveštaju, budu ispravni.
       Zato se sada vozi pravi poziv i gleda ono što jedino znači nešto: da
       polje bez broja piše „—", a ne 0. */
    const stariFetch = globalThis.fetch;
    const env = {
      CRON_SECRET: 'tajna', SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'svc', RESEND_API_KEY: 'r',
      REPORT_TO: 'a@t.rs', REPORT_FROM: 'b@t.rs'
    };
    const staro = {};
    for (const k of Object.keys(env)) { staro[k] = process.env[k]; process.env[k] = env[k]; }
    let html = '', naslov = '';
    globalThis.fetch = async (u, o) => {
      const s = String(u);
      const J = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      if (s.includes('app_stats')) return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
      if (s.includes('/auth/v1/admin/users')) {
        return J(/[?&]page=1\b/.test(s) ? [{ id: 'u1', email: 'k@t.rs' }] : []);
      }
      if (s.includes('user_state')) {
        return J(+String((o.headers || {}).Range || '0-').split('-')[0] > 0 ? []
          : [{ user_id: 'u1', updated_at: new Date().toISOString(), data: { log: {} } }]);
      }
      if (s.includes('api.resend.com')) {
        const t = JSON.parse(o.body); html = t.html; naslov = t.subject; return J({ id: 'm' });
      }
      return J([]);
    };
    try {
      const { default: h } = await import('../api/daily-report.js?t=' + Math.random());
      const r = { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
      await h({ method: 'GET', headers: { authorization: 'Bearer tajna' } }, r);
      assert.equal(r.code, 200, JSON.stringify(r.body));
    } finally {
      globalThis.fetch = stariFetch;
      for (const k of Object.keys(env)) { if (staro[k] === undefined) delete process.env[k]; else process.env[k] = staro[k]; }
    }
    assert.match(html, /statistike nije učitan/i, 'kvar se ne vidi u mejlu');
    assert.match(naslov, /statistika nije učitana/, 'naslov mejla i dalje tvrdi „0 korisnika"');
    /* Tri polja iz app_stats moraju biti prazna… */
    const red = (n) => (html.match(new RegExp(esc(n) + '</td>\\s*<td[^>]*>([^<]*)</td>')) || [])[1];
    assert.equal(red('Korisnika ukupno'), '—', 'nula bez broja izgleda kao činjenica');
    assert.equal(red('Novih (7 dana)'), '—', 'nula bez broja izgleda kao činjenica');
    assert.equal(red('Sa generisanim planom'), '—', 'nula bez broja izgleda kao činjenica');
    /* …a onaj koji se računa ovde, i čiji su izvori odgovorili, mora ostati. */
    assert.equal(red('Aktivnih (danas)'), '1', 'ispravan broj je bačen zajedno sa pokvarenim');

    function esc(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  });
});

/* ============================================================
   N-6 · POLITIKA IMENUJE POSREDNIKA
   ============================================================ */
describe('N-6 · intervals.icu ključ prolazi kroz naš server', () => {

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
