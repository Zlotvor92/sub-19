/* ORIGINALNA MUZIKA ZA REEL — sintetizovana u kodu (bez uzoraka i bez tuđeg materijala), pa nema autorskih prava koja bi Instagram poslovnom nalogu
   blokirala objavu. 100 BPM u 4/4: takt traje 2,4 s, pa se promene scena (svaki 2. takt) poklapaju sa taktom. Akordi: Am – F – C – G.
   Pokretanje:  node docs/reel/audio.mjs   →   docs/reel/out/muzika.wav (44,1 kHz, stereo, 16 bit, 28,8 s) */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SR = 44100, BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4, BARS = 12, DUR = BAR * BARS;
const N = Math.round(DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N);
let seed = 20261104;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);          // MIDI → Hz
const TAU = Math.PI * 2;

/** Dodaje zvuk: fn(t) vraća uzorak (t u sekundama od početka note), env je množilac po t. */
function voice(start, len, fn, gain = 1, pan = 0) {
  const s0 = Math.round(start * SR), n = Math.round(len * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n && s0 + i < N; i++) {
    if (s0 + i < 0) continue;
    const v = fn(i / SR);
    L[s0 + i] += v * gl; R[s0 + i] += v * gr;
  }
}
const tri = (p) => 2 * Math.abs(2 * (p - Math.floor(p + 0.5))) - 1;
const sine = (f, t) => Math.sin(TAU * f * t);

/* akordi po taktu: [bas MIDI, tri tona akorda] */
const CH = { Am: [33, [57, 60, 64]], F: [29, [57, 60, 65]], C: [36, [55, 60, 64]], G: [31, [55, 59, 62]] };
const PROG = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'Am'];

for (let b = 0; b < BARS; b++) {
  const t0 = b * BAR, [bass, tones] = CH[PROG[b]];
  const last = b === BARS - 1;
  /* podloga: tri tona, spor početak, topao (sinus + trougao, blago razdešeno) */
  for (const m of tones) for (const det of [-0.12, 0.12]) {
    const f = hz(m) * Math.pow(2, det / 12);
    voice(t0, BAR + 0.4, (t) => {
      const env = Math.min(1, t / 0.45) * (last ? Math.exp(-t * 0.9) : Math.exp(-Math.max(0, t - BAR * 0.7) * 3));
      return (sine(f, t) * 0.6 + tri(f * t) * 0.25) * env;
    }, 0.055, det > 0 ? 0.35 : -0.35);
  }
  if (b >= 1) {
    /* bas: prvi udarac i „i" posle drugog; kratak, okrugao */
    for (const [beat, len] of [[0, BEAT * 1.4], [1.5, BEAT * 1.0], ...(b % 2 ? [[3, BEAT * 0.8]] : [])]) {
      if (last && beat > 0) continue;
      const f = hz(bass);
      voice(t0 + beat * BEAT, len, (t) => {
        const env = Math.min(1, t / 0.01) * Math.exp(-t * 3.2);
        return (sine(f, t) + 0.35 * sine(f * 2, t) + 0.12 * sine(f * 3, t)) * env;
      }, 0.34);
    }
  }
  if (b >= 1 && !last) {
    /* kick na svaki udarac */
    for (let k = 0; k < 4; k++) voice(t0 + k * BEAT, 0.3, (t) => {
      const f = 46 + 90 * Math.exp(-t * 32);
      return Math.sin(TAU * (46 * t + (90 / 32) * (1 - Math.exp(-t * 32)))) * Math.exp(-t * 11) + 0 * f;
    }, 0.62);
  }
  if (b >= 2 && !last) {
    /* klap na 2 i 4: šum sa brzim padom + kratak ton */
    for (const k of [1, 3]) { let lp = 0; voice(t0 + k * BEAT, 0.22, (t) => {
      const n = rnd() * 2 - 1; lp += (n - lp) * 0.55;
      return ((n - lp) * 0.9 + sine(190, t) * 0.25) * Math.exp(-t * 26);
    }, 0.3, 0.1); }
    /* šejker: osmine, jači na „i" */
    for (let k = 0; k < 8; k++) { let prev = 0; voice(t0 + k * BEAT / 2, 0.06, (t) => {
      const n = rnd() * 2 - 1; const v = n - prev; prev = n; return v * Math.exp(-t * 70);
    }, k % 2 ? 0.14 : 0.08, k % 2 ? 0.3 : -0.3); }
  }
  if (b >= 4 && b <= 10) {
    /* arpeđo: šesnaestine kroz akord (oktava gore), kratke trzaje, naizmenično levo/desno */
    for (let k = 0; k < 16; k++) {
      const m = tones[[0, 1, 2, 1][k % 4]] + 12 + (k % 8 === 7 ? 12 : 0);
      const f = hz(m);
      voice(t0 + k * BEAT / 4, 0.22, (t) => tri(f * t) * Math.exp(-t * 17) * Math.min(1, t / 0.004), 0.085 * (b >= 8 ? 1.15 : 1), k % 2 ? 0.55 : -0.55);
    }
  }
}

/* uvod: podizanje šuma pred prvi takt scene sa prozorom + udar */
{
  const t0 = BAR - 1.1; let lp = 0;
  voice(t0, 1.1, (t) => {
    const n = rnd() * 2 - 1; const a = Math.min(1, t / 1.1);
    lp += (n - lp) * (0.04 + 0.5 * a * a);
    return lp * a * a * 1.6;
  }, 0.2);
  voice(BAR, 1.2, (t) => {
    const n = (rnd() * 2 - 1) * Math.exp(-t * 7);
    return n * 0.5 + Math.sin(TAU * (34 * t + 2.1 * (1 - Math.exp(-t * 20)))) * Math.exp(-t * 3);
  }, 0.55);
}
/* kraj: završni udarac na prvom udarcu poslednjeg takta */
voice(BAR * (BARS - 1), 1.4, (t) => Math.sin(TAU * 41 * t) * Math.exp(-t * 3.5), 0.5);

/* master: meko ograničenje, ulaz/izlaz, normalizacija na −1,2 dBFS */
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, g = Math.min(1, t / 0.25) * Math.min(1, (DUR - t) / 1.4);
  L[i] = Math.tanh(L[i] * 1.15) * g; R[i] = Math.tanh(R[i] * 1.15) * g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.87 / peak;
const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * norm * 32767))), i * 4);
  pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * norm * 32767))), i * 4 + 2);
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
mkdirSync(join(HERE, 'out'), { recursive: true });
writeFileSync(join(HERE, 'out', 'muzika.wav'), Buffer.concat([h, pcm]));
console.log(`✓ muzika.wav ${DUR.toFixed(1)} s, vrh ${(20 * Math.log10(0.87)).toFixed(1)} dBFS`);
