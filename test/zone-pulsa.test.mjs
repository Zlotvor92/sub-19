/* ZONE PULSA — GRANICE I RASPODELA MORAJU BITI IZ ISTOG SISTEMA

   ZAŠTO OVAJ FAJL POSTOJI

   Vreme po zonama (`l.icu.zonePuls`) je oduvek dolazilo sa intervals.icu, a
   granice zona (šta Z1 uopšte znači) ISKLJUČIVO sa Strave. To su dva sistema:
   Strava podrazumevano ima pet zona izvedenih iz maksimalnog pulsa, icu sedam
   izvedenih iz praga. Granice se ne poklapaju ni po broju ni po vrednostima.

   Model je dobijao Stravine nazive i icu raspodelu, jedno ispod drugog, bez
   ijedne reči da su iz različitih sistema — pa je niz brojeva čitao kroz tuđe
   nazive. Prijava korisnika: „ceo trening u zoni 1" za trčanje koje je po
   njegovim zonama bilo Z2.

   Pravilo koje se ovde drži zatvorenim: ko daje RASPODELU, daje i GRANICE.
   Kad to ne može, raspodela se ne imenuje. */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const app = (o = {}) => loadApp({ now: '2026-08-09T21:00:00Z', ...o });

/* Stravine zone kakve stižu sa /athlete/zones — pet, poslednja otvorena. */
const STRAVA = [
  { min: 0, max: 130 }, { min: 131, max: 150 }, { min: 151, max: 165 },
  { min: 166, max: 178 }, { min: 179, max: null }
];
/* icu zone posle prevoda na servera — sedam, poslednja otvorena. */
const ICU = [
  { min: 1, max: 122, ime: 'Recovery' }, { min: 123, max: 141, ime: 'Endurance' },
  { min: 142, max: 153, ime: 'Tempo' },  { min: 154, max: 165, ime: 'Threshold' },
  { min: 166, max: 175, ime: 'VO2Max' }, { min: 176, max: 185, ime: 'Anaerobic' },
  { min: 186, max: null, ime: 'Neuromuscular' }
];

describe('Koji izvor zona je merodavan', () => {

  test('kad je icu povezan, njegove zone imaju prednost nad Stravinim', () => {
    /* Ovo je cela poenta: raspodela dolazi sa icu-a, pa i granice moraju. */
    const a = app();
    a.evalIn(`S.strava={hrZones:${JSON.stringify(STRAVA)}}; S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(ICU)}};`);
    const iz = a.call('zoneIzvor');
    assert.equal(iz.izvor, 'icu');
    assert.equal(iz.zone.length, 7);
  });

  test('bez icu zona ostaju Stravine', () => {
    const a = app();
    a.evalIn(`S.strava={hrZones:${JSON.stringify(STRAVA)}}; S.icu=null;`);
    const iz = a.call('zoneIzvor');
    assert.equal(iz.izvor, 'strava');
    assert.equal(iz.zone.length, 5);
  });

  test('bez ijednog izvora nema zona, i to se kaže kao null', () => {
    const a = app();
    a.evalIn('S.strava=null; S.icu=null;');
    const iz = a.call('zoneIzvor');
    assert.equal(iz.zone, null);
    assert.equal(iz.izvor, null);
  });

  test('prazan niz zona sa icu-a ne otima prednost Stravi', () => {
    /* Inače bi jedan neuspeo prevod ostavio trkača bez ijedne zone, iako
       Stravine postoje i rade. */
    const a = app();
    a.evalIn(`S.strava={hrZones:${JSON.stringify(STRAVA)}}; S.icu={athleteId:'i1',apiKey:'k',hrZones:[]};`);
    assert.equal(a.call('zoneIzvor').izvor, 'strava');
  });
});

describe('PRIJAVLJEN SLUČAJ: isti puls, dva sistema, dve različite zone', () => {

  test('puls 138 je Strava Z2 i icu Z2 — ali granice nisu iste', () => {
    /* 138 pada u Stravinu Z2 (131-150) i u icu Z2 (123-141). Poklapanje je
       ovde slučajno i baš zato je zamka postavljena na puls gde se RAZILAZE. */
    const a = app();
    a.evalIn(`S.strava={hrZones:${JSON.stringify(STRAVA)}}; S.icu=null;`);
    assert.equal(a.call('zonaZaPuls', 138).n, 2);
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(ICU)}};`);
    assert.equal(a.call('zonaZaPuls', 138).n, 2);
  });

  test('puls 148 je Strava Z2 a icu Z3 — sistem odlučuje', () => {
    const a = app();
    a.evalIn(`S.strava={hrZones:${JSON.stringify(STRAVA)}}; S.icu=null;`);
    assert.equal(a.call('zonaZaPuls', 148).n, 2, 'Strava: 148 je u 131-150');
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(ICU)}};`);
    assert.equal(a.call('zonaZaPuls', 148).n, 3, 'icu: 148 je u 142-153');
  });

  test('poslednja zona je otvorena nagore u oba sistema', () => {
    /* Da je icu poslednju granicu preslikao doslovno (na maksimalnom pulsu),
       otkucaj iznad nje ne bi pripadao nijednoj zoni — i `zonaZaPuls` bi vratio
       null baš u najtežim trenucima trke. */
    const a = app();
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(ICU)}};`);
    assert.equal(a.call('zonaZaPuls', 199).n, 7);
  });
});

describe('Spisak zona koji korisnik vidi', () => {

  test('piše iz kog je servisa — inače nema u šta da se uporedi', () => {
    const a = app();
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(ICU)}};`);
    const h = a.call('zoneHTML');
    assert.match(h, /intervals\.icu/, 'ne piše odakle su zone');
    assert.match(h, /Z7/, 'sedma zona se ne crta');
    assert.match(h, /Neuromuscular/, 'icu nazivi zona se ne prikazuju');
  });

  test('sa Stravinim zonama poziva da poveže icu', () => {
    const a = app();
    a.evalIn(`S.strava={hrZones:${JSON.stringify(STRAVA)}}; S.icu=null;`);
    const h = a.call('zoneHTML');
    assert.match(h, /Strava/);
    assert.match(h, /intervals\.icu/, 'ne objašnjava zašto bi icu bio bolji izvor');
  });

  test('šest i sedam zona ne ostaju bez boje', () => {
    /* Paleta ima pet članova; bez klampa bi `boje[5]` bilo undefined i traka
       zone šest bi se iscrtala bez pozadine. */
    const a = app();
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(ICU)}};`);
    assert.doesNotMatch(a.call('zoneHTML'), /background:undefined/);
  });
});

/* ============================================================
   ŠTA STIŽE DO MODELA — preko pravog handler-a, ne čitanjem izvornog koda.
   (Razlog v. test/temperatura-trcanja.test.mjs — provera nad izvorom je već
   jednom propustila prepravku koja modelu šalje pogrešnu granu.)
   ============================================================ */
describe('Zone u zahtevu ka modelu', () => {

  const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', GEMINI_API_KEY: 'gk', VERCEL_URL: 'sub-19.vercel.app' };
  const origFetch = globalThis.fetch;
  const origEnv = {};
  beforeEach(() => { for (const k of Object.keys(ENV)) { origEnv[k] = process.env[k]; process.env[k] = ENV[k]; } });
  afterEach(() => {
    globalThis.fetch = origFetch;
    for (const k of Object.keys(ENV)) { if (origEnv[k] === undefined) delete process.env[k]; else process.env[k] = origEnv[k]; }
  });

  async function promptZa(telo) {
    let poslato = '';
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
    await h({ method: 'POST', headers: { authorization: 'Bearer jwt' }, body: { session: { desc: '9 km lako', tag: 'lako' }, entered: { km: 9 }, ...telo } }, res);
    assert.ok(poslato, 'model nije pozvan: ' + JSON.stringify(res.body));
    const b = JSON.parse(poslato);
    return ((b.systemInstruction && b.systemInstruction.parts || []).map(p => p.text).join('\n')
          + '\n' + (b.contents || []).map(c => (c.parts || []).map(p => p.text).join(' ')).join('\n'));
  }

  test('uz zone piše koliko ih je i iz kog su servisa', async () => {
    const p = await promptZa({ hrZones: ICU, hrZonesIzvor: 'icu' });
    assert.match(p, /7 zona/, 'broj zona se ne šalje — Z2 od pet i Z2 od sedam nisu isto');
    assert.match(p, /iz: intervals\.icu/, 'sistem zona se ne imenuje');
  });

  test('nazivi zona se ne izmišljaju', async () => {
    /* Ranije je stajao tvrd spisak ['Z1 oporavak',…,'Z5 VO2max'] koji se lepio
       na SVAKI izvor. Za sedmozonski model je „Z5 VO2max" prosto netačno. */
    const p = await promptZa({ hrZones: STRAVA, hrZonesIzvor: 'strava' });
    assert.doesNotMatch(p, /Z5 VO2max/, 'izmišljeni nazivi zona su se vratili');
    assert.match(p, /5 zona/);
    assert.match(p, /iz: Strava/);
  });

  test('icu nazivi zona se koriste kad postoje', async () => {
    const p = await promptZa({ hrZones: ICU, hrZonesIzvor: 'icu' });
    assert.match(p, /Z2 Endurance/, 'nazivi koje je trkač podesio se ne prosleđuju');
  });

  test('RASPODELA SE IMENUJE SAMO KAD SU GRANICE IZ ISTOG SISTEMA', async () => {
    /* Jezgro ispravke. icu raspodela + icu granice = sme. */
    const p = await promptZa({
      hrZones: ICU, hrZonesIzvor: 'icu',
      entered: { km: 9, icu: { zonePuls: [100, 1800, 200, 0, 0, 0, 0] } }
    });
    assert.match(p, /iste zone kao gore/, 'raspodela nije označena kao uporediva');
    assert.match(p, /100\/1800\/200/, 'raspodela se ne šalje');
  });

  test('icu raspodela uz STRAVINE granice se NE imenuje', async () => {
    /* Tačno stanje koje je proizvelo „ceo trening u zoni 1". */
    const p = await promptZa({
      hrZones: STRAVA, hrZonesIzvor: 'strava',
      entered: { km: 9, icu: { zonePuls: [100, 1800, 200, 0, 0, 0, 0] } }
    });
    assert.doesNotMatch(p, /100\/1800\/200/, 'raspodela iz drugog sistema i dalje ide modelu');
    assert.match(p, /DRUGOM sistemu zona/, 'modelu se ne kaže da raspodela nije uporediva');
    assert.match(p, /ne imenuj zone/, 'nema zabrane imenovanja');
  });

  test('raspodela sa POGREŠNIM BROJEM zona se ne imenuje ni kad je izvor icu', async () => {
    /* Trkač promeni broj zona na icu-u; stariji trening nosi raspodelu po
       starom broju. Indeksi se tada tiho pomere za jedno mesto. */
    const p = await promptZa({
      hrZones: ICU, hrZonesIzvor: 'icu',
      entered: { km: 9, icu: { zonePuls: [100, 1800, 200, 0, 0] } }
    });
    assert.doesNotMatch(p, /iste zone kao gore/, 'pomereni indeksi su prošli kao uporedivi');
    assert.match(p, /DRUGOM sistemu zona/);
  });

  test('pravilo zabranjuje imenovanje zone kad zona uopšte nema', async () => {
    const p = await promptZa({});
    assert.doesNotMatch(p, /ZONE PULSA OVOG TRKAČA/, 'prazan blok zona se svejedno šalje');
    assert.match(p, /Ako zone NISU date, ne imenuj nijednu zonu/, 'nema pravila za slučaj bez zona');
  });
});

describe('Server: povlačenje zona sa intervals.icu', () => {

  const src = readRepoFile('api/icu.js');

  test('grana postoji i traži prijavu kao i ostale', () => {
    assert.match(src, /sta === 'zone'/, 'nema grane za zone');
    assert.match(src, /limitPrekoracen\(auth\.token, 'zone'/, 'zone se ne broje u dnevni limit');
  });

  test('brojač `zone` je na spisku u rate-limit.sql', () => {
    /* Bez ovoga poziv pada sa BAD_ENDPOINT, a `limitPrekoracen` na grešku
       PROPUŠTA — endpoint bi radio nebrojen, uz ALARM na svaki poziv. */
    assert.match(readRepoFile('supabase/rate-limit.sql'), /'zone'/,
      'nov brojač nije dodat u SQL spisak dozvoljenih');
  });

  test('uzimaju se zone za TRČANJE, ne prve po redu', () => {
    /* Biciklističke zone istog čoveka su bitno drugačije. */
    assert.match(src, /types\.some\(t => \/run\|/, 'sportska podešavanja se ne filtriraju po tipu');
  });
});
