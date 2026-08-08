/* TEST NA 3 KM I TEŽINE U LANCU FORME

   Dve stvari koje se ovde lako pokvare tiho:

   1. TEŽINA. `ALPHA` je jedina tabela koja odlučuje koliko jedno merenje sme da
      pomeri formu. Ako se repeticije i intervali ikad opet slože u istu kantu,
      šest dvestotinjaka tri dana pred trku počeće da pomera predikciju kao
      pravi tempo trening — a to se na ekranu vidi tek kroz nedelje.

   2. PUT DO VDOT-a. Test je TRKA na 3000 m, ne kvalitetna sesija: VDOT mu se
      računa direktno iz distance i vremena. Ako ikad prođe kroz zonsku putanju
      (tempo → zona), najtačnije merenje forme postaje najnetačnije. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const DANAS = '2026-08-05T09:00:00Z';
const app = (danas = DANAS) => loadApp({ now: danas });

describe('Koliko koje merenje sme da pomeri formu', () => {

  test('redosled poverenja: test > tempo > intervali > repeticije', () => {
    const a = app();
    const A = a.get('ALPHA');
    assert.ok(A.test > A.tempo, `test (${A.test}) nije jači od tempa (${A.tempo})`);
    assert.ok(A.tempo > A.int, `tempo (${A.tempo}) nije jači od intervala (${A.int})`);
    assert.ok(A.int > A.rep, `intervali (${A.int}) nisu jači od repeticija (${A.rep})`);
  });

  test('repeticije više NISU u istoj kanti sa intervalima', () => {
    /* Do sada su delile 0,12. Poenta izmene je da 200 m sa punim odmorom i
       1000 m sa kaskanjem nisu jednako pouzdan pokazatelj forme. */
    const a = app();
    const A = a.get('ALPHA');
    assert.notEqual(A.rep, A.int, 'repeticije i intervali opet imaju istu težinu');
    assert.ok(A.rep <= 0.05, `repeticije pomeraju formu previše (${A.rep})`);
  });

  test('zona određuje kantu, a test se prepoznaje po ID-ju', () => {
    const a = app();
    a.evalIn(`CUR_PRED.push(
      {id:'zr', w:1, l:'N1 · Repeticije', q:1, pt:220},
      {id:'zi', w:1, l:'N1 · Intervali',  q:4, pt:240},
      {id:'zt', w:1, l:'N1 · Tempo',      q:5, pt:258})`);
    assert.equal(a.call('tipSesijeZaVdot', 'zr'), 'rep');
    assert.equal(a.call('tipSesijeZaVdot', 'zi'), 'int');
    assert.equal(a.call('tipSesijeZaVdot', 'zt'), 'tempo');
    assert.equal(a.call('tipSesijeZaVdot', 't3k-2026-08-05-abc'), 'test');
    assert.equal(a.call('tipSesijeZaVdot', 'nepoznato'), 'rain_default');
  });

  test('isti pomak izmerene forme pomera lanac srazmerno težini', () => {
    const a = app();
    const bv = a.call('baselineVdot');
    const cilj = bv + 5;
    const rep = a.call('prigusiVdot', bv, cilj, 'rep');
    const int = a.call('prigusiVdot', bv, cilj, 'int');
    const tst = a.call('prigusiVdot', bv, cilj, 'test');
    assert.ok(rep.vdot - bv < int.vdot - bv, 'repeticije pomeraju kao intervali');
    assert.ok(tst.vdot - bv > int.vdot - bv, 'test ne pomera jače od intervala');
    /* „gotovo da ne utiče" mora i brojčano da važi: pet poena razlike sme da
       pomeri formu najviše za oko četvrt poena. */
    assert.ok(rep.vdot - bv <= 0.3, `repeticije pomeraju ${rep.vdot - bv} poena na 5 poena razlike`);
  });
});

describe('Test na 3 km — put do VDOT-a', () => {

  test('VDOT se računa direktno iz 3000 m, ne preko Riegel-5K', () => {
    const a = app();
    const sec = 702;                       /* 11:42 */
    assert.equal(a.call('t3kVdot', sec), a.evalIn(`r1(vdotFromRace(3000, ${sec}))`));
    /* Preko zonske putanje bi ispalo nešto drugo — baš to se izbegava. */
    const prekoZone = a.evalIn(`r1(vdotFromPace(${Math.round(sec / 3)}, 'I'))`);
    assert.notEqual(a.call('t3kVdot', sec), prekoZone);
  });

  test('brže vreme daje viši VDOT, i to monotono', () => {
    const a = app();
    let prosli = -Infinity;
    for (const sec of [900, 840, 780, 720, 660, 600]) {
      const v = a.call('t3kVdot', sec);
      assert.ok(v > prosli, `${sec} s nije dalo viši VDOT od prethodnog`);
      prosli = v;
    }
  });

  test('besmisleno vreme ne pravi VDOT', () => {
    const a = app();
    assert.equal(a.call('t3kVdot', 0), null);
    assert.equal(a.call('t3kVdot', -5), null);
  });

  test('upis testa ulazi u lanac sa težinom testa', () => {
    const a = app();
    a.call('dodajT3k', '2026-08-01', 702);
    const log = a.evalIn('JSON.stringify(S.vdotLog)');
    const e = JSON.parse(log)[0];
    assert.ok(String(e.id).startsWith('t3k-'), `ID nema prefiks: ${e.id}`);
    assert.equal(e.alpha, a.get('ALPHA').test);
    assert.equal(e.measured, a.call('t3kVdot', 702));
    assert.equal(e.prev, a.call('baselineVdot'));
  });

  test('brisanje testa vraća lanac na stanje bez njega', () => {
    const a = app();
    const bv = a.call('baselineVdot');
    a.call('dodajT3k', '2026-08-01', 702);
    assert.notEqual(a.call('currentVdot'), null);
    const id = a.evalIn('S.t3k[0].id');
    a.call('obrisiT3k', id);
    assert.equal(a.evalIn('S.t3k.length'), 0);
    assert.equal(a.evalIn('S.vdotLog.length'), 0, 'zapis je ostao u lancu forme');
    assert.equal(a.call('currentVdot'), null, `forma nije vraćena na polaznu (${bv})`);
  });

  test('izmena postojećeg testa ne pravi drugi zapis', () => {
    const a = app();
    a.call('dodajT3k', '2026-08-01', 720);
    const id = a.evalIn('S.t3k[0].id');
    a.call('zabeleziT3k', id, 700, '2026-08-01');
    assert.equal(a.evalIn('S.vdotLog.length'), 1);
    assert.equal(a.evalIn('S.vdotLog[0].measured'), a.call('t3kVdot', 700));
  });
});

describe('Test ulazi u predikciju', () => {

  test('bez ijedne sesije test sam daje i zadnju i najbržu predikciju', () => {
    const a = app();
    a.call('dodajT3k', '2026-08-01', 702);
    const pc = a.call('predCalc');
    assert.equal(pc.testovi.length, 1);
    assert.ok(pc.last, 'nema zadnje predikcije');
    assert.ok(pc.best, 'nema najbrže predikcije');
    assert.ok(pc.last.r.test3k, 'zadnja predikcija ne dolazi iz testa');
    assert.ok(pc.last.pred > 0 && isFinite(pc.last.pred));
  });

  test('test NIJE u `rows` — inače bi pomerio svaku tačku grafikona', () => {
    /* chartPred crta rows po indeksu naspram CUR_PRED; ubacivanje testa u taj
       niz razmestilo bi ceo grafikon za jedno mesto. */
    const a = app();
    const pre = a.call('predCalc').rows.length;
    a.call('dodajT3k', '2026-08-01', 702);
    assert.equal(a.call('predCalc').rows.length, pre);
    assert.equal(a.evalIn('predCalc().rows.length'), a.evalIn('CUR_PRED.length'));
  });

  test('crvena linija grafikona staje na poslednjoj SESIJI, ne na testu', () => {
    const a = app();
    a.evalIn(`S.pred['p1']=250; recordVdot('p1',250,'2026-06-26',null,false,null);`);
    a.call('dodajT3k', '2026-08-01', 702);
    const pc = a.call('predCalc');
    assert.ok(pc.last.r.test3k, 'test nije najnoviji');
    assert.ok(pc.lastRed && !pc.lastRed.r.test3k, 'lastRed pokazuje na test');
    assert.equal(pc.lastRed.r.id, 'p1');
  });

  test('test se crta kao zaseban znak na grafikonu predikcije', () => {
    const a = app();
    a.call('dodajT3k', '2026-08-01', 702);
    const svg = String(a.call('chartPred', a.call('predCalc')));
    assert.match(svg, /<path d="M[\d.]+,[\d.]+ L/, 'nema romba za test');
    assert.doesNotMatch(svg, /NaN/);
  });

  test('test van plana ne izlazi iz grafikona', () => {
    const a = app();
    a.call('dodajT3k', '2026-01-01', 702);   /* pre početka plana */
    a.call('dodajT3k', '2027-01-01', 700);   /* posle trke */
    const w = a.call('predCalc').testovi.map(t => t.r.w);
    const n = a.evalIn('CUR_PLAN.length');
    for (const x of w) assert.ok(x >= 1 && x <= n, `nedelja ${x} je van plana (1–${n})`);
    assert.doesNotMatch(String(a.call('chartPred', a.call('predCalc'))), /NaN/);
  });
});

describe('Kartica testa', () => {

  test('prazna kartica objašnjava i poziva na unos', () => {
    const a = app();
    const h = String(a.call('t3kKarta'));
    assert.match(h, /Test 3 km/);
    assert.match(h, /id="t3k-add"/);
    assert.doesNotMatch(h, /NaN|undefined/);
  });

  test('puna kartica pokazuje šta TAJ test znači, ne izglačanu formu', () => {
    const a = app();
    a.call('dodajT3k', '2026-08-01', 702);
    const h = String(a.call('t3kKarta'));
    assert.match(h, /11:42/, 'nema unetog vremena');
    assert.match(h, /VDOT iz testa/);
    const izTesta = a.call('t3kVdot', 702);
    assert.ok(h.includes(String(izTesta).replace('.', ',')),
      `kartica ne pokazuje VDOT iz testa (${izTesta})`);
    assert.doesNotMatch(h, /NaN|undefined/);
  });

  test('raniji testovi su na kartici i mogu se otvoriti', () => {
    const a = app();
    a.call('dodajT3k', '2026-07-15', 725);
    a.call('dodajT3k', '2026-08-01', 702);
    const h = String(a.call('t3kKarta'));
    assert.equal((h.match(/data-t3k="/g) || []).length, 2, 'nisu svi testovi dostupni za izmenu');
    assert.ok(h.indexOf('11:42') < h.indexOf('12:05'), 'najnoviji test nije na vrhu');
  });

  test('kartica ne piše decimalnu tačku', () => {
    const a = app();
    a.call('dodajT3k', '2026-08-01', 702);
    const tekst = String(a.call('t3kKarta')).replace(/<[^>]*>/g, ' ');
    assert.deepEqual(tekst.match(/\d+\.\d/g) || [], []);
  });
});

describe('Trajnost i uvoz', () => {

  test('testovi preživljavaju migraciju starog stanja', () => {
    const a = app();
    a.ctx.__st = { v: 7, log: {}, t3k: undefined };
    const m = a.evalIn('JSON.stringify(migrate(__st))');
    assert.deepEqual(JSON.parse(m).t3k, [], 'stanje bez t3k ne dobija prazan niz');
    assert.equal(JSON.parse(m).v, a.get('SCHEMA'));
  });

  test('uvezen zapis bez prefiksa u ID-ju se odbacuje', () => {
    /* Bez prefiksa `tipSesijeZaVdot` ga ne prepoznaje kao test, pa bi tiho
       dobio podrazumevanu težinu — izgledao bi kao test, a ne bi bio. */
    const a = app();
    a.ctx.__st = { v: 8, log: {}, t3k: [
      { id: 't3k-2026-08-01-ok', date: '2026-08-01', sec: 702 },
      { id: 'nesto-drugo',       date: '2026-08-01', sec: 702 },
      { id: 't3k-lose-vreme',    date: '2026-08-01', sec: 0 },
      { id: 't3k-lose-datum',    date: 'juce',       sec: 702 }
    ] };
    const m = JSON.parse(a.evalIn('JSON.stringify(migrate(__st))'));
    assert.deepEqual(m.t3k.map(t => t.id), ['t3k-2026-08-01-ok']);
  });

  test('pokvaren ID testa obara proveru uvoza', () => {
    const a = app();
    a.ctx.__st = { v: 8, log: {}, t3k: [{ id: 't3k-<img src=x>', date: '2026-08-01', sec: 702 }] };
    assert.equal(a.evalIn('losIdUStanju(__st)'), 't3k.id');
  });

  test('testovi idu i na server, kao i svako drugo merenje', () => {
    const a = app();
    a.call('dodajT3k', '2026-08-01', 702);
    const p = JSON.parse(a.evalIn('JSON.stringify(sbPayload(S))'));
    assert.equal(p.t3k.length, 1);
    assert.equal(p.vdotLog.length, 1);
  });
});

describe('Aktivacija u trkačkoj nedelji', () => {

  const gen = (a, over = {}) => {
    a.ctx.__i = {
      startDate: '2026-08-05', raceDate: '2026-12-06', raceDistM: 5000,
      pb: { distM: 5000, sec: 1237 }, weeklyKm: 40, runDays: 4,
      quality: 2, intensity: 'std', trainedRecently: true, ...over
    };
    return a.evalIn('JSON.stringify(generatePlan(__i))');
  };

  test('aktivacioni dan je prava sesija, ne samo opis', () => {
    const a = app();
    const p = JSON.parse(gen(a));
    const trkacka = p.weeks[p.weeks.length - 1];
    const akt = trkacka.days.find(d => d.session);
    assert.ok(akt, 'trkačka nedelja nema nijednu sesiju');
    assert.equal(akt.session.kind, 'Repeticije', 'aktivacija se ne vodi kao repeticije');
    assert.equal(akt.session.repM, 200);
    assert.match(akt.desc, /aktivacija/);
  });

  test('njen PRED red i qs ključ pokazuju na taj isti dan', () => {
    /* Ranije su se dopisivali ručno, pa je plan tvrdio da postoji sesija
       „Intervali" koju nijedan dan ne nosi. */
    const a = app();
    const p = JSON.parse(gen(a));
    const w = p.weeks[p.weeks.length - 1];
    const akt = w.days.find(d => d.session);
    const red = p.pred.filter(r => r.w === w.w);
    assert.equal(red.length, 1);
    assert.equal(red[0].l, 'N' + w.w + ' · ' + akt.session.kind);
    assert.ok(p.qs['n' + w.w + 'd' + akt.dow], 'qs ključ ne pokazuje na aktivacioni dan');
  });

  test('aktivacija formu ne pomera UOPŠTE', () => {
    /* RANIJE JE OVDE STAJALO „pomera jedva primetno" (< 0.35 poena), uz
       oslanjanje na najmanju težinu u lancu (ALPHA.rep). Prigušenje nije
       isključenje, i merenjem se videlo koliko: trkač koji aktivaciju odradi
       TAČNO kako piše dobio bi pad forme (maraton 45.4 → 45.0) i predikciju
       goru nego pre poslednjeg treninga (3:26:44 → 3:28:16) — poslednji broj
       pred trku lošiji zato što je trening odrađen ispravno.

       Uzrok: aktivaciji je tempo `max(rp-4, pI-6)`, dakle tempo TRKE, a vodi
       se kao Repeticije. Pročitana kroz R zonu daje VDOT ispod polaznog (na
       maratonu 35.8 naspram vdot0 41.0). Propis je ispravan kao propis;
       greška je bila čitati ga kao merenje. */
    const a = app();
    a.ctx.__p = JSON.parse(gen(a));
    a.evalIn('S.genPlan=adaptGeneratedPlan(__p); setActivePlan(); rebuildDateIndex();');
    const red = a.evalIn(`JSON.stringify(CUR_PRED.filter(r=>/Repeticije/.test(r.l)).slice(-1)[0])`);
    const r = JSON.parse(red);
    assert.ok(r, 'nema reda za repeticije');
    assert.equal(r.nemeri, true, 'aktivacija nije označena kao sesija koja ne meri formu');
    assert.equal(a.call('tipSesijeZaVdot', r.id), 'rep');

    assert.equal(a.call('recordVdot', r.id, r.pt - 10, '2026-12-04', null, false, null), null,
      'aktivacija je ušla u lanac forme');
    assert.equal(a.evalIn('(S.vdotLog||[]).length'), 0, 'aktivacija je ostavila zapis u lancu');
    assert.equal(a.call('currentVdot'), null, 'forma je nastala iz aktivacije');

    /* Tempo se i dalje čuva i prikazuje — samo ne postaje predikcija. */
    a.evalIn(`S.pred[${JSON.stringify(r.id)}]=${r.pt}; S.predLock[${JSON.stringify(r.id)}]=true;`);
    const pc = a.call('predCalc');
    assert.ok(!pc.entered.some(x => x.r.id === r.id),
      'aktivacija je ucrtana u predikciju — i to kao najgora tačka, tri dana pred trku');
  });
});

/* NEMOGUĆE MERENJE.

   PRIJAVA IZ UPOTREBE: „trend ne uračunava 3k test kako treba, analiza je
   loša". Na ekranu: forma sa 48,6 skoči na 73,5 i tu ostane, a AI analiza taj
   skok čita kao činjenicu i piše da „statistika zabeleženog VDOT-a raste".

   Uzrok je bio jedan broj u proveri: unos je propuštao sve preko 5:00, a
   svetski rekord na 3000 m je 7:20. Otkucano ~6:50 daje izmeren VDOT 89, pa
   lanac sa težinom testa (0,60) skoči tačno na 73,5.

   Ovo nije samo provera unosa. Meri se ceo put: da unos ne prođe, da već
   upisan zapis ne truje lanac, i da učitavanje takvo stanje izleči. Zamka na
   samo jednom od tri mesta pušta kvar da uđe kroz preostala dva — a upravo je
   tako i ušao. */
describe('Nemoguće merenje ne ulazi u formu', () => {

  test('vreme brže od svetskog rekorda na 3000 m se ne prihvata', () => {
    const a = app();
    /* 7:20,67 (Daniel Komen, 1996) — brže od toga nije trčanje. */
    assert.equal(a.call('t3kMoguc', 439), false, '7:19 je prihvaćeno');
    assert.equal(a.call('t3kMoguc', 440), true, '7:20 je odbijeno, a to je rekord');
    assert.equal(a.call('t3kMoguc', 410), false, '6:50 — tačno unos iz prijave — je prihvaćeno');
    assert.equal(a.call('t3kVdot', 410), null, 'nemoguće vreme je ipak dalo VDOT');
  });

  test('stvarna vremena i dalje prolaze — provera nije preoštra', () => {
    const a = app();
    for (const sec of [600, 702, 750, 900, 1200, 1490]) {
      assert.equal(a.call('t3kMoguc', sec), true, `${sec}s je odbijeno`);
      assert.ok(a.call('t3kVdot', sec) > 0, `${sec}s nije dalo VDOT`);
    }
  });

  test('nemoguć test se ne upisuje ni u listu', () => {
    /* Da se upisao a samo ne bi ušao u lanac, stajao bi na kartici kao da je
       priznat i čovek bi se pitao zašto ništa ne radi. */
    const a = app();
    assert.equal(a.call('dodajT3k', '2026-08-05', 410), null);
    assert.equal(a.evalIn('S.t3k.length'), 0, 'nemoguć test je upisan u listu');
    assert.equal(a.evalIn('S.vdotLog.length'), 0, 'nemoguć test je ušao u lanac');
  });

  test('TAČAN SLUČAJ IZ PRIJAVE: forma ostaje gde je bila, ne skače na 73,5', () => {
    const a = app();
    /* Prvo jedan stvaran tempo, da lanac ima gde da stoji. */
    a.evalIn(`CUR_PRED.push({id:'zt', w:1, l:'N1 · Tempo', q:5, pt:258})`);
    a.call('recordVdot', 'zt', 258, '2026-07-31', null, false);
    const pre = a.call('currentVdot');
    assert.ok(pre > 40 && pre < 60, `polazna forma nije razumna: ${pre}`);
    a.call('dodajT3k', '2026-08-05', 410);
    assert.equal(a.call('currentVdot'), pre, 'nemoguć test je pomerio formu');
  });

  test('zapis koji je VEĆ u stanju ne truje lanac', () => {
    /* Star backup i sinhronizacija sa servera zaobilaze unos. Lanac mora da
       bude neškodljiv i pre nego što ga učitavanje očisti. */
    const a = app();
    const bv = a.call('baselineVdot');
    a.evalIn(`S.vdotLog=[{id:'t3k-2026-08-05-abc12', ts:'2026-08-05', measured:89.4}];
              preracunajVdotLog();`);
    /* Ne „ostalo je u granicama" nego „nije se pomerilo". Prigušenje sa 0,60
       bi 89,4 svelo na 72,9 — a to je unutar svake granice i tvrdnja tipa
       „v <= 85" bi to propustila. Nemoguć zapis ne sme da pomeri lanac ni za
       desetinku. */
    assert.equal(a.call('currentVdot'), bv, 'nemoguć zapis je pomerio lanac');
    assert.equal(a.evalIn('S.vdotLog[0].nemoguce'), true, 'zapis nije označen kao nemoguć');

    /* A ispravan zapis pored njega i dalje radi — provera nije zaustavila lanac. */
    a.evalIn(`S.vdotLog.push({id:'t3k-2026-08-06-def34', ts:'2026-08-06', measured:50.1});
              preracunajVdotLog();`);
    assert.notEqual(a.call('currentVdot'), bv, 'ispravan zapis posle nemogućeg ne ulazi u lanac');
  });

  test('učitavanje stanja BRIŠE nemoguć zapis, a ne popravlja ga', () => {
    /* Pogađanje najbližeg mogućeg vremena bilo bi izmišljen podatak o nečijem
       trčanju. Zapis se odbacuje ceo. */
    const seed = {
      v: 10, log: {}, knee: [], kg: [], pred: {}, predLock: {}, moves: {}, alts: {},
      wellness: {}, icu: null, strava: null, genPlan: null, ui: {},
      t3k: [{ id: 't3k-2026-08-05-abc12', date: '2026-08-05', sec: 410 },
            { id: 't3k-2026-07-20-def34', date: '2026-07-20', sec: 720 }],
      vdotLog: [{ id: 't3k-2026-08-05-abc12', ts: '2026-08-05', measured: 89.4 },
                { id: 't3k-2026-07-20-def34', ts: '2026-07-20', measured: 47.9 }]
    };
    const a = loadApp({ now: DANAS, seedLocalStorage: { 'sub19-v1': JSON.stringify(seed) } });
    assert.equal(a.get('UCITAVANJE_PALO'), null, 'učitavanje je puklo');
    assert.deepEqual(a.evalIn('S.t3k.map(t=>t.sec)'), [720], 'nemoguć test je preživeo učitavanje');
    assert.deepEqual(a.evalIn('S.vdotLog.map(e=>e.measured)'), [47.9], 'nemoguć zapis je ostao u lancu');
    assert.ok(a.call('currentVdot') <= 85);
  });

  test('kvalitetna sesija sa nemogućim tempom se takođe odbija', () => {
    /* Isti kvar kroz druga vrata: loše prepoznata deonica ili omaška u
       kucanju daju tempo koji u zoni znači VDOT preko 85. */
    const a = app();
    a.evalIn(`CUR_PRED.push({id:'zt', w:1, l:'N1 · Tempo', q:5, pt:258})`);
    assert.equal(a.call('recordVdot', 'zt', 120, '2026-08-05', null, false), null,
      '2:00/km u tempo zoni je primljeno kao merenje forme');
    assert.equal(a.evalIn('S.vdotLog.length'), 0);
  });

  test('granica je u JEDNOJ tabeli, ne prepisana po fajlu', () => {
    const a = app();
    assert.equal(a.get('VDOT_TABELA_MAX'), 85);
    assert.equal(a.call('vdotMoguc', 85), true);
    assert.equal(a.call('vdotMoguc', 85.1), false);
    assert.equal(a.call('vdotMoguc', 14), false);
    assert.equal(a.call('vdotMoguc', null), false);
    assert.equal(a.call('vdotMoguc', Infinity), false);
  });
});

/* NALAZ QA-1 — SIVA REFERENTNA KRIVA NA „PREDIKCIJA KROZ PLAN".

   PRIJAVA IZ UPOTREBE: na planu za 21:09 trkačka nedelja je bila NAJGORA tačka
   u celom planu — 22:43, gore i od prve nedelje (22:21) i za minut i po gore od
   cilja. Uz to su intervalne sesije od N9 stajale na 22:10 pet nedelja zaredom
   dok su tempo sesije iz istih nedelja išle 21:37 → 21:12, pa je linija skakala
   gore-dole po ceo minut i išla unazad osam puta.

   Uzrok je bilo čitanje UNAZAD: `vdotFromPace(pt, zone)` je propisan tempo
   tumačio kao izmerenu formu. Propis nije merenje — `pIzaNedelju` u poslednjih
   6 nedelja namerno klampuje intervalni tempo na tempo trke, a aktivacija pred
   trku je 6×200 m koja se vodi kao Repeticije.

   Ova zamka meri OBLIK krive, ne pojedinačne brojeve: kartica tvrdi da je to
   putanja plana ka cilju, pa mora i da izgleda tako. */
describe('Referentna kriva prati plan, ne propisan tempo', () => {
  /* SVE ČETIRI DISTANCE, ne samo 5K. Aplikacija pravi planove za 5K, 10K,
     polumaraton i maraton, a dinamički testovi su bili gotovo isključivo na 5K
     — jedanaest poziva sa 5000, dva sa 21097, jedan sa 42195. Duge distance su
     baš one koje niko ne koristi u praksi, pa se kvar na njima ne bi ni video.
     Zadaci se razlikuju i sadržajem: duže pripreme, drugačija rampa, dugo
     trčanje nosi veći udeo nedelje. */
  const DISTANCE = [
    { ime: '5K',      distM: 5000,    pbSec: 1350,  nedelja: 15, km: 30 },
    { ime: '10K',     distM: 10000,   pbSec: 2800,  nedelja: 16, km: 40 },
    { ime: 'HM',      distM: 21097.5, pbSec: 6300,  nedelja: 18, km: 50 },
    { ime: 'Maraton', distM: 42195,   pbSec: 13500, nedelja: 20, km: 60 }
  ];
  const dan = (od, n) => new Date(Date.parse(od) + n * 864e5).toISOString().slice(0, 10);

  const plan = (a, d) => {
    a.ctx.__m = {
      startDate: '2026-08-08', raceDate: dan('2026-08-08', d.nedelja * 7),
      raceDistM: d.distM, pb: { distM: d.distM, sec: d.pbSec },
      weeklyKm: d.km, runDays: 5, quality: 2,
      intensity: 'std', trainedRecently: true, goalSec: null
    };
    a.evalIn(`(function(){ const g=generatePlan(__m);
      S.genPlan=adaptGeneratedPlan(g); setActivePlan(); rebuildDateIndex(); })()`);
    const r = a.evalIn('CUR_PRED.map(r=>({w:r.w,l:r.l,p5k:r.p5k}))');
    assert.ok(r.length >= 5, `${d.ime}: plan ima samo ${r.length} kvalitetnih sesija`);
    return r;
  };

  test('trkačka nedelja je NAJBOLJA tačka, ne najgora', () => {
    /* Ovo je bio glavni simptom: šiljak uvis uz desnu ivicu grafikona. */
    for (const d of DISTANCE) {
      const red = plan(app(), d);
      const zadnja = red[red.length - 1];
      const najgora = red.reduce((m, x) => (x.p5k > m.p5k ? x : m), red[0]);
      assert.notEqual(najgora.l, zadnja.l,
        `${d.ime}: trkačka nedelja (${zadnja.l}) je najgora tačka u planu: ${zadnja.p5k}s`);
      assert.ok(zadnja.p5k <= red[0].p5k,
        `${d.ime}: kraj plana (${zadnja.p5k}s) je gori od početka (${red[0].p5k}s)`);
    }
  });

  test('kriva ne ide unazad — plan ne predviđa pad forme', () => {
    for (const d of DISTANCE) {
      const red = plan(app(), d);
      const unazad = red.filter((x, i) => i > 0 && x.p5k > red[i - 1].p5k);
      assert.deepEqual(unazad.map(x => x.l), [],
        `${d.ime}: referentna kriva ide unazad na: ${unazad.map(x => x.l).join(', ')}`);
    }
  });

  test('sve sesije iste nedelje imaju istu referentnu vrednost', () => {
    /* Plan ne očekuje različitu formu u utorak i u četvrtak. Kad se razlikuju,
       broj ne meri plan nego to koja je sesija te nedelje ispala na red. */
    for (const d of DISTANCE) {
      const red = plan(app(), d);
      const poNedelji = {};
      for (const r of red) (poNedelji[r.w] = poNedelji[r.w] || []).push(r.p5k);
      const razlicite = Object.entries(poNedelji)
        .filter(([, v]) => new Set(v).size > 1)
        .map(([w, v]) => `N${w}: ${v.join('/')}`);
      assert.deepEqual(razlicite, [], `${d.ime}: ista nedelja, različita referenca: ${razlicite.join('  ')}`);
    }
  });

  test('kriva stiže do cilja, a ne staje daleko od njega', () => {
    for (const d of DISTANCE) {
      const a = app();
      const red = plan(a, d);
      const cilj = a.call('goalSecActive');
      const zadnja = red[red.length - 1].p5k;
      /* Tolerancija raste sa distancom: ista greška u VDOT-u nosi više sekundi
         na maratonu nego na 5K, a poređenje je isto. */
      const dozvoljeno = Math.max(30, Math.round(cilj * 0.005));
      assert.ok(Math.abs(zadnja - cilj) <= dozvoljeno,
        `${d.ime}: plan se završava na ${zadnja}s, a cilj je ${cilj}s — razlika ${zadnja - cilj}s`);
    }
  });

  test('propisan tempo ostaje netaknut — menja se SAMO referenca', () => {
    /* `pt` je ono što čovek treba da istrči i mora da ostane onakav kakav ga je
       generator propisao; `p5k` je samo siva linija. Da se i `pt` pomerio,
       izmena bi promenila nečiji trening. */
    const src = readRepoFile('app.js');
    const f = /function predRow\([\s\S]*?\n\}/.exec(src)[0];
    assert.match(f, /return \{ w, l:'N'\+w\+' · '\+tip, q, pt, p5k \}/,
      'predRow više ne vraća propisan tempo nepromenjen');
    assert.match(f, /refVdot/, 'predRow ne prima plansku putanju forme');
  });
});
