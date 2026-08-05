/* SPOJEVI IZMEĐU IZMENA — tu se greške i kriju.

   Svaka funkcija posebno radi; pale su tek kad se sretnu. Sva tri nalaza ispod
   su izmerena, ne pretpostavljena:
   1. ručna izmena kilometraže brisala je run/walk ritam, a opis je i dalje
      pisao „Run/walk 3 min trčanje / 1 min hod" — kartica tvrdi jedno,
      podatak drugo;
   2. ekran „Zameni" otvarao je polje „Ciljni tempo" PRAZNO iako cilj postoji
      (gradi se iz dana, a cilj živi u S.alts), pa je čuvanje brisalo i ručno
      postavljen cilj i onaj iz prilagođavanja formi;
   3. predlog posle povrede i prilagođavanje tempa dele iste dane. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const D = '2026-08-11';

function sa() {
  const a = loadApp({ now: D + 'T09:00:00Z' });
  a.evalIn(`
    const log={}; CUR_PLAN.forEach(w=>w.days.forEach(d=>{
      if(!d.rest&&d.km&&d.date&&d.date<'${D}') log[d.id]={status:'done',km:d.km,sec:Math.round(d.km*330),ts:d.date}; }));
    S.log=log;
    const m=[53.5,54,54.2,54.5,54.8,55,55.2,55.4];
    S.vdotLog=CUR_PRED.slice(0,m.length).map((r,i)=>({id:r.id,ts:'2026-07-'+String(10+i).padStart(2,'0'),measured:m[i]}));
    preracunajVdotLog(); rebuildDateIndex();`);
  return a;
}
const alt = (a, id) => JSON.parse(a.evalIn(`JSON.stringify(S.alts[${JSON.stringify(id)}]||null)`));

describe('setAlt čuva polja koja pozivalac ne navede', () => {
  test('ručna izmena kilometraže NE briše run/walk ritam', () => {
    const a = sa();
    a.evalIn(`S.knee=[{id:'k1',date:'${D}',pain:5,part:'ahilova-D'}]; rebuildDateIndex();`);
    const p = a.call('injuryProposal', D);
    a.call('applyInjuryProposal', p);
    const id = p.changes[0].id;
    assert.ok(alt(a, id).rw, 'run/walk nije ni postavljen');
    /* ekran „Zameni" šalje samo tag/km/opis/tempo — ne zna za run/walk */
    a.evalIn(`setAlt(${JSON.stringify(id)}, {tag:'lako', km:6, desc:S.alts[${JSON.stringify(id)}].desc, pace:null})`);
    assert.ok(alt(a, id).rw, 'ritam je obrisan, a opis i dalje tvrdi da je run/walk');
    assert.equal(alt(a, id).km, 6, 'kilometraža nije izmenjena');
  });

  test('dan odmora gubi ritam — tamo nema šta da se trči', () => {
    const a = sa();
    a.evalIn(`S.knee=[{id:'k1',date:'${D}',pain:5,part:'ahilova-D'}]; rebuildDateIndex();`);
    const p = a.call('injuryProposal', D);
    a.call('applyInjuryProposal', p);
    const id = p.changes[0].id;
    a.evalIn(`setAlt(${JSON.stringify(id)}, {tag:'odmor'})`);
    assert.equal(alt(a, id).rw, null);
  });

  test('izričit null briše ritam, undefined ga čuva', () => {
    const a = sa();
    a.evalIn(`S.knee=[{id:'k1',date:'${D}',pain:5,part:'ahilova-D'}]; rebuildDateIndex();`);
    const p = a.call('injuryProposal', D);
    a.call('applyInjuryProposal', p);
    const id = p.changes[0].id;
    const d = () => a.evalIn(`(function(){const x=BY_ID[${JSON.stringify(id)}];return {tag:x.tag,km:x.km,desc:x.desc};})()`);
    a.evalIn(`(function(){const x=${JSON.stringify(d())}; x.rw=null; setAlt(${JSON.stringify(id)}, x);})()`);
    assert.equal(alt(a, id).rw, null, 'izričit null nije obrisao ritam');
  });
});

describe('Ekran „Zameni" ne gubi ciljni tempo', () => {
  test('polje se otvara popunjeno vrednošću iz S.alts', () => {
    const a = sa();
    const p = a.call('vdotPredlog', D);
    a.call('primeniVdotPredlog', p);
    const id = p.changes[0].id;
    const tempo = alt(a, id).pace;
    assert.ok(tempo > 0, 'prilagođavanje nije postavilo cilj');
    a.ctx.__d = a.evalIn(`BY_ID[${JSON.stringify(id)}]`);
    a.evalIn('ALT_DRAFT=null');
    const html = a.evalIn('altSheetHTML(__d)') || '';
    const m = /id="alt-pace"[^>]*value="([^"]*)"/.exec(html);
    assert.ok(m, 'nema polja za ciljni tempo');
    assert.ok(m[1].length > 0, 'polje se otvara prazno — čuvanje bi obrisalo cilj');
    assert.equal(m[1], a.call('fmtTempo', tempo));
  });

  test('ručno postavljen tempo prestaje da bude automatski', () => {
    const a = sa();
    const p = a.call('vdotPredlog', D);
    a.call('primeniVdotPredlog', p);
    const id = p.changes[0].id;
    assert.equal(alt(a, id).paceAuto, true);
    a.evalIn(`(function(){const x=BY_ID[${JSON.stringify(id)}];
      setAlt(x.id,{tag:x.tag,km:x.km,desc:x.desc,pace:260});})()`);
    assert.equal(alt(a, id).paceAuto, false, 'ručna izmena se i dalje broji kao automatska');
    /* Poništavanje čisti ostale automatske dane — ali NE i ovaj. */
    const ocisceno = a.call('ponistiVdotPrilagodjavanje');
    assert.equal(ocisceno, p.changes.length - 1, `očišćeno ${ocisceno} od ${p.changes.length - 1} automatskih`);
    assert.equal(alt(a, id).pace, 260, 'poništavanje je obrisalo ručno postavljen cilj');
  });
});

describe('Povreda i prilagođavanje forme dele iste dane', () => {
  test('oba se mogu primeniti jedno za drugim, bez pucanja', () => {
    const a = sa();
    const vp = a.call('vdotPredlog', D);
    assert.equal(a.call('primeniVdotPredlog', vp), vp.changes.length);
    a.evalIn(`S.knee=[{id:'k1',date:'${D}',pain:5,part:'ahilova-D'}]; rebuildDateIndex();`);
    const ip = a.call('injuryProposal', D);
    assert.ok(ip && ip.changes.length, 'povreda ne daje predlog posle prilagođavanja tempa');
    const preklop = ip.changes.filter(c => vp.changes.some(x => x.id === c.id));
    assert.ok(preklop.length > 0, 'test ne pokriva preklapanje — nema zajedničkih dana');
    assert.equal(a.call('applyInjuryProposal', ip), ip.changes.length);
    for (const c of preklop) {
      const x = alt(a, c.id);
      assert.ok(x.rw, `${c.date}: run/walk nije postavljen preko prilagođenog dana`);
      assert.equal(x.tag, 'lako');
    }
  });

  test('svi ekrani se crtaju posle oba', () => {
    const a = sa();
    a.call('primeniVdotPredlog', a.call('vdotPredlog', D));
    a.evalIn(`S.knee=[{id:'k1',date:'${D}',pain:5,part:'ahilova-D'}]; rebuildDateIndex();`);
    a.call('applyInjuryProposal', a.call('injuryProposal', D));
    for (const [f, sel] of [['renderDanas', '#pg-danas'], ['renderOporavak', '#pg-opor'],
                            ['renderPred', '#pg-pred'], ['renderOporavak', '#pg-opor'], ['renderPlan', '#pg-plan']]) {
      assert.doesNotThrow(() => a.call(f), `${f} puca`);
      const h = a.evalIn(`$(${JSON.stringify(sel)}).innerHTML`) || '';
      assert.ok(!/NaN|undefined|Invalid Date/.test(h), `${f} ispisuje smeće`);
    }
  });

  test('sve preživi backup krug', () => {
    const a = sa();
    a.call('primeniVdotPredlog', a.call('vdotPredlog', D));
    a.evalIn(`S.knee=[{id:'k1',date:'${D}',pain:5,part:'ahilova-D'}]; rebuildDateIndex();`);
    a.call('applyInjuryProposal', a.call('injuryProposal', D));
    const pre = a.evalIn('JSON.stringify(S.alts)');
    const posle = a.evalIn('JSON.stringify(migrate(JSON.parse(JSON.stringify(S))).alts)');
    assert.equal(posle, pre, 'izmene se gube pri izvozu/uvozu backupa');
  });
});

describe('Stara selekcija grafikona na promenjenim podacima', () => {
  test('nijedan ekran ne ispisuje smeće kad podaci nestanu ispod izbora', () => {
    /* CHART_SEL živi izvan S, pa preživi i uvoz backupa i brisanje unosa. */
    const a = sa();
    a.evalIn('CHART_SEL.tempo=20; CHART_SEL.vdot=7; CHART_SEL.knee=5; CHART_SEL.pred=9; CHART_SEL.hrv=3; CHART_SEL.wt=1;');
    a.evalIn('S.vdotLog=[]; S.kg=[]; S.knee=[]; S.log={}; S.wellness={}; S.pred={}; rebuildDateIndex();');
    for (const [f, sel] of [['renderOporavak', '#pg-opor'], ['renderPred', '#pg-pred'], ['renderOporavak', '#pg-opor']]) {
      assert.doesNotThrow(() => a.call(f), `${f} puca`);
      const h = a.evalIn(`$(${JSON.stringify(sel)}).innerHTML`) || '';
      assert.ok(!/NaN|undefined|Invalid/.test(h), `${f}: ${(/.{0,60}(NaN|undefined|Invalid).{0,20}/.exec(h) || [])[0]}`);
    }
  });
});
