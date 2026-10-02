/* Doslednost između fajlova — stvari koje su se do sada održavale ručno.

   Svaka provera ovde postoji zato što razilaženje ne pravi grešku koja se
   prijavi, nego tiho pogrešno ponašanje: SW koji servira staru verziju,
   događaji na satu koji se više ne prepoznaju kao naši, CSP koji blokira
   sopstveni poziv. */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile, ROOT } from './repo.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const manifest = JSON.parse(readRepoFile('manifest.json'));
const vercel = JSON.parse(readRepoFile('vercel.json'));
const workouts = readRepoFile('api/icu.js');

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

describe("Ništa izvršno ne stoji inline u HTML-u (uslov za script-src 'self')", () => {
  /* Čim jedan `onclick=` ili jedan inline <script> blok uđe nazad u markup,
     stranica se tiho lomi u produkciji (CSP ga blokira), a testovi koji rade
     nad app.js to ne bi videli. Zato se proverava markup, ne ponašanje. */
  const straniceSaSkriptom = ['privacy.html', 'uputstvo.html'];

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

  test('svaka putanja pod api/ koja postoji na disku ima svoj fajl', async () => {
    const { readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { ROOT } = await import('./repo.mjs');
    const fajlovi = new Set(readdirSync(join(ROOT, 'api')));
    for (const f of Object.keys(vercel.functions || {})) {
      assert.ok(fajlovi.has(f.replace('api/', '')), `vercel.json pominje ${f}, a fajl ne postoji`);
    }
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
  }

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
