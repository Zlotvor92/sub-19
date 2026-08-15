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
import { createContext, runInContext } from 'node:vm';
import { loadApp, readRepoFile } from './harness.mjs';

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

describe('Broj verzije — jedini okidač koji pregledač uopšte vidi', () => {
  /* PRIJAVLJENO PONOVO: „nije mi izašao osveži tab". Kod je bio ispravan i
     izmena je bila na sajtu — ali `sw.js` nije diran u tom commitu. Pregledač
     novi service worker prepoznaje ISKLJUČIVO po tome što su se BAJTOVI sw.js
     promenili; ako je fajl isti, nema instalacije, nema `waiting`, nema trake.
     A pošto app.js ide network-first, nov kod se svejedno servira — pa se
     ispod ruke dobije najgori spoj: nova aplikacija, star keš, i nikakav znak
     korisniku. Testovi ispod čuvaju MEHANIZAM; ovaj čuva da se mehanizam
     uopšte pokrene. */
  const izvor = f => readRepoFile(f);

  test('APP_VERSION u app.js i sw.js su isti', () => {
    const uApp = /APP_VERSION\s*=\s*'(\d+)'/.exec(izvor('app.js'));
    const uSw = /APP_VERSION\s*=\s*'(\d+)'/.exec(izvor('sw.js'));
    assert.ok(uApp && uSw, 'APP_VERSION se ne nalazi u oba fajla');
    assert.equal(uApp[1], uSw[1],
      `app.js je na ${uApp[1]}, sw.js na ${uSw[1]} — podnožje bi pisalo jedan broj, keš nosio drugi`);
  });

  test('ime keša prati APP_VERSION', () => {
    /* Da se ne desi da se APP_VERSION podigne a CACHE ostane — tada se stari
       keš NE briše u `activate`, jer se briše sve što nije jednako CACHE. */
    const sw = izvor('sw.js');
    const v = /APP_VERSION\s*=\s*'(\d+)'/.exec(sw)[1];
    const cache = /CACHE\s*=\s*'([^']+)'/.exec(sw);
    assert.ok(cache, 'CACHE se ne nalazi u sw.js');
    assert.ok(cache[1].endsWith('v' + v),
      `keš je „${cache[1]}", a verzija ${v} — stari keš se onda ne briše`);
  });

  test('app.js je na spisku za keširanje', () => {
    /* Od v150 je sav kod u app.js; da ispadne sa spiska, offline bi se
       servirao samo omotač. Ovo je već jednom bila greška (v. komentar u sw.js). */
    assert.match(izvor('sw.js'), /ASSETS\s*=\s*\[[^\]]*'\.\/app\.js'/);
  });
});

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

/* STANJE OFFLINE KOPIJE MORA BITI VIDLJIVO I RUČNO OSVEŽIVO.

   Prijava: „app je na 175, a traka Osveži nije izašla." Broj u podnožju dolazi
   iz app.js, koji ide network-first — skoči čim deploy prođe, i kad keš stoji
   na staroj verziji. Dva različita stanja izgledala su isto, pa se nije moglo
   znati da li je traka izostala ili nije ni bila potrebna. */
describe('Verzija offline kopije se može pročitati i naterati', () => {

  test('service worker odgovara na pitanje koju verziju nosi', () => {
    /* Bez ovoga se verzija SW-a ne može saznati iz stranice NIKAKO — jedini
       broj koji stranica vidi je onaj iz app.js, a on ne govori o kešu. */
    const sw = readRepoFile('sw.js');
    assert.match(sw, /type === 'VERSION'/, 'sw.js ne odgovara na upit o verziji');
    assert.match(sw, /postMessage\(\{ type: 'VERSION', version: APP_VERSION, cache: CACHE \}\)/,
      'odgovor ne nosi i verziju i ime keša');
  });

  test('upit ne može da zablokira Podešavanja', () => {
    /* Stariji SW ne zna za poruku VERSION i nikad neće odgovoriti. */
    const app = readRepoFile('app.js');
    const m = /async function swStanje\(\)\{([\s\S]*?)\n\}/.exec(app);
    assert.ok(m, 'nema swStanje()');
    assert.match(m[1], /setTimeout\(\(\)=>\{ if\(!gotovo\)/, 'nema vremenskog ograničenja na odgovor');
  });

  test('ručno osvežavanje ne zavisi od toga da li se traka pojavila', () => {
    const app = readRepoFile('app.js');
    const m = /async function osveziAplikaciju\(dugme\)\{([\s\S]*?)\n\}/.exec(app);
    assert.ok(m, 'nema osveziAplikaciju()');
    const telo = m[1];
    assert.match(telo, /reg\.waiting/, 'ne pušta SW koji već čeka');
    assert.match(telo, /reg\.update\(\)/, 'ne tera proveru kad ništa ne čeka');
    assert.match(telo, /reg\.installing/, 'ne hvata instalaciju koja je u toku');
    /* Dugme koje tiho ne uradi ništa je gore od dugmeta kojeg nema. */
    assert.match(telo, /Već si na najnovijoj verziji/, 'ćuti kad nema šta da osveži');
  });

  test('Podešavanja imaju i red o stanju i dugme', () => {
    const app = readRepoFile('app.js');
    assert.match(app, /id="sw-osvezi"/);
    assert.match(app, /id="sw-stanje"/);
    assert.match(app, /\$\('#sw-osvezi'\)\.onclick=e=>osveziAplikaciju\(e\.target\)/);
  });
});

describe('Instalacija service workera preživi jedan fajl koji fali', () => {
  /* `addAll` je ATOMIČAN: ako ijedan odgovor nije uspešan, ceo poziv odbija,
     instalacija pada, nov SW nikad ne stigne do `installed` — pa nema ni
     offline keša ni trake „Osveži". I sve to tiho.

     Uhvaćeno uživo: u ASSETS je dodat nov fajl, jedan server ga još nije imao,
     i traka je prestala da izlazi. Uzrok je bio pet redova dalje od simptoma. */
  const sw = readRepoFile('sw.js');
  /* Komentari se sklanjaju: objasnjenje IZNAD popravke pominje `addAll(ASSETS)`
     kao ono sto je bilo — a sirova provera bi bas taj komentar nasla kao dokaz
     da popravke nema. */
  const kod = sw.replace(/\/\*[\s\S]*?\*\//g, '');

  test('instalacija ne koristi addAll', () => {
    assert.doesNotMatch(kod, /c\.addAll\(ASSETS\)/,
      'jedan fajl koji fali ponovo obara celu instalaciju');
  });

  test('svaki fajl se kešira za sebe, a neuspeh se vidi u logu', () => {
    assert.match(kod, /Promise\.allSettled\(ASSETS\.map\(a => c\.add\(a\)\)\)/,
      'fajlovi se ne keširaju pojedinačno');
    assert.match(sw, /console\.warn\('\[sw\] nije keširano pri instalaciji:'/,
      'neuspeh je nem — isti problem bi se opet tražio na pogrešnom mestu');
  });

  test('obe grane odgovora i dalje postoje', () => {
    /* Samo brojanje grana. Šta svaka od njih VRAĆA proverava se izvršavanjem,
       niže — v. „Mreža koja visi ne sme da zaključa otvaranje". Ranija verzija
       je ovde tražila `.catch(` u prvih 400 znakova svake grane; kad je grana
       izdvojena u `mrezaIliKes`, `.catch` je i dalje postojao ali izvan tog
       prozora — zamka je pala na PREMEŠTANJE koda, a ne bi pala da je `catch`
       zaista uklonjen iz izdvojene funkcije. */
    const grane = kod.split('e.respondWith(').slice(1);
    assert.equal(grane.length, 2, 'broj grana se promenio — proveri obe ručno');
  });

  test('zahtevi ka tuđem domenu se NE presreću', () => {
    /* Slika sa Google naloga je prolazila kroz opštu granu: `fetch` iz service
       workera, pa prazan 504 kad ne uspe. Rezultat te grane se ionako nikad ne
       kešira (`putSafe` je ograničen na sopstveni domen), pa SW za tuđe adrese
       nije donosio ništa — samo put kojim zahtev može da propadne.
       Prijavljeno sa iPhonea: aplikacija ima adresu slike, krug prazan. */
    assert.match(kod, /if \(u\.origin !== location\.origin\) return;/,
      'SW opet presreće tuđe adrese');
    /* Provera mora da stoji PRE prve `respondWith` grane — inače ne štiti. */
    const pre = kod.indexOf('u.origin !== location.origin');
    const prva = kod.indexOf('e.respondWith(');
    assert.ok(pre > 0 && pre < prva, 'provera stoji posle prve grane, dakle prekasno');
  });

  test('svaki fajl iz ASSETS zaista postoji u repozitorijumu', () => {
    /* Prava odbrana je da spisak ne laže. Ovo hvata i običnu grešku u kucanju. */
    const m = /const ASSETS = \[([^\]]+)\]/.exec(kod);
    assert.ok(m, 'nema ASSETS spiska');
    const putanje = m[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
    for (const put of putanje) {
      if (put === './') continue;                       /* koren = index.html */
      /* readRepoFile baca za fajl koji ne postoji, pa se hvata — inace bi
         poruka o kvaru bila ENOENT umesto objasnjenja sta je zapravo lose. */
      let ima = true;
      try { readRepoFile(put.replace(/^\.\//, '')); } catch { ima = false; }
      assert.ok(ima, `ASSETS pominje ${put}, a tog fajla nema — instalacija bi ga preskočila`);
    }
  });
});

/* ============================================================
   MREŽA KOJA VISI

   NALAZ: `network-first` grana je glasila
   `fetch(req).then(…).catch(() => caches.match(k))` — dakle keš se koristio
   SAMO kad `fetch` ODBIJE. A mreža koja je mrtva a spojena (metro, lift, wifi
   sa captive portalom, slab signal) ne odbija; visi. Dok visi, visi i obećanje
   dato `respondWith`-u, a to su navigacija i `app.js`: aplikacija se u tom
   stanju NE OTVORI, iako ispravna offline kopija stoji u kešu.

   Sve tvrdnje ispod se IZVRŠAVAJU. Zamka koja bi ovo merila nad izvorom
   („ima li `.catch`", „ima li `setTimeout`") prolazila bi i kad rok postoji a
   ne radi — a upravo to je klasa greške zbog koje je i pisana.
   ============================================================ */
describe('Mreža koja visi ne sme da zaključa otvaranje', () => {
  /* sw.js nije modul i nema izvoz, pa se — po istom načelu kao `harness.mjs`
     za app.js — pušta nad lažnim globalima, a funkcije se čitaju iz konteksta.
     Kod se ne prekraja zbog testa. */
  function ucitajSw({ fetch: mreza, kesirano } = {}) {
    const upisano = [];
    const ctx = {
      console: { warn() {}, log() {}, error() {} },
      setTimeout, clearTimeout, Promise, Object, Array, String, Number, Boolean,
      JSON, Math, Date, RegExp, Error, Map, Set, URL,
      location: { origin: 'https://sub-20.test' },
      Response: class {
        constructor(telo, o) {
          this.telo = telo; this.status = (o && o.status) || 200;
          this.ok = this.status < 300; this.statusText = (o && o.statusText) || '';
        }
        clone() { return this; }
      },
      caches: {
        match: async () => kesirano,
        open: async () => ({ put: async (k, v) => { upisano.push([k, v]); }, add: async () => {} }),
        keys: async () => [], delete: async () => true
      },
      fetch: mreza || (async () => { throw new Error('offline (test)'); }),
      indexedDB: { open: () => ({}) }
    };
    ctx.self = { addEventListener: () => {}, registration: {}, clients: {}, skipWaiting() {} };
    ctx.globalThis = ctx;
    const vmCtx = createContext(ctx);
    runInContext(readRepoFile('sw.js'), vmCtx, { filename: 'sw.js' });
    /* Rok se skraćuje da zamka ne čeka pravih 3,5 s (v. `MREZA_ROK` u sw.js). */
    runInContext('MREZA_ROK.ms = 40', vmCtx);
    return {
      upisano,
      zovi: (kljuc = './index.html') => {
        ctx.__k = kljuc;
        return runInContext('mrezaIliKes({url:"https://sub-20.test/"}, __k)', vmCtx);
      }
    };
  }

  const KES = { ok: true, status: 200, izKesa: true, clone() { return this; } };
  const MREZA = { ok: true, status: 200, izMreze: true, clone() { return this; } };

  test('mreža koja VISI pada na keš umesto da čeka bez kraja', async () => {
    /* Ovo je sam nalaz. Pre popravke ovaj `await` se nikad ne bi razrešio i
       test bi istekao — što je tačno ono što korisnik vidi kao „aplikacija se
       ne otvara", samo bez poruke. */
    const sw = ucitajSw({ fetch: () => new Promise(() => {}), kesirano: KES });
    const r = await sw.zovi();
    assert.equal(r.izKesa, true, 'keš nije uskočio — otvaranje visi koliko i mreža');
  });

  test('mreža koja odbija i dalje pada na keš', async () => {
    const sw = ucitajSw({ fetch: async () => { throw new Error('offline'); }, kesirano: KES });
    const r = await sw.zovi();
    assert.equal(r.izKesa, true, 'offline više ne dobija keširanu kopiju');
  });

  test('mreža koja odbije BEZ keša vraća odgovor, ne `undefined`', async () => {
    /* Tiha rupa stare grane: `caches.match` promašaj vraća `undefined`, a
       `respondWith(undefined)` daje pregledačevu stranicu mrežne greške umesto
       praznog odgovora. Donja grana je to već rešavala svojim 504; ova nije. */
    const sw = ucitajSw({ fetch: async () => { throw new Error('offline'); }, kesirano: undefined });
    const r = await sw.zovi();
    assert.ok(r, 'grana vraća undefined — pregledač prikazuje svoju stranicu greške');
    assert.equal(r.status, 504);
  });

  test('mreža koja stigne pre roka pobeđuje keš', async () => {
    /* Rok ne sme da pretvori network-first u cache-first: dok mreža radi,
       korisnik mora da dobije NOVO, inače izmena na sajtu ne bi stizala. */
    const sw = ucitajSw({ fetch: async () => MREZA, kesirano: KES });
    const r = await sw.zovi();
    assert.equal(r.izMreze, true, 'keš je pretekao mrežu koja radi');
  });

  test('odgovor koji zakasni ipak osveži keš', async () => {
    /* Korisnik je već dobio keširano, ali sledeće otvaranje mora biti novo —
       inače bi jedna spora mreža zamrzla verziju do sledećeg pravog otkaza. */
    const sw = ucitajSw({
      fetch: () => new Promise(res => setTimeout(() => res(MREZA), 80)),
      kesirano: KES
    });
    const r = await sw.zovi();
    assert.equal(r.izKesa, true, 'keš nije uskočio na vreme');
    await new Promise(res => setTimeout(res, 160));
    assert.equal(sw.upisano.length, 1, 'zakasneli odgovor nije upisan u keš');
    assert.equal(sw.upisano[0][0], './index.html');
  });
});
