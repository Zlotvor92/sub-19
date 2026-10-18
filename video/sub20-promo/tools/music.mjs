/* ORIGINALNA MUZIKA — sintetizovana u kodu (bez uzoraka, bez tuđeg materijala). Lagana, razigrana, C-dur, 104 BPM.
   Aranžman prati scene iz timing.mjs: uvod (marimba) → kradljivci (bas + perkusija) → ponoć (filtrirano, bez bubnja)
   → otkrivanje (podizanje) → proizvod (pun ritam) → oporavak (pola tempa, podloga) → rešenje (puno + završni akord).
   Ducking: −8 dB ispod svakog reda naracije (napad 0,12 s, otpuštanje 0,35 s). Miks za telefon: bas ima i više harmonike.
   Pokretanje: node tools/music.mjs → audio/music.wav */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SR, TAU, add, buffer, hz, normalize, onePoleHP, onePoleLP, rng, writeWav } from './wav.mjs';
import { ROOT, timing } from './timing.mjs';

const T = timing();
const DUR = T.total;
const B = buffer(DUR);
const r = rng(104);
const BPM = 104, BEAT = 60 / BPM, BAR = BEAT * 4;
const sc = (n) => T.scenes[n - 1];
/* sekcija u trenutku t */
const sect = (t) => {
  if (t < sc(3).start) return 'intro';
  if (t < sc(6).start) return 'thief';
  if (t < sc(7).start) return 'night';
  if (t < sc(8).start) return 'rise';
  if (t < sc(11).start) return 'groove';
  if (t < sc(12).start) return 'moon';
  if (t < T.outro.lockup) return 'finale';
  return 'end';
};
const tri = (p) => 2 * Math.abs(2 * (p - Math.floor(p + 0.5))) - 1;
const sine = (f, t) => Math.sin(TAU * f * t);

const CH = { C: [36, [60, 64, 67]], G: [31, [59, 62, 67]], Am: [33, [60, 64, 69]], F: [29, [60, 65, 69]] };
const PROG = ['C', 'G', 'Am', 'F'];

/* marimba: osnovni + 4× i 10× parcijal, brzo gašenje */
const marimba = (f) => (t) => (sine(f, t) + 0.35 * sine(f * 3.98, t) * Math.exp(-t * 18) + 0.12 * sine(f * 9.9, t) * Math.exp(-t * 40)) * Math.exp(-t * 6) * Math.min(1, t / 0.002);
const pluckBass = (f) => (t) => (sine(f, t) + 0.55 * sine(2 * f, t) + 0.3 * sine(3 * f, t) + 0.15 * tri(4 * f * t)) * Math.exp(-t * 4.5) * Math.min(1, t / 0.006);

const nBars = Math.ceil(DUR / BAR) + 1;
for (let b = 0; b < nBars; b++) {
  const t0 = b * BAR;
  if (t0 > DUR) break;
  const s = sect(t0 + 0.01);
  const [bass, tones] = CH[PROG[b % 4]];
  const night = s === 'night' || s === 'moon';
  /* podloga (uvek, tiha; noću nosi scenu) */
  for (const m of tones) for (const det of [-0.1, 0.1]) {
    const f = hz(m) * Math.pow(2, det / 12);
    const lp = onePoleLP(night ? 900 : 1800);
    add(B, t0, BAR + 0.3, (t) => lp((sine(f, t) * 0.6 + sine(f * 2, t) * 0.2 + tri(f * t) * 0.2) * Math.min(1, t / 0.4) * Math.exp(-Math.max(0, t - BAR * 0.75) * 4)), night ? 0.075 : 0.05, det > 0 ? 0.3 : -0.3);
  }
  /* marimba arpeđo: osmine (intro, kradljivci, proizvod, finale); noću retko i oktavu više */
  if (s !== 'rise') {
    const pattern = [0, 1, 2, 1, 2, 3, 2, 1];
    const step = night ? 2 : 1;
    for (let k = 0; k < 8; k += step) {
      const m = (k === 5 ? tones[2] + 12 : tones[pattern[k] % 3]) + 12 + (night ? 12 : 0);
      add(B, t0 + (k * BEAT) / 2, 0.6, marimba(hz(m)), night ? 0.09 : 0.16, k % 2 ? 0.45 : -0.45);
    }
  }
  /* razigrani kontra-motiv u sceni kradljivaca: „pizzicato" na 3 i „i" */
  if (s === 'thief' || s === 'finale') {
    for (const [beat, m] of [[2.5, tones[2] + 12], [3.5, tones[1] + 12]]) add(B, t0 + beat * BEAT, 0.25, (t) => tri(hz(m) * t) * Math.exp(-t * 22) * Math.min(1, t / 0.002), 0.12, 0.2);
  }
  /* bas */
  if (s === 'thief' || s === 'groove' || s === 'finale' || s === 'intro') {
    const hits = s === 'intro' ? [[0, 1.6]] : [[0, 1.2], [1.5, 0.8], [2.5, 0.6], [3, 0.9]];
    for (const [beat, len] of hits) add(B, t0 + beat * BEAT, len * BEAT, pluckBass(hz(bass + 12)), s === 'intro' ? 0.18 : 0.26);
  }
  if (s === 'moon') add(B, t0, BAR, pluckBass(hz(bass + 12)), 0.16);
  /* bubanj: meki kick, šejker, klap */
  if (s === 'thief' || s === 'groove' || s === 'finale') {
    for (let k = 0; k < 4; k++) add(B, t0 + k * BEAT, 0.28, (t) => Math.tanh(Math.sin(TAU * (52 * t + (150 / 38) * (1 - Math.exp(-t * 38)))) * Math.exp(-t * 10) * 1.6) * 0.8 + sine(1500, t) * Math.exp(-t * 300) * 0.25, 0.42);
    for (const k of [1, 3]) { const hp = onePoleHP(900); add(B, t0 + k * BEAT, 0.18, (t) => hp(r() * 2 - 1) * Math.exp(-t * 32), 0.16, 0.1); }
  }
  if (s !== 'rise' && s !== 'end') {
    for (let k = 0; k < 8; k++) { const hp = onePoleHP(5000); add(B, t0 + (k * BEAT) / 2, 0.06, (t) => hp(r() * 2 - 1) * Math.exp(-t * 80), (k % 2 ? 0.1 : 0.05) * (night ? 0.5 : 1), k % 2 ? 0.35 : -0.35); }
  }
}
/* podizanje pred otkrivanje: šum + uzlazni ton do početka scene 8 */
{
  const t0 = sc(7).start, len = sc(8).start - t0;
  const lp = onePoleLP(3000);
  add(B, t0, len, (t) => { const p = t / len; return lp(r() * 2 - 1) * p * p * 0.9 + sine(220 * Math.pow(2, p * 2), t) * p * 0.25; }, 0.35);
  add(B, sc(8).start - 0.05, 1.2, (t) => Math.sin(TAU * (40 * t + 2 * (1 - Math.exp(-t * 18)))) * Math.exp(-t * 3) + (r() * 2 - 1) * Math.exp(-t * 9) * 0.3, 0.5);
}
/* završni akord na lockupu */
{
  const t0 = T.outro.lockup + 0.6;
  for (const m of [48, 55, 60, 64, 67, 72]) add(B, t0, DUR - t0, (t) => (sine(hz(m), t) * 0.7 + 0.2 * sine(hz(m) * 2, t)) * Math.min(1, t / 0.02) * Math.exp(-t * 0.9), 0.07, (m % 2 ? 0.3 : -0.3));
  for (const m of [72, 76, 79]) add(B, t0, 1.2, marimba(hz(m)), 0.18);
}

/* meki limiter, pa ducking ispod naracije i ulaz/izlaz */
normalize(B, -3);
const duck = new Float32Array(B.n).fill(1);
const DUCK = Math.pow(10, -8 / 20);
for (const s of T.scenes) {
  const a = s.voStart - 0.08, e = s.voStart + s.voDur + 0.05;
  for (let i = Math.max(0, Math.floor((a - 0.12) * SR)); i < Math.min(B.n, Math.ceil((e + 0.35) * SR)); i++) {
    const t = i / SR;
    let g = 1;
    if (t < a) g = 1 - (1 - DUCK) * ((t - (a - 0.12)) / 0.12);
    else if (t <= e) g = DUCK;
    else g = DUCK + (1 - DUCK) * ((t - e) / 0.35);
    duck[i] = Math.min(duck[i], g);
  }
}
for (let i = 0; i < B.n; i++) {
  const t = i / SR, g = Math.min(1, t / 0.15) * Math.min(1, (DUR - t) / 1.6) * duck[i];
  B.L[i] = Math.tanh(B.L[i] * 1.2) * g; B.R[i] = Math.tanh(B.R[i] * 1.2) * g;
}
normalize(B, -6);
mkdirSync(join(ROOT, 'audio'), { recursive: true });
writeWav(join(ROOT, 'audio/music.wav'), B);
console.log(`✓ audio/music.wav ${DUR.toFixed(2)} s, ${BPM} BPM`);
