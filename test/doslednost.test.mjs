/* Doslednost između fajlova — stvari koje su se do sada održavale ručno.

   Svaka provera ovde postoji zato što razilaženje ne pravi grešku koja se
   prijavi, nego tiho pogrešno ponašanje: SW koji servira staru verziju,
   događaji na satu koji se više ne prepoznaju kao naši, CSP koji blokira
   sopstveni poziv. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile, readClientSource, loadApp, ROOT } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const index = readClientSource();
const sw = readRepoFile('sw.js');
const manifest = JSON.parse(readRepoFile('manifest.json'));
const vercel = JSON.parse(readRepoFile('vercel.json'));
const workouts = readRepoFile('api/icu.js');

describe('Verzija', () => {
  test('APP_VERSION je isti u app.js i sw.js', () => {
    /* Komentar u kodu kaže „mora se poklapati" — sada to proverava mašina.
       Kad se raziđu, SW servira stari keš a app prijavljuje novu verziju. */
    const uApp = /const APP_VERSION='(\d+)'/.exec(index);
    const uSw = /const APP_VERSION = '(\d+)'/.exec(sw);
    assert.ok(uApp, 'APP_VERSION nije nađen u app.js');
    assert.ok(uSw, 'APP_VERSION nije nađen u sw.js');
    assert.equal(uApp[1], uSw[1], `app.js=${uApp[1]} vs sw.js=${uSw[1]}`);
  });

  test('ime keša prati verziju (inače se stari keš ne briše)', () => {
    const ver = /const APP_VERSION = '(\d+)'/.exec(sw)[1];
    const cache = /const CACHE = '([^']+)'/.exec(sw)[1];
    assert.ok(cache.endsWith('v' + ver), `CACHE "${cache}" ne završava se na v${ver}`);
  });
});

describe('Nosivi identifikatori se NE smeju menjati', () => {
  /* Ovi nizovi nisu kozmetika:
     - LS_KEY / SB_KEY: promena = brisanje podataka i odjava svih korisnika
     - 'sub19-' prefiks: identitet događaja koji VEĆ stoje u tuđim
       intervals.icu i Garmin kalendarima; promena znači da „Pošalji iz
       početka" više ne pronalazi ranije poslato → trajni duplikati na satu */
  test('LS_KEY i SB_KEY su nepromenjeni', () => {
    assert.ok(index.includes("LS_KEY='sub19-v1'"), 'LS_KEY je promenjen');
    assert.ok(index.includes("SB_KEY='sub19_sb'"), 'SB_KEY je promenjen');
  });

  test('prefiks externalId je isti u klijentu i na serveru', () => {
    assert.ok(index.includes("externalId:'sub19-'+d.id"), 'klijentski prefiks je promenjen');
    assert.ok(workouts.includes('/^sub19-[A-Za-z0-9_]+$/'), 'serverska provera prefiksa je promenjena');
    assert.ok(workouts.includes('/^sub19-/'), 'serverski filter za brisanje je promenjen');
  });
});

describe('manifest.json', () => {
  test('ne sadrži lične podatke vlasnika (vidi ga svaki korisnik pri instalaciji)', () => {
    const tekst = JSON.stringify(manifest);
    assert.ok(!/24\.09\.2026|24\.9\.2026/.test(tekst),
      'manifest sadrži vlasnikov datum trke');
    assert.ok(!/lični plan/i.test(tekst), 'manifest opis je i dalje „lični"');
  });

  test('ima sve što PWA traži', () => {
    for (const k of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
      assert.ok(manifest[k] != null, `nedostaje "${k}"`);
    }
    assert.ok(manifest.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'),
      'nedostaje maskable ikonica 512');
  });
});

describe('vercel.json', () => {
  test('funkcije koje rade duže imaju podešen maxDuration', () => {
    /* Bez ovoga važi podrazumevani limit, a slanje mejlova / brisanje na
       intervals.icu se prekida na pola posla. */
    assert.ok(vercel.functions, 'nema functions bloka');
    for (const f of ['api/broadcast.js', 'api/icu.js', 'api/daily-report.js']) {
      assert.ok(vercel.functions[f] && vercel.functions[f].maxDuration >= 30,
        `${f} nema maxDuration >= 30`);
    }
  });

  test('CSP dozvoljava tačno ono što aplikacija zove, i ništa više', () => {
    const csp = vercel.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
    for (const treba of ["default-src 'self'", 'https://*.supabase.co', 'https://www.strava.com',
      "frame-ancestors 'none'", "base-uri 'none'", "object-src 'none'", "form-action 'self'"]) {
      assert.ok(csp.includes(treba), `CSP nema "${treba}"`);
    }
    assert.ok(!csp.includes('unsafe-eval'), 'CSP dozvoljava unsafe-eval');
  });

  test('img-src pušta samo Google avatare, i ništa šire', () => {
    /* Zajednica prikazuje profilne slike sa Google naloga, pa je `img-src`
       morao da se otvori. Otvara se samo za Googleov domen za slike. Šire pravilo
       (`https:`, `*`) izgleda isto dok sve radi, a znači da svaka slika sa
       interneta sme u aplikaciju — što je i put kojim se piksel za praćenje
       ubacuje kroz nadimak ili bilo koje polje koje završi u `src`. */
    const csp = vercel.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
    const img = /img-src ([^;]+)/.exec(csp);
    assert.ok(img, 'CSP nema img-src');
    const izvori = img[1].trim().split(/\s+/);
    /* Zvezdica je SAMO u imenu poddomena googleusercontent.com — Google
       avatare služi i sa lh4/lh5/lh6, ne samo sa lh3, i to bez najave.
       Šire pravilo (`https:`, `*`) i dalje ne prolazi. */
    assert.deepEqual(izvori, ["'self'", 'data:', 'https://*.googleusercontent.com'],
      `img-src je "${img[1].trim()}"`);
  });

  test("script-src NEMA 'unsafe-inline'", () => {
    /* Ovo je jedina odbrana koja radi POSLE probijene provere unosa: ako
       ubačeni `<img onerror=...>` ipak dospe u HTML, pregledač odbija da ga
       izvrši. Sa 'unsafe-inline' pregledač ne može da razlikuje naš kod od
       ubačenog, pa ta odbrana ne postoji.
       `style-src 'unsafe-inline'` OSTAJE — <style> blok i style="…" atributi
       su i dalje inline, a ubačen stil ne izvršava kod. */
    const csp = vercel.headers[0].headers.find(h => h.key === 'Content-Security-Policy').value;
    const script = /script-src ([^;]+)/.exec(csp);
    assert.ok(script, 'CSP nema script-src');
    assert.ok(!script[1].includes('unsafe-inline'),
      `script-src je "${script[1].trim()}"`);
    assert.ok(script[1].includes("'self'"), 'script-src ne dozvoljava sopstvene skripte');
  });
});

describe('Izgled obrazaca', () => {
  test('polja u obrascima nisu bela kutija iz pregledača', () => {
    /* Pravilo je bilo nabrajanje po tipu (`input[type=text]`, `[type=number]`,
       `[type=date]`). Takav selektor NE hvata `<input>` bez atributa `type` —
       a takva su bila tri postojeća polja, plus jedno sa `type=password`. Sva
       su se crtala kao bela kutija iz pregledača usred tamnog lista.

       Test ne traži konkretan selektor nego SVOJSTVO: da svaki tip koji
       aplikacija stvarno koristi bude pokriven, uključujući „bez atributa". */
    const css = readRepoFile('index.html');
    const m = /\.f-field input([^{]*)\{/.exec(css);
    assert.ok(m, 'nema pravila za .f-field input');
    const izuzeti = [...m[0].matchAll(/:not\(\[type=([a-z]+)\]\)/g)].map(x => x[1]);
    const nabrojani = [...m[0].matchAll(/input\[type=([a-z]+)\]/g)].map(x => x[1]);
    for (const t of ['text', 'password', 'date', 'number', 'bez-atributa']) {
      const pokriven = izuzeti.length ? !izuzeti.includes(t) : nabrojani.includes(t);
      assert.ok(pokriven, `polje tipa „${t}" nije stilizovano — crta se kao bela kutija`);
    }
  });
});

describe("Ništa izvršno ne stoji inline u HTML-u (uslov za script-src 'self')", () => {
  /* Čim jedan `onclick=` ili jedan inline <script> blok uđe nazad u markup,
     stranica se tiho lomi u produkciji (CSP ga blokira), a testovi koji rade
     nad app.js to ne bi videli. Zato se proverava markup, ne ponašanje. */
  const straniceSaSkriptom = ['index.html', 'privacy.html', 'uputstvo.html'];

  for (const ime of straniceSaSkriptom) {
    const html = readRepoFile(ime).replace(/<!--[\s\S]*?-->/g, '');

    test(`${ime}: nema <script> bloka sa telom`, () => {
      const blokovi = html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) || [];
      assert.deepEqual(blokovi, [], `inline <script> u ${ime}: ${blokovi.join(' ')}`);
    });

    test(`${ime}: nema on*= atributa ni javascript: URL-a`, () => {
      const handleri = html.match(/<[^>]*\son[a-z]+\s*=/gi) || [];
      assert.deepEqual(handleri.map(h => h.slice(-20)), [],
        `inline handler u ${ime}`);
      assert.ok(!/javascript:/i.test(html), `javascript: URL u ${ime}`);
    });
  }

  test('index.html učitava app.js kao spoljnu skriptu sa iste adrese', () => {
    const html = readRepoFile('index.html');
    assert.match(html, /<script src="\.\/app\.js"><\/script>/,
      'index.html ne učitava ./app.js');
  });

  test('app.js je na spisku koji SW osvežava sa mreže', () => {
    /* Bez ovoga bi se logika aplikacije servirala iz starog keša dok bi
       omotač (index.html) bio svež — „promenio sam kod, ništa se ne vidi". */
    const assets = /const ASSETS = \[([^\]]+)\]/.exec(sw);
    assert.ok(assets, 'ASSETS nije pronađen u sw.js');
    assert.ok(assets[1].includes("'./app.js'"), "ASSETS ne sadrži './app.js'");
  });

  test('svaka putanja pod api/ koja postoji na disku ima svoj fajl', async () => {
    const { readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { ROOT } = await import('./harness.mjs');
    const fajlovi = new Set(readdirSync(join(ROOT, 'api')));
    for (const f of Object.keys(vercel.functions || {})) {
      assert.ok(fajlovi.has(f.replace('api/', '')), `vercel.json pominje ${f}, a fajl ne postoji`);
    }
  });
});

describe('Pristupačnost', () => {
  test('pinch-zoom nije blokiran (WCAG 1.4.4)', () => {
    const vp = /<meta name="viewport" content="([^"]+)"/.exec(index);
    assert.ok(vp, 'nema viewport meta taga');
    assert.ok(!/user-scalable\s*=\s*no/.test(vp[1]), 'user-scalable=no je i dalje tu');
    assert.ok(!/maximum-scale\s*=\s*1/.test(vp[1]), 'maximum-scale=1 takođe blokira zoom');
  });

  test('nema <label> bez veze sa poljem', () => {
    /* <label> bez `for` i bez obavijenog polja čitač ekrana prijavljuje kao
       praznu labelu, a dodir na nju ne fokusira polje.
       Komentari se prvo uklanjaju — inače se pomen `<label>` u objašnjenju
       broji kao stvarna labela. */
    const bezKomentara = index
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    const bezFor = bezKomentara.match(/<label(?![^>]*\bfor=)[^>]*>/g) || [];
    assert.equal(bezFor.length, 0,
      `${bezFor.length} labela bez "for": ${bezFor.slice(0, 3).join(' ')}`);
  });
});

describe('Politika privatnosti pominje sve treće strane kojima podaci odlaze', () => {
  const privacy = readRepoFile('privacy.html');
  for (const strana of ['Supabase', 'Strava', 'intervals', 'Resend', 'Gemini', 'Vercel']) {
    test(`pominje ${strana}`, () => {
      assert.ok(new RegExp(strana, 'i').test(privacy), `privacy.html ne pominje ${strana}`);
    });
  }
});

describe('Nema dupliranih definicija na vrhu skripte', () => {
  test('svaka function deklaracija je jedinstvena', () => {
    /* Fajl je vec dvaput imao tiho gazenje istoimenih funkcija (riegel,
       workLapsTempo) — oba puta uz posledicu koja se nigde ne prijavljuje. */
    const imena = [...index.matchAll(/^function ([A-Za-z_$][\w$]*)\s*\(/gm)].map(m => m[1]);
    const brojac = {};
    imena.forEach(n => { brojac[n] = (brojac[n] || 0) + 1; });
    const duplirane = Object.entries(brojac).filter(([, n]) => n > 1).map(([k]) => k);
    assert.deepEqual(duplirane, [], `duplirane funkcije: ${duplirane.join(', ')}`);
  });
});

describe('Aplikacija se učitava bez izuzetka', () => {
  test('nijedan alert ni confirm pri pokretanju bez mreže', () => {
    const app = loadApp();
    assert.deepEqual(app.calls.alerts, [], 'aplikacija je pri startu prikazala alert');
    assert.deepEqual(app.calls.confirms, [], 'aplikacija je pri startu tražila potvrdu');
  });

  test('aktivan plan je izgrađen i indeksi popunjeni', () => {
    const app = loadApp();
    assert.ok(app.evalIn('CUR_PLAN.length') > 0);
    assert.ok(app.evalIn('DATED.length') > 0);
    assert.ok(app.evalIn('Object.keys(BY_DATE).length') > 0);
    assert.equal(app.evalIn('DATED.filter(d=>!d.date).length'), 0, 'dan bez datuma u indeksu');
  });

  test('BY_DATE nema dva dana na istom datumu', () => {
    const app = loadApp();
    const datumi = app.evalIn('DATED.map(d=>d.date)');
    assert.equal(new Set(Array.from(datumi)).size, datumi.length, 'dva dana dele isti datum');
  });
});

describe('Traka „Ovo nije tvoj plan"', () => {
  /* Prijavljen vlasnik je NE sme videti. Ranije jeste — `sbLoad()` je stajao
     ispod `setPage('danas')`, pa je prvo iscrtavanje išlo sa praznim SB
     objektom: sbAuthed() false → jeVlasnik() false → traka. Nestajala je tek
     pri promeni taba, dakle iskakala je pri svakom otvaranju aplikacije. */
  const sesija = uid => ({
    sub19_sb: JSON.stringify({
      access: 'test-token', refresh: 'r', expiresAt: Date.now() + 3600e3,
      email: 'x@t.rs', userId: uid, seenAt: null, deviceId: 'd1'
    })
  });

  test('sesija se učitava PRE prvog iscrtavanja', () => {
    /* Komentari se uklanjaju — objašnjenje iznad samog poziva pominje
       `setPage('danas')`, pa bi ga sirov indexOf našao prvog. */
    const izvor = readClientSource().replace(/\/\*[\s\S]*?\*\//g, '');
    const iLoad = izvor.indexOf("if(typeof sbLoad==='function')sbLoad()");
    /* Od v192 pocetna strana zavisi od ?tab= (precice sa ikonice), pa se
       redosled meri po samom pozivu setPage, ne po njegovom argumentu. */
    const iPage = izvor.indexOf("setPage(pocetnaStrana())");
    assert.ok(iLoad > 0 && iPage > 0, 'nije pronađen redosled pokretanja');
    assert.ok(iLoad < iPage, 'sbLoad() se i dalje poziva posle setPage()');
  });

  test('vlasnik ne vidi traku pri otvaranju aplikacije', () => {
    const app = loadApp({ seedLocalStorage: sesija('0403f8fb-a643-4d4e-843d-f71199a0d6f9') });
    assert.equal(app.call('jeVlasnik'), true, 'vlasnik nije prepoznat pri pokretanju');
    assert.equal(app.call('tudjPlanSaUnosima'), false, 'traka se računa kao potrebna');
    assert.ok(!(app.evalIn('$("#pg-danas").innerHTML') || '').includes('Ovo nije tvoj plan'),
      'traka je iscrtana vlasniku');
  });

  test('tuđi nalog sa SOPSTVENIM unosima traku I DALJE vidi', () => {
    /* Ko je već upisivao treninge na ugrađeni plan ne sme da bude nasilno
       prebačen u čarobnjaka — njegovi unosi nose 'n' ID-jeve i ostali bi bez
       mesta na kom se prikazuju. Njemu se plan PREDLAŽE trakom. */
    const app = loadApp({ seedLocalStorage: sesija('11111111-2222-3333-4444-555555555555') });
    app.evalIn(`S.log={n12d5:{status:'done',km:11,sec:3000}}`);
    assert.equal(app.call('jeVlasnik'), false);
    assert.equal(app.call('imaUnosaNaLicnom'), true);
    assert.equal(app.call('tudjPlanSaUnosima'), true, 'traka se ne prikazuje tuđem nalogu');
    assert.equal(app.call('moraSvojPlan'), false, 'čarobnjak se nameće čoveku sa unosima');
  });

  test('tuđi nalog BEZ unosa ide pravo u čarobnjaka, ne na tuđi plan', () => {
    const app = loadApp({ seedLocalStorage: sesija('11111111-2222-3333-4444-555555555555') });
    assert.equal(app.call('imaUnosaNaLicnom'), false, 'tuđi seed je i dalje tu');
    assert.equal(app.call('moraSvojPlan'), true, 'čarobnjak se ne nameće novom korisniku');
  });

  test('vlasnik sa generisanim planom takođe ne vidi traku', () => {
    const app = loadApp({ seedLocalStorage: sesija('0403f8fb-a643-4d4e-843d-f71199a0d6f9') });
    app.evalIn(`S.genPlan={meta:{raceDistM:5000},pred:[],qs:{},
      weeks:[{w:1,start:'2026-06-22',days:[{dow:0,tag:'lako',km:5,desc:'x',id:'g1d1'}]}]};
      setActivePlan(); rebuildDateIndex()`);
    assert.equal(app.call('tudjPlanSaUnosima'), false);
  });
});

describe('Uputstvo ne sme da laže o brojevima iz koda', () => {
  /* Uputstvo je jedini fajl koji niko ne pokreće, pa tiho zastari: prag se
     promeni u app.js, a tekst i dalje tvrdi staru vrednost. Ove provere vezuju
     KONSTANTU za rečenicu koja je opisuje — kad se konstanta promeni, pada test,
     ne korisnikovo poverenje. */
  const uputstvo = readRepoFile('uputstvo.html');

  const vezano = [
    ['pojas u kom se lagana trčanja porede',
      /const LAKO_POJAS=(\d+);/, n => new RegExp(`pojasa distance</b> \\(${n} km\\)`)],
    ['granica do koje je puls uporediv',
      /const TEMPO_UPOREDIV=(\d+);/, n => new RegExp(`${n} s/km`)],
    ['koliko stepeni mora biti hladnije da se sat uopšte predloži',
      /osecaj-naj\.osecaj>=(\d+)/, n => new RegExp(`bar ${n} °C hladniji`)],
    ['najmanji broj kilometara iz kog se drift uopšte računa',
      /if\(v\.length<(\d+)\) return null;/, n => new RegExp(`bar <b>${n} km</b>`)]
  ];

  for (const [sta, izKoda, uTekst] of vezano) {
    test(sta, () => {
      const m = izKoda.exec(index);
      assert.ok(m, `konstanta više ne postoji u app.js (${sta}) — uputstvo je ostalo bez izvora`);
      assert.match(uputstvo, uTekst(m[1]), `uputstvo ne govori ${m[1]} za: ${sta}`);
    });
  }

  test('pragovi boje drifta su isti u kodu i u uputstvu', () => {
    const m = /function bojaDrifta\(n\)\{ return n<(\d+)\?'var\(--green\)':n<(\d+)\?/.exec(index);
    assert.ok(m, 'bojaDrifta više ne postoji ili je promenila oblik');
    assert.match(uputstvo, new RegExp(`Ispod <b>${m[1]} %</b> je zdrava baza, ${m[1]}–${m[2]} % granično, preko <b>${m[2]} %</b>`),
      `uputstvo ne opisuje pragove ${m[1]} i ${m[2]}`);
  });

  test('svako sidro u uputstvu ima svoj cilj', () => {
    const ids = new Set([...uputstvo.matchAll(/id="([^"]+)"/g)].map(x => x[1]));
    const mrtva = [...uputstvo.matchAll(/href="#([^"]+)"/g)].map(x => x[1]).filter(h => !ids.has(h));
    assert.deepEqual(mrtva, [], `sidra bez cilja: ${mrtva.join(', ')}`);
  });
});

describe('Manifest je spreman za pakovanje u Android aplikaciju', () => {
  /* PWABuilder ocenjuje manifest brojem popunjenih polja (18/45), sto sam po
     sebi nista ne znaci — vecina od tih 45 su polja za slucajeve koje ova
     aplikacija nema (note_taking, edge_side_panel, protocol_handlers…). Dva
     polja sa te liste, medjutim, jesu vazna, i ovi testovi ih drze. */

  test('`id` je stabilan i NE menja identitet vec instaliranih kopija', () => {
    /* Bez `id`, identitet aplikacije je `start_url`. Cim se start_url promeni,
       pregledac to vidi kao DRUGU aplikaciju: nova instalacija, a stara ostaje
       kao siroce. Zato se `id` postavlja eksplicitno.
       ALI: mora da se razresi na ISTU adresu koju su postojece instalacije vec
       zapamtile (koren), inace bi bas ovaj popravak napravio taj rascep. */
    assert.equal(manifest.id, '/', 'id mora biti koren — svaka druga vrednost razdvaja postojece instalacije');
  });

  test('snimci ekrana postoje, sa tacnim dimenzijama i oznakom oblika', () => {
    /* Bez njih Android prikazuje siromasan dijalog za instalaciju. */
    assert.ok(Array.isArray(manifest.screenshots) && manifest.screenshots.length >= 3,
      'manje od tri snimka — dijalog za instalaciju ostaje siromasan');
    for (const s of manifest.screenshots) {
      assert.equal(s.form_factor, 'narrow', `snimak ${s.src} nema form_factor:"narrow"`);
      assert.match(s.sizes, /^\d+x\d+$/, `snimak ${s.src} nema dimenzije`);
      assert.ok(s.label && s.label.length > 5, `snimak ${s.src} nema opis`);
      const put = s.src.replace(/^\.\//, '');
      const b = readFileBytes(put);
      assert.ok(b, `snimak ${put} ne postoji na disku`);
      /* Dimenzije u manifestu moraju odgovarati fajlu — Chrome odbacuje snimak
         cije se dimenzije ne poklapaju, i to bez ijedne poruke. */
      const [w, h] = s.sizes.split('x').map(Number);
      const st = webpDim(b);
      assert.ok(st, `${put} nije citljiv WebP`);
      assert.deepEqual([st.w, st.h], [w, h], `${put} je ${st.w}x${st.h}, a manifest tvrdi ${s.sizes}`);
    }
  });

  test('svi snimci imaju isti odnos strana', () => {
    /* Chrome ocekuje ujednacen oblik po form-faktoru; razliciti odnosi daju
       iskrivljen prikaz u dijalogu. */
    const odnosi = new Set(manifest.screenshots.map(s => s.sizes));
    assert.equal(odnosi.size, 1, `razlicite dimenzije: ${[...odnosi].join(', ')}`);
  });

  test('veza sa Android aplikacijom je pripremljena', () => {
    const al = readRepoFile('.well-known/assetlinks.json');
    const j = JSON.parse(al);
    assert.ok(Array.isArray(j) && j.length, 'assetlinks.json nije niz');
    assert.equal(j[0].relation[0], 'delegate_permission/common.handle_all_urls');
    assert.equal(j[0].target.namespace, 'android_app');
    assert.ok(j[0].target.package_name, 'nema naziva paketa');
  });

  test('otisak kljuca je STVARAN otisak, ne rezervisano mesto', () => {
    /* Ovo je jedini fajl zbog kog Android aplikacija radi preko celog ekrana,
       bez Chrome trake sa adresom. Greska u njemu se NE vidi kao greska —
       aplikacija se normalno instalira i radi, samo sa trakom na vrhu, pa
       lako prodje neprimeceno. A ispravka posle instalacije ne pomaze:
       Android proveru zapamti, mora deinstalacija pa ponovna instalacija.
       Zato oblik cuva test, ne pazljivost. */
    const j = JSON.parse(readRepoFile('.well-known/assetlinks.json'));
    const otisci = j[0].target.sha256_cert_fingerprints;
    assert.ok(Array.isArray(otisci) && otisci.length, 'nema nijednog otiska');
    for (const o of otisci) {
      assert.match(o, /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/,
        `otisak nije 32 para velikih heks cifara sa dvotackama: ${o}`);
    }
    /* Naziv paketa mora biti isti kao u alatu za pakovanje, karakter za
       karakter — Google poredi bas njega uz otisak. */
    assert.match(j[0].target.package_name, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/,
      'naziv paketa nije ispravan Android package id');
  });
});

/* Sirovi bajtovi fajla iz repozitorijuma (readRepoFile vraca tekst). */
function readFileBytes(put) {
  try { return readFileSync(join(ROOT, put)); } catch { return null; }
}
/* Dimenzije iz WebP zaglavlja — bez ijedne zavisnosti.
   VP8L (lossless) i VP8 (lossy) pisu ih razlicito, pa se oba oblika citaju. */
function webpDim(b) {
  if (b.length < 30 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const tip = b.toString('ascii', 12, 16);
  if (tip === 'VP8X') return { w: (b.readUIntLE(24, 3) & 0xffffff) + 1, h: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
  if (tip === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (tip === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  return null;
}

describe('Prečice sa ikonice zaista otvaraju svoj tab', () => {
  /* Manifest ih nudi kao `./?tab=plan`. Ako aplikacija taj parametar ne cita,
     svaka precica otvara Danas — a precica koja ne vodi nikuda je gora od
     nijedne, jer obecava nesto sto ne radi. */
  test('svaka prečica pokazuje na postojeći tab', () => {
    assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length, 'nema prečica');
    const app = loadApp();
    const strane = Object.keys(app.get('PAGES'));
    for (const s of manifest.shortcuts) {
      const m = /\?tab=([a-z]+)$/.exec(s.url);
      assert.ok(m, `prečica "${s.name}" nema ?tab= u adresi (${s.url})`);
      assert.ok(strane.includes(m[1]), `prečica "${s.name}" vodi na nepostojeći tab "${m[1]}"`);
      assert.ok(s.icons && s.icons.length, `prečica "${s.name}" nema ikonicu`);
    }
  });

  test('aplikacija čita ?tab= pri otvaranju', () => {
    const izvor = readClientSource();
    assert.match(izvor, /function pocetnaStrana\(\)/, 'nema čitanja parametra');
    assert.match(izvor, /setPage\(pocetnaStrana\(\)\)/, 'otvaranje i dalje ide fiksno na Danas');
  });

  test('nepoznat ili zlonameran ?tab= pada na Danas, ne obara otvaranje', () => {
    /* Ulaz sa strane — mora da otkaže u bezbednom smeru. */
    for (const zla of ['constructor', '__proto__', 'toString', 'nepostoji', '']) {
      const app = loadApp({ search: '?tab=' + encodeURIComponent(zla) });
      assert.equal(app.call('pocetnaStrana'), 'danas', `„${zla}" nije pao na danas`);
    }
  });

  test('ispravan ?tab= zaista otvara taj tab', () => {
    for (const t of ['plan', 'opor', 'pred']) {
      const app = loadApp({ search: '?tab=' + t });
      assert.equal(app.call('pocetnaStrana'), t);
    }
  });
});

describe('Service worker se registruje bez čekanja na app.js', () => {
  /* MERENO, od početka učitavanja do registracije:
       app.js (611 KB) nosi registraciju →  51 ms brza veza · 1373 ms 4G · 3377 ms 3G
       zaseban sw-reg.js iz <head>       →   5 ms brza veza ·  185 ms 4G ·  431 ms 3G
     Sve to vreme nema ni offline režima ni provere nove verzije — a alati koji
     sa strane proveravaju sajt gledaju kroz kraći prozor, pa prijave da service
     workera nema iako ga ima. */
  const html = readRepoFile('index.html');
  const reg = readRepoFile('sw-reg.js');

  test('index.html registruje service worker pre app.js', () => {
    const iReg = html.indexOf('sw-reg.js');
    const iApp = html.indexOf('./app.js"');
    assert.ok(iReg > 0, 'sw-reg.js se ne učitava iz index.html');
    assert.ok(iApp > 0 && iReg < iApp, 'sw-reg.js se učitava POSLE app.js — čeka 611 KB');
    /* Trazi se ZATVARANJE glave, ne niska '<body' — nju nalazi i komentar koji
       pominje <body> stotinak redova ranije. */
    assert.ok(iReg < html.indexOf('</head>'), 'sw-reg.js nije u <head>');
  });

  test('sw-reg.js je sićušan — inače nema svrhe', () => {
    assert.ok(reg.length < 3000, `sw-reg.js je ${reg.length} B — prevelik za ono što radi`);
    assert.match(reg, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
    assert.match(reg, /location\.protocol !== 'https:'/);
  });

  test('sw-reg.js je i sam u kešu, kao i ostali fajlovi aplikacije', () => {
    assert.match(readRepoFile('sw.js'), /'\.\/sw-reg\.js'/, 'sw-reg.js nije u ASSETS');
  });

  test('app.js i dalje registruje — register je idempotentan, a njemu treba `reg`', () => {
    const izvor = readClientSource();
    assert.match(izvor, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)\.then\(reg=>\{/);
    assert.match(izvor, /pratiAzuriranje\(reg\)/);
  });
});

describe('Animacije napretka — prstenovi i linije', () => {
  /* Prstenovi i linije su jedina mesta koja pokazuju KRETANJE ka broju. Obe
     animacije vise na klasi `uskoci`, koja se skida tajmerom iz app.js. Ako se
     trajanje u CSS-u produži a tajmer ne, klasa nestane USRED animacije i
     linija vidno „pukne" u pun potez — greška koja se ne vidi ni u jednom
     testu koji gleda samo da li pravilo postoji. Zato se ovde iz CSS-a čita
     stvarno trajanje i poredi sa tajmerom. */
  /* KOMENTARI SE SKIDAJU PRE PROVERE. Objašnjenje uz pravilo pominje i imena
     klasa i imena animacija, pa bi se tvrdnja poklopila sa sopstvenim
     komentarom umesto sa kodom — lažno prolazan, odnosno lažno pao test. */
  const css = readRepoFile('index.html').replace(/\/\*[\s\S]*?\*\//g, '');
  const app = readRepoFile('app.js');

  /* „.75s .08s" -> 830 ms; „.7s" -> 700 ms. Između selektora i `animation:`
     sme da stoji i druga osobina (`.ln` nosi i stroke-dasharray). */
  function trajanje(pravilo) {
    const m = new RegExp(pravilo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*animation:[a-z-]+ ([\\d.]+)s(?: ([\\d.]+)s)?').exec(css);
    if (!m) return null;
    return Math.round((parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) : 0)) * 1000);
  }

  test('tajmer klase `uskoci` traje duže od najduže animacije na njoj', () => {
    const rok = +(/USKOK_TMR=setTimeout\(\(\)=>el\.classList\.remove\('uskoci'\),(\d+)\)/.exec(app) || [])[1];
    assert.ok(rok > 0, 'tajmer za `uskoci` nije nađen u app.js');
    const najduza = ['.page.uskoci .pr-val', '.page.uskoci .ln']
      .map(s => ({ s, ms: trajanje(s) }));
    for (const a of najduza) assert.ok(a.ms, `nema animacije za ${a.s}`);
    const max = Math.max(...najduza.map(a => a.ms));
    assert.ok(rok > max,
      `rok je ${rok} ms, a najduža animacija traje ${max} ms — klasa pada usred crtanja`);
  });

  test('prsten kreće od PRAZNOG, i to od tačnog obima', () => {
    /* 2πr, r=42 — isti poluprečnik koji koristi prstenSVG. Da se ne poklapa,
       prsten bi krenuo od pogrešnog mesta i „preskočio" na početku. */
    const r = +(/const r=(\d+), C=2\*Math\.PI\*r/.exec(app) || [])[1];
    assert.equal(r, 42, 'poluprečnik prstena je promenjen');
    const odCSS = +(/@keyframes prsten-puni\{from\{stroke-dashoffset:([\d.]+)\}/.exec(css) || [])[1];
    assert.ok(Math.abs(odCSS - 2 * Math.PI * r) < 0.1,
      `CSS kreće od ${odCSS}, a obim je ${(2 * Math.PI * r).toFixed(1)}`);
  });

  test('svaki prsten nosi klasu koju CSS traži', () => {
    assert.match(app, /<circle class="pr-val"/, 'prstenSVG ne obeležava krug vrednosti');
    /* Uvodni VDOT prsten je DRUGI element sa svojom tranzicijom — ne sme da
       upadne u isto pravilo. */
    assert.ok(!/\.ob-vval[^{]*\{[^}]*animation:prsten-puni/.test(css),
      'uvodni prsten je uvučen u animaciju plana');
  });

  test('linije se crtaju samo na PODACIMA, ne na pomoćnim linijama', () => {
    /* Isprekidane linije su cilj/osnova — one su kontekst, ne merenje. Da se i
       one crtaju, oko bi pratilo pogrešnu liniju. */
    const sve = [...app.matchAll(/<polyline[^`]*?\/>/g)].map(m => m[0]);
    const sKlasom = sve.filter(x => /class="ln"/.test(x));
    assert.ok(sKlasom.length >= 5, `obeleženo je samo ${sKlasom.length} linija`);
    for (const l of sKlasom)
      assert.ok(!/stroke-dasharray="/.test(l), 'obeležena je pomoćna (isprekidana) linija');
  });

  test('isključeno kretanje gasi obe animacije', () => {
    const blok = /@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?\n\}/.exec(css)[0];
    assert.match(blok, /\.page\.uskoci \.pr-val,\.page\.uskoci \.ln\{animation:none!important\}/,
      'nove animacije rade i kad je kretanje isključeno');
  });
});
