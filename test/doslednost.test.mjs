/* Doslednost između fajlova — stvari koje su se do sada održavale ručno.

   Svaka provera ovde postoji zato što razilaženje ne pravi grešku koja se
   prijavi, nego tiho pogrešno ponašanje: SW koji servira staru verziju,
   događaji na satu koji se više ne prepoznaju kao naši, CSP koji blokira
   sopstveni poziv. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile, loadApp } from './harness.mjs';

const index = readRepoFile('index.html');
const sw = readRepoFile('sw.js');
const manifest = JSON.parse(readRepoFile('manifest.json'));
const vercel = JSON.parse(readRepoFile('vercel.json'));
const workouts = readRepoFile('api/workouts.js');

describe('Verzija', () => {
  test('APP_VERSION je isti u index.html i sw.js', () => {
    /* Komentar u kodu kaže „mora se poklapati" — sada to proverava mašina.
       Kad se raziđu, SW servira stari keš a app prijavljuje novu verziju. */
    const uIndex = /const APP_VERSION='(\d+)'/.exec(index);
    const uSw = /const APP_VERSION = '(\d+)'/.exec(sw);
    assert.ok(uIndex, 'APP_VERSION nije nađen u index.html');
    assert.ok(uSw, 'APP_VERSION nije nađen u sw.js');
    assert.equal(uIndex[1], uSw[1], `index.html=${uIndex[1]} vs sw.js=${uSw[1]}`);
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
    const izvor = readRepoFile('index.html').replace(/\/\*[\s\S]*?\*\//g, '');
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

  test('tuđi nalog na ugrađenom planu traku I DALJE vidi', () => {
    /* Da popravka ne ugasi poruku koja tu treba da stoji. */
    const app = loadApp({ seedLocalStorage: sesija('11111111-2222-3333-4444-555555555555') });
    assert.equal(app.call('jeVlasnik'), false);
    assert.equal(app.call('tudjPlanSaUnosima'), true, 'traka se ne prikazuje tuđem nalogu');
  });

  test('vlasnik sa generisanim planom takođe ne vidi traku', () => {
    const app = loadApp({ seedLocalStorage: sesija('0403f8fb-a643-4d4e-843d-f71199a0d6f9') });
    app.evalIn(`S.genPlan={meta:{raceDistM:5000},pred:[],qs:{},
      weeks:[{w:1,start:'2026-06-22',days:[{dow:0,tag:'lako',km:5,desc:'x',id:'g1d1'}]}]};
      setActivePlan(); rebuildDateIndex()`);
    assert.equal(app.call('tudjPlanSaUnosima'), false);
  });
});
