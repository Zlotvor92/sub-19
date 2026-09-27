/* Ikonica obaveštenja na Androidu.

   Android ikonicu u statusnoj traci (Web Push `badge`, a u TWA paketu
   `ic_notification_icon`) crta kao MASKU: uzima samo providnost piksela, boju
   baca. Puna ikonica u boji (icon-128 je 97% neprozirna) zato izađe kao bela
   mrlja. Ovde se proverava da su bedž i monochrome ikonica bela figura na
   providnom — PNG se dekodira bez biblioteka (zlib iz Node-a). */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const koren = new URL('../', import.meta.url);
const procitaj = f => readFileSync(new URL(f, koren));

function png(f) {
  const b = procitaj(f);
  let o = 8, w, h, tip, dub; const idat = [];
  while (o < b.length) {
    const n = b.readUInt32BE(o), t = b.toString('latin1', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); dub = d[8]; tip = d[9]; assert.equal(d[12], 0, `${f}: interlace`); }
    if (t === 'IDAT') idat.push(d);
    o += 12 + n;
  }
  assert.equal(tip, 6, `${f}: mora biti RGBA`); assert.equal(dub, 8);
  const raw = inflateSync(Buffer.concat(idat)), bpp = 4, red = w * bpp, px = Buffer.alloc(h * red);
  for (let y = 0; y < h; y++) {
    const f0 = raw[y * (red + 1)], src = raw.subarray(y * (red + 1) + 1, (y + 1) * (red + 1));
    for (let x = 0; x < red; x++) {
      const a = x >= bpp ? px[y * red + x - bpp] : 0, b2 = y ? px[(y - 1) * red + x] : 0,
        c = x >= bpp && y ? px[(y - 1) * red + x - bpp] : 0;
      let v = src[x];
      if (f0 === 1) v += a; else if (f0 === 2) v += b2; else if (f0 === 3) v += (a + b2) >> 1;
      else if (f0 === 4) { const p = a + b2 - c, pa = Math.abs(p - a), pb = Math.abs(p - b2), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b2 : c; }
      px[y * red + x] = v & 255;
    }
  }
  return { w, h, px };
}

function jednobojna(f) {
  const { w, h, px } = png(f);
  let providno = 0, pune = 0;
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, a] = px.subarray(i * 4, i * 4 + 4);
    if (a === 0) providno++;
    if (a > 200) { pune++; assert.ok(r > 240 && g > 240 && b > 240, `${f}: neprovidan piksel nije beo (${r},${g},${b})`); }
  }
  return { w, h, providno: providno / (w * h), pune: pune / (w * h) };
}

describe('Ikonica obaveštenja (Android)', () => {
  test('sw.js koristi jednobojni bedž, ne ikonicu u boji', () => {
    const sw = procitaj('sw.js').toString();
    assert.match(sw, /badge:\s*'\.\/badge-96\.png'/);
    assert.match(sw, /ASSETS = \[[^\]]*'\.\/badge-96\.png'/);
  });

  test('bedž: bela figura na providnom, 96×96', () => {
    const r = jednobojna('badge-96.png');
    assert.equal(r.w, 96); assert.equal(r.h, 96);
    assert.ok(r.providno > 0.4, `samo ${Math.round(r.providno * 100)}% providno — Android bi nacrtao mrlju`);
    assert.ok(r.pune > 0.15, 'figura je premala da se vidi');
  });

  test('manifest ima monochrome ikonicu (PWABuilder je koristi za ikonicu obaveštenja u APK-u)', () => {
    const m = JSON.parse(procitaj('manifest.json').toString());
    const mono = m.icons.filter(i => i.purpose === 'monochrome');
    assert.equal(mono.length, 1);
    const r = jednobojna(mono[0].src.replace(/^\.\//, ''));
    assert.equal(`${r.w}x${r.h}`, mono[0].sizes);
    assert.ok(r.providno > 0.4);
  });
});
