/* Podešavanja — kartice koje se sklapaju.

   Ranije: šest sekcija u ravnom nizu razdvojenih linijom, sve iste težine, pa
   je do backupa trebalo šest ekrana skrolovanja. intervals.icu je uz to nosio
   i povlačenje oporavka I slanje na sat, pa je bio dvostruko duži od ostalih. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadApp } from './harness.mjs';

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
    assert.deepEqual(k, ['Nalog', 'Plan', 'Strava', 'intervals.icu', 'Slanje na sat', 'Vreme', 'Obaveštenja', 'Podaci']);
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

  const hero = html => {
    const m = /<div class="set-hero">([\s\S]*?)<\/div>\s*<div class="set-sub">/.exec(html);
    return m ? m[1] : '';
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
    const vrh = h => (/<div class="set-hero">([\s\S]*?)<div class="set-sub">/.exec(h) || [, ''])[1];

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
