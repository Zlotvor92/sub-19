/* Telesna masa — ručni unos, brisanje i grafikon po vremenu.

   Prijava iz upotrebe: masa se unosila SAMO uz trening, pa je bez treninga
   nije bilo gde upisati; merenja vezana za dane uklonjenog plana nisu mogla
   da se obrišu; a grafikon je sve što je pre početka plana slagao u N1. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const DANAS = '2026-09-25';
const app = () => loadApp({ now: DANAS + 'T09:00:00Z' });
const kg = a => JSON.parse(a.evalIn('JSON.stringify(S.kg)'));

describe('Ručni unos mase', () => {
  test('upisuje merenje bez treninga i bez cilja', () => {
    const a = app();
    const r = a.call('dodajMasu', DANAS, '79,4');
    assert.equal(r.ok, true, r.err);
    assert.deepEqual(kg(a), [{ date: DANAS, kg: 79.4 }]);
  });

  test('isti dan: ručni unos zamenjuje raniji ručni, a onaj iz treninga ostaje', () => {
    const a = app();
    a.evalIn(`S.kg=[{date:'${DANAS}',kg:80,src:'n1d7'}]`);
    a.call('dodajMasu', DANAS, '79.8');
    a.call('dodajMasu', DANAS, '79.6');
    const k = kg(a);
    assert.equal(k.length, 2);
    assert.equal(k.filter(x => !x.src)[0].kg, 79.6);
    assert.equal(k.filter(x => x.src)[0].kg, 80);
  });

  test('odbija nemoguće vrednosti i datume', () => {
    const a = app();
    for (const [d, v] of [[DANAS, ''], [DANAS, 'abc'], [DANAS, '5'], [DANAS, '400'],
                          ['2026-02-31', '79'], ['nije-datum', '79'], ['2026-09-26', '79']]) {
      assert.equal(a.call('dodajMasu', d, v).ok, false, `prošlo: ${d} / ${v}`);
    }
    assert.equal(kg(a).length, 0);
  });

  test('unos preživi migraciju (backup / server)', () => {
    const a = app();
    a.call('dodajMasu', DANAS, '79,4');
    const m = JSON.parse(a.evalIn('JSON.stringify(migrate(JSON.parse(JSON.stringify(S))).kg)'));
    assert.deepEqual(m, [{ date: DANAS, kg: 79.4 }]);
  });
});

describe('Brisanje mase', () => {
  test('pojedinačno brisanje merenja iz treninga briše i masu na treningu', () => {
    /* Inače bi je syncSide vratio pri sledećoj izmeni tog dana. */
    const a = app();
    a.evalIn(`S.log={n1d7:{status:'done',km:12,kg:80.2}};
              S.kg=[{date:'2026-09-27',kg:80.2,src:'n1d7'},{date:'2026-09-20',kg:81}]`);
    assert.equal(a.call('obrisiMasu', 0), true);
    assert.deepEqual(kg(a), [{ date: '2026-09-20', kg: 81 }]);
    assert.equal(a.evalIn('S.log.n1d7.kg'), undefined);
    assert.equal(a.evalIn('S.log.n1d7.km'), 12, 'obrisan je i trening, ne samo masa');
  });

  test('„obriši pre početka plana" skida tačno stara merenja, uključujući arhivirana', () => {
    const a = app();
    a.evalIn(`S.kg=[{date:'2026-07-01',kg:82,src:'arhiva'},{date:'2026-09-20',kg:81},
                    {date:'2026-09-21',kg:80.5},{date:'${DANAS}',kg:79.4}]`);
    assert.equal(a.call('obrisiMasuPre', a.evalIn('CUR_START')), 2);
    assert.deepEqual(kg(a).map(x => x.date), ['2026-09-21', DANAS]);
  });

  test('dugme za stara merenja se pojavljuje samo kad ih ima', () => {
    const a = app();
    a.evalIn(`S.kg=[{date:'2026-07-01',kg:82,src:'arhiva'},{date:'${DANAS}',kg:79.4}]`);
    assert.match(a.call('karticaMase'), /id="wt-stari"[^>]*>Obriši 1 merenje pre 21\.09\./);
    a.call('obrisiMasuPre', '2026-09-21');
    assert.doesNotMatch(a.call('karticaMase'), /wt-stari/);
  });

  test('svako merenje ima svoje dugme za brisanje', () => {
    const a = app();
    a.evalIn(`S.kg=[{date:'2026-07-01',kg:82},{date:'2026-08-01',kg:81},{date:'${DANAS}',kg:79.4}]`);
    const h = a.call('karticaMase');
    assert.equal((h.match(/data-wtdel="/g) || []).length, 3);
  });
});

describe('Grafikon mase je po vremenu', () => {
  test('merenja pre početka plana se NE slažu u jednu uspravnu liniju', () => {
    const a = app();
    a.evalIn(`S.kg=[{date:'2026-06-22',kg:81.8},{date:'2026-07-20',kg:81},{date:'2026-08-17',kg:80},
                    {date:'2026-09-14',kg:79.3}]`);
    const svg = String(a.call('chartWeight'));
    const xs = [...svg.matchAll(/<circle cx="([\d.]+)"[^>]*data-cpt="wt"/g)].map(m => +m[1]);
    assert.equal(xs.length, 4);
    assert.equal(new Set(xs).size, 4, `tačke dele x: ${xs}`);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1], 'x ne raste sa datumom');
    assert.doesNotMatch(svg, /NaN|undefined|Invalid/);
  });

  test('bez merenja nema praznog grafikona, nego poziv na unos', () => {
    const a = app();
    assert.match(String(a.call('chartWeight')), /Još nema merenja/);
  });

  test('jedno merenje se crta unutar okvira', () => {
    const a = app();
    a.evalIn(`S.kg=[{date:'${DANAS}',kg:79.4}]`);
    const svg = String(a.call('chartWeight'));
    const m = /<circle cx="([\d.]+)"/.exec(svg);
    assert.ok(m && +m[1] >= 30 && +m[1] <= 332, `tačka je van okvira: ${m && m[1]}`);
  });
});
