/* Prilagođavanje plana formi (VDOT).

   Do sada je aplikacija MERILA VDOT iz svake kvalitetne sesije, crtala ga i
   slala AI-u — ali se plan od toga nije pomerao. Ko je napredovao brže od
   pretpostavljene putanje trčao je i dalje sporije tempe nego što može.

   Radi za OBA tipa plana kroz isti put (S.alts[id].pace + effectivePace):
   lični plan je tvrdo kodovan i ne sme se dirati, generisan dodatno osvežava
   i opis sesije. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const DANAS = '2026-08-04';

function sa(merenja, opt = {}) {
  const a = loadApp({ now: DANAS + 'T09:00:00Z' });
  if (opt.generisan) {
    a.ctx.__m = {
      startDate: DANAS, raceDate: '2026-11-15', raceDistM: 5000,
      pb: { distM: 5000, sec: 1237 }, weeklyKm: 40, runDays: 4, quality: 2,
      intensity: 'std', trainedRecently: true, goalSec: null
    };
    a.evalIn(`(function(){ const g=generatePlan(__m);
      S.genPlan=adaptGeneratedPlan(g); setActivePlan(); rebuildDateIndex(); })()`);
  }
  const log = merenja.map((v, i) => ({ id: 'q' + (i + 1), ts: '2026-07-' + String(10 + i * 3).padStart(2, '0'), measured: v }));
  a.evalIn(`S.vdotLog=${JSON.stringify(log)}; preracunajVdotLog(); rebuildDateIndex();`);
  return a;
}
/* trenutno važeći ciljni tempo dana — isti put koji vidi kartica treninga */
const tempo = (a, id) => a.evalIn(
  `(function(){const d=BY_ID[${JSON.stringify(id)}];const pid=predRowFor(d);
     const r=pid?CUR_PRED.find(x=>x.id===pid):null;return effectivePace(d,r);})()`);

const BRZA = [52.5, 53.0, 53.4, 53.8];
const SPORA = [46.0, 45.5, 45.2, 45.0];

describe('Kada se predlog uopšte javlja', () => {
  test('jedna ili dve sesije nisu dovoljne', () => {
    assert.equal(sa([53]).call('vdotPredlog', DANAS), null);
    assert.equal(sa([53, 53.5]).call('vdotPredlog', DANAS), null);
  });

  test('kad se forma i plan slažu, nema šta da se menja', () => {
    const a = sa([48.5, 48.6, 48.7, 48.6]);
    const f = a.call('formaVsPlan', DANAS);
    assert.ok(Math.abs(f.delta) < a.get('VDOT_PRAG'), `razlika ${f.delta}`);
    assert.equal(a.call('vdotPredlog', DANAS), null);
  });

  test('bez ijednog merenja nema ni računa', () => {
    const a = loadApp({ now: DANAS + 'T09:00:00Z' });
    assert.equal(a.call('formaVsPlan', DANAS), null);
    assert.equal(a.call('vdotPredlog', DANAS), null);
  });

  test('planski VDOT se čita IZ PLANA, ne modelira posebno', () => {
    /* Obrtanjem tempa koji plan traži — zato radi jednako za oba tipa plana. */
    const f = sa(BRZA).call('formaVsPlan', DANAS);
    assert.ok(f.planVdot > 40 && f.planVdot < 60, `planVdot = ${f.planVdot}`);
    assert.equal(f.delta, Math.round((f.forma - f.planVdot) * 10) / 10);
    assert.ok(f.danaSaTempom > 0);
  });
});

describe('Lični plan — tempi se prilagođavaju, plan se ne dira', () => {
  test('brža forma daje brže tempe', () => {
    const a = sa(BRZA);
    const p = a.call('vdotPredlog', DANAS);
    assert.ok(p && p.changes.length, 'nema predloga');
    assert.equal(p.brzi, true);
    for (const c of p.changes) assert.ok(c.novo < c.staro, `${c.date}: ${c.novo} nije brže od ${c.staro}`);
  });

  test('sporija forma daje sporije tempe', () => {
    const p = sa(SPORA).call('vdotPredlog', DANAS);
    assert.equal(p.brzi, false);
    for (const c of p.changes) assert.ok(c.novo > c.staro, `${c.date}: ${c.novo} nije sporije od ${c.staro}`);
  });

  test('primena menja ciljni tempo koji vidi kartica treninga', () => {
    const a = sa(BRZA);
    const p = a.call('vdotPredlog', DANAS);
    const id = p.changes[0].id;
    const pre = tempo(a, id);
    assert.equal(a.call('primeniVdotPredlog', p), p.changes.length);
    assert.equal(tempo(a, id), p.changes[0].novo);
    assert.ok(tempo(a, id) < pre);
  });

  test('KONSTANTA PLAN ostaje netaknuta', () => {
    const a = sa(BRZA);
    const pre = a.evalIn('JSON.stringify(PLAN.map(w=>w.days.map(d=>d.origDesc||d.desc)))');
    a.call('primeniVdotPredlog', a.call('vdotPredlog', DANAS));
    assert.equal(a.evalIn('JSON.stringify(PLAN.map(w=>w.days.map(d=>d.origDesc||d.desc)))'), pre,
      'prilagođavanje je diralo tvrdo kodovan plan');
  });

  test('predlog se ne ponavlja pošto je primenjen', () => {
    /* Poredi se sa tempom koji plan TRENUTNO traži, ne sa sirovim PRED redom —
       inače bi isti predlog iskakao u nedogled. */
    const a = sa(BRZA);
    a.call('primeniVdotPredlog', a.call('vdotPredlog', DANAS));
    assert.equal(a.call('vdotPredlog', DANAS), null, 'predlog i dalje iskače posle primene');
  });

  test('poništavanje vraća sve na planske tempe', () => {
    const a = sa(BRZA);
    const p = a.call('vdotPredlog', DANAS);
    const id = p.changes[0].id, pre = tempo(a, id);
    a.call('primeniVdotPredlog', p);
    assert.equal(a.call('ponistiVdotPrilagodjavanje'), p.changes.length);
    assert.equal(tempo(a, id), pre);
    assert.equal(Object.keys(a.evalIn('({...S.alts})')).length, 0, 'ostali su prazni alts unosi');
  });
});

describe('Šta se NE sme dirati', () => {
  test('odrađen trening', () => {
    const a = sa(BRZA);
    const id = a.call('vdotPredlog', DANAS).changes[0].id;
    a.evalIn(`S.log[${JSON.stringify(id)}]={status:'done',km:8}; rebuildDateIndex();`);
    assert.ok(!a.call('vdotPredlog', DANAS).changes.some(c => c.id === id));
  });

  test('ručno postavljen tempo', () => {
    const a = sa(BRZA);
    const id = a.call('vdotPredlog', DANAS).changes[1].id;
    a.evalIn(`(function(){const d=BY_ID[${JSON.stringify(id)}];
      setAlt(d.id,{tag:d.tag,km:d.km,desc:d.desc,pace:260});})()`);
    const p = a.call('vdotPredlog', DANAS);
    assert.ok(!p.changes.some(c => c.id === id), 'automatika gazi ručnu odluku');
    a.call('primeniVdotPredlog', p);
    assert.equal(a.evalIn(`S.alts[${JSON.stringify(id)}].pace`), 260);
    a.call('ponistiVdotPrilagodjavanje');
    assert.equal(a.evalIn(`S.alts[${JSON.stringify(id)}].pace`), 260,
      'poništavanje je obrisalo i ručni tempo');
  });

  test('dan trke', () => {
    const p = sa(BRZA).call('vdotPredlog', DANAS);
    const a = sa(BRZA);
    for (const c of p.changes)
      assert.notEqual(a.evalIn(`BY_ID[${JSON.stringify(c.id)}].tag`), 'trka');
  });

  test('obim — VDOT određuje tempo, ne koliko se trči', () => {
    const a = sa(BRZA);
    const pre = a.evalIn('CUR_PLAN.reduce((s,w)=>s+w.days.reduce((x,d)=>x+(d.km||0),0),0)');
    a.call('primeniVdotPredlog', a.call('vdotPredlog', DANAS));
    assert.equal(a.evalIn('CUR_PLAN.reduce((s,w)=>s+w.days.reduce((x,d)=>x+(d.km||0),0),0)'), pre,
      'prilagođavanje tempa je promenilo kilometražu');
  });
});

describe('Generisan plan — i opis sesije prati novi tempo', () => {
  const opis = (a, id) => a.evalIn(
    `(S.genPlan.weeks.flatMap(w=>w.days).find(d=>d.id===${JSON.stringify(id)})||{}).desc`);

  test('opis treninga se preračuna, ne ostane na starom tempu', () => {
    const a = sa([53.0, 53.6, 54.0, 54.4], { generisan: true });
    const p = a.call('vdotPredlog', DANAS);
    assert.ok(p && p.changes.length, 'nema predloga za generisan plan');
    const id = p.changes.find(c => opis(a, c.id)) ? p.changes.find(c => opis(a, c.id)).id : p.changes[0].id;
    const pre = opis(a, id);
    a.call('primeniVdotPredlog', p);
    assert.notEqual(opis(a, id), pre, 'opis i dalje pokazuje stari tempo');
  });

  test('NE postavlja overrides — to nije ručno zaključavanje', () => {
    const a = sa([53.0, 53.6, 54.0, 54.4], { generisan: true });
    const p = a.call('vdotPredlog', DANAS);
    a.call('primeniVdotPredlog', p);
    const zakljucani = a.evalIn(`S.genPlan.weeks.flatMap(w=>w.days)
      .filter(d=>d.session&&d.session.overrides&&d.session.overrides.paceSec).length`);
    assert.equal(zakljucani, 0, 'automatika se predstavlja kao ručna izmena');
  });

  test('poništavanje vraća i opis i izvorni tempo sesije', () => {
    const a = sa([53.0, 53.6, 54.0, 54.4], { generisan: true });
    const p = a.call('vdotPredlog', DANAS);
    const id = p.changes[0].id, pre = opis(a, id);
    a.call('primeniVdotPredlog', p);
    a.call('ponistiVdotPrilagodjavanje');
    assert.equal(opis(a, id), pre, 'opis nije vraćen');
    assert.equal(a.evalIn(`S.genPlan.weeks.flatMap(w=>w.days)
      .filter(d=>d.session&&d.session.paceSec0!=null).length`), 0, 'ostao je zapamćen izvorni tempo');
  });
});

describe('Prikaz', () => {
  test('kartica sa predlogom se crta na Predikciji', () => {
    const a = sa(BRZA);
    a.call('renderPred');
    const html = a.evalIn('$("#pg-pred").innerHTML') || '';
    assert.match(html, /Forma je ispred plana/);
    assert.match(html, /vd-apply/);
    assert.ok(!/NaN|undefined/.test(html), 'u kartici ima NaN/undefined');
  });

  test('posle primene se nudi vraćanje', () => {
    const a = sa(BRZA);
    a.call('primeniVdotPredlog', a.call('vdotPredlog', DANAS));
    a.call('renderPred');
    const html = a.evalIn('$("#pg-pred").innerHTML') || '';
    assert.match(html, /vd-undo/, 'nema dugmeta za vraćanje — čovek ostaje zaglavljen');
  });

  test('bez predloga nema ni kartice', () => {
    const a = sa([48.5, 48.6, 48.7, 48.6]);
    a.call('renderPred');
    const html = a.evalIn('$("#pg-pred").innerHTML') || '';
    assert.ok(!/vd-apply/.test(html));
  });
});
