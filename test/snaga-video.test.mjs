/* Vežbe snage u ličnom planu imaju link „kako se izvodi" (YouTube pretraga). */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const a = loadApp({ now: '2026-09-25T09:00:00Z' });

describe('YouTube link uz vežbe snage', () => {
  test('svaka vežba iz ličnog plana ima link', () => {
    const nazivi = new Set(JSON.parse(a.evalIn(`JSON.stringify(CUR_PLAN.flatMap(w=>w.days)
      .filter(d=>d.tag==='snaga').flatMap(d=>d.desc.split('\\n'))
      .map(r=>/^• ([^:]+):/.exec(r)).filter(Boolean).map(m=>m[1]))`)));
    assert.ok(nazivi.size >= 20, `samo ${nazivi.size} vežbi`);
    for (const n of nazivi) {
      const u = a.call('vezbaYtUrl', n);
      assert.match(String(u), /^https:\/\/www\.youtube\.com\/results\?search_query=[\w%.-]+$/, n);
    }
  });

  test('dan snage: jedan link po vežbi, ostatak teksta escapovan', () => {
    const d = a.evalIn(`CUR_PLAN.flatMap(w=>w.days).find(d=>d.tag==='snaga'&&d.desc.includes('•')).desc`);
    const h = a.call('opisSaVezbamaHTML', d);
    assert.equal((h.match(/<a class="yt"/g) || []).length, (d.match(/^• /gm) || []).length);
    assert.match(h, /target="_blank" rel="noopener noreferrer"/);
  });

  test('nepoznat red i HTML u opisu ne postaju link niti markup', () => {
    const h = a.call('opisSaVezbamaHTML', '• <img src=x>: 3×10\nlako 5 km');
    assert.doesNotMatch(h, /<a |<img/);
    assert.match(h, /&lt;img/);
  });
});
