/* SNAGA UZ TRČANJE ISTOG DANA — dugo držanje u „Izmeni trening".

   Kratak dodir bira jedan tip (kao ranije). Držanjem se uz trkački tip dodaje
   snaga, pa dan nosi trčanje (km, tempo, sinhronizacija, obim) i oznaku
   „+ Snaga". Samo dugo držanje je provereno u pravom Chromium-u (Playwright):
   harness ne emituje pointer događaje. Ovde se drži sve iza njega. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const app = () => loadApp({ now: '2026-09-28T09:00:00Z' });

describe('Snaga uz trčanje', () => {
  test('čuva se, prikazuje „Lako + Snaga" i broji kao trčanje', () => {
    const a = app();
    const pre = a.evalIn('weekRunCount(CUR_PLAN[1])');
    const r = a.call('setAlt', 'n2d2', { tag: 'lako', km: 5, desc: 'Lako 5 km + Snaga A', snaga: true });
    assert.equal(r.ok, true, r.err);
    assert.equal(a.evalIn('S.alts.n2d2.snaga'), true);
    assert.equal(a.evalIn('BY_ID.n2d2.tag'), 'lako');
    assert.equal(a.evalIn('BY_ID.n2d2.snaga'), true);
    assert.equal(a.call('oznakaDana', a.evalIn('BY_ID.n2d2')), 'Lako + Snaga');
    assert.equal(a.evalIn('weekRunCount(CUR_PLAN[1])'), pre + 1);
    /* sessKind ostaje čist — iz njega idu zone i VDOT */
    assert.equal(a.call('sessKind', a.evalIn('BY_ID.n2d2')), 'Lako');
  });

  test('izmena treninga pokazuje oba izabrana dugmeta i uputstvo za držanje', () => {
    const a = app();
    a.call('setAlt', 'n2d2', { tag: 'tempo', km: 6, desc: 'x', snaga: true });
    a.evalIn('ALT_DRAFT=null');
    const h = a.evalIn(`altSheetHTML(BY_ID['n2d2'])`);
    const on = [...h.matchAll(/data-t="(\w+)" class="on"/g)].map(m => m[1]).sort();
    assert.deepEqual(on, ['snaga', 'tempo']);
    assert.match(h, /Zadrži dugme/);
  });

  test('preživi backup; uz odmor, snagu ili trku se ne prihvata', () => {
    const a = app();
    a.call('setAlt', 'n2d2', { tag: 'lr', km: 10, desc: 'x', snaga: true });
    const m = JSON.parse(a.evalIn('JSON.stringify(migrate(JSON.parse(JSON.stringify(S))).alts.n2d2)'));
    assert.equal(m.snaga, true);
    const c = JSON.parse(a.evalIn(`JSON.stringify(cistAlts({
      a:{tag:'odmor',snaga:true,desc:''}, b:{tag:'snaga',snaga:true,desc:''}, c:{tag:'trka',km:21.1,snaga:true,desc:''},
      d:{tag:'int',km:8,snaga:'da',desc:''} }))`));
    for (const k of ['a', 'b', 'c', 'd']) assert.equal(c[k].snaga, undefined, `${k}: snaga je prošla`);
  });

  test('kratak izbor jednog tipa skida dodatu snagu', () => {
    const a = app();
    a.call('setAlt', 'n2d2', { tag: 'lako', km: 5, desc: 'x', snaga: true });
    a.call('setAlt', 'n2d2', { tag: 'lako', km: 5, desc: 'x', snaga: false });
    assert.equal(a.evalIn('S.alts.n2d2.snaga'), undefined);
    assert.equal(a.evalIn('BY_ID.n2d2.snaga'), false);
  });
});
