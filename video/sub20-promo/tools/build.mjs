/* Sklapa index.html iz src/ (šablon + stil + timeline) i tools/timing.mjs.
   Ubacuje: CSS, vreme (window.__SUB20_T), trajanje, <audio> trake (naracija, muzika, efekti) i sličice za 3D prolet. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, timing } from './timing.mjs';
import { copyFileSync } from 'node:fs';

const T = timing();
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
let html = read('src/index.tpl.html');
const dur = T.total.toFixed(3);

const audio = [];
for (const s of T.scenes) {
  if (!s.audio) continue;
  audio.push(`      <audio id="vo-${s.n}" src="${s.audio}" data-start="${s.voStart.toFixed(3)}" data-duration="${s.voDur.toFixed(3)}" data-track-index="10" data-volume="1"></audio>`);
}
if (existsSync(join(ROOT, 'audio/music.wav'))) audio.push(`      <audio id="bgm" src="audio/music.wav" data-start="0" data-duration="${dur}" data-track-index="11" data-volume="1"></audio>`);
if (existsSync(join(ROOT, 'audio/sfx.wav'))) audio.push(`      <audio id="sfx" src="audio/sfx.wav" data-start="0" data-duration="${dur}" data-track-index="12" data-volume="1"></audio>`);

const thumbs = [];
for (let i = 1; i <= 11; i++) thumbs.push(`<div class="thumb"><img src="assets/thumbs/s${i}.jpg" alt="" /></div>`);

html = html
  .replace('/*CSS*/', read('src/style.css'))
  .replaceAll('__DURATION__', dur)
  .replace('/*TIMING*/', JSON.stringify(T))
  .replace('<!--AUDIO-->', audio.join('\n'))
  .replace('<!--THUMBS-->', thumbs.join(''));
writeFileSync(join(ROOT, 'index.html'), html);
copyFileSync(join(ROOT, 'src/film.js'), join(ROOT, 'assets/film.js'));
console.log(`index.html: ${dur} s, ${audio.length} audio traka`);
