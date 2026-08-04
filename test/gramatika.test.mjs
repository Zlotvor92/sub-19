/* JEZIK U APLIKACIJI

   Dva su razloga zašto ovo ima test, a ne samo jednokratnu ispravku:

   1) „Smirivanje" je preimenovano u „Hlađenje", a ta reč se ne samo ISPISUJE
      nego se i ČITA — regexi koji iz opisa treninga vade zagrevanje, radni deo
      i tempo traže je po imenu. Planovi koji su već sačuvani (u localStorage-u
      i na serveru) nose staru reč zauvek. Da parser prestane da je prepoznaje,
      kartica treninga bi tim ljudima ostala bez strukture i bez ciljnog tempa —
      i to nečujno, jer se ništa ne ruši.

   2) Reči koje je vlasnik izričito tražio („tempo", ne „tempe"; „hlađenje", ne
      „smirivanje") lako se vrate pri sledećem dodavanju teksta. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const app = loadApp();
const izvor = readRepoFile('app.js');

/* Samo stringovi, bez komentara — komentari u ovom projektu su svi bez kvačica
   i nisu deo onoga što korisnik vidi. */
function bezKomentara(t) {
  let out = '', i = 0, st = null;
  while (i < t.length) {
    const c = t[i];
    if (st === null) {
      if (c === "'" || c === '"' || c === '`') { st = c; out += c; i++; continue; }
      if (t.startsWith('/*', i)) { const j = t.indexOf('*/', i + 2); i = j < 0 ? t.length : j + 2; continue; }
      if (t.startsWith('//', i)) { const j = t.indexOf('\n', i); i = j < 0 ? t.length : j; continue; }
      out += c; i++;
    } else {
      if (c === '\\') { out += t.slice(i, i + 2); i += 2; continue; }
      if (c === st) st = null;
      out += c; i++;
    }
  }
  return out;
}
const kod = bezKomentara(izvor);

describe('Hlađenje — ispis', () => {

  test('generisani opisi kažu „hlađenje", ne „smirivanje"', () => {
    const opis = app.call('sessDesc', {
      type: 'tempo', kind: 'Tempo', wuKm: 2, qKm: 5, cdKm: 2, paceSec: 250
    });
    assert.match(opis, /km hlađenje/);
    assert.doesNotMatch(opis, /smirivanje/i);
  });

  test('korak na satu se zove Hlađenje', () => {
    assert.ok(/sek\.push\('Hlađenje/.test(kod), 'izvoz za sat i dalje šalje „Smirivanje"');
  });

  test('nijedan tekst koji korisnik vidi ne piše „smirivanje"', () => {
    /* Regexi za ČITANJE su izuzeti — oni tu reč moraju i dalje da prepoznaju. */
    const redovi = kod.split('\n').filter(r => /smirivanje/i.test(r) && !/\(\?:CD\|/.test(r));
    assert.deepEqual(redovi, []);
  });
});

describe('Hlađenje — čitanje starih planova', () => {

  /* Opis tačno onakav kakav je generator pravio PRE preimenovanja. Ovakvi
     stoje u sačuvanim planovima i moraju da se čitaju i dalje. */
  const STARI = 'Intervali — 2 km zagrevanje + 5×1000 m @ 3:55/km (2 min hoda) + 2 km smirivanje';
  const NOVI  = 'Intervali — 2 km zagrevanje + 5×1000 m @ 3:55/km (2 min hoda) + 2 km hlađenje';
  const LICNI = 'Intervali — 1.5 km WU + 5×400 m @ 3:50/km (90 s hod) + 1.5 km CD';

  function redovi(desc) {
    const r = app.call('sessBreakdown', { date: '2026-07-01', desc, id: 'x' });
    return new Map((r || []).map(x => [x[0], x[1]]));
  }

  test('stari opis i dalje daje radni deo', () => {
    const r = redovi(STARI);
    assert.equal(r.get('Zagrevanje'), '2 km');
    assert.ok(/1000 m @ 3:55\/km/.test(r.get('Radni deo') || ''), 'radni deo nije prepoznat');
    assert.equal(r.get('Hlađenje'), '2 km', 'stari „smirivanje" nije prepoznat kao hlađenje');
  });

  test('nov opis daje isto što i stari', () => {
    assert.deepEqual([...redovi(NOVI)], [...redovi(STARI)]);
  });

  test('lični plan (WU/CD) nije dirnut', () => {
    const r = redovi(LICNI);
    assert.equal(r.get('Zagrevanje'), '1.5 km');
    assert.equal(r.get('Hlađenje'), '1.5 km');
  });

  test('ciljni tempo se i dalje čita iz starog opisa', () => {
    /* Ovo je prava posledica ako regex prestane da hvata staru reč: sažetak
       sesije uzme ceo rep opisa umesto radnog dela. */
    const kratko = app.call('sessCore', { date: '2026-07-01', desc: STARI, id: 'x' });
    assert.doesNotMatch(String(kratko), /smirivanje/i,
      'sažetak je progutao i hlađenje — radni deo nije odsečen');
  });
});

describe('Reči koje je vlasnik tražio', () => {

  test('nigde ne piše „tempe"', () => {
    const redovi = kod.split('\n').filter(r => /\btempe\b/i.test(r));
    assert.deepEqual(redovi, [], 'množina „tempe" se vratila u tekst');
  });

  test('aplikacija se dodiruje, ne klikće', () => {
    /* Radi se o telefonu. „Klikni" je ostatak sa desktopa. */
    const redovi = kod.split('\n').filter(r => /\bklikn/i.test(r));
    assert.deepEqual(redovi, []);
  });

  test('nema engleskog reda reči „Plan tab"', () => {
    assert.doesNotMatch(kod, /\b(Plan|Danas|Progres|Povrede|Trka) tab\b/,
      'red reči je engleski — na srpskom je „u tabu Plan"');
  });
});

describe('Brojevi i oblici reči', () => {

  test('pl3 bira oblik po poslednjoj cifri, sa izuzetkom 11–14', () => {
    const f = n => app.call('pl3', n, 'adresu', 'adrese', 'adresa');
    assert.equal(f(1), 'adresu');
    assert.equal(f(2), 'adrese');
    assert.equal(f(4), 'adrese');
    assert.equal(f(5), 'adresa');
    assert.equal(f(11), 'adresa', '11 ide u treći oblik, ne u prvi');
    assert.equal(f(12), 'adresa', '12–14 idu u treći oblik, ne u drugi');
    assert.equal(f(14), 'adresa');
    assert.equal(f(21), 'adresu');
    assert.equal(f(22), 'adrese');
    assert.equal(f(25), 'adresa');
    assert.equal(f(0), 'adresa');
  });

  test('broj adresa nije zalepljen uz jedan oblik', () => {
    /* Ranije je pisalo „Poslati uputstvo na 1 adresa?" i „na 2 adresa?". */
    assert.doesNotMatch(kod, /\+n\+' adresa\?/);
    assert.doesNotMatch(kod, /adrese\.length\+' adresa /);
  });
});
