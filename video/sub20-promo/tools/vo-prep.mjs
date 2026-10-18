/* Priprema izabranih snimaka naracije: audio/vo/raw/lineNN.mp3 → audio/vo/lineNN.wav (mono, 44,1 kHz, −16 LUFS)
   i granice govora u trim.json (tišina na početku/kraju se preskače preko data-media-start).
   Upotreba: node tools/vo-prep.mjs 01 03 06   (bez argumenata: samo ispiše izmerene granice za sve redove) */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './timing.mjs';

const VO = join(ROOT, 'audio/vo');
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });

function toWav(n) {
  const src = join(VO, `raw/line${n}.mp3`);
  const out = join(VO, `line${n}.wav`);
  /* dva prolaza loudnorm: merenje (JSON na stderr), pa linearno pojačanje na −16 LUFS */
  const err = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', src, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']).stderr.toString();
  const j = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1));
  const af = `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  ff(['-y', '-i', src, '-af', `${af},aresample=44100`, '-ac', '1', '-c:a', 'pcm_s16le', out]);
  return out;
}

/* početak/kraj govora: prvi i poslednji 10 ms okvir iznad −40 dB u odnosu na vrh fajla (rezerva podešena da se poklopi sa ranijim trim.json) */
export function speechBounds(file) {
  const buf = ff(['-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-']);
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  const H = 160, thr = peak * 10 ** (-40 / 20);
  const loud = [];
  for (let i = 0; i + H <= x.length; i += H) { let e = 0; for (let j = 0; j < H; j++) e += x[i + j] ** 2; loud.push(Math.sqrt(e / H) > thr); }
  const a = loud.indexOf(true), b = loud.lastIndexOf(true);
  const r = (v) => +v.toFixed(2);
  return { start: r(Math.max(0, a * 0.01 - 0.03)), end: r(Math.min(x.length / 16000, (b + 1) * 0.01 + 0.09)), file: r(x.length / 16000) };
}

const lines = process.argv.slice(2);
const trimFile = join(VO, 'trim.json');
const trim = JSON.parse(readFileSync(trimFile, 'utf8'));
if (!lines.length) {
  for (let i = 1; i <= 12; i++) { const n = String(i).padStart(2, '0'); console.log(`s${i}`, JSON.stringify(trim[`s${i}`]), '→', JSON.stringify(speechBounds(join(VO, `line${n}.wav`)))); }
}
else {
  for (const n of lines) { const wav = toWav(n); trim[`s${+n}`] = speechBounds(wav); console.log(`s${+n}`, JSON.stringify(trim[`s${+n}`])); }
  writeFileSync(trimFile, JSON.stringify(trim, null, 1) + '\n');
}
