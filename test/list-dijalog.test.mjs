/* MODALNI LIST KAO PRAV DIJALOG

   NALAZ: `#sheet` je bio go `<div class="sheet">`. Bez `role`, bez
   `aria-modal`, bez naziva, bez ijednog `focus()` u celom `app.js` (nula
   poziva) i bez zamke za fokus. Za čitač ekrana i za tastaturu modal nije
   postojao: fokus je ostajao na stranici ISPOD lista, „Tab" je šetao po
   dugmadima koja se ne vide, a Escape nije radio ništa.

   To nije opšta primedba na stil nego raskorak sa merilom koje je aplikacija
   sebi već postavila: `user-scalable=no` je uklonjen izričito zbog WCAG 1.4.4,
   a providnost teksta je birana da i na staklu ostane iznad 4.5:1. Uz to je u
   celom paketu postojala TAČNO JEDNA provera pristupačnosti (pinch-zoom u
   `doslednost.test.mjs`), pa to merilo nije imalo nikakvu mrežu.

   Sve se meri IZVRŠAVANJEM. Provera nad izvorom („ima li `role=dialog`") bi
   prolazila i kad se atribut nikad ne postavi na pravom elementu, i kad fokus
   ne mrdne. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

/* Pravi list sa nekoliko dugmadi u sadržaju — zamka za fokus se ne može meriti
   nad praznim listom. */
const SADRZAJ = `<div class="card"><div class="card-t">Ponedeljak, 3. avgust</div>
  <button id="a1">Prvo</button><button id="a2">Drugo</button><button id="a3">Treće</button></div>`;

const list = a => a.evalIn(`$('#sheet')`);

describe('Otvoren list se predstavlja kao dijalog', () => {

  test('uloga i modalnost stoje u markupu', () => {
    /* `role` i `aria-modal` su statični i žive u index.html; harness učitava
       samo app.js, pa se ovo jedino tamo i može pročitati. `tabindex="-1"` NIJE
       ukras: bez njega `focus()` na `div` ne radi ništa, pa bi zamka za fokus
       ispod prolazila nad elementom koji fokus ne može ni da primi. */
    const html = readRepoFile('index.html');
    const tag = /<div[^>]*id="sheet"[^>]*>/.exec(html);
    assert.ok(tag, 'element #sheet je nestao iz index.html');
    assert.match(tag[0], /role="dialog"/, 'list nije dijalog za čitač ekrana');
    assert.match(tag[0], /aria-modal="true"/, 'čitač ne zna da je sadržaj ispod nedostupan');
    assert.match(tag[0], /tabindex="-1"/, 'fokus se ne može pomeriti na sam list');
  });

  test('otvaranje upisuje naziv i otkriva list čitaču', () => {
    const a = loadApp();
    const el = list(a);
    a.call('openSheet', SADRZAJ);
    assert.equal(el.getAttribute('aria-hidden'), 'false', 'otvoren list je i dalje sakriven od čitača');
    assert.match(String(el.getAttribute('aria-label') || ''), /\S/,
      'dijalog je bezimen — čitač kaže samo „dijalog"');
  });

  test('naziv se uzima iz naslova sadržaja', () => {
    /* Meri se na samoj `listNaziv`, sa objektom koji poštuje isti ugovor kao
       DOM. Razlog: lažni DOM gradi elemente iz TAGOVA, ne iz teksta — pa
       `querySelector('.card-t').textContent` u njemu ne može da vrati ništa, i
       provera kroz `openSheet` bi merila ograničenje harnessa umesto koda.
       Ugovor je uzak i ceo je ovde: prvi `.card-t`, pa `h2`, pa `h3`. */
    const a = loadApp();
    const sa = mapa => a.call('listNaziv', { querySelector: sel => mapa[sel] || null });
    assert.equal(sa({ '.card-t': { textContent: '  Ponedeljak, 3. avgust  ' } }), 'Ponedeljak, 3. avgust',
      'naziv se ne čita iz naslova kartice');
    assert.equal(sa({ h2: { textContent: 'Podešavanja' } }), 'Podešavanja', 'h2 se ne uzima kao naslov');
    assert.equal(sa({ '.card-t': { textContent: '   ' }, h2: { textContent: 'Rezerva' } }), 'Rezerva',
      'prazan naslov se uzima kao ime umesto da se pređe na sledeći');
  });

  test('sadržaj bez naslova ipak dobija ime, nikad prazno', () => {
    const a = loadApp();
    assert.equal(a.call('listNaziv', { querySelector: () => null }), 'Detalji');
    a.call('openSheet', '<p>nešto bez naslova</p>');
    assert.match(String(list(a).getAttribute('aria-label') || ''), /\S/,
      'dijalog je ostao bez imena');
  });

  test('zatvaranje vraća `aria-hidden`', () => {
    /* Inače bi zatvoren list ostao u stablu pristupačnosti i čitač bi i dalje
       nudio njegov sadržaj, iako se ništa ne vidi. */
    const a = loadApp();
    a.call('openSheet', SADRZAJ);
    a.call('closeSheet');
    assert.equal(list(a).getAttribute('aria-hidden'), 'true', 'zatvoren list je i dalje vidljiv čitaču');
  });
});

describe('Fokus ulazi u list i vraća se odakle je došao', () => {

  test('otvaranje pomera fokus U list', () => {
    /* Ovo je sam nalaz: pre popravke u celom app.js nije bilo nijednog
       `focus()`, pa je fokus ostajao na dugmetu ispod otvorenog lista. */
    const a = loadApp();
    a.call('openSheet', SADRZAJ);
    assert.equal(a.evalIn('document.activeElement'), list(a),
      'fokus je ostao na stranici ispod otvorenog lista');
  });

  test('zatvaranje vraća fokus na dugme koje je list otvorilo', () => {
    /* Bez povratka fokus pada na `<body>` i čitač počinje od vrha stranice —
       za čoveka je to isto kao da je izgubio mesto na kom je bio. */
    const a = loadApp();
    a.evalIn(`__dugme = document.createElement('button'); __dugme.focus();`);
    a.call('openSheet', SADRZAJ);
    assert.notEqual(a.evalIn('document.activeElement'), a.evalIn('__dugme'),
      'priprema: fokus se nije ni pomerio');
    a.call('closeSheet');
    assert.equal(a.evalIn('document.activeElement'), a.evalIn('__dugme'),
      'fokus se ne vraća — čitač posle zatvaranja počinje od vrha stranice');
  });
});

describe('Pozadina se sklanja dok list stoji', () => {

  test('zaglavlje, sadržaj i traka tabova postaju inertni', () => {
    /* Bez ovoga „Tab" izlazi iz lista u stranicu koja je za korisnika
       sakrivena — fokus naizgled nestane. */
    const a = loadApp();
    a.call('openSheet', SADRZAJ);
    for (const sel of ['header', 'main', '#tabbar']) {
      assert.equal(a.evalIn(`$('${sel}').inert`), true, `${sel} nije inertan dok list stoji`);
    }
  });

  test('zatvaranje vraća pozadinu', () => {
    const a = loadApp();
    a.call('openSheet', SADRZAJ);
    a.call('closeSheet');
    for (const sel of ['header', 'main', '#tabbar']) {
      assert.equal(a.evalIn(`$('${sel}').inert`), false, `${sel} je ostao inertan i posle zatvaranja`);
    }
  });

  test('pozadina prestaje da bude inertna PRE nego što se fokus vrati', () => {
    /* U inertnu granu se fokus ne može pomeriti. Da je redosled obrnut,
       `focus()` bi tiho pao na `<body>` i povratak fokusa bi bio prazan hod —
       tačno ona vrsta popravke koja izgleda kao da radi. */
    const a = loadApp();
    a.evalIn(`__dugme = document.createElement('button'); __dugme.focus();`);
    a.call('openSheet', SADRZAJ);
    a.call('closeSheet');
    assert.equal(a.evalIn('document.activeElement'), a.evalIn('__dugme'));
    assert.equal(a.evalIn(`$('main').inert`), false);
  });
});

describe('Tastatura', () => {

  const pritisni = (a, key, shift) =>
    a.okini('keydown', { type: 'keydown', key, shiftKey: !!shift, preventDefault() { this._sprecen = true; } });

  test('Escape zatvara otvoren list', () => {
    /* Od dijaloga se to očekuje; pre popravke u app.js nije bilo nijednog
       `keydown` slušaoca. */
    const a = loadApp();
    a.call('openSheet', SADRZAJ);
    assert.equal(list(a).classList.contains('on'), true, 'priprema: list nije ni otvoren');
    assert.ok(pritisni(a, 'Escape') > 0, 'niko ne sluša tastaturu');
    assert.equal(list(a).classList.contains('on'), false, 'Escape ne zatvara list');
  });

  test('Escape ne dira ništa dok je list zatvoren', () => {
    /* Inače bi Escape usred kucanja u polje na stranici okidao zatvaranje
       nečega što nije ni otvoreno, i uz njega `PAGES[ACTIVE]()` — dakle
       precrtavanje ekrana bez povoda. */
    const a = loadApp();
    let palo = false;
    try { pritisni(a, 'Escape'); } catch (e) { palo = true; }
    assert.equal(palo, false, 'Escape nad zatvorenim listom ruši aplikaciju');
    assert.equal(list(a).classList.contains('on'), false);
  });

  test('Tab sa poslednjeg polja se vraća na prvo, ne izlazi iz lista', () => {
    const a = loadApp();
    a.call('openSheet', SADRZAJ);
    const polja = a.evalIn(`$('#sheet').querySelectorAll('button')`);
    assert.ok(polja.length >= 3, `priprema: nađeno ${polja.length} dugmadi u listu`);
    const prvi = polja[0], zadnji = polja[polja.length - 1];

    a.evalIn(`$('#sheet').querySelectorAll('button')[${polja.length - 1}].focus()`);
    assert.equal(a.evalIn('document.activeElement'), zadnji, 'priprema: fokus nije na poslednjem');
    pritisni(a, 'Tab');
    assert.equal(a.evalIn('document.activeElement'), prvi,
      'Tab je izašao iz lista — fokus odlazi na sakrivenu stranicu ispod');
  });

  test('Shift+Tab sa prvog polja ide na poslednje', () => {
    const a = loadApp();
    a.call('openSheet', SADRZAJ);
    const polja = a.evalIn(`$('#sheet').querySelectorAll('button')`);
    a.evalIn(`$('#sheet').querySelectorAll('button')[0].focus()`);
    pritisni(a, 'Tab', true);
    assert.equal(a.evalIn('document.activeElement'), polja[polja.length - 1],
      'Shift+Tab je izašao iz lista unazad');
  });

  test('Tab dok fokus stoji na SAMOM listu ne beži unazad', () => {
    /* Stanje odmah po otvaranju: fokus je na listu, ne na dugmetu u njemu. */
    const a = loadApp();
    a.call('openSheet', SADRZAJ);
    const polja = a.evalIn(`$('#sheet').querySelectorAll('button')`);
    pritisni(a, 'Tab', true);
    assert.equal(a.evalIn('document.activeElement'), polja[polja.length - 1],
      'Shift+Tab sa samog lista je izašao u stranicu ispod');
  });
});
