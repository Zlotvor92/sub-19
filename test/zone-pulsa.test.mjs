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
   RASPODELA PO ZONAMA — PROCENTI

   Traženo posle v253: analiza treba da napiše koliko je procenata trčano u
   kojoj zoni. Procenti se računaju u aplikaciji, ne u modelu — isti brojevi
   moraju stajati na kartici „Po zonama" i u zahtevu ka modelu. Da model sam
   deli sekunde, dobio bi priliku da pogreši u računu koji trkač vidi na ekranu
   tik iznad analize.
   ============================================================ */
describe('Raspodela po zonama — račun', () => {

  const saZonama = (zonePuls, zone = ICU) => {
    const a = app();
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(zone)}};`);
    return a;
  };
  const log = zonePuls => ({ icu: { zonePuls } });

  test('procenti se računaju iz sekundi', () => {
    const a = saZonama();
    const r = a.call('zoneRaspodela', log([600, 1800, 600, 0, 0, 0, 0]));
    assert.equal(r.ukupno, 3000);
    assert.equal(r.redovi[0].pct, 20);
    assert.equal(r.redovi[1].pct, 60);
    assert.equal(r.redovi[2].pct, 20);
  });

  test('ZBIR JE UVEK 100 — i kad zaokruživanje to ne bi dalo', () => {
    /* Sedam jednakih zona daje 14.28…% svaka; obično zaokruživanje na 14 daje
       98, na 15 daje 105. Na ekranu to izgleda kao greška u računu, i jeste. */
    const a = saZonama();
    for (const niz of [[100,100,100,100,100,100,100], [333,333,334,0,0,0,0], [1,2,3,5,7,11,13].map(x=>x*60)]) {
      const r = a.call('zoneRaspodela', log(niz));
      const zbir = r.redovi.reduce((s, x) => s + x.pct, 0);
      assert.equal(zbir, 100, `zbir ${zbir} za ${niz}`);
    }
  });

  test('nazivi zona sa icu-a se prenose u raspodelu', () => {
    const a = saZonama();
    const r = a.call('zoneRaspodela', log([600, 1800, 600, 0, 0, 0, 0]));
    assert.equal(r.redovi[1].ime, 'Endurance');
  });

  test('raspodela izostaje kad su granice STRAVINE', () => {
    /* Isti uslov kao u api/analyze.js: ko daje raspodelu, daje i granice. */
    const a = app();
    a.evalIn(`S.strava={hrZones:${JSON.stringify(STRAVA)}}; S.icu=null;`);
    assert.equal(a.call('zoneRaspodela', log([600, 1800, 600, 0, 0, 0, 0])), null);
  });

  test('raspodela izostaje kad se broj zona ne poklapa', () => {
    /* Trkač promeni broj zona; stariji trening nosi raspodelu po starom broju,
       pa je svaka oznaka „Z2" pomerena za jedno mesto. */
    const a = saZonama();
    assert.equal(a.call('zoneRaspodela', log([600, 1800, 600, 0, 0])), null);
  });

  test('trčanje kraće od minuta se ne deli na zone', () => {
    const a = saZonama();
    assert.equal(a.call('zoneRaspodela', log([10, 20, 0, 0, 0, 0, 0])), null);
  });

  test('bez icu podataka nema raspodele', () => {
    const a = saZonama();
    assert.equal(a.call('zoneRaspodela', {}), null);
    assert.equal(a.call('zoneRaspodela', null), null);
  });

  test('pokvarene vrednosti iz backupa ne prave NaN procente', () => {
    const a = saZonama();
    const r = a.call('zoneRaspodela', log([600, 'x', null, -50, 0, 0, 1800]));
    assert.ok(r, 'raspodela je otpala iako ima ispravnih vrednosti');
    for (const x of r.redovi) assert.ok(Number.isFinite(x.pct), `pct nije broj: ${x.pct}`);
    assert.equal(r.redovi.reduce((s, x) => s + x.pct, 0), 100);
  });
});

describe('Raspodela po zonama — kartica', () => {

  test('kartica prikazuje procenat po zoni', () => {
    const a = app();
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(ICU)}};`);
    const h = a.call('karticaZona', { icu: { zonePuls: [600, 1800, 600, 0, 0, 0, 0] } });
    assert.match(h, /Po zonama/);
    assert.match(h, /60 %/, 'procenat se ne prikazuje');
    assert.match(h, /Endurance/, 'naziv zone se ne prikazuje');
  });

  test('zone bez ijedne sekunde se ne crtaju', () => {
    const a = app();
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(ICU)}};`);
    const h = a.call('karticaZona', { icu: { zonePuls: [600, 1800, 0, 0, 0, 0, 0] } });
    assert.doesNotMatch(h, /Z5/, 'prazne zone pune karticu nulama');
    assert.match(h, /Z2/);
  });

  test('nema kartice kad raspodela nije uporediva', () => {
    const a = app();
    a.evalIn(`S.strava={hrZones:${JSON.stringify(STRAVA)}}; S.icu=null;`);
    assert.equal(a.call('karticaZona', { icu: { zonePuls: [600, 1800, 600, 0, 0, 0, 0] } }), '');
  });
});

/* ============================================================
   ZAŠTO RASPODELE NEMA

   Posle v255 raspodela se kod korisnika nije pojavila, a kartica je prosto
   nestala — isti prazan ekran za četiri različita uzroka. Nije se moglo
   razlikovati „nisi povukao zone" od „icu za ovo trčanje nema taj podatak", ni
   sa ekrana ni iz analize. Ovde se drži da svaki uzrok ima svoju rečenicu.
   ============================================================ */
describe('Kad raspodele nema, kartica kaže zašto', () => {

  const beziIcu = () => { const a = app(); a.evalIn('S.icu=null; S.strava=null;'); return a; };
  const saIcu = (extra = '') => {
    const a = app();
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k'${extra}};`);
    return a;
  };

  test('bez povezanog intervals.icu se ne javlja ništa', () => {
    /* Ko nema icu nema ni odakle da dobije raspodelu — poruka bi bila šum na
       svakom treningu, ne obaveštenje. */
    const a = beziIcu();
    assert.equal(a.call('zoneRazlog', { icu: { zonePuls: [600, 1800] } }), '');
    assert.equal(a.call('karticaZona', {}), '');
  });

  test('icu povezan ali zone nisu povučene — uputi na „Povuci sve"', () => {
    const a = saIcu();
    const r = a.call('zoneRazlog', { icu: { zonePuls: [600, 1800, 600, 0, 0, 0, 0] } });
    assert.match(r, /Povuci sve/, 'ne kaže šta korisnik treba da uradi');
    assert.match(a.call('karticaZona', { icu: { zonePuls: [600, 1800, 600, 0, 0, 0, 0] } }), /Povuci sve/);
  });

  test('ručno korigovan trening ima svoje objašnjenje', () => {
    /* `l.lock` blokira prepisivanje sa icu-a, pa `l.icu` za taj dan ne postoji.
       Bez ove rečenice izgleda kao kvar, a namerno je. */
    const a = saIcu(`,hrZones:${JSON.stringify(ICU)}`);
    const r = a.call('zoneRazlog', { lock: true });
    assert.match(r, /ručno korigovano/i, 'ne objašnjava zašto baš taj trening nema podatke');
  });

  test('trening bez zonePuls-a, a nije zaključan — druga rečenica', () => {
    const a = saIcu(`,hrZones:${JSON.stringify(ICU)}`);
    const r = a.call('zoneRazlog', {});
    assert.match(r, /vreme po zonama/);
    assert.match(r, /Povuci sve/, 'ne kaže šta korisnik treba da uradi');
    assert.doesNotMatch(r, /ručno/i, 'meša zaključan trening sa običnim');
  });

  test('nepoklapanje broja zona kaže OBA broja', () => {
    /* Bez konkretnih brojeva poruka ne govori ništa upotrebljivo. */
    const a = saIcu(`,hrZones:${JSON.stringify(ICU)}`);
    const r = a.call('zoneRazlog', { icu: { zonePuls: [600, 1800, 600, 0, 0] } });
    assert.match(r, /5 zona/, 'ne kaže po koliko zona je raspodela računata');
    assert.match(r, /7/, 'ne kaže koliko zona trkač sada ima');
  });

  test('kad raspodela POSTOJI, razloga nema', () => {
    const a = saIcu(`,hrZones:${JSON.stringify(ICU)}`);
    assert.equal(a.call('zoneRazlog', { icu: { zonePuls: [600, 1800, 600, 0, 0, 0, 0] } }), '');
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

  test('stara veza se prepoznaje pre nego što se poziv pošalje', () => {
    /* Poziv koji je unapred osuđen ne treba ni slati — a razlog se zna odmah. */
    const a = app();
    a.evalIn("S.icu={athleteId:'i1',token:'t',scope:'ACTIVITY:READ,WELLNESS:READ,CALENDAR:WRITE'};");
    assert.equal(a.call('icuImaZone'), false, 'stara veza je prošla kao da sme');
    a.evalIn("S.icu={athleteId:'i1',token:'t',scope:'ACTIVITY:READ,WELLNESS:READ,CALENDAR:WRITE,SETTINGS:READ'};");
    assert.equal(a.call('icuImaZone'), true, 'nova veza je odbijena');
  });

  test('veza preko API ključa nema scope i mora da prođe', () => {
    /* API ključ ima pun pristup; isto pravilo kao `icuImaTreninge`. */
    const a = app();
    a.evalIn("S.icu={athleteId:'i1',apiKey:'k'};");
    assert.equal(a.call('icuImaZone'), true, 'veza preko ključa je odbijena');
  });

  test('STARA VEZA NE SME DA BUDE PREPREKA — granice stižu uz aktivnost', () => {
    /* Ovo je jezgro ispravke posle druge prijave („ništa ne radi i dalje").
       Granice zona dolaze uz samu aktivnost, pod `ACTIVITY:READ` koji svaka
       veza koja uvozi treninge već ima. Veza bez `SETTINGS` i dalje mora da
       da punu raspodelu — inače se korisnik šalje na otkačivanje bez potrebe. */
    const a = app();
    a.evalIn("S.icu={athleteId:'i1',token:'t',scope:'ACTIVITY:READ,WELLNESS:READ'};");
    const l = { icu: { zonePuls: [600, 1800, 600], zoneGranice: [130, 150, 175] } };
    const r = a.call('zoneRaspodela', l);
    assert.ok(r, 'raspodela izostaje iako aktivnost nosi i granice i vremena');
    assert.equal(r.redovi.length, 3);
    assert.equal(r.redovi[1].pct, 60);
    assert.equal(a.call('zoneRazlog', l), '', 'javlja se razlog iako sve radi');
  });

  test('zapamćena greška sa servera ima prednost nad opštim uputstvom', () => {
    const a = app();
    a.evalIn("S.icu={athleteId:'i1',apiKey:'k',zoneGreska:'Konkretan razlog sa servera.'};");
    assert.equal(a.call('zoneRazlog', {}), 'Konkretan razlog sa servera.');
  });

  test('kad zone stignu, zapamćena greška se briše', () => {
    /* Inače bi stara poruka nadživela ispravku i tvrdila da je i dalje loše. */
    const src = readRepoFile('app.js');
    assert.match(src, /zapamti\(null\);/, 'uspeh ne čisti zapamćenu grešku');
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

/* ============================================================
   GRANICE IZ SAME AKTIVNOSTI

   Druga prijava: „ništa ne radi i dalje", uz karticu koja i dalje traži da se
   zone povuku. Prva ispravka je dodala opseg `SETTINGS:READ` i time tražila od
   svakog korisnika da otkači pa ponovo poveže — rešenje koje radi, ali traži
   ručnu radnju i ostavlja svakog ko je ne uradi bez raspodele.

   Bolji izvor je stajao tu sve vreme: intervals.icu uz svaku aktivnost šalje i
   granice zona po kojima je `icu_hr_zone_times` izračunat. To je pod
   `ACTIVITY:READ`, koji svaka veza koja uopšte uvozi treninge već ima — i po
   definiciji se poklapa sa raspodelom, jer je iz istog zapisa.
   ============================================================ */
describe('Granice zona iz aktivnosti', () => {

  test('gornje granice se prevode u {min,max}, poslednja otvorena', () => {
    const a = app();
    const z = a.call('zoneIzGranica', [122, 141, 153, 165, 175]);
    assert.equal(z.length, 5);
    assert.deepEqual({ min: z[0].min, max: z[0].max }, { min: 1, max: 122 });
    assert.deepEqual({ min: z[1].min, max: z[1].max }, { min: 123, max: 141 });
    assert.equal(z[4].max, null, 'poslednja zona nije otvorena nagore');
  });

  test('besmislene granice se odbijaju u celosti', () => {
    /* Pola tačnih zona je gore od nijedne — izgleda ispravno. */
    const a = app();
    for (const los of [[130, 120], [130], [10, 20, 30], [130, 130, 150],
                       [130, null, 160], [130, 'x', 160], null, [300, 400]])
      assert.equal(a.call('zoneIzGranica', los), null, `prošlo: ${JSON.stringify(los)}`);
  });

  test('granice iz aktivnosti imaju PREDNOST nad sportskim podešavanjima', () => {
    /* Podešavanja pokazuju stanje DANAS, a raspodela je od dana trčanja. Ako se
       razilaze, merodavno je ono iz zapisa tog trčanja. */
    const a = app();
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(ICU)}};`);
    const r = a.call('zoneRaspodela', { icu: { zonePuls: [600, 1800, 600], zoneGranice: [130, 150, 175] } });
    assert.ok(r, 'raspodela izostaje');
    assert.equal(r.redovi.length, 3, 'uzete su zone iz podešavanja (7) umesto iz aktivnosti (3)');
  });

  test('kad granica uz aktivnost nema, pada se na podešavanja', () => {
    /* Stariji uvozi nemaju `zoneGranice`; njima podešavanja i dalje rade. */
    const a = app();
    a.evalIn(`S.icu={athleteId:'i1',apiKey:'k',hrZones:${JSON.stringify(ICU)}};`);
    const r = a.call('zoneRaspodela', { icu: { zonePuls: [600, 1800, 600, 0, 0, 0, 0] } });
    assert.ok(r, 'rezerva preko podešavanja više ne radi');
    assert.equal(r.redovi.length, 7);
  });

  test('granice koje se ne poklapaju po broju se ignorišu, ne koriste naslepo', () => {
    const a = app();
    a.evalIn('S.icu={athleteId:"i1",apiKey:"k"};');
    assert.equal(a.call('zoneRaspodela', { icu: { zonePuls: [600, 1800, 600], zoneGranice: [130, 150] } }), null);
  });

  test('stariji uvoz bez granica i bez podešavanja upućuje na „Povuci sve"', () => {
    const a = app();
    a.evalIn('S.icu={athleteId:"i1",apiKey:"k"};');
    const r = a.call('zoneRazlog', { icu: { zonePuls: [600, 1800, 600] } });
    assert.match(r, /Povuci sve/);
    assert.match(r, /nije potrebna nikakva nova dozvola/, 'i dalje sugeriše problem sa dozvolom');
  });

  test('server prosleđuje granice uz aktivnost', () => {
    const src = readRepoFile('api/icu.js');
    assert.match(src, /zoneGranice: Array\.isArray\(a\.icu_hr_zones\)/, 'granice se ne čitaju sa aktivnosti');
    assert.match(readRepoFile('app.js'), /'zoneTempo','zoneGranice'/, 'granice se ne prenose u dnevnik');
  });
});
