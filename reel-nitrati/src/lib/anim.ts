import {Easing, interpolate} from 'remotion';
import timeline from '../timeline.json';

export const FPS = timeline.fps;
export const cue = timeline.cues as Record<string, number>;
export const sceneOf = (id: number) => timeline.scenes[id - 1];

/** Sekunde na globalnoj liniji -> lokalni frejm scene. */
export const lf = (sceneId: number, seconds: number) => Math.round((seconds - sceneOf(sceneId).start) * FPS);

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.55, 0, 1, 0.45);
export const easeSoft = Easing.bezier(0.33, 0, 0.2, 1);

/** Interpolacija 0..1 između dva frejma sa zadatim easingom. */
export const prog = (frame: number, from: number, dur: number, ease = easeOut) =>
  interpolate(frame, [from, from + Math.max(1, dur)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ulaz + izlaz (0..1..0). */
export const inOut = (frame: number, inStart: number, inDur: number, outStart: number, outDur: number, ease = easeOut) =>
  Math.min(prog(frame, inStart, inDur, ease), 1 - prog(frame, outStart, outDur, easeInOut));

/** Deterministički pseudo-slučajan broj iz semena. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

/** Periodična Catmull-Rom interpolacija ključnih vrednosti na fazi 0..1. */
export const periodic = (keys: number[], phase: number) => {
  const n = keys.length;
  const p = (((phase % 1) + 1) % 1) * n;
  const i = Math.floor(p);
  const t = p - i;
  const k = (j: number) => keys[((j % n) + n) % n];
  const p0 = k(i - 1), p1 = k(i), p2 = k(i + 1), p3 = k(i + 2);
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
