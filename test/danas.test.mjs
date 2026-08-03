/* Prelazak preko ponoći.

   Instalirana PWA stoji otvorena danima. Dok je `TODAY` bio `const`
   izračunat pri učitavanju, aplikacija je posle ponoći prikazivala
   jučerašnji trening kao „Danas", a „Završi trening" upisivao jučerašnji
   datum. Ovaj fajl to drži zatvorenim. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

describe('Dan se osvežava', () => {
  test('TODAY prati stvarni datum posle prelaska ponoći', () => {
    const app = loadApp({ now: '2026-07-01T23:50:00Z' });
    assert.equal(app.get('TODAY'), '2026-07-01');

    app.clock.set('2026-07-02T00:30:00Z');
    /* bez osvežavanja i dalje stoji stara vrednost — to je i bio bag */
    assert.equal(app.get('TODAY'), '2026-07-01');

    assert.equal(app.call('osveziDan'), true, 'osveziDan mora prijaviti promenu');
    assert.equal(app.get('TODAY'), '2026-07-02');
  });

  test('osveziDan ne prijavljuje promenu kad je isti dan', () => {
    const app = loadApp({ now: '2026-07-01T10:00:00Z' });
    assert.equal(app.call('osveziDan'), false);
    app.clock.set('2026-07-01T22:00:00Z');
    assert.equal(app.call('osveziDan'), false);
  });

  test('setPage osvežava dan (promena taba posle ponoći)', () => {
    const app = loadApp({ now: '2026-07-01T23:59:00Z' });
    app.clock.set('2026-07-02T00:05:00Z');
    app.call('setPage', 'plan');
    assert.equal(app.get('TODAY'), '2026-07-02');
  });

  test('izvedene funkcije koriste NOVI dan posle osvežavanja', () => {
    /* Provera da nijedno mesto nije uhvatilo staru vrednost u zatvaranju. */
    const app = loadApp({ now: '2026-07-01T23:50:00Z' });
    const preDiff = app.call('diffD', app.get('TODAY'), '2026-07-10');
    app.clock.set('2026-07-02T00:30:00Z');
    app.call('osveziDan');
    const posleDiff = app.call('diffD', app.get('TODAY'), '2026-07-10');
    assert.equal(preDiff - posleDiff, 1, 'razlika do trke se nije smanjila za dan');
  });

  test('TODAY je uvek ispravnog oblika YYYY-MM-DD', () => {
    for (const iso of ['2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', '2026-03-29T02:30:00Z']) {
      const app = loadApp({ now: iso });
      assert.match(app.get('TODAY'), /^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('Datumske pomoćne funkcije', () => {
  const app = loadApp();
  test('addD i diffD su međusobno dosledni', () => {
    for (const d of ['2026-01-01', '2026-02-28', '2026-06-22', '2026-12-31']) {
      for (const n of [-30, -1, 0, 1, 7, 60]) {
        assert.equal(app.call('diffD', d, app.call('addD', d, n)), n, `${d} +${n}`);
      }
    }
  });
  test('prelazak preko prelazne godine i letnjeg računanja vremena', () => {
    assert.equal(app.call('addD', '2028-02-28', 1), '2028-02-29');
    assert.equal(app.call('addD', '2026-03-28', 1), '2026-03-29');
    assert.equal(app.call('addD', '2026-10-24', 1), '2026-10-25');
  });
  test('mondayOfWeek i nextMonday rade u UTC-u (bez pomeraja po zoni)', () => {
    assert.equal(app.call('mondayOfWeek', '2026-06-24'), '2026-06-22');
    assert.equal(app.call('mondayOfWeek', '2026-06-22'), '2026-06-22');
    assert.equal(app.call('nextMonday', '2026-06-23'), '2026-06-29');
    assert.equal(app.call('nextMonday', '2026-06-22'), '2026-06-22');
  });
});
