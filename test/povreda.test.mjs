/* Prilagođavanje plana posle povrede.

   Testovi prate tri stvarna nalaza:
   1. bol 10 u ŠACI ili GLAVI pretvarao je naredne treninge u odmor — plan
      trčanja nije razlikovao delove tela koji nose trčanje od ostalih;
   2. doziranje je bilo isti fiksni procenat za svakoga, i to od PLANIRANOG
      obima — a posle povrede plan i realnost se razilaze;
   3. run/walk je postojao samo za početnike u generatoru, ne i kao odgovor
      na bol. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const DANAS = '2026-08-11';

/* Aplikacija sa stvarnom istorijom trčanja (za hronično opterećenje) i
   jednim zapisom o bolu. */
function sa(bol, deo, opt = {}) {
  const a = loadApp({ now: DANAS + 'T09:00:00Z' });
  if (opt.bezIstorije !== true) {
    const log = {};
    a.evalIn('CUR_PLAN').filter(w => w.start < DANAS).slice(-4)
      .forEach(w => w.days.forEach(d => {
        /* SAMO prošli dani — budući "odrađeni" trening setAlt s pravom odbija */
        if (!d.rest && d.km && d.date < DANAS) log[d.id] = { status: 'done', km: d.km };
      }));
    a.evalIn(`S.log=${JSON.stringify(log)};`);
  }
  a.evalIn(`S.knee=[{id:'k1',date:'${DANAS}',pain:${bol},part:'${deo}'}]; rebuildDateIndex();`);
  return a;
}

describe('Bol koji ne nosi trčanje ne zaustavlja plan', () => {
  const NOSIVI = ['koleno-L', 'ahilova-D', 'list-L', 'stopalo-D', 'donja-ledja', 'kuk-L'];
  const OSTALI = ['saka-L', 'glava', 'rame-D', 'vrat', 'grudi', 'podlaktica-D'];

  for (const deo of NOSIVI) {
    test(`bol 10 u „${deo}" menja plan trčanja`, () => {
      const a = sa(10, deo);
      assert.equal(a.call('kneeStatus', DANAS).cls, 'stop');
      const p = a.call('injuryProposal', DANAS);
      assert.ok(p, 'nema predloga za nosivi deo tela');
      assert.equal(p.hitno, true, 'jak bol se ne označava kao hitan');
    });
  }

  for (const deo of OSTALI) {
    test(`bol 10 u „${deo}" NE zaustavlja trčanje`, () => {
      const a = sa(10, deo);
      assert.equal(a.call('kneeStatus', DANAS).cls, 'ok',
        `bol u delu koji ne nosi trčanje i dalje daje status ${a.call('kneeStatus', DANAS).cls}`);
      assert.equal(a.call('injuryProposal', DANAS), null,
        'plan trčanja se i dalje prepisuje zbog bola koji nema veze sa trčanjem');
    });
  }

  test('zapisi bez dela tela se broje kao nosivi (stari dnevnik kolena)', () => {
    const a = loadApp({ now: DANAS + 'T09:00:00Z' });
    a.evalIn(`S.knee=[{id:'k1',date:'${DANAS}',pain:8}]; rebuildDateIndex();`);
    assert.equal(a.call('kneeStatus', DANAS).cls, 'stop',
      'zapis bez `part` je prestao da se računa — stara istorija bi tiho nestala');
  });

  test('bol koji ne nosi trčanje se pominje u poruci, ne prećutkuje', () => {
    const a = loadApp({ now: DANAS + 'T09:00:00Z' });
    a.evalIn(`S.knee=[{id:'k1',date:'${DANAS}',pain:5,part:'ahilova-D'},
                      {id:'k2',date:'${DANAS}',pain:7,part:'rame-D'}]; rebuildDateIndex();`);
    const p = a.call('injuryProposal', DANAS);
    assert.ok(p, 'nema predloga');
    assert.match(p.message, /Desno rame/, 'bol u ramenu se nigde ne pominje');
    assert.ok(!p.parts.includes('Desno rame'), 'rame je ušlo u osnov za izmenu plana');
  });
});

describe('Run/walk dok bol ne padne ispod 4', () => {
  test('plan se NIKAD ne prazni — ni na bolu 10', () => {
    /* Ranije je bol 6+ brisao svako trčanje iz plana; čovek bi ostao bez
       ikakve strukture. Sada se nudi run/walk, a jačina bola menja odnos
       trčanja i hoda i obim — ne postojanje treninga. */
    for (const bol of [6, 7, 8, 9, 10]) {
      const p = sa(bol, 'ahilova-D').call('injuryProposal', DANAS);
      assert.ok(p && p.changes.length, `bol ${bol}: nema predloga`);
      assert.ok(p.changes.every(c => c.to !== 'odmor'), `bol ${bol}: plan je obrisan u odmor`);
      assert.ok(p.changes.every(c => c.km > 0), `bol ${bol}: trening bez kilometraže`);
      assert.ok(p.rw, `bol ${bol}: nema run/walk strukture`);
    }
  });

  test('jak bol i dalje nosi upozorenje, ne samo kraće trčanje', () => {
    const p = sa(9, 'ahilova-D').call('injuryProposal', DANAS);
    assert.equal(p.hitno, true);
    assert.match(p.message, /prilagođavanje TRENINGA, ne lečenje/);
    assert.match(p.message, /fizijatru ili lekaru/);
  });

  test('što je bol jači, kraće se trči i duže hoda', () => {
    const odnos = bol => {
      const p = sa(bol, 'ahilova-D').call('injuryProposal', DANAS);
      return p.rw.runSec / p.rw.walkSec;
    };
    const niz = [10, 8, 6, 5, 4].map(odnos);
    for (let i = 1; i < niz.length; i++)
      assert.ok(niz[i] > niz[i - 1], `odnos trčanje/hod ne raste kako bol pada: ${niz}`);
  });

  for (const [bol, runSec] of [[10, 60], [8, 60], [6, 120], [5, 180], [4, 300]]) {
    test(`bol ${bol} — run/walk sa ${runSec / 60} min trčanja`, () => {
      const p = sa(bol, 'ahilova-D').call('injuryProposal', DANAS);
      assert.equal(p.level, 'runwalk', `nivo je ${p.level}`);
      assert.ok(p.rw, 'nema run/walk strukture');
      assert.equal(p.rw.runSec, runSec);
      assert.ok(p.changes.every(c => c.rw), 'nisu svi treninzi dobili run/walk');
      assert.match(p.message, /Neprekidno trčanje se vraća kad bol padne ispod 4/);
    });
  }

  test('bol 3 — neprekidno trčanje, samo smanjen obim', () => {
    const p = sa(3, 'ahilova-D').call('injuryProposal', DANAS);
    assert.equal(p.level, 'warn');
    assert.equal(p.rw, null, 'run/walk se ubacuje ispod praga od 4');
  });

  test('run/walk preživi primenu, ponovni build i backup krug', () => {
    const a = sa(5, 'ahilova-D');
    const p = a.call('injuryProposal', DANAS);
    assert.equal(a.call('applyInjuryProposal', p), p.changes.length, 'nisu primenjene sve izmene');
    const id = p.changes[0].id;
    const rw = () => a.evalIn(`(BY_ID[${JSON.stringify(id)}]||{}).runWalk||null`);
    assert.ok(rw(), 'run/walk nije stigao do dana');
    a.evalIn('rebuildDateIndex()');
    assert.ok(rw(), 'run/walk se izgubio pri ponovnom build-u indeksa');
    const m = a.call('migrate', JSON.parse(JSON.stringify(a.evalIn('S'))));
    assert.ok(m.alts[id] && m.alts[id].rw, 'run/walk ne preživi backup krug');
  });

  test('ritam se VIDI na kartici treninga, ne samo u opisu', () => {
    const a = sa(5, 'ahilova-D');
    const p = a.call('injuryProposal', DANAS);
    a.call('applyInjuryProposal', p);
    a.ctx.__d = a.evalIn(`BY_ID[${JSON.stringify(p.changes[0].id)}]`);
    const html = a.evalIn('dayCard(__d)') || '';
    assert.match(html, /Ritam/, 'red „Ritam" se ne crta');
    assert.match(html, /min trčanje \/ .*min hod/);
  });

  test('run/walk iz pokvarenog backupa se odbacuje', () => {
    const a = loadApp();
    for (const zao of [{ runSec: 'x', walkSec: 60 }, { runSec: -5, walkSec: 60 },
                       { runSec: 60, walkSec: 0 }, { runSec: 99999, walkSec: 60 }, 'niz', null, 42])
      assert.equal(a.call('cistRunWalk', zao), null, `propušten ${JSON.stringify(zao)}`);
    const ok = a.call('cistRunWalk', { runSec: '120', walkSec: '60', label: '<img src=x onerror=1>' });
    assert.equal(ok.runSec, 120);
    assert.ok(!/img/.test(ok.label), 'label iz backupa se preuzima umesto da se preračuna');
  });
});

describe('Obim se dozira po stvarno odrađenom, ne po planiranom', () => {
  test('hronično opterećenje je prosek ostvarenog kroz 4 nedelje', () => {
    const a = sa(5, 'ahilova-D');
    const h = a.call('hronicniObim', DANAS);
    assert.ok(h > 0, 'hronično opterećenje se ne računa');
    assert.ok(h < 100 && h > 10, `nerealna vrednost: ${h}`);
  });

  test('bez istorije trčanja pada na ranije procente, ne puca', () => {
    const a = sa(5, 'ahilova-D', { bezIstorije: true });
    assert.equal(a.call('hronicniObim', DANAS), null);
    const p = a.call('injuryProposal', DANAS);
    assert.ok(p && p.changes.length, 'nema predloga bez istorije');
    assert.ok(p.changes.every(c => c.km == null || c.km > 0));
  });

  test('predloženi obim je uvek MANJI od planiranog', () => {
    for (const bol of [3, 4, 5]) {
      const a = sa(bol, 'ahilova-D');
      const p = a.call('injuryProposal', DANAS);
      for (const c of p.changes) {
        const baza = a.evalIn(`(function(){const d=BY_ID[${JSON.stringify(c.id)}];return d.origKm!=null?d.origKm:d.km;})()`);
        assert.ok(c.km <= baza, `bol ${bol}: ${c.km} km je više od planiranih ${baza} km`);
      }
    }
  });

  test('jači bol daje manji obim', () => {
    const uk = bol => {
      const p = sa(bol, 'ahilova-D').call('injuryProposal', DANAS);
      return p.changes.reduce((s, c) => s + (c.km || 0), 0);
    };
    const niz = [10, 8, 6, 5, 4, 3].map(uk);
    for (let i = 1; i < niz.length; i++)
      assert.ok(niz[i] >= niz[i - 1], `obim ne raste kako bol pada: ${niz}`);
    assert.ok(uk(10) < uk(3), `bol 10 daje ${uk(10)} km, bol 3 daje ${uk(3)} km`);
  });

  test('ponovljen predlog ne smanjuje već smanjeno', () => {
    /* Računa se od origKm — inače bi drugi krug dao 50% od već prepolovljenog. */
    const a = sa(5, 'ahilova-D');
    const prvi = a.call('injuryProposal', DANAS);
    a.call('applyInjuryProposal', prvi);
    const drugi = a.call('injuryProposal', DANAS);
    assert.deepEqual(Array.from(drugi.changes.map(c => c.km)),
                     Array.from(prvi.changes.map(c => c.km)),
                     'drugi predlog daje drugačiji obim od prvog');
  });
});
