/* UVODNI EKRAN I ZNAK APLIKACIJE

   Uvod je jedina stvar u aplikaciji koja stoji PREKO svega ostalog dok traje.
   Zato ga ovde ne zanima kako izgleda nego dve stvari koje mogu da naprave
   štetu:
     1) da se skloni kad ne treba da se vidi (toplo pokretanje, smanjeno
        kretanje) — inače korisnik čeka animaciju pri svakom osvežavanju;
     2) da NIKAD ne ostane kao nevidljiv poklopac preko ekrana ako app.js
        zakaže — `opacity:0` element i dalje guta svaki dodir. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadApp, readRepoFile, ROOT } from './harness.mjs';

const html = readRepoFile('index.html');
const sw = readRepoFile('sw.js');
const manifest = JSON.parse(readRepoFile('manifest.json'));

describe('Uvodni ekran — markup i CSS', () => {

  test('#uvod je prvi element u <body>', () => {
    const telo = html.slice(html.indexOf('<body>'));
    const uvod = telo.indexOf('id="uvod"');
    const zaglavlje = telo.indexOf('<header>');
    assert.ok(uvod > -1, '#uvod ne postoji u markup-u');
    assert.ok(uvod < zaglavlje,
      '#uvod mora doći PRE zaglavlja — inače se aplikacija vidi ispod njega dok se crta');
  });

  test('animacija je u CSS-u, ne čeka app.js', () => {
    /* Da je vođena skriptom, korisnik bi prvo gledao praznu stranu dok se ne
       preuzme pola megabajta app.js-a, pa tek onda znak. */
    assert.ok(/@keyframes uvod-luk/.test(html), 'nema keyframe-a za iscrtavanje luka');
    assert.ok(/#uvod\s*\{[^}]*animation:\s*uvod-kraj/.test(html),
      '#uvod nema animaciju gašenja u CSS-u');
  });

  test('kad app.js zakaže, uvod se sam skloni i ne guta dodire', () => {
    const kraj = /@keyframes uvod-kraj\s*\{([\s\S]*?)\n\}/.exec(html);
    assert.ok(kraj, 'nema @keyframes uvod-kraj');
    assert.ok(/100%\s*\{[^}]*visibility\s*:\s*hidden/.test(kraj[1]),
      'poslednji kadar mora imati visibility:hidden — providan element i dalje hvata klikove');
  });

  test('visibility se ne prebacuje na polovini gašenja', () => {
    /* `visibility` je diskretno svojstvo: da stoji samo u `to` bloku, pregledač
       bi ga preklopio na 50% trajanja i ekran bi nestao naglo, pri pola
       providnosti. Zato mora postojati i kadar tik pre kraja koji je `visible`. */
    const kraj = /@keyframes uvod-kraj\s*\{([\s\S]*?)\n\}/.exec(html)[1];
    assert.ok(/99%\s*\{[^}]*visibility\s*:\s*visible/.test(kraj),
      'nedostaje kadar pred kraj sa visibility:visible');
  });

  test('preskakanje dodirom koristi DRUGO ime animacije', () => {
    /* Promena samo trajanja na animaciji koja već teče ne pokreće je iz
       početka — proteklo vreme ostaje, pa bi ekran posle 0,22 s skočio pravo
       u završno stanje umesto da se ugasi. */
    const gasi = /#uvod\.gasi\s*\{([^}]*)\}/.exec(html);
    assert.ok(gasi, 'nema pravila za #uvod.gasi');
    assert.ok(!/uvod-kraj/.test(gasi[1]),
      '#uvod.gasi koristi isto ime keyframe-a kao redovno gašenje — animacija se neće pokrenuti iz početka');
    assert.ok(/@keyframes uvod-preskok/.test(html), 'nema zasebnog keyframe-a za preskakanje');
  });

  test('smanjeno kretanje sakriva uvod već u CSS-u', () => {
    const blok = /@media\(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/.exec(html);
    assert.ok(blok, 'nema bloka za smanjeno kretanje');
    assert.ok(/#uvod\s*\{\s*display:\s*none/.test(blok[1]),
      'uvod se ne sakriva pri smanjenom kretanju — trepnuo bi dok skripta ne stigne da ga skloni');
  });

  test('smanjeno kretanje gasi i slaganje kartica, ne samo skraćuje', () => {
    /* Blok skraćuje `animation-duration`, ali NE i `animation-delay`; uz
       `both` to znači da `from{opacity:0}` traje kroz celo kašnjenje. Izmereno
       u pregledaču: kartica na Planu je povremeno providna i 80 ms posle
       promene taba — tačno ono što smanjeno kretanje treba da spreči. */
    const blok = /@media\(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/.exec(html);
    assert.match(blok[1], /\.page\.uskoci>\*\s*\{\s*animation:\s*none\s*!important/,
      'slaganje kartica se pri smanjenom kretanju samo ubrzava umesto da se ugasi');
  });

  test('uvod je iznad svega ostalog, uključujući prijavni ekran', () => {
    /* `#sb-gate` je takođe `position:fixed` i dugo je stajao na ISTOM z-index-u
       (400). Pri jednakom sloju pobeđuje ono što je kasnije u DOM-u, a gate
       app.js dodaje na kraj <body> — pa je uvod bio nevidljiv tačno kod
       neprijavljenog korisnika, dakle na prvom pokretanju aplikacije. */
    const mojZ = Number(/#uvod\s*\{[\s\S]*?z-index:\s*(\d+)/.exec(html)[1]);
    const svi = [...html.matchAll(/z-index:\s*(\d+)/g)].map(m => Number(m[1]));
    const ostali = svi.filter(z => z !== mojZ);
    const najvisi = ostali.length ? Math.max(...ostali) : 0;
    assert.ok(mojZ > najvisi,
      `#uvod je na z-index ${mojZ}, a nešto drugo na ${najvisi} — biće prekriven`);
  });

  test('podloga uvoda je ista boja kao background_color u manifestu', () => {
    /* Sistemski splash instalirane aplikacije crta manifestovu boju, pa ovaj
       ekran preuzima. Ako se boje razlikuju, između njih se vidi trzaj. */
    const pravilo = /#uvod\s*\{([\s\S]*?)\n\}/.exec(html)[1];
    const boje = pravilo.match(/#[0-9A-Fa-f]{6}/g) || [];
    assert.ok(boje.map(x => x.toUpperCase()).includes(manifest.background_color.toUpperCase()),
      `podloga #uvod ne sadrži ${manifest.background_color}`);
  });
});

describe('Uvodni ekran — kad se prikazuje', () => {

  test('hladan start: ostaje na ekranu i zaključa skrolovanje', () => {
    const a = loadApp();
    const uvod = a.ctx.document.getElementById('uvod');
    assert.equal(uvod._removed, false, 'uvod je sklonjen iako je hladan start');
    assert.ok(a.ctx.document.body.classList.contains('uvod-radi'),
      'telo nije dobilo klasu koja zaključava skrolovanje');
  });

  test('hladan start upisuje trag, da se drugi put ne ponovi', () => {
    const a = loadApp();
    assert.equal(a.ss.getItem('sub20-uvod'), '1');
  });

  test('toplo pokretanje: sklanja se odmah', () => {
    /* Osvežavanje strane, povratak iz pozadine, reload posle „Osveži". */
    const a = loadApp({ seedSessionStorage: { 'sub20-uvod': '1' } });
    const uvod = a.ctx.document.getElementById('uvod');
    assert.equal(uvod._removed, true, 'uvod se prikazuje i pri toplom startu');
    assert.ok(!a.ctx.document.body.classList.contains('uvod-radi'),
      'skrolovanje ostaje zaključano iako uvoda nema');
  });

  test('smanjeno kretanje: sklanja se odmah, i na hladnom startu', () => {
    const a = loadApp({ reducedMotion: true });
    assert.equal(a.ctx.document.getElementById('uvod')._removed, true,
      'uvod se prikazuje uprkos sistemskom „smanji kretanje"');
  });

  test('trag se upisuje i kad se uvod ne prikaže', () => {
    /* Inače bi prvo pokretanje sa smanjenim kretanjem ostavilo prazan trag, pa
       bi se pri sledećem osvežavanju — ako se podešavanje u međuvremenu
       promeni — uvod pojavio kao da je aplikacija tek pokrenuta. */
    const a = loadApp({ reducedMotion: true });
    assert.equal(a.ss.getItem('sub20-uvod'), '1');
  });
});

describe('Ikonice', () => {

  const izManifesta = manifest.icons.map(i => i.src.replace(/^\.\//, ''));
  const izHtmla = [...html.matchAll(/<link[^>]+href="\.\/(icon-[\w-]+\.png|apple-touch-icon\.png)"/g)].map(m => m[1]);
  const sve = [...new Set([...izManifesta, ...izHtmla])];

  test('svaka ikonica iz manifesta i index.html postoji na disku', () => {
    assert.ok(sve.length >= 4, 'spisak ikonica je sumnjivo kratak');
    for (const f of sve) {
      assert.ok(existsSync(join(ROOT, f)), `nedostaje fajl ${f}`);
      assert.ok(statSync(join(ROOT, f)).size > 500, `${f} je prazan ili krnj`);
    }
  });

  test('svaka ikonica je na ASSETS spisku u sw.js', () => {
    /* ASSETS ide network-first. Ikonica koja nije na spisku servira se iz
       starog keša — tačno ona greška zbog koje je ceo spisak i prebačen na
       network-first: „promenio sam ikonicu, na telefonu je i dalje stara". */
    for (const f of sve) {
      assert.ok(sw.includes(`'./${f}'`), `sw.js ASSETS ne sadrži ./${f}`);
    }
  });

  test('maskable ikonica je zaseban fajl, ne ista kao obična', () => {
    /* Android maskira ikonicu u krug/kvadrat/kapljicu i seče sve van 80%
       platna. Ista slika u obe uloge znači ili odsečen znak, ili obična
       ikonica sa suvišnom prazninom okolo. */
    const any = manifest.icons.filter(i => i.purpose === 'any').map(i => i.src);
    const mask = manifest.icons.filter(i => i.purpose === 'maskable').map(i => i.src);
    assert.ok(mask.length > 0, 'nema maskable ikonice');
    for (const m of mask) assert.ok(!any.includes(m), `${m} je i "any" i "maskable"`);
  });
});

describe('Znak u zaglavlju', () => {

  test('zaglavlje nosi znak aplikacije', () => {
    assert.ok(/class="h-mark"/.test(html), 'nema znaka u zaglavlju');
  });

  test('gradijenti uvoda i zaglavlja imaju različite id-jeve', () => {
    /* Dva <defs> sa istim id-jem u jednom dokumentu: drugi se ignoriše, pa
       jedan od dva znaka ostane bez boje. */
    const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, `duplirani id gradijenta: ${ids.join(', ')}`);
  });
});
