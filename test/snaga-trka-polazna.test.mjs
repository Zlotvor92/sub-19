/* Tri izmene iz iste prijave:
   1. trčanje na dan snage — ostaje na tom danu i broji se;
   2. polazna tačka za polumaraton je Niš (03.10), kad je upisan;
   3. „Trka" kao tip treninga, sa izborom dužine. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const VLASNIK = '0403f8fb-a643-4d4e-843d-f71199a0d6f9';

function sinhronizuj(treninzi, pripremi = '') {
  const a = loadApp({ now: '2026-09-30T09:00:00Z', online: true });
  a.evalIn(`${pripremi}
    S.icu={athleteId:'i1', token:'t', scope:'ACTIVITY:READ,WELLNESS:READ'};
    SB={access:'t',refresh:'r',expiresAt:Date.now()+3600e3,email:'x@t.rs',userId:'${VLASNIK}',seenAt:null,deviceId:'d1'};`);
  a.setFetch(async (url, opt) => {
    const b = JSON.parse(opt.body || '{}');
    if (b.detalji) return { ok: true, status: 200, json: async () =>
      ({ detalji: Object.fromEntries(b.detalji.map(i => [i, { krugovi: [], grupe: [] }])) }) };
    if (b.tokovi) return { ok: true, status: 200, json: async () =>
      ({ tokovi: Object.fromEntries(b.tokovi.map(i => [i, { greska: true }])) }) };
    return { ok: true, status: 200, json: async () => ({ treninzi }) };
  });
  return a;
}
const TRCANJE_UTORAK = { id: 'a3', datum: '2026-09-29', sat: 9, tip: 'Run', naziv: 'Lako', km: 5, sec: 1700, hr: 138 };

describe('Trčanje na dan snage', () => {
  test('ostaje na danu snage i broji se u nedelju', async () => {
    const a = sinhronizuj([TRCANJE_UTORAK]);
    await a.evalIn('icuSyncTreninzi(30, true)');
    assert.equal(a.evalIn(`BY_DATE['2026-09-29'].id`), 'n2d2');
    assert.equal(a.evalIn(`BY_DATE['2026-09-29'].tag`), 'snaga', 'dan je prestao da bude snaga');
    assert.equal(a.evalIn(`S.log.n2d2.km`), 5);
    assert.equal(a.evalIn(`weekRealKm(CUR_PLAN[1])`), 5);
    assert.equal(a.evalIn(`akutniObim('2026-09-30')`), 5);
  });

  test('ne preotima susedni trkački dan (ranije: sreda od 7 km prebačena i upisana sa 5)', async () => {
    const a = sinhronizuj([TRCANJE_UTORAK]);
    await a.evalIn('icuSyncTreninzi(30, true)');
    assert.deepEqual(JSON.parse(a.evalIn('JSON.stringify(S.moves)')), {});
    assert.equal(a.evalIn(`BY_DATE['2026-09-30'].id`), 'n2d3');
    assert.equal(a.evalIn(`stFor('n2d3')`), 'pending');
  });

  test('ne nestaje ni kad susednog dana nema (sreda izmenjena na 9 km)', async () => {
    const a = sinhronizuj([TRCANJE_UTORAK],
      `S.alts={n2d3:{tag:'lako',km:9,desc:'Lako trčanje 9 km'}}; rebuildDateIndex();`);
    const r = await a.evalIn('icuSyncTreninzi(30, true)');
    assert.equal(r.n, 1);
    assert.equal(a.evalIn(`S.log.n2d2.km`), 5);
  });

  test('trčanje na danu snage se broji kao trčanje, snaga bez trčanja ne', () => {
    const a = loadApp({ now: '2026-09-30T09:00:00Z' });
    const pre = a.evalIn('weekRunCount(CUR_PLAN[1])');
    a.evalIn(`S.log.n2d2={status:'done'}`);
    assert.equal(a.evalIn('weekRunCount(CUR_PLAN[1])'), pre, 'odrađena snaga je brojana kao trčanje');
    a.evalIn(`S.log.n2d2={status:'done',km:5}`);
    assert.equal(a.evalIn('weekRunCount(CUR_PLAN[1])'), pre + 1);
    assert.equal(a.evalIn('weekRunDone(CUR_PLAN[1])'), 1);
  });
});

describe('Polazna tačka: Niš polumaraton', () => {
  test('dok Niš nije upisan, polazna je PB 20:37 na 5K', () => {
    const a = loadApp({ now: '2026-10-02T09:00:00Z' });
    assert.equal(a.call('polaznaTrka'), null);
    assert.equal(a.call('baselineVdot'), 48.1);
  });

  test('upisan Niš postaje polazna forma, a lanac forme kreće od nje', () => {
    const a = loadApp({ now: '2026-10-04T09:00:00Z' });
    a.evalIn(`S.log.n2d6={status:'done',km:21.1,sec:6600,ts:'2026-10-03'};
              S.vdotLog=[{id:'p3',ts:'2026-10-28',measured:46}]; preracunajVdotLog();`);
    const v = a.evalIn('Math.round(vdotFromRace(21100,6600)*10)/10');
    assert.equal(a.call('baselineVdot'), v);
    assert.ok(v < a.call('goalVdotActive'), '1:50 na Nišu mora biti sporije od cilja 1:40');
    /* prsten sada ima šta da meri */
    const u = a.call('trkaUdeo', 6300);
    assert.ok(u > 0 && u < 1, `udeo ${u}`);
    assert.ok(a.evalIn('S.vdotLog[0].prev') === v, 'lanac forme ne kreće od Niša');
  });

  test('kratko trčanje ili trčanje bez vremena na dan Niša nije polazna tačka', () => {
    const a = loadApp({ now: '2026-10-04T09:00:00Z' });
    a.evalIn(`S.log.n2d6={status:'done',km:12,sec:3600}`);
    assert.equal(a.call('polaznaTrka'), null);
    a.evalIn(`S.log.n2d6={status:'done',km:21.1}`);
    assert.equal(a.call('polaznaTrka'), null);
  });

  test('generisan plan ne gleda lični polazni dan', () => {
    const a = loadApp({ now: '2026-10-04T09:00:00Z' });
    a.evalIn(`S.log.n2d6={status:'done',km:21.1,sec:6600};
              S.genPlan={meta:{raceDistM:5000,vdot0:44},weeks:[],pred:[],qs:{}}`);
    assert.equal(a.call('baselineVdot'), 44);
  });
});

describe('Trka kao tip treninga', () => {
  test('izmena treninga nudi Trku i dužine', () => {
    const a = loadApp({ now: '2026-09-25T09:00:00Z' });
    a.evalIn(`ALT_DRAFT={tag:'trka',km:null,desc:'',pace:null}`);
    const h = a.evalIn(`altSheetHTML(BY_ID['n2d6'])`);
    assert.match(h, /data-t="trka"[^>]*>Trka</);
    for (const n of ['5 km', '10 km', 'Polumaraton', 'Maraton']) assert.match(h, new RegExp(`data-tkm="[\\d.]+"[^>]*>${n}<`));
  });

  test('Niš kao trka na polumaratonu se čuva i preživi backup', () => {
    const a = loadApp({ now: '2026-09-25T09:00:00Z' });
    const km = 21.1;
    const r = a.call('setAlt', 'n2d6', { tag: 'trka', km, desc: a.call('altDescTemplate', 'trka', km) });
    assert.equal(r.ok, true, r.err);
    assert.equal(a.evalIn(`BY_ID['n2d6'].tag`), 'trka');
    assert.equal(a.evalIn(`BY_ID['n2d6'].km`), 21.1);
    assert.equal(a.evalIn(`BY_ID['n2d6'].desc`), '🏁 Trka — Polumaraton (21,1 km)');
    const posle = JSON.parse(a.evalIn('JSON.stringify(migrate(JSON.parse(JSON.stringify(S))).alts.n2d6)'));
    assert.equal(posle.tag, 'trka');
    assert.equal(posle.km, 21.1);
  });
});
