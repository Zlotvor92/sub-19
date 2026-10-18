/* ZVUČNI EFEKTI — sintetizovani u kodu (bez uzoraka, bez tuđeg materijala).
   sfxCues(T) daje listu {id, file, t, len, vol} iz zajedničkih vremena (timing.mjs → T.ev); `node tools/sfx.mjs` piše WAV fajlove. */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, TAU, add, bandpass, buffer, normalize, onePoleHP, onePoleLP, rng, writeWav } from './wav.mjs';

const LEN = { popbig: 0.34, pop: 0.12, gulp: 0.42, drip: 0.16, whoosh: 0.55, whooshlong: 1.7, swipe: 0.28, scribble: 0.5, stamp: 0.26, tick: 0.04, step: 0.06, chime: 1.3, boing: 0.24, suction: 1.3, sparkle: 0.7 };

export function sfxCues(T) {
  const e = T.ev, out = [];
  const c = (type, t, vol) => out.push({ id: `sfx-${String(out.length + 1).padStart(2, '0')}-${type}`, file: `audio/sfx/${type}.wav`, t: Math.max(0, t), len: LEN[type], vol });
  c('popbig', e.land - 0.01, 0.9); c('pop', e.land2, 0.35);
  c('pop', e.gap, 0.3);
  for (let i = 0; i < 9; i++) c('step', e.run + i * 0.11, 0.3);
  c('drip', e.melt + 0.05, 0.55); c('drip', e.melt + 0.3, 0.4);
  c('drip', e.chunkA + 0.6, 0.5); c('pop', e.chunkA + 0.64, 0.35);
  c('boing', e.hop1, 0.3); c('boing', e.hop2, 0.3);
  c('gulp', e.bite, 0.85);
  c('suction', e.vortex, 0.45); c('pop', e.snap + 0.1, 0.5);
  for (let i = 0; i < 6; i++) c('tick', e.clock + 0.3 + i * 0.5, 0.35);
  e.cards.forEach((t) => c('swipe', t, 0.3));
  c('sparkle', e.reveal + 0.2, 0.45);
  c('whoosh', e.pan - 0.05, 0.8);
  c('scribble', e.circle8, 0.4);
  c('swipe', e.push9, 0.35);
  c('pop', e.fly9 + 0.7, 0.45);
  c('scribble', e.check9, 0.3);
  for (let i = 0; i < 7; i++) c('tick', e.rows10 + i * 0.13, 0.22);
  c('scribble', e.circle10, 0.4);
  c('boing', e.peek10, 0.25);
  c('whoosh', e.zoom11, 0.7);
  c('stamp', e.stamp11 + 0.26, 0.8);
  for (let i = 0; i < 3; i++) c('pop', e.ret12 + i * 0.32 + 0.48, 0.55);
  c('chime', e.grow12 + 0.1, 0.45);
  c('stamp', e.stamp12 + 0.26, 0.8);
  c('whooshlong', e.fly - 0.1, 0.6);
  c('pop', e.lockup + 0.42, 0.5); c('chime', e.lockup + 0.62, 0.5);
  return out;
}

function synth(type) {
  const r = rng(type.length * 977 + 13);
  const b = buffer(LEN[type]);
  const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t / d);
  switch (type) {
    case 'popbig': {
      add(b, 0, LEN.popbig, (t) => Math.sin(TAU * (60 * t + (110 / 22) * (1 - Math.exp(-t * 22)))) * env(t, 0.002, 0.09) * 1.2);
      add(b, 0, 0.1, (t) => Math.sin(TAU * (380 * t + (500 / 40) * (1 - Math.exp(-t * 40)))) * env(t, 0.001, 0.025) * 0.6);
      const lp = onePoleLP(2500); add(b, 0, 0.03, (t) => lp(r() * 2 - 1) * env(t, 0.0005, 0.006) * 0.6);
      break;
    }
    case 'pop':
      add(b, 0, LEN.pop, (t) => Math.sin(TAU * (300 * t + (700 / 45) * (1 - Math.exp(-t * 45)))) * env(t, 0.001, 0.03));
      break;
    case 'gulp': {
      add(b, 0, 0.26, (t) => Math.sin(TAU * (120 * t + (140 / 9) * (1 - Math.exp(-t * 9)))) * (0.6 + 0.4 * Math.sin(TAU * 22 * t)) * env(t, 0.01, 0.1));
      add(b, 0.22, 0.2, (t) => Math.sin(TAU * (260 * t - (90 / 15) * (1 - Math.exp(-t * 15)))) * env(t, 0.003, 0.05) * 0.9);
      break;
    }
    case 'drip':
      add(b, 0, LEN.drip, (t) => Math.sin(TAU * (900 * t + (1700 / 30) * (1 - Math.exp(-t * 30)))) * env(t, 0.001, 0.035));
      break;
    case 'whoosh': case 'whooshlong': case 'swipe': {
      const L = LEN[type], bp = bandpass(), bp2 = bandpass();
      add(b, 0, L, (t) => {
        const p = t / L, a = Math.sin(Math.PI * Math.pow(p, 0.7)) ** 2;
        const fc = 300 + 2600 * Math.sin(Math.PI * p);
        const n = r() * 2 - 1;
        return (bp(n, fc, 0.9) * 0.9 + bp2(n, fc * 1.9, 1.5) * 0.4) * a * 2.2;
      }, 1, 0);
      break;
    }
    case 'scribble': {
      const hp = onePoleHP(2500), bp = bandpass();
      add(b, 0, LEN.scribble, (t) => { const stroke = 0.5 + 0.5 * Math.sin(TAU * 11 * t + Math.sin(TAU * 3 * t)); return bp(hp(r() * 2 - 1), 4200, 0.8) * stroke * Math.min(1, t / 0.03) * Math.min(1, (LEN.scribble - t) / 0.08) * 1.4; });
      break;
    }
    case 'stamp': {
      const lp = onePoleLP(900);
      add(b, 0, LEN.stamp, (t) => (Math.sin(TAU * (75 * t + (90 / 30) * (1 - Math.exp(-t * 30)))) * env(t, 0.001, 0.06) + lp(r() * 2 - 1) * env(t, 0.0005, 0.02) * 1.4));
      break;
    }
    case 'tick': add(b, 0, LEN.tick, (t) => Math.sin(TAU * 2400 * t) * env(t, 0.0003, 0.006)); break;
    case 'step': { const lp = onePoleLP(700); add(b, 0, LEN.step, (t) => (lp(r() * 2 - 1) * 1.6 + Math.sin(TAU * 140 * t) * 0.5) * env(t, 0.001, 0.015)); break; }
    case 'chime':
      for (const [f, g] of [[1046.5, 0.5], [1568, 0.35], [2093, 0.18], [2637, 0.1]]) add(b, 0, LEN.chime, (t) => Math.sin(TAU * f * t) * env(t, 0.003, 0.32) * g);
      break;
    case 'boing': add(b, 0, LEN.boing, (t) => Math.sin(TAU * (260 * t + (240 / 12) * (1 - Math.exp(-t * 12))) + 0.8 * Math.sin(TAU * 18 * t)) * env(t, 0.002, 0.07)); break;
    case 'suction': {
      const bp = bandpass();
      add(b, 0, LEN.suction, (t) => { const p = t / LEN.suction; return bp(r() * 2 - 1, 1800 - 1400 * p, 3) * Math.sin(Math.PI * p) * (0.7 + 0.3 * Math.sin(TAU * 7 * t)) * 2.4; });
      break;
    }
    case 'sparkle':
      [2637, 3136, 3951, 3520].forEach((f, i) => add(b, i * 0.07, 0.4, (t) => Math.sin(TAU * f * t) * env(t, 0.002, 0.09) * 0.4, 1, i % 2 ? 0.4 : -0.4));
      break;
  }
  normalize(b, -1.5);
  return b;
}

/* svi efekti smešani u jednu traku dužine videa (audio/sfx.wav), na vremenima iz sfxCues */
export function mixSfx(T) {
  const out = buffer(T.total);
  const cache = {};
  for (const c of sfxCues(T)) {
    const type = c.file.replace(/^.*\/|\.wav$/g, '');
    const src = (cache[type] ??= synth(type));
    const s0 = Math.round(c.t * SR);
    for (let i = 0; i < src.n && s0 + i < out.n; i++) { out.L[s0 + i] += src.L[i] * c.vol; out.R[s0 + i] += src.R[i] * c.vol; }
  }
  let p = 0;
  for (let i = 0; i < out.n; i++) p = Math.max(p, Math.abs(out.L[i]), Math.abs(out.R[i]));
  if (p > 0.95) for (let i = 0; i < out.n; i++) { out.L[i] *= 0.95 / p; out.R[i] *= 0.95 / p; }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const dir = join(root, 'audio/sfx');
  mkdirSync(dir, { recursive: true });
  for (const type of Object.keys(LEN)) writeWav(join(dir, `${type}.wav`), synth(type));
  const { timing } = await import('./timing.mjs');
  const T = timing();
  writeWav(join(root, 'audio/sfx.wav'), mixSfx(T));
  console.log('✓ sfx:', Object.keys(LEN).length, 'tipova +', sfxCues(T).length, 'efekata u audio/sfx.wav', `(${T.total.toFixed(2)} s)`);
}
