/* PREVLAČENJE IZMEĐU TABOVA.

   Tab se menja i prstom (levo/desno), ne samo dodirom na ikonicu. To je gest
   koji se okine slučajno — ruka koja skroluje ide u luku — pa ovaj fajl drži
   zatvoreno ono što razdvaja koristan pokret od slučajnog: ugao, dužinu,
   brzinu i ekrane ispod kojih se tab ne sme menjati.

   ŠTA SE NE MERI OVDE: kako izgleda. Klizanje je CSS, i za njega postoji samo
   provera da postoji i da se gasi kad je kretanje isključeno. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const T0 = '2026-08-13T10:00:00.000Z';
const T0MS = new Date(T0).getTime();

/* Lažni dodir. Harness pamti slušaoce na dokumentu (`okini`), pa se ceo pokret
   može odglumiti: početak, nekoliko međukoraka i puštanje. Vreme se pomera
   ručno jer BRZINA odlučuje o kratkim pokretima. */
function stolica(opts = {}) {
  const a = loadApp({ now: T0, ...opts });
  /* Uvodni ekran pokriva sve i traje 1,55 s; ispod njega se tab ne menja. Sat
     se zato pomeri preko njega — merimo aplikaciju u radu, ne pokretanje. */
  let sada = T0MS + 2000;
  a.clock.set(new Date(sada).toISOString());
  /* Bez naloga stoji kapija za prijavu preko celog ekrana i ispod nje se tab
     ne menja (to proverava svoj test niže). Ovde se sklanja da bi ostali
     testovi merili pokret, a ne kapiju. */
  a.evalIn(`document.getElementById('sb-gate').style.display='none'`);
  const meta = () => ({ tagName: 'DIV', scrollWidth: 0, clientWidth: 0, parentElement: null });
  const X0 = 200, Y0 = 400;

  const pocni = (target) => a.okini('touchstart', { touches: [{ clientX: X0, clientY: Y0 }], target: target || meta() });
  const pomeri = (dx, dy) => a.okini('touchmove', {
    cancelable: true, preventDefault() {},
    touches: [{ clientX: X0 + dx, clientY: Y0 + (dy || 0) }]
  });
  const pusti = (ms) => {
    sada += (ms == null ? 200 : ms);
    a.clock.set(new Date(sada).toISOString());
    a.okini('touchend', {});
  };

  return {
    a,
    pocni, pomeri, pusti,
    /* Ceo pokret odjednom, u četiri koraka — jedan skok od nule do kraja ne bi
       prošao kroz odlučivanje o osi, koje se dešava na prvih 10 px. */
    prevuci({ dx, dy = 0, ms = 200, target } = {}) {
      pocni(target);
      for (let i = 1; i <= 4; i++) pomeri(dx * i / 4, dy * i / 4);
      pusti(ms);
    },
    tab: () => a.evalIn('ACTIVE')
  };
}

describe('Redosled tabova', () => {
  test('kod i traka na dnu nabrajaju iste tabove istim redom', () => {
    /* Prevlačenje čita redosled iz `PAGES`, a prst gleda ikonice u index.html.
       Da se raziđu, šesti tab bi se pri prevlačenju tiho preskakao — ništa ne
       bi puklo, samo bi jedan ekran bio nedostupan prstom. */
    const html = readRepoFile('index.html');
    const nav = /<nav id="tabbar">([\s\S]*?)<\/nav>/.exec(html);
    assert.ok(nav, 'traka tabova nije nađena u index.html');
    const naTraci = [...nav[1].matchAll(/data-pg="([^"]+)"/g)].map(m => m[1]);
    const uKodu = stolica().a.evalIn('TAB_RED');
    assert.deepEqual(uKodu, naTraci, 'redosled u PAGES se razišao sa trakom tabova');
  });
});

describe('Pokret menja tab', () => {
  test('ulevo vodi na sledeći tab', () => {
    const s = stolica();
    assert.equal(s.tab(), 'danas');
    s.prevuci({ dx: -90 });
    assert.equal(s.tab(), 'plan');
  });

  test('udesno vodi na prethodni', () => {
    const s = stolica();
    s.a.call('setPage', 'opor');
    s.prevuci({ dx: 90 });
    assert.equal(s.tab(), 'plan');
  });

  test('brz kratak pokret (flik) prolazi', () => {
    /* Namera je u brzini, ne u dužini: palac koji „baci" ekran završi pokret
       pre nego što pređe pola palca. */
    const s = stolica();
    s.prevuci({ dx: -30, ms: 30 });
    assert.equal(s.tab(), 'plan');
  });
});

describe('Pokret koji NE sme da promeni tab', () => {
  test('kratak i spor pokret ostaje na svom ekranu', () => {
    const s = stolica();
    s.prevuci({ dx: -30, ms: 900 });
    assert.equal(s.tab(), 'danas', 'ekran se promenio na 30 px u 0,9 s');
  });

  test('skrolovanje u luku (uspravno duže od vodoravnog) ne menja tab', () => {
    /* Ovo je gest koji se u aplikaciji radi stotinu puta po ekranu. Da prolazi,
       lista treninga bi povremeno odvela na drugi tab. */
    const s = stolica();
    s.prevuci({ dx: -90, dy: -120 });
    assert.equal(s.tab(), 'danas');
  });

  test('vodoravno mora biti IZRAZITO duže, ne tek malo', () => {
    const s = stolica();
    s.prevuci({ dx: -90, dy: -80 });   /* 1,125× — ispod praga od 1,3× */
    assert.equal(s.tab(), 'danas');
  });

  test('na kraju niza nema gde dalje', () => {
    const prvi = stolica();
    prvi.prevuci({ dx: 90 });
    assert.equal(prvi.tab(), 'danas', 'sa prvog taba se otišlo unazad');

    const zadnji = stolica();
    zadnji.a.call('setPage', 'zajed');
    zadnji.prevuci({ dx: -90 });
    assert.equal(zadnji.tab(), 'zajed', 'sa poslednjeg taba se otišlo unapred');
  });

  test('dva prsta su zumiranje, ne prevlačenje', () => {
    const s = stolica();
    s.a.okini('touchstart', {
      touches: [{ clientX: 100, clientY: 400 }, { clientX: 300, clientY: 400 }],
      target: { tagName: 'DIV', scrollWidth: 0, clientWidth: 0 }
    });
    s.pomeri(-90);
    s.pusti(200);
    assert.equal(s.tab(), 'danas');
  });
});

describe('Dodir koji pripada nečem drugom', () => {
  test('polje za unos (klizač za bol) zadržava svoj pokret', () => {
    const s = stolica();
    s.prevuci({ dx: -90, target: { tagName: 'INPUT', scrollWidth: 0, clientWidth: 0 } });
    assert.equal(s.tab(), 'danas', 'prevlačenje klizača je promenilo tab');
  });

  test('vodoravna lista (filteri u Zajednici) zadržava svoj pokret', () => {
    /* Provera je opšta — pomerljivost + `overflow-x` — pa se ovde i lažni
       element predstavlja tako: širi od okvira i sa `overflow-x:auto`. */
    const s = stolica();
    s.a.ctx.getComputedStyle = () => ({ overflowX: 'auto' });
    s.prevuci({ dx: -90, target: { tagName: 'DIV', scrollWidth: 600, clientWidth: 300, parentElement: null } });
    assert.equal(s.tab(), 'danas');
  });

  test('skraćen tekst NIJE vodoravna lista', () => {
    /* `text-overflow:ellipsis` daje element širi od svog okvira, a nikuda se ne
       pomera — bez provere `overflow-x` bi svaki red sa dugim imenom treninga
       progutao prevlačenje. */
    const s = stolica();
    s.a.ctx.getComputedStyle = () => ({ overflowX: 'hidden' });
    s.prevuci({ dx: -90, target: { tagName: 'DIV', scrollWidth: 600, clientWidth: 300, parentElement: null } });
    assert.equal(s.tab(), 'plan');
  });
});

describe('Ekrani ispod kojih se tab ne menja', () => {
  test('otvoren list', () => {
    const s = stolica();
    s.a.call('openSheet', '<div>test</div>');
    s.prevuci({ dx: -90 });
    assert.equal(s.tab(), 'danas', 'tab se promenio ispod otvorenog lista');
  });

  test('čarobnjak (sakriven `main`)', () => {
    const s = stolica();
    s.a.evalIn(`document.querySelector('main').style.display='none'`);
    s.prevuci({ dx: -90 });
    assert.equal(s.tab(), 'danas');
  });

  test('kapija za prijavu', () => {
    const s = stolica();
    s.a.evalIn(`document.getElementById('sb-gate').style.display='flex'`);
    s.prevuci({ dx: -90 });
    assert.equal(s.tab(), 'danas');
  });
});

describe('Smer se vidi na ekranu', () => {
  const klase = (s, pg) => s.a.evalIn(
    `['sleva','sdesna'].filter(k=>$('#pg-${pg}').classList.contains(k))`);

  test('ekran koji stiže ulazi sa strane sa koje je pokret došao', () => {
    const napred = stolica();
    napred.prevuci({ dx: -90 });
    assert.deepEqual(klase(napred, 'plan'), ['sdesna'], 'sledeći tab ne ulazi zdesna');

    const nazad = stolica();
    nazad.a.call('setPage', 'opor');
    nazad.prevuci({ dx: 90 });
    assert.deepEqual(klase(nazad, 'plan'), ['sleva'], 'prethodni tab ne ulazi sleva');
  });

  test('dodir na ikonicu radi tačno kao pre — bez klizanja u stranu', () => {
    const s = stolica();
    s.a.call('setPage', 'plan');
    assert.deepEqual(klase(s, 'plan'), [], 'klik je dobio animaciju prevlačenja');
  });

  test('ekran ide za prstom dok prst stoji, i vrati se kad pokret nije dovoljan', () => {
    const s = stolica();
    const pomeraj = () => s.a.evalIn(`$('#pg-danas').style.transform||''`);
    const PRST = 40;   /* dovoljno da se osa zaključa, premalo da promeni tab */
    s.pocni();
    s.pomeri(-PRST);
    assert.match(pomeraj(), /translateX\(-\d/, 'ekran ne prati prst');
    /* Prigušeno, ne 1:1 — inače bi se susedni ekran napola otvarao na svaki
       slučajan pokret. */
    const px = Math.abs(parseFloat(/translateX\(([-\d.]+)px\)/.exec(pomeraj())[1]));
    assert.ok(px < PRST / 2, `ekran prati prst previše verno (${px} px na ${PRST} px pokreta)`);
    s.pusti(900);
    assert.equal(s.tab(), 'danas');
    assert.equal(pomeraj(), '', 'pomeraj je ostao na ekranu posle puštanja');
  });
});

describe('Isključeno kretanje', () => {
  test('tab se i dalje menja prstom — gasi se kretanje, ne radnja', () => {
    const s = stolica({ reducedMotion: true });
    s.prevuci({ dx: -90 });
    assert.equal(s.tab(), 'plan');
  });

  test('ekran ne klizi za prstom', () => {
    const s = stolica({ reducedMotion: true });
    s.pocni();
    s.pomeri(-60);
    assert.equal(s.a.evalIn(`$('#pg-danas').style.transform||''`), '',
      'ekran klizi iako je kretanje isključeno');
  });

  test('CSS gasi i ulazak novog ekrana', () => {
    const css = readRepoFile('index.html').replace(/\/\*[\s\S]*?\*\//g, '');
    const blok = /@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?\n\}/.exec(css)[0];
    assert.match(blok, /\.page\.sleva,\.page\.sdesna\{animation:none!important\}/,
      'ulazak novog ekrana radi i kad je kretanje isključeno');
  });
});

describe('CSS koji kod očekuje', () => {
  const css = readRepoFile('index.html').replace(/\/\*[\s\S]*?\*\//g, '');

  test('svaka klasa koju kod postavlja ima svoje pravilo', () => {
    for (const k of ['vuce', 'vraca', 'sleva', 'sdesna'])
      assert.match(css, new RegExp('\\.page\\.' + k + '\\{'), `nema pravila za .page.${k}`);
  });

  test('povratak nedovoljnog pokreta traje kraće od roka koji skida klasu', () => {
    /* Ista zamka kao kod `uskoci`: da rok istekne usred prelaza, ekran bi
       ostatak puta preskočio. */
    const ms = +(/\.page\.vraca\{transition:transform ([\d.]+)s/.exec(css) || [])[1] * 1000;
    const rok = +(/PV_TMR=setTimeout\(\(\)=>el\.classList\.remove\('vraca'\),(\d+)\)/
      .exec(readRepoFile('app.js')) || [])[1];
    assert.ok(ms > 0 && rok > 0, 'prelaz ili rok nisu nađeni');
    assert.ok(rok > ms, `rok je ${rok} ms, a prelaz traje ${ms} ms`);
  });
});
