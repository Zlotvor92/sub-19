/* RADNI DEO INTERVALA — ŠTA JESTE REP, A ŠTA NIJE

   PRIJAVA SA EKRANA (v259): sesija N8, 1,5 km WU + 6×1000 m @ 3:55 (2 min hod)
   + 2,5 km CD. Sat je snimio repove na 3:53,6 / 3:53,7 / 3:52,0 / 3:55,4 /
   3:52,4 / 3:46,0 — dakle prosek 3:52. Aplikacija je izračunala 4:40/km.

   UZROK: `icuKrugoviULaps` je izbacivao samo deonice koje intervals.icu
   izričito označi kao `RECOVERY` — dakle kaskanja IZMEĐU repova. Zagrevanje i
   hlađenje dolaze kao obične deonice, pa su ulazili u „radni deo": ukupno vreme
   svih osam deonica podeljeno sa 10 km daje tačno ~4:40.

   ŠTETA JE BILA DVOSTRUKA:
   1. Taj tempo u zoni I znači VDOT ~39 naspram stvarnih ~49, pa ga je
      `recordVdot` (s pravom) odbio kao neverodostojan. Korisnik je posle SVAKIH
      intervala dobijao žutu poruku „verovatno su u prosek ušla kaskanja" i
      morao da kuca tempo ručno.
   2. Tiše: isti niz ide u AI analizu, gde je zagrevanje stajalo kao
      „Rep 1 (1500 m): tempo 5:30", i u trend, gde je `repova` bilo 8 umesto 6.

   Strava putanja je taj izbor imala sve vreme (`workLapsSelect`); icu putanja,
   koja je u međuvremenu postala primarna, nije imala nikakav.

   ZAŠTO SE SKIDAJU SAMO KRAJEVI: prva verzija ispravke primenila je Stravino
   pravilo na ceo niz i time napravila grešku u suprotnom smeru — u lestvici
   1600 m @4:00 + 400 m @3:00 oba SU repovi, a razlika im je 33%, pa bi duži
   ispao i tempo bi bio 3:00 umesto 3:48. Dve postojeće zamke su to odmah
   uhvatile. Zagrevanje i hlađenje razlikuje POLOŽAJ, ne samo tempo. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const app = (o = {}) => loadApp({ now: '2026-08-12T20:00:00Z', ...o });

const WU = { tip: 'rad', distM: 1500, sec: 495, paceSec: 330, hr: 140 };
const CD = { tip: 'rad', distM: 2500, sec: 900, paceSec: 360, hr: 145 };
const ODMOR = { tip: 'oporavak', distM: 180, sec: 120, paceSec: 667 };
const rep = s => ({ tip: 'rad', distM: 1000, sec: s, paceSec: s, hr: 170 });
/* Repovi doslovno sa sata iz prijave. */
const REPOVI = [234, 234, 232, 235, 232, 226];
const SESIJA = [WU,
  rep(234), ODMOR, rep(234), ODMOR, rep(232), ODMOR,
  rep(235), ODMOR, rep(232), ODMOR, rep(226), CD];
/* 6 × 1000 m: 1393 s na 6 km = 232 s/km = 3:52/km */
const TACAN = Math.round(REPOVI.reduce((a, b) => a + b, 0) / 6);

describe('Prijavljena sesija: 1,5 km WU + 6×1000 m + 2,5 km CD', () => {

  test('krugovi su ŠEST repova, ne osam deonica', () => {
    const a = app();
    const laps = a.call('icuKrugoviULaps', SESIJA);
    assert.equal(laps.length, 6, 'zagrevanje i/ili hlađenje su ušli među repove');
    assert.deepEqual(laps.map(x => x.distM), [1000, 1000, 1000, 1000, 1000, 1000]);
    assert.deepEqual(laps.map(x => x.paceSec), REPOVI);
  });

  test('radni tempo je 3:52, ne 4:40', () => {
    const a = app();
    const t = a.call('icuRadniTempo', a.call('icuKrugoviULaps', SESIJA));
    assert.equal(t, TACAN, `dobijeno ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}/km`);
    assert.ok(t < 240, 'tempo je i dalje sporiji od 4:00 — krajevi nisu skinuti');
  });

  test('oporavci ostaju zakačeni za rep ispred sebe', () => {
    /* Bez ovoga trend gubi `pauzaPrva`/`pauzaZadnja`, a to je raniji znak da je
       serija bila preteška od samog pada tempa. */
    const a = app();
    const laps = a.call('icuKrugoviULaps', SESIJA);
    assert.deepEqual(laps.slice(0, 5).map(x => x.restSec), [120, 120, 120, 120, 120]);
    assert.equal(laps[5].restSec, undefined, 'poslednji rep je dobio nepostojeći oporavak');
  });

  test('taj tempo daje formu koja odgovara trkaču, pa se UPISUJE', () => {
    /* Jezgro prijave: automatski put je odustajao i tražio ručni unos. */
    const a = app();
    a.evalIn("S.vdotLog=[{id:'seed',ts:'2026-06-22',measured:48.6}]; preracunajVdotLog();");
    const forma = a.call('currentVdot');
    const t = a.call('icuRadniTempo', a.call('icuKrugoviULaps', SESIJA));
    const izmeren = a.evalIn(`Math.round(vdotFromPace(${t},'I')*10)/10`);
    assert.ok(Math.abs(izmeren - forma) < a.get('AUTO_VDOT_TOL'),
      `izmereno ${izmeren} naspram forme ${forma} — recordVdot bi ovo odbio`);
  });
});

describe('Šta se NE sme skinuti', () => {

  test('lestvica: sporiji rep u sredini ostaje rep', () => {
    /* 1600 @4:00 i 400 @3:00 su OBA radni. Razlika 33% — pravilo koje gleda
       samo tempo bi duži izbacilo i dalo 3:00 umesto 3:48. */
    const a = app();
    const laps = a.call('icuKrugoviULaps', [
      WU,
      { tip: 'rad', distM: 1600, sec: 384, paceSec: 240 },
      ODMOR,
      { tip: 'rad', distM: 400, sec: 72, paceSec: 180 },
      CD
    ]);
    assert.equal(laps.length, 2, 'legitiman sporiji rep je izbačen');
    assert.equal(a.call('icuRadniTempo', laps), 228, 'tempo nije ponderisan distancom');
  });

  test('čista serija bez zagrevanja i hlađenja ostaje netaknuta', () => {
    const a = app();
    const samoRepovi = REPOVI.map(rep);
    const laps = a.call('icuKrugoviULaps', samoRepovi);
    assert.equal(laps.length, 6, 'skinut je rep iako zagrevanja nema');
    assert.equal(a.call('icuRadniTempo', laps), TACAN);
  });

  test('ispod tri deonice se ne dira ništa — nema sredine iz koje bi se merilo', () => {
    const a = app();
    assert.equal(a.call('icuKrugoviULaps', [WU, rep(232)]).length, 2);
    assert.equal(a.call('icuKrugoviULaps', [rep(232)]).length, 1);
    assert.equal(a.call('icuKrugoviULaps', []).length, 0);
    assert.equal(a.call('icuKrugoviULaps', null).length, 0);
  });

  test('progresivni tempo: svi blokovi ostaju, skidaju se samo krajevi', () => {
    const a = app();
    const laps = a.call('icuKrugoviULaps', [
      WU,
      { tip: 'rad', distM: 2000, sec: 560, paceSec: 280 },
      { tip: 'rad', distM: 2000, sec: 520, paceSec: 260 },
      { tip: 'rad', distM: 2000, sec: 480, paceSec: 240 },
      CD
    ]);
    assert.deepEqual(laps.map(x => x.paceSec), [280, 260, 240],
      'blok progresivnog trčanja je izbačen kao da je zagrevanje');
  });
});

describe('Zagrevanje i hlađenje pojedinačno', () => {

  test('samo zagrevanje na početku', () => {
    const a = app();
    const laps = a.call('icuKrugoviULaps', [WU, rep(234), ODMOR, rep(232), ODMOR, rep(226)]);
    assert.deepEqual(laps.map(x => x.paceSec), [234, 232, 226]);
  });

  test('samo hlađenje na kraju', () => {
    const a = app();
    const laps = a.call('icuKrugoviULaps', [rep(234), ODMOR, rep(232), ODMOR, rep(226), CD]);
    assert.deepEqual(laps.map(x => x.paceSec), [234, 232, 226]);
  });

  test('neprekidan tempo između zagrevanja i hlađenja', () => {
    const a = app();
    const laps = a.call('icuKrugoviULaps', [
      WU, { tip: 'rad', distM: 6000, sec: 1560, paceSec: 260 }, CD
    ]);
    assert.equal(laps.length, 1, 'ostao je i WU ili CD');
    assert.equal(laps[0].paceSec, 260);
  });
});

/* ============================================================
   DRUGA PRIJAVA: 4:22 umesto 4:40 — bolje, ali i dalje pogrešno.

   Prva ispravka je skidala samo KRAJEVE niza. Ono što je ostajalo je bilo u
   SREDINI: intervals.icu ne označava uvek kaskanja tipom `RECOVERY`, a kad ih
   ne označi, ona stoje između repova — tamo gde pravilo po položaju po
   definiciji ne dopire. Rekonstrukcija te strukture daje 4:26, dakle praktično
   prijavljenih 4:22.

   Odatle tri sloja, svaki sa svojim poslom:
     1. DUŽINA REPA IZ PLANA — odlučujuća kad je plan zna (`qsFor`);
     2. OČIGLEDNO KASKANJE — sporije od najbržeg preko `KASKANJE_PRAG`, ma gde
        stajalo; jedini sloj koji doseže u sredinu;
     3. POLOŽAJ — zagrevanje i hlađenje na krajevima.
   ============================================================ */
describe('Kaskanja koja icu nije označio kao oporavak', () => {

  const WU2 = { tip: 'rad', distM: 1500, sec: 495, paceSec: 330 };
  const CD2 = { tip: 'rad', distM: 2500, sec: 900, paceSec: 360 };
  const kaskanje = { tip: 'rad', distM: 300, sec: 120, paceSec: 400 };
  const r2 = s => ({ tip: 'rad', distM: 1000, sec: s, paceSec: s });
  /* Kaskanja kao OBIČNE deonice, ne kao `oporavak` — dakle u sredini niza. */
  const NEOZNACENA = [WU2,
    r2(234), kaskanje, r2(234), kaskanje, r2(232), kaskanje,
    r2(235), kaskanje, r2(232), kaskanje, r2(226), CD2];

  test('bez plana: kaskanje iz sredine i dalje ispada', () => {
    const a = app();
    const laps = a.call('icuKrugoviULaps', NEOZNACENA);
    assert.equal(laps.length, 6, 'kaskanja iz sredine su ostala među repovima');
    assert.equal(a.call('icuRadniTempo', laps), TACAN);
  });

  test('sa planom: isti rezultat, drugim putem', () => {
    const a = app();
    const laps = a.call('icuKrugoviULaps', NEOZNACENA, [1000]);
    assert.equal(laps.length, 6);
    assert.equal(a.call('icuRadniTempo', laps, [1000]), TACAN);
  });

  test('plan bira po dužini repa — sve što nije ~1000 m ispada ma gde stajalo', () => {
    /* Najgori zamišljeni oblik: isečeno zagrevanje, stride, neoznačena
       kaskanja, isečeno hlađenje. Položaj tu ne pomaže; plan pomaže uvek. */
    const a = app();
    const kosmar = [
      { tip: 'rad', distM: 800, sec: 280, paceSec: 350 },
      { tip: 'rad', distM: 700, sec: 225, paceSec: 321 },
      { tip: 'rad', distM: 120, sec: 24, paceSec: 200 },
      r2(234), kaskanje, r2(234), kaskanje, r2(232), kaskanje,
      r2(235), kaskanje, r2(232), kaskanje, r2(226),
      { tip: 'rad', distM: 1200, sec: 430, paceSec: 358 },
      { tip: 'rad', distM: 1300, sec: 480, paceSec: 369 }
    ];
    const laps = a.call('icuKrugoviULaps', kosmar, [1000]);
    assert.equal(laps.length, 6, 'ostalo je nešto što nije rep');
    assert.deepEqual(laps.map(x => x.paceSec), REPOVI);
    assert.equal(a.call('icuRadniTempo', laps, [1000]), TACAN);
  });

  test('plan koji se NE poklapa sa istrčanim se ne primenjuje naslepo', () => {
    /* Plan kaže 1000 m, čovek istrčao 5×600. Da se pravilo primeni doslovno,
       ostalo bi NIŠTA i tempa ne bi bilo uopšte. */
    const a = app();
    const drugacije = [WU2,
      { tip: 'rad', distM: 600, sec: 138, paceSec: 230 },
      { tip: 'rad', distM: 600, sec: 139, paceSec: 232 },
      { tip: 'rad', distM: 600, sec: 137, paceSec: 228 },
      CD2];
    const laps = a.call('icuKrugoviULaps', drugacije, [1000]);
    assert.equal(laps.length, 3, 'plan je obrisao stvarno istrčane repove');
    assert.equal(a.call('icuRadniTempo', laps, [1000]), 230);
  });

  /* KASKANJE U TRČKARANJU — jedini oblik koji SAMO plan rešava.
     Hod od dva minuta je preko dva puta sporiji od repa, pa ga grubi sloj hvata
     bez ičije pomoći. Ali ko kaska trčkaranjem na 5:00/km uz repove na 3:52 je
     na odnosu 1,33 — ispod `KASKANJE_PRAG`, a u sredini niza, dakle van domašaja
     i pravila po položaju. Tu je dužina repa iz plana jedino što razlikuje
     kaskanje od repa. Ova zamka to i drži: bez plana ostaje pogrešno, i to je
     zapisano, a ne prećutano. */
  const kaskTrk = { tip: 'rad', distM: 400, sec: 120, paceSec: 300 };
  const SA_TRCKARANJEM = [WU2,
    r2(234), kaskTrk, r2(234), kaskTrk, r2(232), kaskTrk,
    r2(235), kaskTrk, r2(232), kaskTrk, r2(226), CD2];

  test('kaskanje u trčkaranju: plan ga skida, ostali slojevi ne mogu', () => {
    const a = app();
    const bezPlana = a.call('icuKrugoviULaps', SA_TRCKARANJEM);
    assert.ok(bezPlana.length > 6,
      'zamka ne meri ništa — grubi sloj je već sve rešio, pa plan nema šta da dokaže');
    assert.notEqual(a.call('icuRadniTempo', bezPlana), TACAN);

    const saPlanom = a.call('icuKrugoviULaps', SA_TRCKARANJEM, [1000]);
    assert.equal(saPlanom.length, 6, 'plan nije izdvojio repove');
    assert.equal(a.call('icuRadniTempo', saPlanom, [1000]), TACAN);
  });

  test('lestvica preživljava i grubi sloj', () => {
    /* KASKANJE_PRAG mora biti širi od razlike među repovima u lestvici
       (1600 @4:00 uz 400 @3:00 je odnos 1,33), a uži od hoda. */
    const a = app();
    assert.ok(a.get('KASKANJE_PRAG') > 1.34, 'prag bi izbacio sporiji rep lestvice');
    assert.ok(a.get('KASKANJE_PRAG') < 2.0, 'prag je toliko širok da hod prolazi');
    const laps = a.call('icuKrugoviULaps', [
      WU2,
      { tip: 'rad', distM: 1600, sec: 384, paceSec: 240 },
      kaskanje,
      { tip: 'rad', distM: 400, sec: 72, paceSec: 180 },
      CD2
    ]);
    assert.equal(laps.length, 2, 'lestvica je izgubila rep');
    assert.equal(a.call('icuRadniTempo', laps), 228);
  });

  test('hod od dva minuta je van svake sumnje kaskanje', () => {
    const a = app();
    const hod = { tip: 'rad', distM: 180, sec: 120, paceSec: 667 };
    const laps = a.call('icuKrugoviULaps', [r2(234), hod, r2(232), hod, r2(226)]);
    assert.deepEqual(laps.map(x => x.paceSec), [234, 232, 226]);
  });
});

describe('Treninzi uvezeni PRE ispravke', () => {

  /* Sinhronizacija ih više nikad ne dodirne (`lapsIzvor` počinje sa 'icu'), pa
     bi bez ova dva mehanizma zauvek nosili zagrevanje i hlađenje među repovima. */

  test('drugi sloj: icuRadniTempo čisti i već upisan niz', () => {
    /* Kartica „Ostvaren tempo" i trend računaju iz `l.laps` kakav jeste. */
    const a = app();
    const stari = [
      { distM: 1500, paceSec: 330 },
      ...REPOVI.map(p => ({ distM: 1000, paceSec: p })),
      { distM: 2500, paceSec: 360 }
    ];
    assert.equal(stari.length, 8, 'zamka ne polazi od zagađenog niza');
    assert.equal(a.call('icuRadniTempo', stari), TACAN,
      'star zapis i dalje daje tempo sa zagrevanjem i hlađenjem u proseku');
  });

  test('LAPS_VER tera jedno ponovno povlačenje', () => {
    /* Tvrdnje su vezane za KONKRETNU granu, ne za pojavu niza u fajlu:
       `lapsVer` se upisuje na dva mesta (krugovi i „nema strukture"), pa bi
       provera nad celim fajlom ostala zelena i kad se izgubi iz onog koje
       stvarno čuva repove. Isti propust je u ovom paketu već tri puta
       napravljen — v. revizija6.test.mjs. */
    const src = readRepoFile('app.js');
    assert.match(src, /const LAPS_VER = \d+;/, 'nema oznake verzije krugova');
    assert.match(src, /l\.laps=laps;\s*l\.lapsIzvor='icu';\s*l\.lapsVer=LAPS_VER;/,
      'verzija se ne upisuje uz same krugove — stari zapis se ne bi prepoznao kao star');
    assert.match(src, /l\.lapsIzvor='icu-bez-strukture';\s*l\.lapsVer=LAPS_VER;/,
      'kontinuirano trčanje bi se povlačilo iznova pri svakoj sinhronizaciji');
    assert.match(src,
      /startsWith\('icu'\)\s*&&\s*l\.lapsVer===LAPS_VER\)\)\s*\n\s*trazi\.push/,
      'uslov ponovnog povlačenja ne gleda verziju — stari treninzi ostaju pokvareni');
  });

  /* Star zapis sa kaskanjima u TRČKARANJU (400 m @5:00) — grubi sloj i položaj
     ih ne mogu skinuti, pa ove dve zamke istovremeno drže da drugi sloj zaista
     dobija plan (`qsFor`) na oba mesta gde se stari niz čita. */
  const STAR_ZAPIS = `S.log['n8d3']={status:'done',km:11,sec:3464,src:'icu',
      ts:'2026-08-12',runDate:'2026-08-12',lapsIzvor:'icu',
      laps:[{distM:1500,paceSec:330,avgHr:140},
            {distM:1000,paceSec:234,avgHr:172,restSec:120},{distM:400,paceSec:300,avgHr:150},
            {distM:1000,paceSec:234,avgHr:172,restSec:120},{distM:400,paceSec:300,avgHr:150},
            {distM:1000,paceSec:232,avgHr:172,restSec:120},{distM:400,paceSec:300,avgHr:150},
            {distM:1000,paceSec:235,avgHr:172,restSec:120},{distM:400,paceSec:300,avgHr:150},
            {distM:1000,paceSec:232,avgHr:172,restSec:120},{distM:400,paceSec:300,avgHr:150},
            {distM:1000,paceSec:226,avgHr:172},
            {distM:2500,paceSec:360,avgHr:145}]};`;

  test('trend iz starog zapisa daje tačan tempo', () => {
    const a = app();
    a.evalIn(STAR_ZAPIS);
    /* Da zamka nešto zaista meri: bez plana ovaj niz JESTE pogrešan. */
    assert.notEqual(a.evalIn(`icuRadniTempo(S.log['n8d3'].laps)`), TACAN,
      'ulaz nije zagađen — zamka ne dokazuje ništa');
    const r = JSON.parse(a.evalIn(
      `JSON.stringify(trendSummary().treninzi.find(x=>x.date==='2026-08-12')||null)`));
    assert.ok(r, 'trening nije ušao u trend');
    assert.equal(r.tempo, TACAN, 'trend računa tempo sa kaskanjima u proseku');
  });

  test('kartica „Ostvaren tempo" iz starog zapisa takođe', () => {
    const a = app();
    a.evalIn(STAR_ZAPIS);
    const m = JSON.parse(a.evalIn(
      `JSON.stringify(merenjaDana(BY_ID['n8d3'], S.log['n8d3']))`));
    assert.equal(m.tempo, TACAN, 'kartica pokazuje tempo sa kaskanjima u proseku');
  });
});

/* ============================================================
   CEO LANAC — od odgovora intervals.icu do upisanog tempa.

   Zamke iznad zovu `icuKrugoviULaps` neposredno, pa ne vide da li
   sinhronizacija uopšte PROSLEĐUJE plan. Mutacija koja je uklonila
   `qsFor(x.d.id)` iz poziva prolazila je zelena — ista klasa promašaja kao
   tvrdnja nad celim fajlom umesto nad granom.
   Datum je stvaran: 12.08.2026. je `n8d3`, sesija iz prijave.
   ============================================================ */
describe('Sinhronizacija: od icu odgovora do upisanog tempa', () => {

  function sinhronizuj(krugovi) {
    const a = loadApp({ now: '2026-08-13T09:00:00Z', online: true });
    a.evalIn(`S.icu={athleteId:'i1', token:'t', scope:'ACTIVITY:READ,WELLNESS:READ'};
      SB={access:'t',refresh:'r',expiresAt:Date.now()+3600e3,email:'x@t.rs',
          userId:'0403f8fb-a643-4d4e-843d-f71199a0d6f9',seenAt:null,deviceId:'d1'};
      S.vdotLog=[{id:'seed',ts:'2026-06-22',measured:48.6}]; preracunajVdotLog();`);
    a.ctx.__kr = krugovi;
    a.setFetch(async (url, opt) => {
      const b = JSON.parse(opt.body || '{}');
      if (b.detalji) return { ok: true, status: 200, json: async () =>
        ({ detalji: Object.fromEntries(b.detalji.map(i => [i, { krugovi: krugovi, grupe: [] }])) }) };
      if (b.tokovi) return { ok: true, status: 200, json: async () =>
        ({ tokovi: Object.fromEntries(b.tokovi.map(i => [i, { greska: true }])) }) };
      return { ok: true, status: 200, json: async () => ({ treninzi: [
        { id: 'a1', datum: '2026-08-12', sat: 20, tip: 'Run', naziv: 'Intervali',
          km: 11, sec: 3464, hr: 157, maxHr: 182 }
      ] }) };
    });
    return a;
  }

  const WU3 = { tip: 'rad', distM: 1500, sec: 495, paceSec: 330, hr: 140 };
  const CD3 = { tip: 'rad', distM: 2500, sec: 900, paceSec: 360, hr: 145 };
  const kask = { tip: 'rad', distM: 300, sec: 120, paceSec: 400, hr: 150 };
  const r3 = s => ({ tip: 'rad', distM: 1000, sec: s, paceSec: s, hr: 172 });

  /* Kaskanje u TRČKARANJU (400 m @5:00), ne u hodu: grubi sloj i položaj ga ne
     mogu skinuti, pa ovo istovremeno proverava i da sinhronizacija zaista
     PROSLEĐUJE plan `icuKrugoviULaps`-u. Sa hodom bi zamka prolazila i kad se
     plan izgubi iz poziva. */
  const kaskT = { tip: 'rad', distM: 400, sec: 120, paceSec: 300, hr: 150 };

  test('upisuje se 3:52, a ne 4:22 — i žuta poruka se ne pali', async () => {
    const a = sinhronizuj([WU3,
      r3(234), kaskT, r3(234), kaskT, r3(232), kaskT,
      r3(235), kaskT, r3(232), kaskT, r3(226), CD3]);
    const r = await a.evalIn('icuSyncTreninzi(30, true)');
    assert.ok(r.ok, 'sinhronizacija nije prošla: ' + JSON.stringify(r));

    const l = JSON.parse(a.evalIn('JSON.stringify(S.log["n8d3"]||null)'));
    assert.ok(l, 'trening nije vezan za n8d3 — zamka ne meri ništa');
    assert.equal(l.laps.length, 6, `u dnevnik je upisano ${l.laps.length} „repova"`);
    assert.equal(l.lapsVer, a.get('LAPS_VER'), 'verzija krugova nije upisana');
    assert.equal(l.autoOdbijen, undefined,
      'tempo je odbijen kao neverodostojan — žuta poruka bi i dalje stajala');

    const pid = a.evalIn(`predRowFor(BY_ID["n8d3"])`);
    assert.equal(a.evalIn(`S.pred[${JSON.stringify(pid)}]`), TACAN,
      'u Predikciju je upisan pogrešan tempo radnog dela');
  });

  test('forma raste, umesto da padne zbog dobrog treninga', () => {
    /* 4:22 u zoni I znači VDOT oko 41 — pad od sedam poena posle sesije koja je
       odrađena po planu. Zbog toga je `recordVdot` i odbijao upis. */
    const a = loadApp({ now: '2026-08-13T09:00:00Z' });
    const dobar = a.evalIn(`Math.round(vdotFromPace(${TACAN},'I')*10)/10`);
    const los = a.evalIn(`Math.round(vdotFromPace(262,'I')*10)/10`);
    assert.ok(dobar > 48, `tempo 3:52 daje VDOT ${dobar}`);
    assert.ok(los < 44, `tempo 4:22 daje VDOT ${los}`);
  });

  test('ručno unet tempo zadržava prednost nad automatskim', async () => {
    /* Ko je posle prijave sam ukucao tempo ne sme da ga izgubi ponovnim uvozom. */
    const a = sinhronizuj([WU3, r3(234), kask, r3(232), kask, r3(226), CD3]);
    const pid = a.evalIn(`predRowFor(BY_ID["n8d3"])`);
    a.evalIn(`S.pred[${JSON.stringify(pid)}]=240; S.predLock[${JSON.stringify(pid)}]=true;`);
    await a.evalIn('icuSyncTreninzi(30, true)');
    assert.equal(a.evalIn(`S.pred[${JSON.stringify(pid)}]`), 240,
      'automatski uvoz je pregazio ručno unet tempo');
  });
});

describe('Isti prag za oba izvora', () => {

  test('prag je jedna konstanta, ne dva broja', () => {
    /* Dok su bila dva zapisana broja, Stravina putanja je imala izbor a icu
       nikakav — i to se nije videlo ni iz jednog mesta u kodu. */
    const a = app();
    assert.equal(a.get('RADNI_PRAG'), 1.25);
    const src = readRepoFile('app.js');
    assert.doesNotMatch(src, /fastest\s*\*\s*1\.25/, 'Stravin prag je opet ukucan brojem');
    assert.match(src, /najbrzi\s*\*\s*RADNI_PRAG|Math\.min\(\.\.\.jezgro\)\s*\*\s*RADNI_PRAG/,
      'icu putanja ne koristi zajedničku konstantu');
  });

  test('Stravina putanja i dalje bira radne krugove po distanci i tempu', () => {
    /* Ispravka ne sme da promeni ono što je na toj putanji već validirano. */
    const a = app();
    const laps = [
      { distance: 1500, moving_time: 495 },   /* zagrevanje */
      { distance: 1000, moving_time: 234 },
      { distance: 1000, moving_time: 232 },
      { distance: 2500, moving_time: 900 }    /* hlađenje */
    ];
    assert.equal(a.call('workLapsTempo', laps, [1000]), 233);
  });
});
