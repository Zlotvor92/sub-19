import React from 'react';
import {C} from '../theme';
import {periodic} from '../lib/anim';

/*
 * Stilizovan 2D trkač (sagitalni prikaz) sa ciklusom trčanja izvedenim iz
 * tipičnih krivih uglova kuka, kolena i skočnog zgloba tokom trčanja.
 * Faza 0 = kontakt desnog stopala sa podlogom.
 */

const HIP = [28, 18, 6, -6, -14, -6, 14, 32, 40, 36];
const KNEE = [14, 32, 40, 28, 22, 70, 104, 112, 76, 30];
const ANKLE = [0, 10, 16, 6, -24, -10, 0, 4, 6, 3];

const P = {
  head: 0.062,
  neck: 0.045,
  torso: 0.29,
  thigh: 0.245,
  shank: 0.245,
  upper: 0.165,
  fore: 0.135,
  hipH: 0.53,
};

type V = {x: number; y: number};
const dir = (deg: number): V => {
  const r = (deg * Math.PI) / 180;
  return {x: Math.sin(r), y: Math.cos(r)};
};
const add = (a: V, b: V, s = 1): V => ({x: a.x + b.x * s, y: a.y + b.y * s});

/** Konveksni omotač dva kruga (sužavajući ud). */
export const capsule = (a: V, ra: number, b: V, rb: number) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.max(1e-3, Math.hypot(dx, dy));
  const th = Math.atan2(dy, dx);
  const al = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / d)));
  const pa1 = {x: a.x + ra * Math.cos(th + al), y: a.y + ra * Math.sin(th + al)};
  const pa2 = {x: a.x + ra * Math.cos(th - al), y: a.y + ra * Math.sin(th - al)};
  const pb1 = {x: b.x + rb * Math.cos(th + al), y: b.y + rb * Math.sin(th + al)};
  const pb2 = {x: b.x + rb * Math.cos(th - al), y: b.y + rb * Math.sin(th - al)};
  const largeB = al > Math.PI / 2 ? 1 : 0;
  const largeA = al < Math.PI / 2 ? 1 : 0;
  const f = (n: number) => n.toFixed(2);
  return `M${f(pa1.x)},${f(pa1.y)} L${f(pb1.x)},${f(pb1.y)} A${f(rb)},${f(rb)} 0 ${largeB} 0 ${f(pb2.x)},${f(pb2.y)} L${f(pa2.x)},${f(pa2.y)} A${f(ra)},${f(ra)} 0 ${largeA} 0 ${f(pa1.x)},${f(pa1.y)} Z`;
};

const leg = (hip: V, phase: number, h: number) => {
  const hf = periodic(HIP, phase);
  const kf = periodic(KNEE, phase);
  const an = periodic(ANKLE, phase);
  const knee = add(hip, dir(hf), P.thigh * h);
  const shankA = hf - kf;
  const ankle = add(knee, dir(shankA), P.shank * h);
  const fA = shankA + 90 + an;
  const fd = dir(fA);
  const down = {x: -fd.y, y: fd.x};
  const heel = add(add(ankle, fd, -0.035 * h), down, 0.03 * h);
  const toe = add(add(ankle, fd, 0.115 * h), down, 0.026 * h);
  return {knee, ankle, heel, toe};
};

const TOE_OFF = 0.38;
const smooth = (t: number) => t * t * (3 - 2 * t);

export const runnerPose = (phase: number, h: number) => {
  const hip0 = {x: 0, y: 0};
  const pf = ((phase % 1) + 1) % 1;
  const R = leg(hip0, pf, h);
  const L = leg(hip0, pf + 0.5, h);
  const low = (l: ReturnType<typeof leg>) => Math.max(l.heel.y, l.toe.y) + 0.014 * h;
  const lowAt = (p: number) => low(leg(hip0, p, h));
  let ext: number;
  let lift = 0;
  if (pf < TOE_OFF) {
    ext = lowAt(pf);
  } else if (pf < 0.5) {
    const t = (pf - TOE_OFF) / (0.5 - TOE_OFF);
    ext = lowAt(TOE_OFF) + (lowAt(0) - lowAt(TOE_OFF)) * smooth(t);
    lift = Math.sin(Math.PI * t) * 0.024 * h;
  } else if (pf < 0.5 + TOE_OFF) {
    ext = lowAt(pf + 0.5);
  } else {
    const t = (pf - 0.5 - TOE_OFF) / (0.5 - TOE_OFF);
    ext = lowAt(TOE_OFF) + (lowAt(0) - lowAt(TOE_OFF)) * smooth(t);
    lift = Math.sin(Math.PI * t) * 0.024 * h;
  }
  return {R, L, offsetY: -ext - lift};
};

/** Prosečna brzina stopala u osloncu (px po fazi), za klizanje podloge bez proklizavanja. */
export const groundSpeedPerCycle = (h: number) => {
  let sum = 0, n = 0;
  for (let p = 0.04; p < 0.34; p += 0.01) {
    const a = leg({x: 0, y: 0}, p, h).ankle.x;
    const b = leg({x: 0, y: 0}, p + 0.01, h).ankle.x;
    sum += (a - b) / 0.01;
    n++;
  }
  return sum / n; // px po jednom ciklusu
};

export const Runner: React.FC<{
  x: number;
  groundY: number;
  height: number;
  phase: number;
  body?: string;
  far?: string;
  shirt?: string;
  shirtFar?: string;
  shorts?: string;
  shortsFar?: string;
  opacity?: number;
  shadow?: boolean;
}> = ({x, groundY, height: h, phase, body = C.white, far = '#7D848A', shirt = C.beet, shirtFar = C.beetDeep, shorts = '#3A434C', shortsFar = '#262D33', opacity = 1, shadow = true}) => {
  const {R, L, offsetY} = runnerPose(phase, h);
  const hip = {x, y: groundY + offsetY};
  const tr = (l: ReturnType<typeof leg>) => ({
    knee: add(hip, l.knee),
    ankle: add(hip, l.ankle),
    heel: add(hip, l.heel),
    toe: add(hip, l.toe),
  });
  const r = tr(R), l = tr(L);
  const lean = 11 + 1.6 * Math.cos(4 * Math.PI * phase);
  const shoulder = add(hip, {x: Math.sin((lean * Math.PI) / 180), y: -Math.cos((lean * Math.PI) / 180)}, P.torso * h);
  const neckTop = add(shoulder, {x: Math.sin(((lean - 4) * Math.PI) / 180), y: -Math.cos(((lean - 4) * Math.PI) / 180)}, P.neck * h);
  const head = add(neckTop, {x: 0.012 * h, y: -0.045 * h});

  const arm = (ph: number) => {
    const hipRef = periodic(HIP, ph - 0.03);
    const sh = -0.9 * (hipRef - 13);
    const el = 86 + 0.45 * sh;
    const upperA = sh + lean * 0.4;
    const elbow = add(shoulder, dir(upperA), P.upper * h);
    const hand = add(elbow, dir(upperA + el), P.fore * h);
    return {elbow, hand};
  };
  const aR = arm(phase), aL = arm(phase + 0.5);

  const limb = (a: V, ra: number, b: V, rb: number, fill: string) => <path d={capsule(a, ra * h, b, rb * h)} fill={fill} />;
  const legParts = (g: ReturnType<typeof tr>, fill: string, shoe: string) => (
    <g>
      {limb(hip, 0.05, g.knee, 0.033, fill)}
      {limb(g.knee, 0.033, g.ankle, 0.017, fill)}
      {limb(g.heel, 0.019, g.toe, 0.012, shoe)}
      {limb(g.ankle, 0.018, g.heel, 0.019, shoe)}
    </g>
  );
  const armParts = (a: ReturnType<typeof arm>, fill: string, sleeve: string) => (
    <g>
      {limb(shoulder, 0.03, a.elbow, 0.021, fill)}
      {limb(a.elbow, 0.021, a.hand, 0.015, fill)}
      <circle cx={a.hand.x} cy={a.hand.y} r={0.019 * h} fill={fill} />
      {limb(shoulder, 0.034, add(shoulder, {x: a.elbow.x - shoulder.x, y: a.elbow.y - shoulder.y}, 0.28), 0.029, sleeve)}
    </g>
  );

  // Desna strana = bliža kameri u fazi 0..0.5? Ovde je bliža strana fiksno leva noga/ruka,
  // a dalja desna, radi stabilne dubine.
  const shadowW = 0.2 * h;
  return (
    <g opacity={opacity}>
      {shadow ? (
        <ellipse cx={x + 0.02 * h} cy={groundY + 4} rx={shadowW} ry={0.012 * h} fill="#000" opacity={0.35} />
      ) : null}
      {/* dalja strana */}
      {armParts(aR, far, shirtFar)}
      {legParts(r, far, '#3E6F67')}
      <path d={capsule(hip, 0.05 * h, add(hip, {x: r.knee.x - hip.x, y: r.knee.y - hip.y}, 0.42), 0.04 * h)} fill={shortsFar} />
      {/* trup */}
      {limb(shoulder, 0.022, neckTop, 0.021, body)}
      {limb(add(hip, {x: 0, y: -0.01 * h}), 0.05, add(shoulder, {x: 0.008 * h, y: 0.03 * h}), 0.064, shirt)}
      <path d={capsule(add(hip, {x: -0.004 * h, y: 0.004 * h}), 0.052 * h, add(hip, {x: 0.006 * h, y: -0.03 * h}), 0.05 * h)} fill={shorts} />
      <circle cx={head.x} cy={head.y} r={P.head * h} fill={body} />
      {/* bliža strana */}
      {legParts(l, body, C.teal)}
      <path d={capsule(hip, 0.052 * h, add(hip, {x: l.knee.x - hip.x, y: l.knee.y - hip.y}, 0.42), 0.041 * h)} fill={shorts} />
      {armParts(aL, body, shirt)}
    </g>
  );
};
