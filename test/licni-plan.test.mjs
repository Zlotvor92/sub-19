/* LIČNI (hardkodovan) PLAN — zaključan.

   Ovo je vlasnikov plan iz Plan_Bokeski_polumaraton.xlsx: 80 dana od
   25.09.2026, Bokeški polumaraton 13.12.2026 (cilj ispod 1:40; Excel pogrešno navodi 12.12). U aplikaciji je
   12 nedelja od ponedeljka 21.09: Excel ned. 0 (10 dana) je N1+N2, Excel ned. k
   je N(k+2). Nije podrazumevani plan aplikacije nego NEČIJI STVARNI plan.
   (Prethodni plan, Plan_SUB-19_5K_v5.xlsx, uklonjen je u celini.)

   Za razliku od generatora, ovde se tvrde TAČNE vrednosti — namerno. Cilj
   nije da se opiše ponašanje nego da nijedna izmena drugde (refaktor,
   promena formule, „mala popravka") ne može tiho da ga promeni. Ako ovaj
   fajl padne, izmena je pogrešna dok se ne dokaže suprotno. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile, readClientSource } from './harness.mjs';

const app = loadApp();

describe('Konstante ličnog plana', () => {
  test('datumi i cilj su nepromenjeni', () => {
    assert.equal(app.get('START'), '2026-09-21');
    assert.equal(app.get('RACE'), '2026-12-13');
    assert.equal(app.get('CILJ'), 'ispod 1:40');
    assert.equal(app.get('CILJ_TEMPO'), '4:40–4:44 /km');
    const L = app.get('LICNI');
    assert.equal(L.raceDistM, 21097.5);
    assert.equal(L.goalSec, 6000);
  });

  test('plan ima 12 nedelja i nepromenjen raspored', () => {
    const plan = app.get('PLAN');
    assert.equal(plan.length, 12);
    assert.equal(plan[0].start, '2026-09-21');
    assert.equal(plan[11].start, '2026-12-07');
    /* N1 je samo pet–ned (Excel ned. 0 počinje 25.09, dan posle trke 5 km) */
    assert.deepEqual(Array.from(plan[0].days.map(d => d.id)), ['n1d5', 'n1d6', 'n1d7']);
    /* Niš polumaraton je LAGANO — ne sme biti označen kao trka */
    const nis = plan[1].days.find(d => d.id === 'n2d6');
    assert.equal(nis.tag, 'lr');
    assert.equal(nis.km, 21.1);
    /* lakše nedelje: Excel ned. 4 i 8 */
    assert.deepEqual(Array.from(plan.filter(w => w.deload).map(w => w.w)), [6, 10]);
    const trke = plan.flatMap(w => w.days).filter(d => d.tag === 'trka');
    assert.equal(trke.length, 1, 'plan ima tačno jednu trku');
    assert.equal(trke[0].id, 'n12d7');
    assert.equal(trke[0].km, 21.1);
    assert.equal(app.evalIn(`BY_ID['n12d7'].date`), '2026-12-13');
    /* dan pred trku je shakeout, dan pre njega odmor */
    assert.equal(app.evalIn(`BY_ID['n12d6'].tag`), 'lako');
    assert.equal(app.evalIn(`BY_ID['n12d6'].km`), 3);
    assert.equal(app.evalIn(`BY_ID['n12d5'].rest`), true);
  });

  test('ukupna kilometraža i broj treninga su nepromenjeni', () => {
    const plan = app.get('PLAN');
    const ukupno = plan.reduce((s, w) => s + w.days.reduce((a, d) => a + (d.km || 0), 0), 0);
    assert.equal(Math.round(ukupno * 10) / 10, 408.2, 'ukupna kilometraža plana se promenila (Excel: 408,2)');
    assert.equal(plan.reduce((n, w) => n + w.days.length, 0), 80, 'Excel ima 80 dana');
    const treninga = plan.reduce((n, w) => n + w.days.filter(d => !d.rest).length, 0);
    assert.equal(treninga, 66, 'broj treninga se promenio');
  });

  test('svaki dan je na svom datumu iz Excel-a', () => {
    /* 25.09.2026 (petak) je prvi, 13.12.2026 (nedelja) poslednji, bez rupa. */
    const datumi = JSON.parse(app.evalIn('JSON.stringify(DATED.map(d=>d.date))'));
    assert.equal(datumi.length, 80);
    assert.equal(datumi[0], '2026-09-25');
    assert.equal(datumi[79], '2026-12-13');
    for (let i = 1; i < datumi.length; i++)
      assert.equal(app.call('diffD', datumi[i - 1], datumi[i]), 1, `rupa posle ${datumi[i - 1]}`);
  });

  test('ključni treninzi se čitaju kao struktura (sat, lapovi)', () => {
    const k = JSON.parse(app.evalIn(`JSON.stringify(['n4d3','n6d3','n8d3','n12d3'].map(id=>icuIzOpisa(BY_ID[id].desc,BY_ID[id].tag)))`));
    assert.deepEqual([k[0].reps, k[0].repM, k[0].paceSec, k[0].paceSec2, k[0].restSec], [3, 2000, 280, 285, 90]);
    assert.deepEqual([k[1].reps, k[1].repM, k[1].paceSec, k[1].restSec], [5, 1000, 255, 90]);
    assert.deepEqual([k[2].type, k[2].qKm, k[2].paceSec], ['tempo', 8, 280]);
    assert.deepEqual([k[3].qKm, k[3].cdKm], [3, 1.5]);
  });

  test('ID-jevi dana su u „n" prostoru (ne smeju se sudariti sa generisanim „g")', () => {
    const plan = app.get('PLAN');
    for (const w of plan) {
      for (const d of w.days) {
        assert.match(d.id, /^n\d+/, `ID ${d.id} nije u "n" prostoru`);
      }
    }
  });

  test('predikciona tabela i ciljna težina su nepromenjene', () => {
    assert.equal(app.get('PRED').length, 9);
    assert.equal(app.evalIn('PRED[0].id'), 'p1');
    assert.equal(app.evalIn('PRED[8].id'), 'p9');
    /* formu mere samo 4:15 deonice; tempo trke je propis iz cilja */
    assert.deepEqual(Array.from(app.evalIn('PRED.filter(r=>!r.nemeri).map(r=>r.id)')), ['p3', 'p6']);
    /* svaki red pripada svom ključnom treningu */
    assert.deepEqual(Array.from(app.evalIn(`CUR_PLAN.flatMap(w=>w.days).filter(d=>d.tag==='int'||d.tag==='tempo').map(d=>predRowFor(d))`)),
      ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']);
    /* novi Excel nema ciljnu liniju mase */
    assert.equal(app.get('WT_TARGET').length, 0);
  });

  test('QS tabela (Strava lapovi) je nepromenjena', () => {
    const qs = app.get('QS');
    assert.equal(Object.keys(qs).length, 9);
    assert.deepEqual(Array.from(qs.n4d3), [2000]);
    assert.deepEqual(Array.from(qs.n9d3), [1600]);
    assert.deepEqual(Array.from(qs.n12d3), [3000]);
  });

  test('lični podaci vlasnika NISU u isporučenom kodu', () => {
    /* Beleške o kolenu i merenja telesne mase su ranije stajale u seedState()
       u čitljivom obliku — dakle vidljive svakome ko otvori izvor stranice.
       Uklonjene su; stvarni podaci žive u Supabase-u i u backup fajlovima. */
    const izvor = readClientSource();
    for (const trag of ['Bol se javio', 'Osetio sam koleno', 'Prilikom budjenja',
      'Preskocio sam trcanje', 'brzo je prolazilo', '81.6']) {
      assert.ok(!izvor.includes(trag), `lični podatak je i dalje u kodu: "${trag}"`);
    }
    assert.ok(!izvor.includes('VLASNIK_ISTORIJA'), 'blok sa istorijom je i dalje tu');
  });

  test('potpis zatečenog seeda nosi SAMO identifikatore', () => {
    const p = app.get('STARI_SEED_POTPIS');
    const svi = JSON.stringify(p);
    assert.ok(/n1d1/.test(svi) && /k10/.test(svi), 'potpis ne prepoznaje stari seed');
    assert.ok(!/81\.6|Bol|koleno ok|note/.test(svi), 'potpis nosi lične podatke');
  });

  test('seedState je PRAZAN — tuđi podaci ne idu novom korisniku', () => {
    const s = app.call('seedState');
    assert.deepEqual({ ...s.log }, {}, 'novi korisnik dobija tuđe treninge');
    assert.deepEqual(Array.from(s.knee), [], 'novi korisnik dobija tuđe beleške o kolenu');
    assert.deepEqual(Array.from(s.kg), [], 'novi korisnik dobija tuđa merenja mase');
    assert.deepEqual({ ...s.pred }, {}, 'novi korisnik dobija tuđe tempove');
  });
});

describe('Lični plan ne sme da odluta u tuđu zonu', () => {
  /* ZAŠTO OVAJ TEST POSTOJI. Tempi zona (`paceForZone`) su ZAJEDNIČKI sloj —
     koristi ih i generator i rekalibracija forme nad ličnim planom
     (`vdotPredlog` → `zonaZaDan(d)` → `paceForZone(f.forma, z.zone)`). Kad je M
     zona ispravljena da bude pravi maratonski tempo trke umesto procenta
     VO2max, promenio se tempo koji ta grana vraća. Lični plan to nije osetio
     jer njegove sesije nikad ne padnu u M — ali to je bila SREĆNA okolnost
     koju ništa nije čuvalo.

     Dovoljno je da neko kasnije doda naziv sesije u ZONE_FOR_KIND ili preimenuje
     postojeći, pa da dan ličnog plana tiho pređe u drugu zonu i dobije drugi
     predloženi tempo — bez ijednog testa koji bi pao. Zato se ovde tvrdi TAČAN
     skup zona, u duhu ostatka fajla. */
  const zoneLicnogPlana = () => {
    const a = loadApp();
    return JSON.parse(a.evalIn(`JSON.stringify(CUR_PLAN.flatMap(w => w.days.map(d => {
      const z = zonaZaDan(d);
      return { id: d.id, zona: z ? z.zone : null };
    })))`));
  };

  test('nijedan dan ne završi u M zoni (maratonski tempo)', () => {
    const m = zoneLicnogPlana().filter(d => d.zona === 'M');
    assert.equal(m.length, 0,
      `dani ličnog plana u M zoni: ${m.map(d => d.id).join(', ')} — M je maratonski tempo, polumaratonski plan ga nema`);
  });

  test('koriste se TAČNO zone I i T, i nijedna druga', () => {
    /* Intervali → I, Tempo → T. Lako/LR/Odmor/Snaga/Test/TRKA nemaju zonu
       (null) i ne ulaze u rekalibraciju tempa. */
    const zone = [...new Set(zoneLicnogPlana().map(d => d.zona))].sort(
      (a, b) => String(a).localeCompare(String(b)));
    assert.deepEqual(zone.filter(z => z !== null).map(String), ['I', 'T'],
      `lični plan koristi zone: ${zone.map(z => z === null ? '(bez zone)' : z).join(', ')}`);
  });

  test('tipovi sesija su nepromenjeni — odatle i zone dolaze', () => {
    const a = loadApp();
    const kinds = JSON.parse(a.evalIn(
      `JSON.stringify([...new Set(CUR_PLAN.flatMap(w => w.days.map(d => sessKind(d))))].sort())`));
    assert.deepEqual(kinds.map(String),
      ['Dugo (LR)', 'Intervali', 'Lako', 'Odmor', 'Snaga', 'TRKA', 'Tempo']);
  });
});

describe('Lični plan je aktivan kad nema generisanog', () => {
  test('CUR_PLAN pokazuje na PLAN, a datumi na START/RACE', () => {
    const a = loadApp();
    assert.equal(a.evalIn('S.genPlan'), null);
    assert.equal(a.evalIn('CUR_PLAN.length'), 12);
    assert.equal(a.evalIn('CUR_START'), '2026-09-21');
    assert.equal(a.evalIn('CUR_RACE'), '2026-12-13');
    assert.equal(a.evalIn('CUR_PRED.length'), 9);
  });

  test('podrazumevani opis cilja za AI je vlasnikov polumaratonski cilj', () => {
    const a = loadApp();
    assert.equal(a.call('goalCtxText'),
      'Bokeški polumaraton 13.12.2026 — cilj ispod 1:40 (4:40–4:44/km)');
  });

  test('baseline i ciljni VDOT su vlasnikovi (PB 20:37 na 5K -> polumaraton 1:40:00)', () => {
    const a = loadApp();
    assert.equal(a.call('baselineVdot'), 48.1);
    assert.equal(a.call('goalVdotActive'), 45.1);
    assert.equal(a.call('goalSecActive'), 6000);
    assert.equal(a.call('raceDistActive'), 21097.5);
    /* plan očekuje formu cilja — Excel nema rampu */
    assert.equal(a.call('planVdotSada', '2026-10-14'), 45.1);
  });

  test('brisanje generisanog plana ne dira „n" unose', () => {
    /* purgeGenPlanData sme da obriše ISKLJUČIVO „g" prostor. */
    const a = loadApp();
    a.evalIn(`S.log={n1d1:{status:'done',km:7}, g1d1:{status:'done',km:9}};
              S.pred={p1:265, g1_0:250};
              S.vdotLog=[{id:'p1',ts:'2026-07-01',measured:48},{id:'g1_0',ts:'2026-07-02',measured:50}];
              S.knee=[{id:'k1',src:'n1d1',date:'2026-06-22',pain:1},{id:'k2',src:'g1d1',date:'2026-07-02',pain:2}]`);
    a.call('purgeGenPlanData');
    assert.deepEqual(Array.from(a.evalIn('Object.keys(S.log)')), ['n1d1']);
    assert.deepEqual(Array.from(a.evalIn('Object.keys(S.pred)')), ['p1']);
    assert.equal(a.evalIn('S.vdotLog.length'), 1);
    assert.equal(a.evalIn('S.vdotLog[0].id'), 'p1');
    assert.equal(a.evalIn('S.knee.length'), 1, 'obrisan je unos vezan za lični plan');
  });
});

describe('Vlasnikovi podaci ne izlaze van njegovog naloga', () => {
  const VLASNIK = '0403f8fb-a643-4d4e-843d-f71199a0d6f9';
  const sesija = uid => ({
    sub19_sb: JSON.stringify({
      access: 't', refresh: 'r', expiresAt: Date.now() + 3600e3,
      email: 'x@t.rs', userId: uid, seenAt: null, deviceId: 'd1'
    })
  });
  /* zatečeno stanje sa starih verzija: vlasnikov seed u tuđem localStorage-u */
  const saStarimSeedom = uid => ({
    ...sesija(uid),
    'sub19-v1': JSON.stringify({
      v: 7,
      log: { n1d1: { status: 'done', km: 7, ts: '2026-06-22' }, n1d3: { status: 'done', km: 8, ts: '2026-06-24' } },
      knee: [{ id: 'k1', date: '2026-06-22', act: 'Trčanje', pain: 1, note: 'Bol se javio izmedju 6-7km' }],
      kg: [{ date: '2026-06-22', kg: 81.6 }],
      pred: { p1: 265 }, predLock: {}, vdotLog: [], moves: {}, alts: {},
      genPlan: null, strava: null, wellness: {}, icu: null,
      ui: { firstRun: '2026-06-22', lastBackup: null, snooze: null, seenWeek: null }
    })
  });

  test('nov korisnik ne dobija NIJEDAN tuđi podatak', () => {
    const app = loadApp({ seedLocalStorage: sesija('11111111-2222-3333-4444-555555555555') });
    assert.equal(app.evalIn('Object.keys(S.log).length'), 0);
    assert.equal(app.evalIn('S.knee.length'), 0);
    assert.equal(app.evalIn('S.kg.length'), 0);
    assert.equal(app.evalIn('Object.keys(S.pred).length'), 0);
    const svi = app.evalIn('JSON.stringify(S)');
    assert.ok(!svi.includes('Bol se javio'), 'tuđe beleške o kolenu su u stanju');
    assert.ok(!svi.includes('81.6'), 'tuđa merenja mase su u stanju');
  });

  test('zatečen tuđi seed se briše sa uređaja drugog korisnika', () => {
    const app = loadApp({ seedLocalStorage: saStarimSeedom('11111111-2222-3333-4444-555555555555') });
    assert.equal(app.evalIn('Object.keys(S.log).length'), 0, 'tuđi treninzi su ostali');
    assert.equal(app.evalIn('S.knee.length'), 0, 'tuđe beleške o kolenu su ostale');
    assert.equal(app.evalIn('S.kg.length'), 0, 'tuđa merenja mase su ostala');
    assert.equal(app.call('moraSvojPlan'), true, 'čovek i dalje gleda tuđi plan');
  });

  test('ali NE briše se ako je čovek uneo bilo šta svoje', () => {
    /* Brisanje tuđeg seeda ne sme da povuče i sopstveni rad. */
    const sa = saStarimSeedom('11111111-2222-3333-4444-555555555555');
    const st = JSON.parse(sa['sub19-v1']);
    /* tekuća šema — iz v10 i starijih migracija ionako briše stari plan */
    st.v = 11;
    st.log.n12d5 = { status: 'done', km: 11, sec: 3000 };   /* njegov trening */
    sa['sub19-v1'] = JSON.stringify(st);
    const app = loadApp({ seedLocalStorage: sa });
    assert.ok(app.evalIn('Object.keys(S.log).length') >= 3, 'obrisan je sopstveni unos');
    assert.ok(app.evalIn('!!S.log.n12d5'), 'obrisan je baš njegov trening');
  });

  test('tuđe merenje mase odlazi i kad korisnik ima svoje', () => {
    /* Uklanjanje je hirurško: briše se TAČNO tuđi zapis, a sopstveni ostaje.
       Ranije se odustajalo čim postoji bilo šta svoje — pa su tuđa merenja
       ostajala na grafikonu težine zauvek. */
    const sa = saStarimSeedom('11111111-2222-3333-4444-555555555555');
    const st = JSON.parse(sa['sub19-v1']);
    st.kg.push({ date: '2026-08-01', kg: 74 });
    sa['sub19-v1'] = JSON.stringify(st);
    const app = loadApp({ seedLocalStorage: sa });
    assert.equal(app.evalIn('S.kg.length'), 1, 'tuđe merenje je ostalo');
    assert.equal(app.evalIn('S.kg[0].kg'), 74, 'obrisano je sopstveno umesto tuđeg');
  });

  test('tuđe beleške o kolenu odlaze I KAD postoji generisan plan', () => {
    /* Ovo je slučaj viđen na uređaju: čovek napravi svoj plan čarobnjakom, a
       tuđe beleške mu ostanu u tabu Povrede — jer je čišćenje odustajalo čim
       postoji generisan plan. */
    const sa = saStarimSeedom('11111111-2222-3333-4444-555555555555');
    const st = JSON.parse(sa['sub19-v1']);
    st.genPlan = { meta: { raceDistM: 5000 }, pred: [], qs: {},
      weeks: [{ w: 1, start: '2026-06-22', days: [{ dow: 0, tag: 'lako', km: 5, desc: 'x', id: 'g1d1' }] }] };
    st.log = { g1d1: { status: 'done', km: 5 } };
    sa['sub19-v1'] = JSON.stringify(st);
    const app = loadApp({ seedLocalStorage: sa });
    assert.equal(app.evalIn('S.knee.length'), 0, 'tuđe beleške o kolenu su ostale uz generisan plan');
    assert.equal(app.evalIn('S.kg.length'), 0, 'tuđa merenja mase su ostala uz generisan plan');
    assert.ok(app.evalIn('!!S.genPlan'), 'obrisan je sopstveni plan');
    assert.ok(app.evalIn('!!S.log.g1d1'), 'obrisan je sopstveni trening');
  });

  test('vlasnik na praznom uređaju kreće prazan — podaci stižu sa servera', () => {
    /* Istorija se više ne ubacuje iz koda; sbPull je donosi iz Supabase-a. */
    const app = loadApp({ seedLocalStorage: sesija(VLASNIK) });
    assert.equal(app.evalIn('Object.keys(S.log).length'), 0);
    assert.equal(app.evalIn('S.knee.length'), 0);
  });

  test('vlasniku se postojeći podaci ne diraju', () => {
    const sa = sesija(VLASNIK);
    sa['sub19-v1'] = JSON.stringify({
      v: 11, log: { n9d5: { status: 'done', km: 11, sec: 2900 } }, knee: [], kg: [],
      pred: {}, predLock: {}, vdotLog: [], moves: {}, alts: {}, genPlan: null,
      strava: null, wellness: {}, icu: null,
      ui: { firstRun: '2026-06-22', lastBackup: null, snooze: null, seenWeek: null }
    });
    const app = loadApp({ seedLocalStorage: sa });
    assert.deepEqual(Array.from(app.evalIn('Object.keys(S.log)')), ['n9d5'],
      'vlasnikovi stvarni podaci su promenjeni');
  });

  test('vlasnik sa generisanim planom se ne dira', () => {
    const sa = sesija(VLASNIK);
    sa['sub19-v1'] = JSON.stringify({
      v: 7, log: {}, knee: [], kg: [], pred: {}, predLock: {}, vdotLog: [], moves: {}, alts: {},
      genPlan: { meta: { raceDistM: 5000 }, pred: [], qs: {},
        weeks: [{ w: 1, start: '2026-06-22', days: [{ dow: 0, tag: 'lako', km: 5, desc: 'x', id: 'g1d1' }] }] },
      strava: null, wellness: {}, icu: null,
      ui: { firstRun: '2026-06-22', lastBackup: null, snooze: null, seenWeek: null }
    });
    const app = loadApp({ seedLocalStorage: sa });
    assert.equal(app.evalIn('Object.keys(S.log).length'), 0);
    assert.ok(app.evalIn('!!S.genPlan'), 'generisan plan je obrisan');
  });
});

describe('Sinhronizacija sa servera ne vraća tuđi seed', () => {
  test('uskladiVlasnickePodatke se poziva i posle sbPull', () => {
    /* Čišćenje pri pokretanju dira samo localStorage. Vlasnikov seed je stara
       verzija gurnula i u tuđ Supabase red, pa ga povlačenje vraća nazad —
       „opet sve vuče na tuđi plan". */
    /* Od v222 usvajanje stanja sa servera stoji u `primiStanjeSaServera`, koju
       koriste i „Uzmi sa servera" i vraćanje ranije verzije. Provera zato ide
       u dva koraka: da sbPull i dalje ide TIM putem, i da taj put čisti. */
    const izvor = readClientSource();
    const blok = /async function sbPull\(\)\{[\s\S]*?\n\}/.exec(izvor);
    assert.ok(blok, 'sbPull nije pronađen');
    assert.ok(/primiStanjeSaServera\(mig\)/.test(blok[0]),
      'sbPull više ne usvaja stanje zajedničkim putem');

    const usvoji = /function primiStanjeSaServera\(mig\)\{[\s\S]*?\n\}/.exec(izvor);
    assert.ok(usvoji, 'primiStanjeSaServera nije pronađena');
    assert.ok(/uskladiVlasnickePodatke\(\)/.test(usvoji[0]),
      'usvajanje stanja sa servera ne čisti tuđi seed');
    assert.ok(usvoji[0].indexOf('setActivePlan()') < usvoji[0].indexOf('uskladiVlasnickePodatke()'),
      'čišćenje se poziva pre setActivePlan() — rebuildDateIndex bi radio nad starim planom');
    /* I vraćanje verzije mora da ide istim putem, inače se dva puta raziđu. */
    const vrati = /async function istorijaVrati\(id\)\{[\s\S]*?\n\}/.exec(izvor);
    assert.ok(vrati && /primiStanjeSaServera\(mig\)/.test(vrati[0]),
      'vraćanje ranije verzije usvaja stanje mimo zajedničkog puta');
  });

  test('povučeno stanje sa tuđim seedom se očisti', () => {
    const app = loadApp({
      seedLocalStorage: {
        sub19_sb: JSON.stringify({ access: 't', refresh: 'r', expiresAt: Date.now() + 3600e3,
          email: 'x@t.rs', userId: '11111111-2222-3333-4444-555555555555', seenAt: null, deviceId: 'd1' })
      }
    });
    /* simulira ono što sbPull upiše iz servera */
    app.evalIn(`S=migrate({v:7,
      log:{n1d1:{status:'done',km:7,ts:'2026-06-22'},n1d3:{status:'done',km:8,ts:'2026-06-24'}},
      knee:[{id:'k1',date:'2026-06-22',act:'Trčanje',pain:1,note:'x'}],
      kg:[{date:'2026-06-22',kg:81.6}], pred:{p1:265},
      predLock:{},vdotLog:[],moves:{},alts:{},genPlan:null,strava:null,wellness:{},icu:null,
      ui:{firstRun:null,lastBackup:null,snooze:null,seenWeek:null}});
      setActivePlan(); uskladiVlasnickePodatke(); rebuildDateIndex()`);
    assert.equal(app.evalIn('Object.keys(S.log).length'), 0, 'tuđi treninzi su ostali posle povlačenja');
    assert.equal(app.evalIn('S.knee.length'), 0);
    assert.equal(app.evalIn('S.kg.length'), 0);
    assert.equal(app.call('moraSvojPlan'), true, 'čovek i dalje gleda tuđi plan');
  });
});
