/* Opterećenje u prvim nedeljama plana.

   Hronično opterećenje je bio prosek poslednje četiri ZAVRŠENE nedelje PLANA.
   Plan koji je tek počeo nema četiri nedelje, pa je imenilac bio samo ono što je
   istrčano po planu, a sve pre prvog dana plana aplikacija nije videla.
   Izmereno na ličnom planu (prvi dan 25.09): 30.09 odnos 1,55 i „plan narednih
   7 dana: 2,83 — skrati", 02.10 odnos 2,18 — kod trkača koji je u septembru
   istrčao 113 km. Lažan alarm, a isti broj ulazi i u predlog posle povrede. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const VLASNIK = '0403f8fb-a643-4d4e-843d-f71199a0d6f9';
/* Stvarna septembarska trčanja sa Strave (km po danu). */
const SEPTEMBAR = { '2026-09-01': 9.01, '2026-09-02': 8.0, '2026-09-03': 8.43, '2026-09-04': 6.01,
  '2026-09-05': 13.19, '2026-09-06': 12.07, '2026-09-08': 7.7, '2026-09-09': 4.01, '2026-09-10': 6.98,
  '2026-09-12': 5.5, '2026-09-13': 6.0, '2026-09-16': 5.48, '2026-09-19': 6.0, '2026-09-22': 5.01,
  '2026-09-23': 2.73, '2026-09-24': 6.84 };

function saPlanom(now, vanPlana) {
  const a = loadApp({ now: now + 'T09:00:00Z' });
  a.evalIn(`S.log={}; CUR_PLAN.forEach(w=>w.days.forEach(d=>{
      if(!d.rest&&d.km&&d.date<'${now}') S.log[d.id]={status:'done',km:d.km,ts:d.date}; }));
    S.vanPlana=${JSON.stringify(vanPlana || {})}; rebuildDateIndex();`);
  return a;
}

describe('Hronično opterećenje pre četiri nedelje plana', () => {
  test('30.09: nema lažnog alarma kad su septembarska trčanja poznata', () => {
    const a = saPlanom('2026-09-30', SEPTEMBAR);
    const r = JSON.parse(a.evalIn(`JSON.stringify(acwrSada('2026-09-30'))`));
    /* 31.08–06.09, 07–13.09, 14–20.09, N1 (21–27.09 = 14,58 pre plana + 11 po planu) */
    assert.equal(r.hron, 31);
    assert.ok(r.odnos < 1.3, `odnos ${r.odnos}`);
    assert.doesNotMatch(a.call('karticaOpterecenja'), /Preko 1,5/);
  });

  test('02.10: isto — ranije 2,18', () => {
    const a = saPlanom('2026-10-02', SEPTEMBAR);
    const r = JSON.parse(a.evalIn(`JSON.stringify(acwrSada('2026-10-02'))`));
    assert.ok(r.odnos < 1.3, `odnos ${r.odnos}`);
  });

  test('akutno broji i trčanja pre plana u prozoru od sedam dana', () => {
    const a = saPlanom('2026-09-30', SEPTEMBAR);
    /* 24.09 (6,84) + 27.09 (11) + 28.09 (6) */
    assert.equal(a.evalIn(`akutniObim('2026-09-30')`), 23.8);
  });

  test('kad plan ima četiri svoje nedelje, trčanja pre plana više ne ulaze', () => {
    const sa = saPlanom('2026-10-20', SEPTEMBAR), bez = saPlanom('2026-10-20', {});
    /* N1 i dalje nosi trčanja od 22–24.09 (14,58 ≈ 14,6) — ona su u toj nedelji, samo pre prvog dana plana */
    assert.equal(sa.evalIn(`hronicniObim('2026-10-20')`),
      Math.round((bez.evalIn('weekRealKm(CUR_PLAN[0])') + 14.6 + [1, 2, 3].reduce((s, i) =>
        s + bez.evalIn(`weekRealKm(CUR_PLAN[${i}])`), 0)) / 4 * 10) / 10);
  });

  test('bez podataka pre plana ponašanje je kao ranije', () => {
    const a = saPlanom('2026-09-30', {});
    assert.equal(a.evalIn(`hronicniObim('2026-09-30')`), 11);
  });
});

describe('Sinhronizacija puni trčanja pre plana', () => {
  function icu(now, treninzi) {
    const a = loadApp({ now: now + 'T09:00:00Z', online: true });
    a.evalIn(`S.icu={athleteId:'i1', token:'t', scope:'ACTIVITY:READ,WELLNESS:READ'};
      SB={access:'t',refresh:'r',expiresAt:Date.now()+3600e3,email:'x@t.rs',userId:'${VLASNIK}',seenAt:null,deviceId:'d1'};`);
    a.ctx.__upit = null;
    a.setFetch(async (url, opt) => {
      const b = JSON.parse(opt.body || '{}');
      if (b.detalji) return { ok: true, status: 200, json: async () => ({ detalji: {} }) };
      if (b.tokovi) return { ok: true, status: 200, json: async () => ({ tokovi: {} }) };
      a.ctx.__upit = b;
      return { ok: true, status: 200, json: async () => ({ treninzi: treninzi.filter(t => t.datum >= b.oldest) }) };
    });
    return a;
  }

  test('intervals.icu: traži četiri nedelje pre prvog dana plana i pamti ih po danu', async () => {
    const a = icu('2026-09-30', [
      { id: 'x0', datum: '2026-08-20', tip: 'Run', km: 10, sec: 3300 },   /* van prozora */
      { id: 'x1', datum: '2026-09-10', tip: 'Run', km: 2.14, sec: 780 },
      { id: 'x2', datum: '2026-09-10', tip: 'Run', km: 4.84, sec: 1250 },
      { id: 'x3', datum: '2026-09-24', tip: 'Run', km: 5.12, sec: 1253 },
      { id: 'x4', datum: '2026-09-27', tip: 'Run', km: 12, sec: 4000 }    /* dan plana */
    ]);
    await a.evalIn('icuSyncTreninzi(45, true)');
    assert.equal(a.ctx.__upit.oldest, '2026-08-28');
    assert.deepEqual(JSON.parse(a.evalIn('JSON.stringify(S.vanPlana)')), { '2026-09-10': 6.98, '2026-09-24': 5.12 });
    assert.equal(a.evalIn('S.log.n1d7.km'), 12, 'dan plana nije upisan');
  });

  test('vanPlana preživi backup i server, a smeće ne', () => {
    const a = loadApp({ now: '2026-09-30T09:00:00Z' });
    const m = JSON.parse(a.evalIn(`JSON.stringify(migrate({v:11, log:{}, vanPlana:{
      '2026-09-10':6.98, 'nije-datum':5, '2026-09-11':'7', '2026-09-12':-3, '2026-09-13':900 }}).vanPlana)`));
    assert.deepEqual(m, { '2026-09-10': 6.98 });
    assert.deepEqual(JSON.parse(a.evalIn('JSON.stringify(migrate({v:11, log:{}}).vanPlana)')), {});
  });
});
