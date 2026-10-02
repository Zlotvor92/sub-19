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
import { readRepoFile } from './repo.mjs';


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

  test('gotovi procenti stižu modelu i on ih ne preračunava sam', async () => {
    const p = await promptZa({
      hrZones: ICU, hrZonesIzvor: 'icu',
      entered: { km: 9, zoneUdeo: { ukupno: 3000, redovi: [
        { n: 1, sec: 600, pct: 20, ime: 'Recovery' },
        { n: 2, sec: 1800, pct: 60, ime: 'Endurance' },
        { n: 3, sec: 600, pct: 20, ime: 'Tempo' }
      ] } }
    });
    assert.match(p, /Z2 Endurance 60%/, 'procenti po zoni ne stižu modelu');
    assert.match(p, /NE preračunavaj/, 'modelu nije zabranjeno da sam deli sekunde');
  });

  test('model je IZRIČITO obavezan da raspodelu napiše', async () => {
    /* Bez ovog pravila procenti stignu, a analiza ih ne pomene — traženo
       ponasanje je da ih ispise redom od Z1 navise. */
    const p = await promptZa({ hrZones: ICU, hrZonesIzvor: 'icu' });
    assert.match(p, /OBAVEZNO JE NAPIŠI/, 'nema pravila koje traži ispis raspodele');
    assert.match(p, /redom od Z1 naviše/);
    assert.match(p, /Zone sa 0% preskoči/);
  });

  test('gotovi procenti imaju prednost nad sirovim sekundama', async () => {
    /* Oba oblika u istom zahtevu: sirov niz je samo rezerva za stariju offline
       kopiju. Da oba prodju, model bi dobio dva opisa iste stvari. */
    const p = await promptZa({
      hrZones: ICU, hrZonesIzvor: 'icu',
      entered: { km: 9,
        icu: { zonePuls: [600, 1800, 600, 0, 0, 0, 0] },
        zoneUdeo: { ukupno: 3000, redovi: [{ n: 1, sec: 600, pct: 20 }, { n: 2, sec: 1800, pct: 60 }, { n: 3, sec: 600, pct: 20 }] } }
    });
    assert.doesNotMatch(p, /u sekundama: 600\/1800/, 'sirov niz se salje uz vec izracunate procente');
    assert.match(p, /Z2 60%/);
  });

  test('stara offline kopija bez `zoneUdeo` i dalje dobija sirove sekunde', async () => {
    const p = await promptZa({
      hrZones: ICU, hrZonesIzvor: 'icu',
      entered: { km: 9, icu: { zonePuls: [600, 1800, 600, 0, 0, 0, 0] } }
    });
    assert.match(p, /600\/1800\/600/, 'stariji klijent je ostao bez raspodele');
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

/* ============================================================
   STVARNI UZROK PRIJAVE: OAUTH OPSEG

   Korisnik je posle v256 prijavio da ništa ne pomaže — brisao unos, sinhronizovao
   ponovo, a kartica je i dalje pisala „zone još nisu povučene". Poziv je uredno
   odlazio i uredno bio ODBIJEN: `SETTINGS:READ` nije bio u OAuth opsegu, jer je
   opseg nastao pre grane za zone. `icuZoneSync` je grešku gutala (`return false`
   bez traga), pa se spolja videlo samo odsustvo.

   Dve stvari se ovde drže: da opseg sadrži dozvolu, i da se neuspeh nikad više
   ne izgubi bez rečenice.
   ============================================================ */
describe('OAuth opseg za zone', () => {

  test('SETTINGS:READ je u traženom opsegu', () => {
    /* Bez njega intervals.icu na `/sport-settings` vraća 403 — a to je bio
       stvarni uzrok prijave. */
    const src = readRepoFile('api/icu-oauth.js');
    const m = /const SCOPE = '([^']+)'/.exec(src);
    assert.ok(m, 'SCOPE se više ne definiše ovako — zamka je zastarela');
    assert.match(m[1], /SETTINGS:READ/, 'opseg nema dozvolu za čitanje podešavanja');
    assert.doesNotMatch(m[1], /SETTINGS:WRITE/, 'vratio se opseg za UPIS, koji ništa ne koristi');
  });
});

describe('Server: oblik odgovora sa intervals.icu', () => {

  const src = readRepoFile('api/icu.js');

  test('probaju se OBE putanje za sportska podešavanja', () => {
    /* Pretpostavka o obliku odgovora je već jednom bila mesto gde je sve stalo.
       `/sport-settings` vraća go niz, `/athlete/{id}` ugnježdeno u
       `sportSettings` — prihvataju se oba. */
    assert.match(src, /sport-settings/, 'namenska putanja se ne poziva');
    assert.match(src, /Array\.isArray\(j\) \? j/, 'go niz se ne prihvata');
    assert.match(src, /j\.sportSettings/, 'ugnježden oblik se ne prihvata');
  });

  test('403 se prevodi u uputstvo, ne u golu grešku', () => {
    assert.match(src, /nema dozvolu za čitanje podešavanja/,
      '403 na zonama ne kaže korisniku šta da uradi');
  });

  test('prazne zone nose razlog, ne ćutanje', () => {
    assert.match(src, /razlog: zone \? null :/, 'odsustvo zona se ne objašnjava');
  });
});
