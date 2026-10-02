/* ANDROID PAKET (sub20.apk) NASPRAM REPOZITORIJUMA.

   Zašto ovaj test postoji. APK je TWA — ljuska koja otvara sajt, pa se pri
   običnoj izmeni aplikacije NE mora praviti iznova: `app.js`, `index.html` i
   `sw.js` se povlače sa mreže, i instalirana Android aplikacija ih dobija
   istim putem kao pregledač. Zato je `versionName` ostao `1.0.0` kroz sve
   verzije aplikacije od 139 do 199, i to je ispravno.

   Ali PET stvari je zapečeno u APK pri pakovanju i one se sa sajtom mogu
   razići u tišini: adresa koja se otvara, ime pod ikonicom, sama ikonica,
   splash ekran i naziv paketa. Kvar je nevidljiv u svakom pogledu koji
   inače imaš — sajt izgleda novo, instalirana aplikacija mesecima nosi staro.

   Šta test NE hvata, pošteno rečeno: ikonicu i boje splash ekrana. Alat za
   pakovanje ih menja veličinom i ponovo kodira, pa poređenje bajtova ne bi
   značilo ništa, a poređenje „na oko" test ne ume. Ostaje ručna provera kad
   menjaš `icon-*.png` ili `theme_color`.

   Sve se čita iz samog APK-a, bez ijedne zavisnosti: mali čitač ZIP-a preko
   `node:zlib` i parser Androidovog binarnog XML-a (isti oblik `string pool`
   zaglavlja koriste i `AndroidManifest.xml` i `resources.arsc`). */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { readRepoFile, repoPath } from './repo.mjs';

/* Adresa na koju TWA pokazuje. Nije izvedena iz `manifest.json` jer su tamo
   sve putanje relativne (`start_url: "./"`) — origin nigde u repozitorijumu ne
   postoji kao konstanta. Ako ikad promeniš domen, promeni ga i ovde; test će
   pasti na svim mestima gde stara adresa preživi. */
const ORIGIN = 'https://sub-19.vercel.app';

const APK = repoPath('sub20.apk');

/* ---------- minimalni čitač ZIP-a ---------- */
function zipCitaj(buf, imena) {
  const out = {};
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;   /* End of Central Directory */
  assert.ok(e >= 0, 'sub20.apk nije ispravan ZIP (nema EOCD zapisa)');
  const broj = buf.readUInt16LE(e + 10);
  let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < broj; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'oštećen central directory u APK-u');
    const metod    = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nLen = buf.readUInt16LE(p + 28), xLen = buf.readUInt16LE(p + 30), cLen = buf.readUInt16LE(p + 32);
    const lokal = buf.readUInt32LE(p + 42);
    const ime = buf.toString('utf8', p + 46, p + 46 + nLen);
    if (imena.includes(ime)) {
      /* Dužine u lokalnom zaglavlju umeju da se razlikuju od onih u central
         directory-ju (poravnanje), pa se čitaju odatle. */
      const lnLen = buf.readUInt16LE(lokal + 26), lxLen = buf.readUInt16LE(lokal + 28);
      const d = lokal + 30 + lnLen + lxLen;
      const sirovo = buf.subarray(d, d + compSize);
      out[ime] = metod === 0 ? sirovo : inflateRawSync(sirovo);
    }
    p += 46 + nLen + xLen + cLen;
  }
  return out;
}

/* ---------- Androidov `string pool` (RES_STRING_POOL_TYPE) ---------- */
function stringPool(buf, off) {
  assert.equal(buf.readUInt16LE(off), 0x0001, 'na očekivanom mestu nije string pool');
  const size   = buf.readUInt32LE(off + 4);
  const cnt    = buf.readUInt32LE(off + 8);
  const flags  = buf.readUInt32LE(off + 16);
  const strOff = buf.readUInt32LE(off + 20);
  const utf8   = !!(flags & (1 << 8));
  const res = [];
  for (let i = 0; i < cnt; i++) {
    let p = off + strOff + buf.readUInt32LE(off + 28 + 4 * i);
    if (utf8) {
      /* dve dužine (u znakovima pa u bajtovima), svaka 1 ili 2 bajta */
      p += (buf[p] & 0x80) ? 2 : 1;
      let n = buf[p];
      if (n & 0x80) { n = ((n & 0x7f) << 8) | buf[p + 1]; p += 2; } else p += 1;
      res.push(buf.toString('utf8', p, p + n));
    } else {
      let n = buf.readUInt16LE(p); p += 2;
      if (n & 0x8000) { n = ((n & 0x7fff) << 16) | buf.readUInt16LE(p); p += 2; }
      res.push(buf.toString('utf16le', p, p + n * 2));
    }
  }
  return { strings: res, kraj: off + size };
}

/* Atributi `<manifest>` elementa iz binarnog AndroidManifest.xml. */
function manifestAtributi(am) {
  const pool = stringPool(am, 8);
  let off = pool.kraj;
  while (off < am.length - 8) {
    const typ = am.readUInt16LE(off), size = am.readUInt32LE(off + 4);
    if (size <= 0) break;
    if (typ === 0x0102 /* START_ELEMENT */ && pool.strings[am.readUInt32LE(off + 20)] === 'manifest') {
      const cnt = am.readUInt16LE(off + 28);
      const atr = {};
      let ap = off + 36;
      for (let i = 0; i < cnt; i++) {
        const aName = am.readUInt32LE(ap + 4), aRaw = am.readUInt32LE(ap + 8), aData = am.readUInt32LE(ap + 16);
        atr[pool.strings[aName]] = aRaw !== 0xFFFFFFFF ? pool.strings[aRaw] : aData;
        ap += 20;
      }
      return atr;
    }
    off += size;
  }
  assert.fail('u AndroidManifest.xml nema <manifest> elementa');
}

/* ---------- jednom pročitano, deljeno kroz testove ---------- */
const imaApk = existsSync(APK);
const fajlovi = imaApk ? zipCitaj(readFileSync(APK), ['AndroidManifest.xml', 'resources.arsc']) : {};
const atr     = imaApk ? manifestAtributi(fajlovi['AndroidManifest.xml']) : {};
const resStr  = imaApk ? stringPool(fajlovi['resources.arsc'], 12).strings : [];

const assetlinks = JSON.parse(readRepoFile('.well-known/assetlinks.json'));
const manifest   = JSON.parse(readRepoFile('manifest.json'));

describe('assetlinks.json — spremnost za Play prodavnicu', () => {
  const otisci = assetlinks[0].target.sha256_cert_fingerprints;

  test('nijedan otisak se ne ponavlja', () => {
    /* Niz sme da nosi VIŠE otisaka — tako rade uporedo verzija koju sam
       instaliraš i ona iz prodavnice (Play potpisuje svojim ključem, v.
       .well-known/README.md). Duplikat znači da je neko nalepio isti otisak
       dvaput misleći da je dodao Play-ov, pa Play verzija ostaje bez veze
       sa sajtom i dobija Chrome traku. */
    assert.equal(new Set(otisci).size, otisci.length,
      'isti otisak je upisan više puta: ' + otisci.join(', '));
  });

  test('otisak iz APK-a nije zamenjen, samo dopunjen', () => {
    /* Kad dodaš Play-ov otisak, POSTOJEĆI mora ostati — inače sideloadovana
       verzija (sub20.apk sa ovog sajta) prestane da radi preko celog ekrana
       istog trenutka kad se promena objavi. */
    assert.ok(otisci.length >= 1, 'niz otisaka je prazan');
    assert.ok(otisci.length <= 2,
      `${otisci.length} otisaka — očekuje se najviše dva (lokalni ključ i Play App Signing); ` +
      'ako namerno ima više, podigni granicu i napiši zašto');
  });
});
