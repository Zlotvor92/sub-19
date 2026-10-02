/* TRENINZI SA intervals.icu — PRIMARAN IZVOR, STRAVA REZERVA

   Tri stvari se ovde lako pokvare tiho:

   1. REDOSLED. „icu ako je povezan, inače Strava" je odluka koju ništa u
      izlazu ne pokazuje — ako se izvor zameni, sve i dalje radi, samo lošije.

   2. OBLIK KRUGOVA. `l.laps` čitaju `aiIzvor`, `trendSummary` i AI payload.
      Ako icu krugovi ne legnu u isti oblik, kartica i trend tiho počnu da
      pokazuju drugo — ili ništa.

   3. OPORAVCI KAO KRUGOVI. Ako pauze uđu u `laps`, „6×800" postane 11 krugova
      i prosečan tempo radnog dela postane besmislen. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile } from './repo.mjs';


/* Odgovor kakav vraća /api/activities za jednu 6×800 sesiju. */
const KRUGOVI = [
  { red: 0, tip: 'rad',      distM: 800, sec: 186, paceSec: 233, gapSec: 231, hr: 168, maxHr: 176, kadenca: 88, razdvajanje: 1.2 },
  { red: 1, tip: 'oporavak', distM: 200, sec: 120, paceSec: 600, hr: 140 },
  { red: 2, tip: 'rad',      distM: 800, sec: 188, paceSec: 235, gapSec: 234, hr: 172, maxHr: 179, kadenca: 88 },
  { red: 3, tip: 'oporavak', distM: 205, sec: 124, paceSec: 605, hr: 143 },
  { red: 4, tip: 'rad',      distM: 800, sec: 191, paceSec: 239, gapSec: 238, hr: 176, maxHr: 183, kadenca: 87 },
  { red: 5, tip: 'oporavak', distM: 210, sec: 131, paceSec: 624, hr: 146 }
];

describe('Ko sme da čita treninge', () => {


  test('OAuth opseg u kodu servera traži i treninge', () => {
    const izvor = readRepoFile('api/icu-oauth.js');
    const m = /const SCOPE = '([^']+)'/.exec(izvor);
    assert.ok(m, 'nema SCOPE konstante');
    assert.match(m[1], /ACTIVITY:READ/, 'opseg ne traži treninge — icu će vraćati 403');
    assert.match(m[1], /WELLNESS:READ/, 'izgubljen opseg za jutarnja merenja');
  });
});

describe('Server: /api/activities', () => {

  const src = readRepoFile('api/icu.js');

  test('režim tokova postoji, ograničen je i vraća Stravin oblik', () => {
    assert.match(src, /Array\.isArray\(body\.tokovi\)/, 'nema režima za sirove tokove');
    assert.match(src, /\.slice\(0, 3\)/, 'broj treninga po pozivu nije ograničen');
    assert.match(src, /'\/streams\?types='/, 'ne poziva se streams endpoint');
    assert.match(src, /tok\[s\.type\] = \{ data:/, 'odgovor nije sveden na Stravin oblik {type:{data}}');
    /* Bez ovog filtera bi se povlacili i tokovi koje perKmDetail ni ne cita. */
    assert.match(src, /if \(!ZELJENI\.includes\(s\.type\)\) continue;/, 'povlače se i tokovi koji se ne koriste');
  });

  test('traži prijavu i broji dnevni limit, kao i wellness', () => {
    assert.match(src, /requireUser\(req\)/);
    assert.match(src, /limitPrekoracen\(auth\.token, 'activities'/);
  });

  test('ključ ne izlazi iz servera ni u grešci', () => {
    assert.doesNotMatch(src, /error:.*apiKey/);
    assert.doesNotMatch(src, /console\.(log|warn|error)\([^)]*apiKey/);
    assert.match(src, /Nema veze sa intervals\.icu/);
  });

  test('403 se prevodi u uputstvo, ne u golu grešku', () => {
    assert.match(src, /starija veza nema dozvolu za treninge/);
  });

  test('odgovor je ograničen — ni spisak ni detalji ne mogu da narastu', () => {
    assert.match(src, /\.slice\(0, 12\)/, 'nema plafona na broj traženih detalja');
    assert.match(src, /\.slice\(0, 200\)/, 'nema plafona na dužinu spiska');
  });

  test('brzina i tempo se ne mešaju', () => {
    /* icu čuva `pace`/`gap` kao brzinu u m/s; ako se to protumači kao s/km,
       tempo ispadne 3 s/km i cela analiza je smeće. */
    assert.match(src, /function tempoIz/);
    assert.match(src, /x >= 1 && x <= 8/);
    assert.match(src, /x >= 100 && x <= 900/);
  });

  test('vraćaju se samo trčanja', () => {
    assert.match(src, /run\|trčanje\|trcanje/i);
  });
});

describe('Vlasnik nema limit AI analiza', () => {

  /* Ovde je do sada stajala provera regularnim izrazom nad izvornim kodom
     (`assert.match(src, /if \(!vlasnik && posao !== 'radi'\)/)`). Takav test
     kaže samo da kod IZGLEDA očekivano — a baš ta klasa je propustila potpun
     obilazak dnevnog limita (v. „Analiza odvojena od cekanja" u api.test.mjs).
     Zato se sada vozi pravi poziv i broji ono što jedino znači nešto: da li je
     brojač pomeren. */
  async function pozoviAnalizu(korisnik) {
    const stariFetch = globalThis.fetch;
    const env = {
      SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon',
      GEMINI_API_KEY: 'k', ADMIN_EMAIL: 'vlasnik@t.rs', VERCEL_URL: 'x.vercel.app'
    };
    const staro = {};
    for (const k of Object.keys(env)) { staro[k] = process.env[k]; process.env[k] = env[k]; }
    let brojano = 0, limiti = [];
    globalThis.fetch = async (u, o) => {
      const s = String(u);
      const J = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });
      if (s.includes('/auth/v1/user')) return J(korisnik);
      if (s.includes('check_and_bump_api_usage')) {
        brojano++;
        try { limiti.push(JSON.parse(o.body).p_limit); } catch (e) { limiti.push(null); }
        return J({});
      }
      if (s.includes('ai_posao') && o && o.method === 'POST') return J([{ id: 'p1' }]);
      return J({});
    };
    try {
      const { default: h } = await import('../api/analyze.js?t=' + Math.random());
      const r = { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {} };
      await h({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: { posao: 'start' } }, r);
      return { brojano, limiti, code: r.code };
    } finally {
      globalThis.fetch = stariFetch;
      for (const k of Object.keys(env)) { if (staro[k] === undefined) delete process.env[k]; else process.env[k] = staro[k]; }
    }
  }

  /* REGRESIJA IZ PRIJAVE: „u dnevnom izveštaju piše da je poslednja AI analiza
     06.08.2026", a analize su se radile skoro posle svakog treninga.
     Uzrok nije bio u izveštaju nego ovde: vlasnik je preskakao CEO poziv ka
     brojaču, pa u `api_usage` — jedinom izvoru te kolone — za njega nije
     ostajao nijedan red posle dana kad je izuzetak uveden.
     Ispravka razdvaja dve stvari koje su bile spojene: brojač se pomera SVIMA
     (zapis mora da postoji), a vlasniku se samo postavlja granica koju stvarna
     upotreba ne može da dotakne. */
  test('vlasniku se analiza BROJI, ali sa granicom koja ne seče', async () => {
    const o = await pozoviAnalizu({ id: 'v', email: 'vlasnik@t.rs', email_confirmed_at: '2026-01-01' });
    assert.equal(o.code, 200);
    assert.equal(o.brojano, 1, 'vlasnikova analiza nije ostavila trag u api_usage');
    assert.equal(o.limiti[0], 100000, 'vlasniku je poslata granica koja ga može preseći');
  });

  test('drugom korisniku se broji, sa pravim limitom', async () => {
    const o = await pozoviAnalizu({ id: 'k', email: 'neko@t.rs', email_confirmed_at: '2026-01-01' });
    assert.equal(o.brojano, 1, 'običan korisnik je preskočio brojač');
    assert.equal(o.limiti[0], 30, 'običnom korisniku je skinut dnevni limit');
  });

  test('NEPOTVRĐENA vlasnikova adresa ne skida limit', async () => {
    /* NAPAD: na Supabase podešavanju bez obavezne potvrde mejla svako se može
       registrovati vlasnikovom adresom i dobiti token sa `email: vlasnik,
       email_confirmed_at: null`. Bez provere potvrde time skida limit sebi. */
    const o = await pozoviAnalizu({ id: 'a', email: 'vlasnik@t.rs', email_confirmed_at: null });
    assert.equal(o.brojano, 1, 'nepotvrđena vlasnikova adresa je skinula limit');
    assert.equal(o.limiti[0], 30, 'nepotvrđena vlasnikova adresa je dobila vlasnikovu granicu');
  });
});
