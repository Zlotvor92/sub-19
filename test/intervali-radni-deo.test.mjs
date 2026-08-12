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

  test('trend iz starog zapisa daje tačan tempo i tačan broj repova', () => {
    const a = app();
    a.evalIn(`S.log['n8d3']={status:'done',km:11,sec:3464,src:'icu',ts:'2026-08-12',runDate:'2026-08-12',
      laps:[{distM:1500,paceSec:330,avgHr:140},
            ${REPOVI.map(p => `{distM:1000,paceSec:${p},avgHr:170,restSec:120}`).join(',')},
            {distM:2500,paceSec:360,avgHr:145}]};`);
    const r = JSON.parse(a.evalIn(
      `JSON.stringify(trendSummary().treninzi.find(x=>x.date==='2026-08-12')||null)`));
    assert.ok(r, 'trening nije ušao u trend');
    assert.equal(r.tempo, TACAN, 'trend i dalje računa tempo sa zagrevanjem i hlađenjem');
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
