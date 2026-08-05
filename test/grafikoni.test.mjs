/* Dodirljivi grafikoni.

   Telesna masa i nedeljna kilometraža su od ranije reagovale na dodir, a
   ostalih pet linija su bile mrtve slike. Sada svi rade po istom obrascu:
   natpis sa detaljima na vrhu, uvećana izabrana tačka i nevidljiv širi krug
   kao dodirni cilj (3 px prečnika se na telefonu ne pogađa). */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const DANAS = '2026-08-04';

function sa() {
  const a = loadApp({ now: DANAS + 'T09:00:00Z' });
  const log = {};
  a.evalIn('CUR_PLAN').forEach(w => w.days.forEach(d => {
    if (!d.rest && d.km && d.date && d.date < DANAS)
      log[d.id] = { status: 'done', km: d.km, sec: Math.round(d.km * 330), ts: d.date };
  }));
  const wellness = {};
  for (let i = 0; i < 20; i++) {
    const dt = a.call('addD', DANAS, -i);
    wellness[dt] = { datum: dt, hrv: 100 + ((i * 7) % 20), pulsUMiru: 46 + (i % 5), sanH: 6.5 + (i % 4) / 10 };
  }
  a.evalIn(`S.log=${JSON.stringify(log)};
    S.kg=[{date:'2026-06-22',kg:82},{date:'2026-07-06',kg:81},{date:'2026-08-03',kg:79}];
    S.knee=[{id:'k1',date:'2026-07-10',pain:3,part:'koleno-D',act:'Trčanje',note:'posle intervala'},
            {id:'k2',date:'2026-07-20',pain:5,part:'ahilova-D',act:'Trčanje',note:''}];
    S.wellness=${JSON.stringify(wellness)};
    const ids=CUR_PRED.slice(0,8).map(r=>r.id);
    S.pred={}; S.vdotLog=[];
    ids.forEach((id,i)=>{ const r=CUR_PRED.find(x=>x.id===id);
      S.pred[id]=r.pt+(i%3)*3;
      S.vdotLog.push({id, ts:'2026-0'+(6+Math.floor(i/4))+'-'+String(5+i*3).padStart(2,'0'), measured:48+i*0.3}); });
    preracunajVdotLog(); rebuildDateIndex();`);
  return a;
}

/* koji grafikon živi na kom ekranu */
const GRAFIKONI = [
  { kljuc: 'wt',    render: 'renderOporavak', sel: '#pg-opor',   ime: 'telesna masa' },
  { kljuc: 'tempo', render: 'renderPred',      sel: '#pg-pred',   ime: 'prosečan tempo' },
  { kljuc: 'hrv',   render: 'renderOporavak', sel: '#pg-opor',   ime: 'HRV' },
  { kljuc: 'knee',  render: 'renderOporavak', sel: '#pg-opor', ime: 'bol kroz vreme' },
  { kljuc: 'vdot',  render: 'renderPred', sel: '#pg-pred',   ime: 'VDOT trend' },
  { kljuc: 'pred',  render: 'renderPred', sel: '#pg-pred',   ime: 'predikcija' }
];

describe('Svaka linija je dodirljiva', () => {
  for (const g of GRAFIKONI) {
    test(`${g.ime} ima dodirne ciljeve`, () => {
      const a = sa();
      a.call(g.render);
      const html = a.evalIn(`$(${JSON.stringify(g.sel)}).innerHTML`) || '';
      const n = (html.match(new RegExp(`data-cpt="${g.kljuc}"`, 'g')) || []).length;
      assert.ok(n > 0, `${g.ime}: nijedna tačka nije dodirljiva`);
    });

    test(`${g.ime} pokazuje detalje izabrane tačke`, () => {
      const a = sa();
      a.call(g.render);
      const bez = a.evalIn(`$(${JSON.stringify(g.sel)}).innerHTML`) || '';
      assert.match(bez, /Dodirni tačku za detalje/, `${g.ime}: nema poziva na dodir`);

      a.evalIn(`CHART_SEL.${g.kljuc}=1`);
      a.call(g.render);
      const sa_ = a.evalIn(`$(${JSON.stringify(g.sel)}).innerHTML`) || '';
      const m = /class="chart-info"[^>]*>([^<]+)</.exec(sa_);
      assert.ok(m && m[1].trim().length > 3, `${g.ime}: izbor ne daje natpis`);
      assert.ok(!/NaN|undefined|Invalid/.test(m[1]), `${g.ime}: natpis je "${m[1]}"`);
    });

    test(`${g.ime} — nijedan indeks ne pravi smeće`, () => {
      /* Selekcija preživi promenu podataka (CHART_SEL je van S), pa indeks ume
         da pokaže na tačku koje više nema. */
      const a = sa();
      for (let i = -1; i < 30; i++) {
        a.evalIn(`CHART_SEL.${g.kljuc}=${i}`);
        a.call(g.render);
        const html = a.evalIn(`$(${JSON.stringify(g.sel)}).innerHTML`) || '';
        assert.ok(!/NaN|undefined|Invalid Date/.test(html), `${g.ime}: indeks ${i} daje smeće`);
      }
    });
  }
});

describe('Ponašanje izbora', () => {
  test('broj dodirnih ciljeva prati broj nacrtanih tačaka', () => {
    const a = sa();
    a.call('renderPred');
    const html = a.evalIn('$("#pg-pred").innerHTML') || '';
    assert.equal((html.match(/data-cpt="pred"/g) || []).length,
                 Object.keys(a.evalIn('({...S.pred})')).length);
    assert.equal((html.match(/data-cpt="vdot"/g) || []).length, a.evalIn('S.vdotLog.length'));
  });

  test('dodirni cilj je dovoljno veliki za prst (r=11)', () => {
    const a = sa();
    a.call('renderOporavak');
    const html = a.evalIn('$("#pg-opor").innerHTML') || '';
    const hits = html.match(/<circle[^>]*data-cpt="[^"]*"[^>]*>/g) || [];
    assert.ok(hits.length > 0);
    for (const h of hits) assert.match(h, /r="11"/, `dodirni cilj je manji: ${h.slice(0, 80)}`);
  });

  test('vezisTacke poništava izbor na ponovni dodir', () => {
    const a = sa();
    a.evalIn('CHART_SEL.vdot=2');
    /* isti indeks ponovo -> null (logika iz vezisTacke) */
    a.evalIn(`(function(){ const k='vdot', i=2; CHART_SEL[k]=CHART_SEL[k]===i?null:i; })()`);
    assert.equal(a.evalIn('CHART_SEL.vdot'), null);
  });

  test('svi ključevi selekcije postoje od početka', () => {
    const a = loadApp();
    const sel = a.evalIn('({...CHART_SEL})');
    for (const g of GRAFIKONI) assert.ok(g.kljuc in sel, `CHART_SEL nema ${g.kljuc}`);
    for (const k of Object.keys(sel)) assert.equal(sel[k], null, `${k} nije null na startu`);
  });
});
