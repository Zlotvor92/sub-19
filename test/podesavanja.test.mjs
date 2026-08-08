/* Podešavanja — kartice koje se sklapaju.

   Ranije: šest sekcija u ravnom nizu razdvojenih linijom, sve iste težine, pa
   je do backupa trebalo šest ekrana skrolovanja. intervals.icu je uz to nosio
   i povlačenje oporavka I slanje na sat, pa je bio dvostruko duži od ostalih. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, readAppSource, readRepoFile } from './harness.mjs';

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
  /* Backup se u stanju vodi kao datum poslednjeg izvoza. Svež datum znači
     „rešeno" — stariji od praga i dalje traži radnju, pa se uzima današnji. */
  if (opt.backup) a.evalIn(`S.ui.lastBackup=todayStr();`);
  if (opt.geo) a.evalIn(`S.ui.geo={lat:44.81,lon:20.46};`);
  a.call('openSettings');
  return { a, html: a.evalIn('$("#sheet").innerHTML') || '' };
}
/* `data-k` nosi naziv sekcije — po njemu se posle ponovnog iscrtavanja vraća
   koje su bile otvorene, pa stoji između klase i `open`. */
const kartice = h => [...h.matchAll(/<details class="set-card"[^>]*?data-k="([^"]*)"( open)?>[\s\S]*?<span>([^<]*)<\/span>/g)]
  .map(m => ({ otvorena: !!m[2], naslov: m[1], stanje: m[3] }));

describe('Struktura', () => {
  test('svaka sekcija je zasebna kartica', () => {
    const { html } = sa({ prijavljen: true, strava: true, icu: true });
    const k = kartice(html).map(x => x.naslov);
    assert.deepEqual(k, ['Nalog', 'Plan', 'Strava', 'intervals.icu', 'Slanje na sat', 'Vreme', 'Obaveštenja', 'Podaci', 'Zajednica']);
  });

  test('Zajednica postoji samo prijavljenom, i stoji SKLOPLJENA', () => {
    /* Sve ostale sekcije se otvaraju same kad nešto „čeka". Ovde ništa ne
       čeka: isključeno je ispravno stanje, ne nedostatak. Otvorena kartica bi
       bila blag pritisak da se uključi — a ovo je jedina odluka u aplikaciji
       koja podatke iznosi iz naloga. */
    const { html } = sa({ prijavljen: true });
    const z = kartice(html).find(x => x.naslov === 'Zajednica');
    assert.ok(z, 'nema kartice Zajednica');
    assert.equal(z.otvorena, false, 'kartica Zajednica se otvara sama');
    assert.equal(z.stanje, 'isključena');

    const bez = sa({ prijavljen: false });
    assert.ok(!kartice(bez.html).some(x => x.naslov === 'Zajednica'),
      'Zajednica se nudi i neprijavljenom, koji nema gde da je upiše');
  });

  test('čitanje i slanje su odvojene kartice', () => {
    /* Sekcija se zove „intervals.icu" jer je to i izvor i za jutarnja merenja i
       za trčanja — „Oporavak" je od spajanja tabova ime CELOG ekrana, pa bi
       sekcija sa istim imenom obećavala nešto drugo. Slanje na sat ostaje
       odvojeno: to je pisanje, ne čitanje. */
    const { html } = sa({ prijavljen: true, icu: true });
    const k = kartice(html).map(x => x.naslov);
    assert.ok(k.includes('intervals.icu') && k.includes('Slanje na sat'),
      'povlačenje i slanje su i dalje u istoj sekciji');
  });

  test('povlačenje je JEDNO dugme, ne dva', () => {
    /* Jutarnja merenja i trčanja dolaze sa iste veze — dva dugmeta su bila
       podela po tome kako je kod pisan, ne po tome šta čovek radi. */
    const { html } = sa({ prijavljen: true, icu: true });
    assert.match(html, /id="icu-sync"/, 'nema dugmeta za povlačenje');
    assert.doesNotMatch(html, /id="icu-tren"/, 'vratilo se odvojeno dugme za treninge');
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
    /* „Vreme" je otvoreno dok lokacija nije uključena — isto pravilo kao za
       ostale sekcije koje traže jedan dodir da bi počele da rade. */
    assert.deepEqual(otv, ['Nalog', 'Strava', 'intervals.icu', 'Vreme'],
      'nepovezane sekcije nisu otvorene');
  });

  test('kad je sve povezano, ništa nije otvoreno — sve staje na jedan ekran', () => {
    const { html } = sa({ prijavljen: true, strava: true, icu: true, push: true, geo: true });
    assert.deepEqual(kartice(html).filter(x => x.otvorena), []);
  });

  test('svaka kartica pokazuje stanje BEZ otvaranja', () => {
    const { html } = sa({ prijavljen: true, strava: true, icu: true });
    for (const k of kartice(html))
      assert.ok(k.stanje && k.stanje.trim().length > 2,
        `„${k.naslov}" nema liniju stanja u zaglavlju`);
  });

});

/* KONTROLNA TABLA NA VRHU (raspored D).
   Zamenila je stari red od tri ćelije („Nalog ✓ · Strava ✓ · intervals —").
   Taj red je samo PRIJAVLJIVAO stanje; ovaj imenuje prvu stvar koja čeka i
   daje dugme koje je obavlja. Zato se ovde meri to, a ne izgled. */
describe('Vrh podešavanja — šta čeka', () => {

  /* Vrh se završava tamo gde počinje traka sa grupama. Kraj se traži po tome
     što DOLAZI POSLE, a ne po brojanju </div> — ugnežđenih divova ima. */
  const hero = html => {
    const m = /<div class="set-hero">([\s\S]*?)<\/div>\s*<div class="zseg set-seg"/.exec(html);
    assert.ok(m, 'vrh podešavanja se više ne završava pred trakom sa grupama');
    return m[1];
  };
  const naslov = html => (/<b>([^<]*)<\/b>/.exec(hero(html)) || [, ''])[1];
  const dugme  = html => (/<button class="btn" id="(hero-[a-z]+)">([^<]*)</.exec(hero(html)) || [, null, null]).slice(1);

  test('kad ništa nije povezano, imenuje PRVU stvar po prioritetu', () => {
    /* Redosled nije proizvoljan: bez naloga nema servera, pa nalog ide prvi. */
    const { html } = sa({});
    const [id, tekst] = dugme(html);
    assert.equal(id, 'hero-nalog', 'vrh nudi nešto drugo umesto prijave');
    assert.equal(tekst, 'Prijavi se');
  });

  test('kad je nalog rešen, prelazi na sledeću', () => {
    const { html } = sa({ prijavljen: true });
    assert.equal(dugme(html)[0], 'hero-strava');
  });

  test('slanje na sat se nudi tek kad intervals.icu postoji', () => {
    /* Bez veze sa intervals.icu slanje na sat NIJE stvar koja čeka — nema čime
       da se pošalje. Da se broji, vrh bi tražio radnju koja se ne može obaviti. */
    const bez = sa({ prijavljen: true, strava: true });
    assert.notEqual(dugme(bez.html)[0], 'hero-sat');
    const sa_ = sa({ prijavljen: true, strava: true, icu: true });
    assert.equal(dugme(sa_.html)[0], 'hero-sat');
  });

  test('kad je sve rešeno, nema dugmeta nego potvrda', () => {
    const { html } = sa({ prijavljen: true, strava: true, icu: true, push: true, backup: true });
    assert.equal(naslov(html), 'Sve je povezano');
    assert.equal(dugme(html)[0], null, 'vrh i dalje nudi radnju iako ništa ne čeka');
  });

  test('broj stvari koje čekaju je u pravom obliku', () => {
    /* „Jedna stvar čeka" / „Dve stvari čekaju" — ne „2 stvari čeka". */
    const jedna = sa({ prijavljen: true, strava: true, icu: true, backup: true });
    assert.match(naslov(jedna.html), /^Jedna stvar čeka$/);
    const dve = sa({ prijavljen: true, backup: true });   /* čekaju Strava i intervals.icu */
    assert.match(naslov(dve.html), /^Dve stvari čekaju$/);
  });

  test('ima po jednu trakicu za svaku sekciju', () => {
    const { html } = sa({ prijavljen: true, strava: true, icu: true });
    const trake = [...hero(html).matchAll(/<i class="(a?)">/g)].map(m => m[1]);
    assert.equal(trake.length, 5, 'broj trakica ne odgovara broju sekcija');
    assert.ok(trake.includes('a'), 'nijedna trakica nije označena kao ono što čeka');
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
      /* Traži se POKVAREN ISPIS, ne reč. „Invalid" je ranije bilo dovoljno da
         uhvati „Invalid Date", ali sada legitimno stoji u tekstu pomoći
         („Ako piše Invalid redirect_uri") — pa se traži ceo izraz. */
      const lose = /NaN|undefined|Invalid Date/.exec(html);
      assert.ok(!lose, `${JSON.stringify(opt)}: ${(/.{0,50}(NaN|undefined|Invalid Date).{0,20}/.exec(html) || [])[0]}`);
    }
  });

  test('podnožje i dalje nosi verziju i linkove', () => {
    const { html, a } = sa({ prijavljen: true });
    assert.ok(html.includes('Verzija ' + a.get('APP_VERSION')));
    assert.match(html, /uputstvo\.html/);
    assert.match(html, /privacy\.html/);
  });
});

/* OSVEŽAVANJE POSLE RADNJE.

   Prijava iz upotrebe: „pošaljem treninge na sat, ne registruje da su poslati".
   Slanje je radilo — `lastPush` se upisivao i čuvao — ali ekran se nije iznova
   iscrtavao, pa je red i dalje pisao „još nije slato", a kontrolna tabla je i
   dalje tvrdila da jedna stvar čeka. Sa rasporedom D je to postalo očigledno:
   radnja se okine sa vrha, povratna informacija stigne na dugme u sklopljenoj
   sekciji koju čovek i ne gleda, a vrh se ne pomeri. */
describe('Ekran prati stanje posle radnje', () => {

  test('kad je poslato na sat, vrh više ne traži tu radnju', () => {
    /* Mora se meriti SAMO vrh. „Pošalji na sat" stoji i kao dugme unutar
       sekcije — provera nad celim HTML-om bi ga tamo našla i uvek padala. */
    const vrh = h => {
      const m = /<div class="set-hero">([\s\S]*?)<div class="zseg set-seg"/.exec(h);
      assert.ok(m, 'vrh podešavanja se više ne završava pred trakom sa grupama');
      return m[1];
    };

    const bez = sa({ prijavljen: true, strava: true, icu: true, backup: true });
    assert.match(vrh(bez.html), /Pošalji na sat/, 'pre slanja vrh ne nudi tu radnju');

    const posle = sa({ prijavljen: true, strava: true, icu: true, push: true, backup: true });
    assert.doesNotMatch(vrh(posle.html), /Pošalji na sat/, 'posle slanja vrh i dalje traži slanje');
    assert.match(vrh(posle.html), /Sve je povezano/);
  });

  test('red sekcije pokazuje datum poslednjeg slanja, ne „još nije slato"', () => {
    const { html } = sa({ prijavljen: true, icu: true, push: true });
    const red = kartice(html).find(k => k.naslov === 'Slanje na sat');
    assert.ok(red, 'nema sekcije za slanje na sat');
    assert.doesNotMatch(red.stanje, /još nije slato/);
    assert.match(red.stanje, /poslednje/);
  });

  test('svaka kartica nosi svoj ključ, i ključevi su jedinstveni', () => {
    /* Po njemu se vraća otvorenost. Da se vraćala po REDOSLEDU, promena broja
       kartica (npr. „Slanje na sat" nestane kad se otkači intervals.icu) bi je
       preselila na pogrešnu sekciju. */
    const { html } = sa({ prijavljen: true, vlasnik: true, strava: true, icu: true });
    const kljucevi = [...html.matchAll(/data-k="([^"]*)"/g)].map(m => m[1]);
    assert.ok(kljucevi.length >= 6, `premalo ključeva: ${kljucevi.length}`);
    assert.equal(new Set(kljucevi).size, kljucevi.length, `duplirani ključ: ${kljucevi.join(', ')}`);
    assert.ok(!kljucevi.some(k => !k), 'postoji kartica bez ključa');
  });

  test('osveziPodesavanja ne dira tuđi list', () => {
    /* Poziva se iz rukovalaca koji mogu da se okinu i kad je u međuvremenu
       otvoren neki drugi list — tada ne sme da ga zameni podešavanjima. */
    const a = loadApp();
    a.call('openSheet', '<div class="sh-t">Nešto drugo</div>');
    a.evalIn(`$('#sheet').classList.add('on')`);
    a.call('osveziPodesavanja');
    assert.match(a.evalIn(`$('#sheet').innerHTML`), /Nešto drugo/,
      'osveziPodesavanja je pregazio drugi list');
  });
});

describe('Lokacija — poruka mora da kaže ŠTA da uradiš', () => {
  /* PRIJAVA: „Lokacija nije dostupna, a upalio sam je kad sam pravio
     aplikaciju." Jedna rečenica je pokrivala tri različita uzroka — ugašenu
     lokaciju, odbijenu dozvolu i istekli pokušaj — pa se iz nje nije moglo
     saznati ništa. U instaliranoj Android aplikaciji je uz to i uputstvo bilo
     pogrešno: dozvola tamo ne pripada pregledaču nego samoj aplikaciji. */

  const poruka = (a, kod, uApp) => {
    a.evalIn(`__uApp=${uApp ? 'true' : 'false'};
              uAplikaciji=()=>__uApp;`);
    return a.evalIn(`geoPoruka(${kod === null ? 'null' : `{code:${kod}}`})`);
  };

  test('tri uzroka daju tri različite poruke', () => {
    const a = loadApp();
    const m = [1, 2, 3].map(k => poruka(a, k, false));
    assert.equal(new Set(m).size, 3, 'dva uzroka i dalje dele istu poruku');
    for (const t of m) assert.ok(t.length > 40, `poruka je pretanka: ${t}`);
  });

  test('u aplikaciji upućuje na podešavanja TELEFONA, ne pregledača', () => {
    /* Uključena „location delegation" pri pakovanju znači samo da aplikacija
       SME da traži lokaciju; Android je i dalje mora odobriti posebno. */
    const a = loadApp();
    for (const kod of [1, 2]) {
      const t = poruka(a, kod, true);
      assert.match(t, /Podešavanja telefona/, `kod ${kod} ne pominje podešavanja telefona`);
      assert.match(t, /SUB-20/, `kod ${kod} ne kaže koju aplikaciju da otvori`);
      assert.doesNotMatch(t, /pregledač/i, `kod ${kod} u aplikaciji i dalje šalje u pregledač`);
    }
  });

  test('na vebu upućuje na pregledač, ne na podešavanja telefona', () => {
    const a = loadApp();
    const t = poruka(a, 1, false);
    assert.match(t, /pregledač/i);
    assert.doesNotMatch(t, /Podešavanja telefona/);
  });

  test('istek se ne prijavljuje kao „nedostupna" — to je druga stvar', () => {
    const a = loadApp();
    const t = poruka(a, 3, true);
    assert.match(t, /isteklo/i);
    assert.doesNotMatch(t, /Dozvole/, 'istek šalje da menja dozvole, a nisu one problem');
  });

  test('nepoznata greška ne ostaje bez poruke', () => {
    const a = loadApp();
    assert.ok(poruka(a, null, false).length > 40);
  });

  test('istek pokreće DRUGI, duži pokušaj pre nego što odustane', () => {
    /* U zatvorenom prostoru je 12 s bez GPS-a često premalo za prvi fiks. */
    const src = readAppSource();
    const blok = /if\(\$\('#vr-on'\)\)[\s\S]*?\n  \};/.exec(src)[0];
    assert.match(blok, /err&&err\.code===3/, 'istek se ne razlikuje od ostalih grešaka');
    assert.match(blok, /enableHighAccuracy:true, timeout:30000/, 'nema drugog, dužeg pokušaja');
    /* Već odbijena dozvola ne sme da se čeka 12 s da bi se to saznalo. */
    assert.match(blok, /await geoOdbijena\(\)/, 'ne proverava se unapred poznato odbijanje');
  });
});

/* GRUPE I IKONICE (segmenti umesto jednog dugačkog spiska).

   Ranije: jedanaest kartica jedna ispod druge. Sve su bile sklopljene, pa je
   ekran bio uredan — ali da bi se našla jedna, čitao se ceo spisak, jer ništa
   nije govorilo gde šta pripada. Sada su u pet grupa, sa po jednom linijskom
   ikonicom u redu.

   Ono što se ovde meri nije izgled nego dve stvari koje tiho odlaze: da svaka
   sekcija ima i grupu i ikonicu (nova sekcija sutra ne sme da ispadne u
   „ostalo"), i da skrivanje grupe ne krije dugmad iz DOM-a. */
describe('Podešavanja — grupe i ikonice', () => {

  const sekcije = h => [...h.matchAll(/data-k="([^"]*)"/g)].map(m => m[1]);
  const grupe   = h => [...h.matchAll(/data-g="([^"]*)"/g)].map(m => m[1]);
  const segmenti = h => [...h.matchAll(/data-sg="([^"]*)"/g)].map(m => m[1]);
  const SVE = { prijavljen: true, vlasnik: true, strava: true, icu: true };

  test('svaka sekcija je svrstana — nijedna ne pada u rezervnu grupu', () => {
    /* `grupaZaSekciju` ima rezervu (`app`) da preimenovana sekcija ne nestane
       sa ekrana. Rezerva je zaštita od pucanja, ne raspored: kad se sekcija
       preimenuje a spisak grupa ne, ovo mora da padne, a ne da je tiho gurne
       među obaveštenja. */
    const { a, html } = sa(SVE);
    const nesvrstane = sekcije(html).filter(n => !a.evalIn(`SET_GRUPE.some(g=>g[3].includes(${JSON.stringify(n)}))`));
    assert.deepEqual(nesvrstane, [], `nisu ni u jednoj grupi: ${nesvrstane.join(', ')}`);
  });

  test('svaka sekcija ima ikonicu', () => {
    const { a, html } = sa(SVE);
    const bez = sekcije(html).filter(n => !a.evalIn(`!!SET_IKONE[${JSON.stringify(n)}]`));
    assert.deepEqual(bez, [], `bez ikonice: ${bez.join(', ')}`);
    /* I obrnuto: ikonica za sekciju koja više ne postoji je mrtav kod koji se
       prepisuje pri svakoj izmeni. */
    const visak = a.evalIn('Object.keys(SET_IKONE)').filter(n => !sekcije(html).includes(n));
    assert.deepEqual(visak, [], `ikonice bez sekcije: ${visak.join(', ')}`);
  });

  test('ikonice su linijski crtež u jeziku aplikacije, ne emodži', () => {
    /* Uslov iz zahteva: isti crtački jezik kao ikonice tabova. Emodži se na
       svakom uređaju crta drugačije i ne prati boju teksta. */
    const { a } = sa(SVE);
    const ikone = a.evalIn('Object.entries(SET_IKONE)');
    for (const [ime, svg] of ikone) {
      assert.match(svg, /^<svg viewBox="0 0 24 24"/, `${ime}: nije 24×24 svg`);
      assert.match(svg, /fill="none"/, `${ime}: nije linijski crtež`);
      assert.match(svg, /stroke="currentColor"/, `${ime}: ne prati boju teksta`);
      assert.match(svg, /stroke-width="1\.[89]"/, `${ime}: druga debljina linije`);
      assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(svg), `${ime}: sadrži emodži`);
    }
  });

  test('sakrivena grupa i dalje stoji u DOM-u — dugmad rade bez ponovnog kačenja', () => {
    /* Da se ne-izabrane grupe izostavljaju iz HTML-a, svaki prelazak segmenta
       bi tražio ponovno kačenje dvadesetak rukovalaca; prvi zaboravljen bi bio
       dugme koje tiho ne radi. */
    const { html } = sa(SVE);
    assert.equal(new Set(grupe(html)).size, 5, 'nisu iscrtane sve grupe odjednom');
    for (const id of ['sb-sync', 'st-sync', 'icu-sync', 's-exp', 'bc-svi'])
      assert.ok(html.includes('id="' + id + '"'), `#${id} nestaje kad mu grupa nije izabrana`);
  });

  test('Admin grupe za druge ljude nema — ne kao zaključane, nego je nema', () => {
    const vlasnik = sa(SVE);
    assert.ok(segmenti(vlasnik.html).includes('admin'), 'vlasnik nema Admin segment');

    const drugi = sa({ prijavljen: true, strava: true, icu: true });
    assert.ok(!segmenti(drugi.html).includes('admin'), 'Admin segment se nudi i drugima');
    assert.ok(!grupe(drugi.html).includes('admin'), 'admin grupa je iscrtana pa samo sakrivena');
    assert.ok(!drugi.html.includes('id="bc-svi"'), 'admin dugme postoji u DOM-u drugog naloga');
  });

  test('otvara se na grupi u kojoj nešto čeka', () => {
    /* Nalog je rešen, Strava nije — čeka se u „Veze", pa se tamo i skače. */
    const veze = sa({ prijavljen: true, backup: true });
    assert.equal(veze.a.evalIn('SET_GRUPA'), 'veze');

    /* Backup čeka a nalog ne postoji: prvi po prioritetu je nalog. */
    const nalog = sa({});
    assert.equal(nalog.a.evalIn('SET_GRUPA'), 'nalog');
  });

  test('kad ništa ne čeka, uvek ista, prva grupa', () => {
    const { a } = sa({ prijavljen: true, strava: true, icu: true, push: true, backup: true });
    assert.equal(a.evalIn('podesavanjaStanje().cekaju.length'), 0);
    assert.equal(a.evalIn('SET_GRUPA'), 'nalog');
  });

  test('izbor se NE pamti između otvaranja', () => {
    /* Pamćenje bi značilo da ekran svaki put počinje na drugom mestu, pa se
       nijedno ne nauči napamet. */
    const { a } = sa({ prijavljen: true, strava: true, icu: true, push: true, backup: true });
    a.evalIn(`document.querySelectorAll('[data-sg]').forEach(b=>{ if(b.dataset.sg==='app') b.onclick(); })`);
    assert.equal(a.evalIn('SET_GRUPA'), 'app', 'dodir segmenta ne menja grupu');
    a.call('closeSheet');
    a.call('openSettings');
    assert.equal(a.evalIn('SET_GRUPA'), 'nalog', 'izbor se preneo u sledeće otvaranje');
  });

  test('dodir segmenta prikazuje tačno jednu grupu', () => {
    const { a } = sa(SVE);
    for (const g of ['nalog', 'trening', 'veze', 'app', 'admin']) {
      a.evalIn(`document.querySelectorAll('[data-sg]').forEach(b=>{ if(b.dataset.sg==='${g}') b.onclick(); })`);
      const vidljive = a.evalIn(`[...document.querySelectorAll('.set-grp.on')].map(x=>x.dataset.g)`);
      assert.ok(vidljive.length > 0, `grupa ${g} nema nijednu sekciju`);
      assert.deepEqual([...new Set(vidljive)], [g], `uz ${g} se vidi i tuđa sekcija`);
      const oznaceni = a.evalIn(`[...document.querySelectorAll('[data-sg].on')].map(x=>x.dataset.sg)`);
      assert.deepEqual(oznaceni, [g], `označen segment ne prati prikazanu grupu`);
    }
  });

  test('grupa koja čeka se ne bira ako je za taj nalog i nema', () => {
    /* Zaštita od tihe greške: da `grupaKojaCeka` vrati „admin" nekome ko taj
       segment ne vidi, ekran bi se otvorio prazan. */
    const { a } = sa({ prijavljen: true, strava: true, icu: true, push: true, backup: true });
    a.evalIn(`SET_GRUPA='admin'; podesiGrupe()`);
    assert.notEqual(a.evalIn('SET_GRUPA'), 'admin', 'nevidljiva grupa ostaje izabrana');
    const vidljive = a.evalIn(`[...document.querySelectorAll('.set-grp.on')].map(x=>x.dataset.g)`);
    assert.ok(vidljive.length > 0, 'ekran je ostao prazan');
  });
});

/* NALAZ QA-4 i QA-5 — ono što se izgubi između dva učitavanja, i ono što je
   premalo za prst.

   Oba su nađena u pregledaču, ne u kodu: prvo se vidi tek kad se stranica
   stvarno učita iznova, drugo tek kad se izmeri visina. */
describe('Otvoren ekran preživljava ponovno učitavanje', () => {
  const sa = (opt = {}) => loadApp(Object.assign({ now: '2026-08-04T09:00:00Z' }, opt));

  test('prelazak na tab se pamti', () => {
    const a = sa();
    a.call('setPage', 'opor');
    assert.equal(a.evalIn(`sessionStorage.getItem('sub19-tab')`), 'opor',
      'otvoren tab se nigde ne pamti — posle „Osveži" se gubi mesto na kom je čovek bio');
  });

  test('pri pokretanju se otvara zapamćen tab', () => {
    const a = sa({ seedSessionStorage: { 'sub19-tab': 'pred' } });
    assert.equal(a.call('pocetnaStrana'), 'pred');
  });

  test('`?tab=` POBEĐUJE pamćenje — izričita namera je jača od nastavka', () => {
    /* Prečica sa ikonice kaže „hoću baš tu". Da pamćenje pobeđuje, dug pritisak
       na ikonicu bi otvarao ekran sa kog si slučajno izašao. */
    const a = sa({ search: '?tab=plan', seedSessionStorage: { 'sub19-tab': 'pred' } });
    assert.equal(a.call('pocetnaStrana'), 'plan');
  });

  test('nepoznata zapamćena vrednost tiho pada na Danas', () => {
    for (const smece of ['nepostojeci', '', '__proto__', 'constructor'])
      assert.equal(sa({ seedSessionStorage: { 'sub19-tab': smece } }).call('pocetnaStrana'), 'danas',
        `zapamćeno „${smece}" je prošlo`);
  });

  test('pamti se u sessionStorage, ne u localStorage', () => {
    /* Mora da traje tačno koliko i kartica: preko localStorage bi aplikacija
       sutra ujutru otvarala ekran na kom si stao juče uveče, a Danas je mesto
       sa kog se počinje. */
    const src = readAppSource();
    const f = /function pocetnaStrana\(\)\{[\s\S]*?\n\}/.exec(src)[0];
    assert.match(f, /sessionStorage/, 'zapamćen tab se ne čita iz sessionStorage');
    assert.doesNotMatch(f, /localStorage/, 'zapamćen tab bi preživeo i zatvaranje aplikacije');
  });
});

describe('Nijedna dodirna meta nije niža od 44 px', () => {
  /* Izmereno u Chromium-u na 360 px: tri dugmeta su bila 34, 38 i 42 px, četiri
     sklopiva objašnjenja 28 px, i jedan link 12 px. Visina se dobijala iz
     `padding`-a i veličine slova, pa je zavisila od dužine teksta umesto od
     toga koliko je prstu potrebno.

     Zamka gleda CSS, jer harness nema raspored — ali pravilo je isto ono koje
     je mereno u pregledaču. */
  const CSS = readRepoFile('index.html');

  const pravilo = sel => {
    const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}');
    const m = re.exec(CSS);
    assert.ok(m, `nema CSS pravila za ${sel}`);
    return m[1];
  };

  for (const sel of ['.bodytoggle button', '.zseg button', '.btn-ai', '.nb-d button',
                     '.seg button', '.zchip', 'details.help>summary']) {
    test(`${sel} ima min-height od bar 44 px`, () => {
      const m = /min-height\s*:\s*(\d+)px/.exec(pravilo(sel));
      assert.ok(m, `${sel} nema min-height — visina zavisi od dužine teksta`);
      assert.ok(+m[1] >= 44, `${sel} je ${m[1]}px, ispod 44`);
    });
  }

  test('link u sitnom redu dobija metu bez lomljenja teksta', () => {
    /* Jedini izuzetak od `min-height`: inline link u prozi. `min-height` bi ga
       izvukao iz reda, pa se meta pravi razmakom uz negativnu marginu. */
    const p = pravilo('.note-src a');
    assert.match(p, /display\s*:\s*inline-block/, 'link nije inline-block, pa razmak ne radi');
    const pad = /padding\s*:\s*(\d+)px/.exec(p);
    assert.ok(pad && +pad[1] >= 16, `uspravni razmak je ${pad && pad[1]}px — meta ostaje ispod 44`);
  });
});
