/* Podešavanja — kartice koje se sklapaju.

   Ranije: šest sekcija u ravnom nizu razdvojenih linijom, sve iste težine, pa
   je do backupa trebalo šest ekrana skrolovanja. intervals.icu je uz to nosio
   i povlačenje oporavka I slanje na sat, pa je bio dvostruko duži od ostalih. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

const UID = '0403f8fb-a643-4d4e-843d-f71199a0d6f9';

function sa(opt = {}) {
  const a = loadApp({
    now: '2026-08-04T09:00:00Z',
    seedLocalStorage: opt.prijavljen ? {
      sub19_sb: JSON.stringify({ access: 't', token: 't', expiresAt: Date.now() + 9e6,
        email: 'a@b.c', userId: opt.vlasnik ? UID : '1111', seenAt: null, deviceId: 'd1' })
    } : {}
  });
  if (opt.strava) a.evalIn(`S.strava={athlete:'A V',lastSync:Date.now()};`);
  if (opt.icu) a.evalIn(`S.icu={athleteId:'i584208',token:'t',lastSync:Date.now(),lastPush:${opt.push ? 'Date.now()' : 'null'}}; S.wellness={};`);
  a.call('openSettings');
  return { a, html: a.evalIn('$("#sheet").innerHTML') || '' };
}
const kartice = h => [...h.matchAll(/<details class="set-card"( open)?>[\s\S]*?<b>([^<]*)<\/b><span>([^<]*)<\/span>/g)]
  .map(m => ({ otvorena: !!m[1], naslov: m[2], stanje: m[3] }));

describe('Struktura', () => {
  test('svaka sekcija je zasebna kartica', () => {
    const { html } = sa({ prijavljen: true, strava: true, icu: true });
    const k = kartice(html).map(x => x.naslov);
    assert.deepEqual(k, ['Nalog', 'Plan', 'Strava', 'Oporavak', 'Slanje na sat', 'Podaci']);
  });

  test('intervals.icu je razdvojen — oporavak i sat su odvojene kartice', () => {
    const { html } = sa({ prijavljen: true, icu: true });
    const k = kartice(html).map(x => x.naslov);
    assert.ok(k.includes('Oporavak') && k.includes('Slanje na sat'),
      'povlačenje i slanje su i dalje u istoj sekciji');
  });

  test('kartica za slanje na sat ne postoji dok intervals.icu nije povezan', () => {
    const { html } = sa({ prijavljen: true });
    assert.ok(!kartice(html).some(x => x.naslov === 'Slanje na sat'));
  });

  test('vlasnik dobija i karticu za obaveštenje korisnicima', () => {
    const { html } = sa({ prijavljen: true, vlasnik: true });
    assert.ok(kartice(html).some(x => x.naslov === 'Obaveštenje korisnicima'));
    const tudj = sa({ prijavljen: true });
    assert.ok(!kartice(tudj.html).some(x => x.naslov === 'Obaveštenje korisnicima'),
      'tuđ nalog vidi administratorsku sekciju');
  });
});

describe('Šta je otvoreno, a šta sklopljeno', () => {
  test('sekcija koja traži radnju otvara se sama', () => {
    const { html } = sa({});
    const otv = kartice(html).filter(x => x.otvorena).map(x => x.naslov);
    assert.deepEqual(otv, ['Nalog', 'Strava', 'Oporavak'],
      'nepovezane sekcije nisu otvorene');
  });

  test('kad je sve povezano, ništa nije otvoreno — sve staje na jedan ekran', () => {
    const { html } = sa({ prijavljen: true, strava: true, icu: true, push: true });
    assert.deepEqual(kartice(html).filter(x => x.otvorena), []);
  });

  test('svaka kartica pokazuje stanje BEZ otvaranja', () => {
    const { html } = sa({ prijavljen: true, strava: true, icu: true });
    for (const k of kartice(html))
      assert.ok(k.stanje && k.stanje.trim().length > 2,
        `„${k.naslov}" nema liniju stanja u zaglavlju`);
  });

  test('pregled veza na vrhu pokazuje sve tri', () => {
    const { html } = sa({ prijavljen: true, strava: true });
    const c = [...html.matchAll(/<div class="(ok|no)"><b>([^<]*)<\/b>/g)].map(m => [m[2], m[1]]);
    assert.deepEqual(c, [['Nalog', 'ok'], ['Strava', 'ok'], ['intervals', 'no']]);
  });
});

describe('Ništa nije izgubljeno pri preuređenju', () => {
  const SVA_DUGMAD = ['sb-sync', 'sb-out', 'st-sync', 'st-off', 'icu-sync', 'icu-off',
    'icu-push', 'icu-vidi', 'icu-push2', 's-exp', 's-imp', 's-file', 's-bug',
    'bc-lista', 'bc-proba', 'bc-svi'];

  test('sva dugmad iz starog rasporeda i dalje postoje', () => {
    const { html } = sa({ prijavljen: true, vlasnik: true, strava: true, icu: true });
    const nema = SVA_DUGMAD.filter(id => !html.includes('id="' + id + '"'));
    assert.deepEqual(nema, [], `nedostaju: ${nema.join(', ')}`);
  });

  test('dugmad za povezivanje postoje kad ništa nije povezano', () => {
    const { html } = sa({});
    for (const id of ['sb-in', 'st-on', 'icu-oauth', 'icu-on', 'pl-gen'])
      assert.ok(html.includes('id="' + id + '"'), `nema #${id}`);
  });

  test('vezivanje rukovalaca ne puca ni u jednom stanju', () => {
    for (const opt of [{}, { prijavljen: true }, { prijavljen: true, strava: true },
                       { prijavljen: true, strava: true, icu: true },
                       { prijavljen: true, vlasnik: true, strava: true, icu: true, push: true }])
      assert.doesNotThrow(() => sa(opt), `puca za ${JSON.stringify(opt)}`);
  });

  test('zone pulsa i dalje stoje u Strava kartici', () => {
    const a = loadApp({ now: '2026-08-04T09:00:00Z' });
    a.evalIn(`S.strava={athlete:'A',lastSync:Date.now(),hrZones:[{min:0,max:120},{min:120,max:140}]};`);
    a.call('openSettings');
    assert.match(a.evalIn('$("#sheet").innerHTML') || '', /Tvoje zone pulsa/);
  });

  test('nema NaN ni undefined ni u jednom stanju', () => {
    for (const opt of [{}, { prijavljen: true }, { prijavljen: true, strava: true, icu: true },
                       { prijavljen: true, vlasnik: true, strava: true, icu: true, push: true }]) {
      const { html } = sa(opt);
      assert.ok(!/NaN|undefined|Invalid/.test(html), `${JSON.stringify(opt)}: ${(/.{0,50}(NaN|undefined|Invalid).{0,20}/.exec(html) || [])[0]}`);
    }
  });

  test('podnožje i dalje nosi verziju i linkove', () => {
    const { html, a } = sa({ prijavljen: true });
    assert.ok(html.includes('Verzija ' + a.get('APP_VERSION')));
    assert.match(html, /uputstvo\.html/);
    assert.match(html, /privacy\.html/);
  });
});
