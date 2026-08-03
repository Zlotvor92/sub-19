/* LIČNI (hardkodovan) PLAN — zaključan.

   Ovo je vlasnikov plan iz Plan_SUB-19_5K_v5.xlsx: 14 nedelja, start
   22.06.2026, trka 24.09.2026. Nije podrazumevani plan aplikacije nego
   NEČIJI STVARNI plan sa istorijom treninga uz njega.

   Za razliku od generatora, ovde se tvrde TAČNE vrednosti — namerno. Cilj
   nije da se opiše ponašanje nego da nijedna izmena drugde (refaktor,
   promena formule, „mala popravka") ne može tiho da ga promeni. Ako ovaj
   fajl padne, izmena je pogrešna dok se ne dokaže suprotno. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = loadApp();

describe('Konstante ličnog plana', () => {
  test('datumi i cilj su nepromenjeni', () => {
    assert.equal(app.get('START'), '2026-06-22');
    assert.equal(app.get('RACE'), '2026-09-24');
    assert.equal(app.get('CILJ'), '19:20–19:30');
    assert.equal(app.get('CILJ_TEMPO'), '3:52–3:54 /km');
  });

  test('plan ima 14 nedelja i nepromenjen raspored', () => {
    const plan = app.get('PLAN');
    assert.equal(plan.length, 14);
    assert.equal(plan[0].start, '2026-06-22');
    assert.equal(plan[13].start, '2026-09-21');
    assert.equal(plan[0].focus, 'TEMPO nedelja');
    /* N7 je deload, N14 je trkačka */
    assert.match(plan[6].focus, /DELOAD/);
    assert.equal(plan[13].days.length, 4, 'trkačka nedelja ima 4 dana (trka je četvrtak)');
    const trka = plan[13].days.find(d => d.tag === 'trka');
    assert.ok(trka, 'nema dana trke');
    assert.equal(trka.km, 5);
    assert.equal(trka.id, 'n14d4');
  });

  test('ukupna kilometraža i broj treninga su nepromenjeni', () => {
    const plan = app.get('PLAN');
    const ukupno = plan.reduce((s, w) => s + w.days.reduce((a, d) => a + (d.km || 0), 0), 0);
    assert.equal(Math.round(ukupno * 10) / 10, 533.7, 'ukupna kilometraža plana se promenila');
    const treninga = plan.reduce((n, w) => n + w.days.filter(d => !d.rest).length, 0);
    assert.equal(treninga, 72, 'broj treninga se promenio');
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
    assert.equal(app.get('PRED').length, 25);
    assert.equal(app.evalIn('PRED[0].id'), 'p1');
    assert.equal(app.evalIn('PRED[24].id'), 'p21');
    const wt = app.get('WT_TARGET');
    assert.equal(wt.length, 14);
    assert.equal(wt[0].kg, 82);
    assert.equal(wt[13].kg, 75.5);
  });

  test('QS tabela (Strava lapovi) je nepromenjena', () => {
    const qs = app.get('QS');
    assert.equal(Object.keys(qs).length, 24);
    assert.deepEqual(Array.from(qs.n6d5), [4000, 2000]);
    assert.deepEqual(Array.from(qs.n14d2), [200]);
  });

  test('početna istorija iz Excela je nepromenjena', () => {
    const s = app.call('seedState');
    assert.equal(Object.keys(s.log).length, 7);
    assert.equal(s.log.n1d1.km, 7);
    assert.equal(s.log.n1d7.status, 'skip');
    assert.equal(s.knee.length, 10);
    assert.equal(s.kg.length, 2);
    assert.equal(s.kg[0].kg, 81.6);
    assert.deepEqual({ ...s.pred }, { p1: 265, p2: 236 });
  });
});

describe('Lični plan je aktivan kad nema generisanog', () => {
  test('CUR_PLAN pokazuje na PLAN, a datumi na START/RACE', () => {
    const a = loadApp();
    assert.equal(a.evalIn('S.genPlan'), null);
    assert.equal(a.evalIn('CUR_PLAN.length'), 14);
    assert.equal(a.evalIn('CUR_START'), '2026-06-22');
    assert.equal(a.evalIn('CUR_RACE'), '2026-09-24');
    assert.equal(a.evalIn('CUR_PRED.length'), 25);
  });

  test('podrazumevani opis cilja za AI je vlasnikov 5K cilj', () => {
    const a = loadApp();
    assert.equal(a.call('goalCtxText'),
      '5K oko 19:30 (cilj koji i na lošiji dan iznosi sub-20)');
  });

  test('baseline i ciljni VDOT su vlasnikovi (PB 20:37 -> cilj 19:30)', () => {
    const a = loadApp();
    assert.equal(a.call('baselineVdot'), 48.1);
    assert.equal(a.call('goalVdotActive'), 51.3);
    assert.equal(a.call('goalSecActive'), 1170);
    assert.equal(a.call('raceDistActive'), 5000);
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
