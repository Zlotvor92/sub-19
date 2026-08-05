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
import { loadApp } from './harness.mjs';

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

  test('kao repeticije, aktivacija formu pomera jedva primetno', () => {
    const a = app();
    a.ctx.__p = JSON.parse(gen(a));
    a.evalIn('S.genPlan=adaptGeneratedPlan(__p); setActivePlan(); rebuildDateIndex();');
    const red = a.evalIn(`JSON.stringify(CUR_PRED.filter(r=>/Repeticije/.test(r.l)).slice(-1)[0])`);
    const r = JSON.parse(red);
    assert.ok(r, 'nema reda za repeticije');
    assert.equal(a.call('tipSesijeZaVdot', r.id), 'rep');
    /* Deset sekundi po kilometru brže od plana — na tempu bi to vidno pomerilo
       formu; ovde sme jedva. */
    const bv = a.call('baselineVdot');
    a.evalIn(`recordVdot(${JSON.stringify(r.id)}, ${r.pt - 10}, '2026-12-04', null, false, null)`);
    const posle = a.call('currentVdot');
    assert.ok(Math.abs(posle - bv) < 0.35,
      `aktivacija je pomerila formu za ${Math.abs(posle - bv)} poena`);
  });
});
