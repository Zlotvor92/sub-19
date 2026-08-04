/* Traka „Osveži" — praćenje novog service worker-a.

   Prijavljeno: verzija se promeni na 157, a traka ne dođe; bez nje se stari
   keš ne briše. Uzrok: kod je slušao SAMO `updatefound`, a taj događaj se
   javlja jedino za nov SW pronađen POSLE vezivanja slušaoca. Pregledač sam
   proverava sw.js pri otvaranju stranice — kad ga tada nađe i instalira pre
   nego što registracija odgovori, događaj je propušten i nov SW zauvek ostane
   u `reg.waiting`.

   Online se to ne primeti jer app.js ide network-first: broj verzije skoči,
   a traka izostane. Offline i dalje radi stara verzija. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

/* Traka se meri po STVARNOM dodavanju u DOM. Harness pamti elemente po
   selektoru, pa je $('#update-banner') uvek istinit i showUpdateBanner bi
   odmah izašao — provera bi prolazila a da ništa nije provereno. */
function sa(stanje = {}) {
  const a = loadApp();
  a.evalIn(`
    __dodato=0; __slusaoci={};
    const __q=document.querySelector;
    document.querySelector=(s)=>(s==='#update-banner'&&!__dodato)?null:__q(s);
    document.body.appendChild=(c)=>{ if(c&&c.id==='update-banner')__dodato++; return c; };
    navigator.serviceWorker={ controller:${stanje.bezKontrolera ? 'null' : '{}'}, addEventListener:()=>{} };
    __w={ state:${JSON.stringify(stanje.wState || 'installed')},
          addEventListener:(t,f)=>{__slusaoci[t]=f;}, postMessage:(m)=>{__poruka=m;} };
    __reg={ waiting:${stanje.waiting ? '__w' : 'null'}, installing:${stanje.installing ? '__w' : 'null'},
            addEventListener:(t,f)=>{__slusaoci['reg:'+t]=f;}, update:()=>{} };
  `);
  return a;
}
const traka = a => a.evalIn('__dodato');

describe('Nov service worker se primeti u sva tri stanja', () => {
  test('već čeka pri pokretanju (reg.waiting) — ovo je bio propust', () => {
    const a = sa({ waiting: true });
    a.call('pratiAzuriranje', a.evalIn('__reg'));
    assert.equal(traka(a), 1, 'nov SW čeka, a traka se ne pojavljuje');
  });

  test('instalira se u trenutku registracije (reg.installing)', () => {
    const a = sa({ installing: true, wState: 'installing' });
    a.call('pratiAzuriranje', a.evalIn('__reg'));
    assert.equal(traka(a), 0, 'traka je došla pre nego što je instalacija gotova');
    a.evalIn(`__w.state='installed'; __slusaoci.statechange();`);
    assert.equal(traka(a), 1, 'traka ne dolazi ni posle instalacije');
  });

  test('pronađen tek kasnije (updatefound)', () => {
    const a = sa({});
    a.call('pratiAzuriranje', a.evalIn('__reg'));
    assert.equal(traka(a), 0, 'lažna traka bez novog SW-a');
    a.evalIn(`__reg.installing=__w; __w.state='installed'; __slusaoci['reg:updatefound']();`);
    assert.equal(traka(a), 1, 'updatefound se više ne prati');
  });
});

describe('Kada traka NE sme da dođe', () => {
  test('prva instalacija ikad — nema stare verzije koju bi menjala', () => {
    const a = sa({ waiting: true, bezKontrolera: true });
    a.call('pratiAzuriranje', a.evalIn('__reg'));
    assert.equal(traka(a), 0, 'traka „Osveži" na prvom otvaranju aplikacije');
  });

  test('ponovljeni pozivi ne dupliraju ni traku ni slušaoce', () => {
    /* pratiAzuriranje se poziva i pri registraciji i na svaki sat kroz update() */
    const a = sa({ waiting: true });
    for (let i = 0; i < 5; i++) a.call('pratiAzuriranje', a.evalIn('__reg'));
    assert.equal(traka(a), 1, `traka je dodata ${traka(a)} puta`);
    assert.equal(a.evalIn('__reg.__pratimo'), 1, 'updatefound slušalac se veže više puta');
  });

  test('bez registracije se ne ruši', () => {
    const a = sa({});
    assert.doesNotThrow(() => a.call('pratiAzuriranje', null));
    assert.doesNotThrow(() => a.call('pratiAzuriranje', undefined));
  });
});

describe('Klik na „Osveži" pušta novi SW da preuzme', () => {
  test('šalje SKIP_WAITING baš tom workeru', () => {
    const a = sa({ waiting: true });
    a.call('pratiAzuriranje', a.evalIn('__reg'));
    /* dugme unutar trake — traka je pravi objekat iz createElement */
    a.evalIn(`$('#update-go').onclick && $('#update-go').onclick();`);
    /* Objekti nastali u vm realmu imaju drugi prototip, pa ih deepEqual odbija
       i kad je sadržaj isti — poredi se polje. */
    assert.equal(a.evalIn('__poruka && __poruka.type'), 'SKIP_WAITING',
      'klik ne šalje poruku novom SW-u — stari keš ostaje');
  });
});
