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
const workouts = readRepoFile('api/workouts.js');

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
    for (const f of ['api/broadcast.js', 'api/workouts.js', 'api/daily-report.js']) {
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
    const iPage = izvor.indexOf("setPage('danas')");
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
