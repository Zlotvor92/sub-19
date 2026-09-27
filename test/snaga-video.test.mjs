/* Vežbe snage: zaseban snimak E3 Rehab / Squat University, inače Short
   jedne vežbe sa pozitivnim komentarima (SA), inače najbolji Short označen
   „neprovereno". */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const a = loadApp({ now: '2026-09-25T09:00:00Z' });
const SA = ['A-skip', 'Bočna plank', 'Bugarski čučanj', 'Dorsifleksija sa trakom', 'Goblet čučanj',
  'Most na jednoj nozi', 'Mrtva buba', 'Pallof pritisak', 'Podizanje na prste, jedna noga',
  'Podizanje prstiju uz zid (tibialis)', 'Pogo skokovi snožno', 'Rumunsko mrtvo dizanje na jednoj nozi', 'Skok iz čučnja'];
const nazivi = new Set(JSON.parse(a.evalIn(`JSON.stringify(CUR_PLAN.flatMap(w=>w.days)
  .filter(d=>d.tag==='snaga').flatMap(d=>d.desc.split('\\n'))
  .map(r=>/^• ([^:]+):/.exec(r)).filter(Boolean).map(m=>m[1]))`)));

describe('Snimak tehnike uz vežbe snage', () => {
  test('svaki snimak pripada vežbi iz plana i jednom od dva kanala', () => {
    const kljucevi = JSON.parse(a.evalIn('JSON.stringify(Object.keys(VEZBE_VIDEO))'));
    assert.deepEqual([...kljucevi].sort(), [...nazivi].sort());
    for (const n of kljucevi) {
      assert.ok(nazivi.has(n), `${n} nije u planu`);
      const v = JSON.parse(a.evalIn(`JSON.stringify(vezbaVideo(${JSON.stringify(n)}))`));
      assert.match(v.url, /^https:\/\/www\.youtube\.com\/(watch\?v=|shorts\/)[\w-]{11}$/);
      if (v.url.includes('watch')) assert.ok(['E3 Rehab', 'Squat University'].includes(v.autor), n);
    }
  });

  test('svaka vežba iz plana ima snimak; neproverene su označene', () => {
    assert.ok(nazivi.size >= 20);
    for (const n of nazivi) {
      const v = JSON.parse(a.evalIn(`JSON.stringify(vezbaVideo(${JSON.stringify(n)}))`));
      assert.ok(v, n);
      assert.equal(v.neprov, !SA.includes(n), n);
    }
    assert.equal(a.evalIn(`vezbaVideo('toString')`), null);
    const h = a.call('opisSaVezbamaHTML', '• Pogo na jednoj nozi: 2×10\n• A-skip: 2×20 m');
    assert.equal((h.match(/· neprovereno</g) || []).length, 1);
  });

  test('dan Snage B: link uz svaku vežbu, ostalo escapovano', () => {
    const d = a.evalIn(`CUR_PLAN.flatMap(w=>w.days).find(d=>d.tag==='snaga'&&d.desc.includes('• Mrtva buba')).desc`);
    const h = a.call('opisSaVezbamaHTML', d);
    assert.equal((h.match(/<a class="yt"/g) || []).length,
      (d.match(/^• /gm) || []).length);
    assert.match(h, /target="_blank" rel="noopener noreferrer"/);
    assert.doesNotMatch(a.call('opisSaVezbamaHTML', '• <img src=x>: 3×10'), /<img/);
  });
});
