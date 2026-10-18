/* Zajednički alati za sintezu zvuka: stereo bafer, PRNG sa semenom, filteri, upis 16-bitnog WAV-a. */
import { writeFileSync } from 'node:fs';

export const SR = 44100;
export const TAU = Math.PI * 2;
export const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function rng(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buffer(sec) {
  const n = Math.max(1, Math.round(sec * SR));
  return { n, L: new Float32Array(n), R: new Float32Array(n) };
}

/** dodaje glas: fn(t) → uzorak; gain i pan (-1..1) */
export function add(buf, start, len, fn, gain = 1, pan = 0) {
  const s0 = Math.round(start * SR), n = Math.round(len * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4), gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n; i++) {
    const k = s0 + i;
    if (k < 0) continue;
    if (k >= buf.n) break;
    const v = fn(i / SR, i);
    buf.L[k] += v * gl; buf.R[k] += v * gr;
  }
}

/* filteri sa stanjem (jedan po glasu) */
export const onePoleLP = (fc) => { const a = Math.exp((-TAU * fc) / SR); let y = 0; return (x) => (y = (1 - a) * x + a * y); };
export const onePoleHP = (fc) => { const lp = onePoleLP(fc); return (x) => x - lp(x); };
export function bandpass() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, fc, q = 1.2) => {
    const w = (TAU * Math.min(fc, SR * 0.45)) / SR, al = Math.sin(w) / (2 * q), c = Math.cos(w);
    const b0 = al, b2 = -al, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

export function normalize(buf, peakDb = -1) {
  let p = 0;
  for (let i = 0; i < buf.n; i++) p = Math.max(p, Math.abs(buf.L[i]), Math.abs(buf.R[i]));
  const g = p > 0 ? Math.pow(10, peakDb / 20) / p : 1;
  for (let i = 0; i < buf.n; i++) { buf.L[i] *= g; buf.R[i] *= g; }
}

export function writeWav(path, buf) {
  const pcm = Buffer.alloc(buf.n * 4);
  for (let i = 0; i < buf.n; i++) {
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf.L[i] * 32767))), i * 4);
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf.R[i] * 32767))), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  writeFileSync(path, Buffer.concat([h, pcm]));
}
