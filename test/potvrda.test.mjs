/* POTVRDA KOJU PRIGUŠEN DIJALOG NE MOŽE DA POJEDE

   NALAZ: u kodu je već dvaput zapisano da instalirane PWA i deo pregledača
   prigušuju sistemski dijalog i da `confirm()` tada vraća `false` — i oba puta
   je popravka bila lokalna, za jedno dugme. Ostala su dvadeset dva poziva
   oblika `if(!confirm(...)) return;`, gde prigušen dijalog znači da akcija
   TIHO NE URADI NIŠTA: čovek dodirne „Obriši unos", ne desi se ništa, dodirne
   opet — opet ništa.

   `false` iz prigušenog dijaloga se ne razlikuje od `false` koji je čovek
   izabrao, osim po VREMENU: dijalog koji se prikazao mora da se pročita i da
   se u njega klikne. Zamke ispod mere baš to razlikovanje i, što je važnije,
   mere da pogrešna procena ide u BEZOPASNOM smeru — „pitaj još jednom", nikad
   „uradi neupitano".

   Lažni `confirm` u harnessu vraća odgovor trenutno, dakle ponaša se tačno kao
   prigušen dijalog. To je ovde prednost, ne smetnja: podrazumevano stanje
   testa JESTE stanje koje se popravlja. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readRepoFile } from './harness.mjs';

/* TRAKA SE MERI PO STVARNOM DODAVANJU U DOM.

   Harness pravi element za svaki `getElementById`, pa je on UVEK istinit — a
   `trakaUpozorenja` počinje sa `if(document.getElementById(id)) return null;`.
   Bez ovoga se traka nikad ne bi ni napravila, a tvrdnja „traka postoji" bi
   svejedno prolazila jer bi i ona dobila svež element. Dakle prazan hod u oba
   smera. Ista zamka je već opisana u `sw-azuriranje.test.mjs`. */
function saTrakom(opts = {}) {
  const a = loadApp(opts);
  a.evalIn(`
    __trake=[]; __zadnja=null;
    document.getElementById=(id)=> __trake.indexOf(id)>=0
      ? { id, remove(){ __trake=__trake.filter(x=>x!==id); } } : null;
    const __ap=document.body.appendChild;
    document.body.appendChild=(c)=>{
      if(c&&c.id){ __trake.push(c.id); __zadnja=c;
        const __r=c.remove; c.remove=()=>{ __trake=__trake.filter(x=>x!==c.id); if(__r)__r.call(c); }; }
      return __ap.call(document.body,c);
    };
  `);
  return a;
}
const imaTraku = a => a.evalIn(`__trake.indexOf('potvrda-dva')>=0`);

/* Sporo `confirm` — kakav je kad ga čovek zaista vidi i klikne u njega.
   Vreme se troši sinhrono, jer je i pravi `confirm` sinhron. */
function ljudskiConfirm(a, odgovor) {
  a.ctx.confirm = () => {
    const kraj = Date.now() + 120;
    while (Date.now() < kraj) { /* čeka, kao čovek koji čita */ }
    return odgovor;
  };
}

describe('Prigušen dijalog ne prolazi kao odgovor „ne"', () => {

  test('prvi dodir ne potvrđuje, ali ni ne ćuti', () => {
    /* Ovo je sam nalaz: pre popravke je ovde bilo samo `false` i tišina. */
    const a = saTrakom();
    assert.equal(a.call('potvrdi', 'Obrisati unos?'), false,
      'prigušen dijalog je prošao kao potvrda — razorno dejstvo bez pitanja');
    assert.equal(imaTraku(a), true,
      'čovek ne vidi nikakvo objašnjenje zašto se ništa nije desilo');
  });

  test('drugi dodir na ISTO pitanje važi kao potvrda', () => {
    const a = saTrakom();
    a.call('potvrdi', 'Obrisati unos?');
    assert.equal(a.call('potvrdi', 'Obrisati unos?'), true,
      'ni drugi dodir ne potvrđuje — dugme je i dalje mrtvo');
  });

  test('drugi dodir na DRUGO pitanje ne potvrđuje ništa', () => {
    /* Inače bi „Obriši unos" pa „Obriši nalog" značilo da je nalog potvrđen
       dodirom koji je pripadao nečem drugom. */
    const a = saTrakom();
    a.call('potvrdi', 'Obrisati unos?');
    assert.equal(a.call('potvrdi', 'Obrisati CEO NALOG?'), false,
      'potvrda se prenela sa jednog pitanja na drugo');
  });

  test('potvrda ističe — posle roka se pita ispočetka', () => {
    const a = saTrakom({ now: '2026-08-15T10:00:00Z' });
    a.call('potvrdi', 'Obrisati unos?');
    a.clock.set('2026-08-15T10:00:11Z');     /* rok je 10 s */
    assert.equal(a.call('potvrdi', 'Obrisati unos?'), false,
      'zaboravljena potvrda i dalje važi — dodir od pre pola sata bi obrisao podatke');
  });

  test('„Odustani" na traci poništava čekanje', () => {
    const a = saTrakom();
    a.call('potvrdi', 'Obrisati unos?');
    /* Dugme se traži KROZ SAMU TRAKU: svaki element ima sopstveni keš
       selektora, pa `document.querySelector('#pd-ne')` vraća drugi objekat od
       onog kom je kod dodelio `onclick`. */
    a.evalIn(`__zadnja.querySelector('#pd-ne').onclick()`);
    assert.equal(a.call('potvrdi', 'Obrisati unos?'), false,
      'odustajanje nije poništilo čekanje, pa sledeći dodir potvrđuje');
  });
});

describe('Dijalog koji se STVARNO prikazao ostaje merodavan', () => {

  test('„ne" od čoveka je „ne", bez trake i bez drugog dodira', () => {
    /* Ovo je druga polovina popravke i lako se promaši: da se svaki `false`
       tumačio kao prigušenje, svako odustajanje bi tražilo drugi dodir i
       „Otkaži" bi prestao da radi. */
    const a = saTrakom();
    ljudskiConfirm(a, false);
    assert.equal(a.call('potvrdi', 'Obrisati unos?'), false);
    assert.equal(imaTraku(a), false,
      'traka se digla iako je dijalog uredno prikazan — „Otkaži" više ne znači otkaži');
    assert.equal(a.call('potvrdi', 'Obrisati unos?'), false,
      'drugi „Otkaži" je protumačen kao potvrda');
  });

  test('„da" od čoveka prolazi odmah', () => {
    const a = saTrakom();
    ljudskiConfirm(a, true);
    assert.equal(a.call('potvrdi', 'Obrisati unos?'), true);
  });

  test('brzo „da" nije prigušenje — prigušen dijalog vraća samo `false`', () => {
    /* Zato se prag primenjuje SAMO na `false`. Da se primenjivao na oba,
       potvrda bi se gubila na brzim uređajima. */
    const a = saTrakom({ confirmReturns: true });
    assert.equal(a.call('potvrdi', 'Obrisati unos?'), true,
      'trenutno „da" je odbačeno kao prigušenje');
  });

  test('`confirm` koji baci ne ruši poziv nego traži drugi dodir', () => {
    const a = saTrakom();
    a.ctx.confirm = () => { throw new Error('nema dijaloga'); };
    assert.equal(a.call('potvrdi', 'Obrisati unos?'), false);
    assert.equal(a.call('potvrdi', 'Obrisati unos?'), true,
      'okruženje bez dijaloga uopšte nema kako da potvrdi');
  });
});

describe('Kapije su stvarno prešle na potvrdi()', () => {

  test('nijedna kapija ne zove `confirm` direktno', () => {
    /* Kapija = `if(!confirm(...)) return;`. Tu prigušen dijalog znači tiho
       ništa. Provera je nad izvorom jer meri POKRIVENOST (da nijedno mesto nije
       zaboravljeno), što se iz ponašanja jednog poziva ne vidi. */
    const kod = readRepoFile('app.js').replace(/\/\*[\s\S]*?\*\//g, '');   /* komentari pominju confirm namerno */
    const kapije = kod.match(/!\s*confirm\(/g) || [];
    assert.deepEqual(kapije, [],
      `${kapije.length} kapija i dalje zove confirm() — prigušen dijalog ih tiho preskače`);
  });

  test('jedini preostali `confirm` je ponuda, ne kapija', () => {
    /* „Prvo izvezi backup?" — čarobnjak se otvara u oba slučaja, pa prigušenje
       znači samo „bez backupa". Traka „dodirni još jednom" bi ovde bila laž. */
    const kod = readRepoFile('app.js').replace(/\/\*[\s\S]*?\*\//g, '');
    const svi = kod.match(/(?<![A-Za-z0-9_$.])confirm\([^\n]*/g) || [];
    /* jedan je poziv u samoj `potvrdi`, jedan je ponuda za backup */
    assert.equal(svi.length, 2, `neočekivan broj poziva confirm(): ${svi.length}`);
    assert.ok(svi.some(l => /backup/i.test(l)), 'ponuda za backup je nestala');
  });
});
