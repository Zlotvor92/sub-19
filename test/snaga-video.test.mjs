/* Vežbe snage: link na snimak tehnike samo tamo gde E3 Rehab ili Squat
   University imaju zaseban snimak baš te vežbe. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const a = loadApp({ now: '2026-09-25T09:00:00Z' });
const nazivi = new Set(JSON.parse(a.evalIn(`JSON.stringify(CUR_PLAN.flatMap(w=>w.days)
  .filter(d=>d.tag==='snaga').flatMap(d=>d.desc.split('\\n'))
  .map(r=>/^• ([^:]+):/.exec(r)).filter(Boolean).map(m=>m[1]))`)));

describe('Snimak tehnike uz vežbe snage', () => {
  test('svaki snimak pripada vežbi iz plana i jednom od dva kanala', () => {
    const kljucevi = JSON.parse(a.evalIn('JSON.stringify(Object.keys(VEZBE_VIDEO))'));
    assert.deepEqual(kljucevi.sort(), ['Bugarski čučanj', 'Mrtva buba', 'Rumunsko mrtvo dizanje na jednoj nozi']);
    for (const n of kljucevi) {
      assert.ok(nazivi.has(n), `${n} nije u planu`);
      const v = JSON.parse(a.evalIn(`JSON.stringify(vezbaVideo(${JSON.stringify(n)}))`));
      assert.match(v.url, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/);
      assert.ok(['E3 Rehab', 'Squat University'].includes(v.autor));
    }
  });

  test('vežbe bez zasebnog snimka nemaju link', () => {
    assert.ok(nazivi.size >= 20);
    for (const n of nazivi) if (!['Bugarski čučanj', 'Mrtva buba', 'Rumunsko mrtvo dizanje na jednoj nozi'].includes(n))
      assert.equal(a.evalIn(`vezbaVideo(${JSON.stringify(n)})`), null, n);
    assert.equal(a.evalIn(`vezbaVideo('toString')`), null);
  });

  test('dan Snage B: linkovi samo uz vežbe sa snimkom, ostalo escapovano', () => {
    const d = a.evalIn(`CUR_PLAN.flatMap(w=>w.days).find(d=>d.tag==='snaga'&&d.desc.includes('• Mrtva buba')).desc`);
    const h = a.call('opisSaVezbamaHTML', d);
    assert.equal((h.match(/<a class="yt"/g) || []).length,
      ['Bugarski čučanj', 'Mrtva buba', 'Rumunsko mrtvo dizanje na jednoj nozi'].filter(n => d.includes('• ' + n + ':')).length);
    assert.match(h, /target="_blank" rel="noopener noreferrer"/);
    assert.doesNotMatch(a.call('opisSaVezbamaHTML', '• <img src=x>: 3×10'), /<img/);
  });
});
