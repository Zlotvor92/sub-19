/* PREVLAČENJE IZMEĐU TABOVA.

   Tab se menja i prstom (levo/desno), ne samo dodirom na ikonicu. Dve stvari
   ovaj fajl drži zatvorenim:

   1. ŠTA RAZDVAJA KORISTAN POKRET OD SLUČAJNOG — ugao, dužina, brzina i ekrani
      ispod kojih se tab ne sme menjati. Skrolovanje palcem ide u luku i dešava
      se stotinu puta po ekranu; jedan pogrešno prihvaćen pokret je izgubljeno
      mesto u aplikaciji.
   2. DA SE DVA EKRANA POMERAJU ZAJEDNO. Prva verzija je pomerala samo aktivni
      ekran za 34 px i tek po puštanju ubacivala novi — radilo je tačno, i bilo
      pogrešno: čitalo se kao slajdšou. Zamke ispod mere da ekran koji odlazi
      ide 1:1 sa prstom, da susedni stoji uz njega na tačno jednu širinu ekrana,
      i da se tab menja kad prelazak LEGNE, a ne u trenutku puštanja. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

const T0 = '2026-08-13T10:00:00.000Z';
const T0MS = new Date(T0).getTime();
const SIRINA = 390;          /* širina ekrana u testu — prag je deo nje, ne fiksan broj */
const PRAG = SIRINA * 0.28;

/* Lažni dodir. Harness pamti slušaoce na dokumentu (`okini`), pa se ceo pokret
   može odglumiti: početak, međukoraci i puštanje. Sat se pomera između koraka
   jer BRZINA odlučuje o kratkim pokretima, a meri se na poslednjem potezu. */
function stolica(opts = {}) {
  const a = loadApp({ now: T0, ...opts });
  let sada = T0MS + 2000;
  /* Uvodni ekran pokriva sve i traje 1,55 s; ispod njega se tab ne menja. Sat
     se zato pomeri preko njega — merimo aplikaciju u radu, ne pokretanje. */
  a.clock.set(new Date(sada).toISOString());
  /* Bez naloga stoji kapija za prijavu preko celog ekrana i ispod nje se tab ne
     menja (to proverava svoj test niže). Ovde se sklanja da bi ostali testovi
     merili pokret, a ne kapiju. */
  a.evalIn(`document.getElementById('sb-gate').style.display='none'`);
  a.ctx.innerWidth = SIRINA;

  const meta = () => ({ tagName: 'DIV', scrollWidth: 0, clientWidth: 0, parentElement: null });
  const X0 = 200, Y0 = 400;
  const sat = (ms) => { sada += ms; a.clock.set(new Date(sada).toISOString()); };

  const pocni = (target) => a.okini('touchstart', { touches: [{ clientX: X0, clientY: Y0 }], target: target || meta() });
  const pomeri = (dx, dy) => a.okini('touchmove', {
    cancelable: true, preventDefault() {},
    touches: [{ clientX: X0 + dx, clientY: Y0 + (dy || 0) }]
  });
  const pusti = () => a.okini('touchend', {});
  /* Dovršetak posle puštanja je na tajmeru (najviše 420 ms + rezerva), pa se
     tab menja tek kad prelazak legne. */
  const sleti = () => sat(600);

  return {
    a, sat, pocni, pomeri, pusti, sleti,
    /* Ceo pokret: četiri koraka, jer se osa odlučuje na prvih 10 px, a brzina
       na poslednjem potezu. `ms` je trajanje celog pokreta. */
    prevuci({ dx, dy = 0, ms = 400, target, drzi = false } = {}) {
      pocni(target);
      for (let i = 1; i <= 4; i++) { sat(ms / 4); pomeri(dx * i / 4, dy * i / 4); }
      pusti();
      if (!drzi) sleti();
    },
    tab: () => a.evalIn('ACTIVE'),
    stanje: (pg) => a.evalIn(`(()=>{const e=$('#pg-${pg}');return {
        klase:[...e.classList._s].join(' '), pomeraj:e.style.transform||'' };})()`),
    pomerajPx: (pg) => {
      const m = /translate3d\(([-\d.]+)px/.exec(a.evalIn(`$('#pg-${pg}').style.transform||''`));
      return m ? parseFloat(m[1]) : null;
    }
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

describe('Dva ekrana putuju zajedno', () => {
  test('ekran koji odlazi ide 1:1 sa prstom', () => {
    /* Ovo je cela razlika između „vučem sadržaj" i „pritisnuo sam dugme".
       Prigušeno praćenje je bila prva verzija i baš ono što nije valjalo. */
    const s = stolica();
    s.pocni();
    s.sat(16); s.pomeri(-40);
    assert.equal(s.pomerajPx('danas'), -40, 'ekran ne prati prst tačno');
    s.sat(16); s.pomeri(-150);
    assert.equal(s.pomerajPx('danas'), -150);
  });

  test('susedni ekran je u kadru, na tačno jednu širinu ekrana odatle', () => {
    const s = stolica();
    s.pocni();
    s.sat(16); s.pomeri(-40);
    const st = s.stanje('plan');
    assert.match(st.klase, /dolazi/, 'susedni ekran nije pripremljen');
    assert.ok(st.pomeraj, 'susedni ekran se ne pomera');
    assert.equal(s.pomerajPx('plan'), -40 + SIRINA,
      'razmak između dva ekrana nije tačno jedna širina — u kadru bi se videla rupa ili preklapanje');
    assert.ok(s.a.evalIn(`$('#pg-plan').innerHTML.length`) > 0,
      'susedni ekran je u kadru prazan — sadržaj se iscrtava tek pri puštanju');
  });

  test('promena smera preko početne tačke menja i susedni ekran', () => {
    const s = stolica();
    s.a.call('setPage', 'opor');
    s.pocni();
    s.sat(16); s.pomeri(-40);
    assert.match(s.stanje('pred').klase, /dolazi/, 'ulevo ne priprema sledeći tab');
    s.sat(16); s.pomeri(40);
    assert.match(s.stanje('plan').klase, /dolazi/, 'udesno ne priprema prethodni tab');
    assert.ok(!/dolazi/.test(s.stanje('pred').klase), 'stari susedni ekran je ostao u kadru');
  });

  test('na kraju niza ekran samo popusti i vrati se', () => {
    const s = stolica();
    s.pocni();
    s.sat(16); s.pomeri(160);                 /* Danas je prvi — nema šta da dođe sleva */
    const px = s.pomerajPx('danas');
    assert.ok(px > 0 && px < 160 * .5, `otpora nema: ${px} px na 160 px pokreta`);
    s.pusti(); s.sleti();
    assert.equal(s.tab(), 'danas');
    assert.equal(s.stanje('danas').pomeraj, '', 'pomeraj je ostao na ekranu');
  });
});

describe('Pokret menja tab', () => {
  test('ulevo vodi na sledeći tab', () => {
    const s = stolica();
    assert.equal(s.tab(), 'danas');
    s.prevuci({ dx: -160 });
    assert.equal(s.tab(), 'plan');
  });

  test('udesno vodi na prethodni', () => {
    const s = stolica();
    s.a.call('setPage', 'opor');
    s.prevuci({ dx: 160 });
    assert.equal(s.tab(), 'plan');
  });

  test('tab se menja kad prelazak LEGNE, ne u trenutku puštanja', () => {
    /* Da se menjao pri puštanju, sadržaj bi se prebacio ispod ekrana koji još
       leti — i prelazak bi opet bio ukras preko gotove promene. */
    const s = stolica();
    s.prevuci({ dx: -160, drzi: true });
    assert.equal(s.tab(), 'danas', 'tab se promenio pre nego što je ekran sleteo');
    assert.match(s.stanje('plan').klase, /klizi/, 'dovršetak ne ide preko prelaza');
    s.sleti();
    assert.equal(s.tab(), 'plan');
  });

  test('posle sletanja ne ostaje nijedan trag prelaska', () => {
    const s = stolica();
    s.prevuci({ dx: -160 });
    for (const pg of ['danas', 'plan']) {
      const st = s.stanje(pg);
      assert.ok(!/dolazi|klizi/.test(st.klase), `${pg} je ostao u stanju prelaska: ${st.klase}`);
      assert.equal(st.pomeraj, '', `${pg} je ostao pomeren`);
    }
  });

  test('brz kratak pokret (flik) prolazi i pre praga', () => {
    const s = stolica();
    s.prevuci({ dx: -60, ms: 60 });           /* 1 px/ms, a prag je ~109 px */
    assert.ok(60 < PRAG, 'test više ne meri flik — pokret je prešao prag');
    assert.equal(s.tab(), 'plan');
  });

  test('stranica koja je doklizala ne igra i ulaznu animaciju', () => {
    /* Kartice su se slagale pred očima celim putem; da se slože još jednom po
       sletanju, prelazak bi se završavao trzajem. */
    const s = stolica();
    s.prevuci({ dx: -160 });
    assert.ok(!/uskoci/.test(s.stanje('plan').klase),
      'doklizala stranica dobija i slaganje kartica');
  });

  test('dodir na ikonicu i dalje slaže kartice, kao pre', () => {
    const s = stolica();
    s.a.call('setPage', 'plan');
    assert.match(s.stanje('plan').klase, /uskoci/, 'klik je izgubio ulaznu animaciju');
  });
});

describe('Pokret koji NE sme da promeni tab', () => {
  test('kratak i spor pokret vrati ekran na svoje', () => {
    const s = stolica();
    s.prevuci({ dx: -60, ms: 900 });
    assert.equal(s.tab(), 'danas', `ekran se promenio na 60 px (prag je ${Math.round(PRAG)})`);
    assert.equal(s.stanje('danas').pomeraj, '', 'pomeraj je ostao na ekranu');
    assert.ok(!/dolazi/.test(s.stanje('plan').klase), 'susedni ekran je ostao u kadru');
  });

  test('skrolovanje u luku (uspravno duže od vodoravnog) ne menja tab', () => {
    /* Ovo je gest koji se u aplikaciji radi stotinu puta po ekranu. Da prolazi,
       lista treninga bi povremeno odvela na drugi tab. */
    const s = stolica();
    s.prevuci({ dx: -160, dy: -220 });
    assert.equal(s.tab(), 'danas');
    assert.equal(s.stanje('danas').pomeraj, '', 'ekran se pomerio pri skrolovanju');
  });

  test('vodoravno mora biti IZRAZITO duže, ne tek malo', () => {
    const s = stolica();
    s.prevuci({ dx: -160, dy: -140 });        /* 1,14× — ispod praga od 1,3× */
    assert.equal(s.tab(), 'danas');
  });

  test('sa poslednjeg taba se ne ide dalje', () => {
    const s = stolica();
    s.a.call('setPage', 'zajed');
    s.prevuci({ dx: -160 });
    assert.equal(s.tab(), 'zajed');
  });

  test('dva prsta su zumiranje, ne prevlačenje', () => {
    const s = stolica();
    s.a.okini('touchstart', {
      touches: [{ clientX: 100, clientY: 400 }, { clientX: 300, clientY: 400 }],
      target: { tagName: 'DIV', scrollWidth: 0, clientWidth: 0 }
    });
    s.sat(16); s.pomeri(-160);
    s.pusti(); s.sleti();
    assert.equal(s.tab(), 'danas');
  });

  test('drugi prst usred pokreta vraća ekran, ne menja tab', () => {
    const s = stolica();
    s.pocni();
    s.sat(16); s.pomeri(-160);
    s.a.okini('touchmove', { cancelable: true, preventDefault() {},
      touches: [{ clientX: 40, clientY: 400 }, { clientX: 300, clientY: 400 }] });
    s.sleti();
    assert.equal(s.tab(), 'danas');
    assert.equal(s.stanje('danas').pomeraj, '');
  });
});

describe('Dodir koji pripada nečem drugom', () => {
  test('polje za unos (klizač za bol) zadržava svoj pokret', () => {
    const s = stolica();
    s.prevuci({ dx: -160, target: { tagName: 'INPUT', scrollWidth: 0, clientWidth: 0 } });
    assert.equal(s.tab(), 'danas', 'prevlačenje klizača je promenilo tab');
  });

  test('vodoravna lista (filteri u Zajednici) zadržava svoj pokret', () => {
    /* Provera je opšta — pomerljivost + `overflow-x` — pa se ovde i lažni
       element predstavlja tako: širi od okvira i sa `overflow-x:auto`. */
    const s = stolica();
    s.a.ctx.getComputedStyle = () => ({ overflowX: 'auto' });
    s.prevuci({ dx: -160, target: { tagName: 'DIV', scrollWidth: 600, clientWidth: 300, parentElement: null } });
    assert.equal(s.tab(), 'danas');
  });

  test('skraćen tekst NIJE vodoravna lista', () => {
    /* `text-overflow:ellipsis` daje element širi od svog okvira, a nikuda se ne
       pomera — bez provere `overflow-x` bi svaki red sa dugim imenom treninga
       progutao prevlačenje. */
    const s = stolica();
    s.a.ctx.getComputedStyle = () => ({ overflowX: 'hidden' });
    s.prevuci({ dx: -160, target: { tagName: 'DIV', scrollWidth: 600, clientWidth: 300, parentElement: null } });
    assert.equal(s.tab(), 'plan');
  });
});

describe('Ekrani ispod kojih se tab ne menja', () => {
  test('otvoren list', () => {
    const s = stolica();
    s.a.call('openSheet', '<div>test</div>');
    s.prevuci({ dx: -160 });
    assert.equal(s.tab(), 'danas', 'tab se promenio ispod otvorenog lista');
  });

  test('čarobnjak (sakriven `main`)', () => {
    const s = stolica();
    s.a.evalIn(`document.querySelector('main').style.display='none'`);
    s.prevuci({ dx: -160 });
    assert.equal(s.tab(), 'danas');
  });

  test('kapija za prijavu', () => {
    const s = stolica();
    s.a.evalIn(`document.getElementById('sb-gate').style.display='flex'`);
    s.prevuci({ dx: -160 });
    assert.equal(s.tab(), 'danas');
  });
});

describe('Isključeno kretanje', () => {
  test('tab se i dalje menja prstom — gasi se kretanje, ne radnja', () => {
    const s = stolica({ reducedMotion: true });
    s.prevuci({ dx: -160 });
    assert.equal(s.tab(), 'plan');
  });

  test('nijedan ekran se ne pomera niti ulazi u kadar', () => {
    const s = stolica({ reducedMotion: true });
    s.pocni();
    s.sat(16); s.pomeri(-160);
    assert.equal(s.stanje('danas').pomeraj, '', 'ekran klizi iako je kretanje isključeno');
    assert.ok(!/dolazi/.test(s.stanje('plan').klase), 'susedni ekran ulazi u kadar');
  });

  test('promena taba tada ide sa uobičajenim ulaskom sadržaja', () => {
    /* Ekran nije doklizao pred očima, pa nema šta da se preskoči — dobija isto
       što bi dobio i od dodira na ikonicu. Kretanje gasi CSS, ne ova grana. */
    const s = stolica({ reducedMotion: true });
    s.prevuci({ dx: -160 });
    assert.match(s.stanje('plan').klase, /uskoci/);
  });
});

describe('CSS koji kod očekuje', () => {
  const css = readRepoFile('index.html').replace(/\/\*[\s\S]*?\*\//g, '');
  const app = readRepoFile('app.js');

  test('svaka klasa koju kod postavlja ima svoje pravilo', () => {
    for (const k of ['dolazi', 'klizi'])
      assert.match(css, new RegExp('\\.page\\.' + k + '[,{]'), `nema pravila za .page.${k}`);
  });

  test('ekran koji dolazi ne pomera ništa u toku i ne prima dodire', () => {
    const p = /\.page\.dolazi\{([^}]*)\}/.exec(css);
    assert.ok(p, 'pravilo .page.dolazi nije nađeno');
    assert.match(p[1], /position:absolute/, 'ekran u kadru bi produžio stranicu i pomerio skrol');
    assert.match(p[1], /pointer-events:none/, 'ekran koji putuje prima dodire');
  });

  test('bočni razmak dolazećeg ekrana je ISTI kao razmak sadržaja', () => {
    /* Ako se raziđu, sadržaj poskoči u stranu tačno u trenutku kad prelazak
       legne — a to je jedini trenutak kad se gleda pravo u njega. */
    assert.match(css, /main\{padding:var\(--pad\) var\(--pad\)/, 'main više ne koristi --pad');
    const p = /\.page\.dolazi\{([^}]*)\}/.exec(css)[1];
    assert.match(p, /left:var\(--pad\);right:var\(--pad\)/, 'dolazeći ekran ne deli razmak sa main');
  });

  test('trajanje dovršetka dolazi iz koda, a kriva iz CSS-a', () => {
    /* Trajanje se računa iz preostalog puta i brzine prsta, pa ne može biti
       zapisano u CSS-u; kriva je stvar izgleda i ne sme biti u kodu. */
    assert.match(css, /\.page\.klizi\{transition:transform var\(--pv-ms,[^)]*\) cubic-bezier/);
    assert.match(app, /setProperty\('--pv-ms'/, 'kod ne postavlja trajanje dovršetka');
  });

  test('rok koji čisti prelazak preživi najduži dovršetak', () => {
    /* Ista zamka kao kod `uskoci`: da rok istekne ranije, stranica bi ostala
       pomerena ili bi se tab promenio usred klizanja. */
    const max = +(/PV_MS_MAX=(\d+)/.exec(app) || [])[1];
    const rez = +(/setTimeout\(pvOdmah, ms\+(\d+)\)/.exec(app) || [])[1];
    assert.ok(max > 0 && rez > 0, 'granica trajanja ili rezerva nisu nađene');
    assert.ok(rez > 0 && max <= 420, `najduži dovršetak je ${max} ms`);
  });
});
