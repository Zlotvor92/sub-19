import React from 'react';
import {C, FONT_BODY} from '../theme';
import {clamp, mix, rand} from '../lib/anim';
import {useSvgId} from './Produce';

const deg = (a: number) => (a * Math.PI) / 180;

/**
 * Molekul sa kontinualnom fazom:
 * stage 0 = NO₃⁻ (nitrat), 1 = NO₂⁻ (nitrit), 2 = NO (azot-monoksid).
 */
export const Molecule: React.FC<{
  x: number;
  y: number;
  scale?: number;
  stage?: number;
  rot?: number;
  glow?: number;
  opacity?: number;
  labels?: boolean;
}> = ({x, y, scale = 1, stage = 0, rot = 0, glow = 0, opacity = 1, labels = true}) => {
  const id = useSvgId('mol');
  const s1 = clamp(stage);
  const s2 = clamp(stage - 1);
  const L = 72;
  const atoms = [
    // O koji odlazi u prvom koraku
    {a: -90, d: L + 190 * s1 * s1, o: 1 - clamp(s1 * 1.3)},
    // O koji odlazi u drugom koraku
    {a: mix(150, 145, s1), d: L + 190 * s2 * s2, o: 1 - clamp(s2 * 1.3), a2: mix(150, 150, s2)},
    // O koji ostaje
    {a: mix(mix(30, 35, s1), 0, s2), d: L, o: 1},
  ];
  const charge = 1 - clamp((stage - 1.45) * 2.2);
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${scale})`} opacity={opacity}>
      <defs>
        <radialGradient id={`${id}n`} cx="-0.3" cy="-0.35" r="1.2">
          <stop offset="0" stopColor="#E7789A" />
          <stop offset="0.55" stopColor={C.beet} />
          <stop offset="1" stopColor="#5E1530" />
        </radialGradient>
        <radialGradient id={`${id}o`} cx="-0.3" cy="-0.35" r="1.2">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor={C.white} />
          <stop offset="1" stopColor="#B9B4A8" />
        </radialGradient>
        <radialGradient id={`${id}g`} cx="0" cy="0" r="1">
          <stop offset="0" stopColor={C.teal} stopOpacity={0.5} />
          <stop offset="0.55" stopColor={C.teal} stopOpacity={0.12} />
          <stop offset="1" stopColor={C.teal} stopOpacity={0} />
        </radialGradient>
      </defs>
      {glow > 0 ? <circle r={150} fill={`url(#${id}g)`} opacity={glow} style={{mixBlendMode: 'screen'}} /> : null}
      {atoms.map((at, i) => {
        const ax = Math.cos(deg(at.a)) * at.d;
        const ay = Math.sin(deg(at.a)) * at.d;
        const bondO = at.o * clamp(1 - (at.d - L) / 40);
        return (
          <g key={`b${i}`}>
            {bondO > 0 ? (
              <line x1={0} y1={0} x2={ax * (L / at.d)} y2={ay * (L / at.d)} stroke={C.white} strokeOpacity={0.55 * bondO} strokeWidth={9} strokeLinecap="round" />
            ) : null}
          </g>
        );
      })}
      {atoms.map((at, i) => {
        const ax = Math.cos(deg(at.a)) * at.d;
        const ay = Math.sin(deg(at.a)) * at.d;
        return at.o > 0.01 ? (
          <g key={`o${i}`} opacity={at.o}>
            <circle cx={ax} cy={ay} r={29} fill={`url(#${id}o)`} />
            {labels ? (
              <text x={ax} y={ay + 10} textAnchor="middle" fontFamily={FONT_BODY} fontWeight={700} fontSize={28} fill={C.graphite}>
                O
              </text>
            ) : null}
          </g>
        ) : null;
      })}
      <circle r={34} fill={`url(#${id}n)`} />
      {labels ? (
        <text y={11} textAnchor="middle" fontFamily={FONT_BODY} fontWeight={700} fontSize={31} fill={C.white}>
          N
        </text>
      ) : null}
      {charge > 0 ? (
        <g opacity={charge} transform="translate(50,-56)">
          <circle r={16} fill="none" stroke={C.white} strokeWidth={3} opacity={0.8} />
          <line x1={-7} x2={7} y1={0} y2={0} stroke={C.white} strokeWidth={3.5} strokeLinecap="round" />
        </g>
      ) : null}
    </g>
  );
};

/** Bakterija (štapić) na površini jezika. */
export const Bacterium: React.FC<{x: number; y: number; rot?: number; len?: number; active?: number; dim?: number; t?: number; seed?: number}> = ({
  x,
  y,
  rot = 0,
  len = 74,
  active = 0,
  dim = 0,
  t = 0,
  seed = 0,
}) => {
  const wob = Math.sin(t * 0.12 + seed) * 3;
  const w = 30;
  const col = C.teal;
  return (
    <g transform={`translate(${x},${y}) rotate(${rot + wob})`} opacity={1 - dim * 0.72}>
      {active > 0 ? <rect x={-len / 2 - 14} y={-w / 2 - 14} width={len + 28} height={w + 28} rx={(w + 28) / 2} fill={col} opacity={0.22 * active} /> : null}
      <rect x={-len / 2} y={-w / 2} width={len} height={w} rx={w / 2} fill={dim > 0.5 ? '#2C5F57' : '#1F6E63'} stroke={col} strokeWidth={3} />
      <rect x={-len / 2 + 8} y={-w / 2 + 6} width={len * 0.55} height={5} rx={2.5} fill={C.white} opacity={0.35} />
      {[0.25, 0.55, 0.78].map((k, i) => (
        <circle key={i} cx={-len / 2 + len * k} cy={4} r={3.4} fill={col} opacity={0.7} />
      ))}
      <path d={`M${len / 2},0 q 14,${-8 + wob} 26,${2 + wob} t 22,0`} stroke={col} strokeWidth={2} fill="none" opacity={0.6} />
    </g>
  );
};

/** Mala ikonica glave iz profila sa istaknutom usnom dupljom. Lokalno 300×360. */
export const HeadIcon: React.FC<{x: number; y: number; scale?: number; opacity?: number; mouthGlow?: number}> = ({x, y, scale = 1, opacity = 1, mouthGlow = 0}) => (
  <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
    <path
      d="M150,18 C214,16 252,62 254,118 C255,138 252,150 258,162 L276,198 C279,205 274,209 266,210 L258,211 C262,220 262,226 256,230 C262,236 262,244 256,250 C258,262 256,276 246,286 C236,294 216,296 200,296 L198,330 M88,330 C90,300 84,282 70,262 C44,226 40,180 46,140 C54,70 96,20 150,18 Z"
      fill="rgba(245,242,234,0.06)"
      stroke={C.white}
      strokeOpacity={0.55}
      strokeWidth={3}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path d="M196,226 C214,222 236,224 252,232 C236,242 214,246 196,240 C188,236 188,230 196,226 Z" fill={C.beet} opacity={0.35 + 0.5 * mouthGlow} />
    {mouthGlow > 0 ? <circle cx={222} cy={233} r={44} fill={C.teal} opacity={0.18 * mouthGlow} /> : null}
  </g>
);

/** Krvni sud (vodoravno) sa crvenim krvnim zrncima konstantnog broja i mišićnim vlaknima ispod. */
export const Vessel: React.FC<{
  y: number;
  r: number;
  t: number;
  width?: number;
  x?: number;
  wallOpacity?: number;
  lumenOpacity?: number;
  cells?: number;
  flow?: number;
}> = ({y, r, t, width = 1300, x = -110, wallOpacity = 1, lumenOpacity = 1, cells = 1, flow = 1}) => {
  const id = useSvgId('ves');
  const wall = 24;
  const n = 16;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}lum`} x1="0" y1={y - r} x2="0" y2={y + r} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2A0712" />
          <stop offset="0.5" stopColor="#56132B" />
          <stop offset="1" stopColor="#2A0712" />
        </linearGradient>
        <linearGradient id={`${id}wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8E2A4A" />
          <stop offset="1" stopColor="#5E1A31" />
        </linearGradient>
      </defs>
      <rect x={x} y={y - r} width={width} height={2 * r} fill={`url(#${id}lum)`} opacity={lumenOpacity} />
      <g opacity={cells * lumenOpacity}>
        {Array.from({length: n}, (_, i) => {
          const sp = 3.2 * flow;
          const px = ((i * 97 + t * sp + rand(i) * 60) % (width + 200)) + x - 100;
          const py = y + (rand(i * 3.7) - 0.5) * (r * 1.2);
          const tilt = (rand(i * 9.1) - 0.5) * 50 + Math.sin(t * 0.05 + i) * 8;
          return (
            <g key={i} transform={`translate(${px},${py}) rotate(${tilt})`}>
              <ellipse rx={30} ry={13} fill="#C2385F" />
              <ellipse rx={17} ry={6} fill="#8E1C45" opacity={0.85} />
            </g>
          );
        })}
      </g>
      <g opacity={wallOpacity}>
        <rect x={x} y={y - r - wall} width={width} height={wall} fill={`url(#${id}wall)`} />
        <rect x={x} y={y + r} width={width} height={wall} fill={`url(#${id}wall)`} />
        <rect x={x} y={y - r - 3} width={width} height={4} fill={C.white} opacity={0.18} />
        <rect x={x} y={y + r - 1} width={width} height={4} fill={C.white} opacity={0.18} />
      </g>
    </g>
  );
};

/** Snop mišićnih vlakana (vodoravno), aktivacija daje tirkizni ton. */
export const Muscle: React.FC<{y: number; t: number; active?: number; opacity?: number}> = ({y, t, active = 0, opacity = 1}) => {
  const id = useSvgId('mus');
  const fibers = [
    {x: -40, w: 760, dy: 0},
    {x: 180, w: 980, dy: 46},
    {x: -80, w: 640, dy: 92},
    {x: 470, w: 700, dy: 92},
    {x: 40, w: 900, dy: 138},
  ];
  return (
    <g opacity={opacity}>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8A4A5C" />
          <stop offset="1" stopColor="#5A2B3A" />
        </linearGradient>
        <pattern id={`${id}str`} width={34} height={40} patternUnits="userSpaceOnUse">
          <rect x={0} width={3} height={40} fill="#F5F2EA" opacity={0.07} />
        </pattern>
      </defs>
      {fibers.map((fb, i) => {
        const shift = Math.sin(t * 0.09 + i * 1.3) * 5 * active;
        return (
          <g key={i} transform={`translate(${shift},0)`}>
            <rect x={fb.x} y={y + fb.dy} width={fb.w} height={38} rx={19} fill={`url(#${id}f)`} />
            <rect x={fb.x} y={y + fb.dy} width={fb.w} height={38} rx={19} fill={`url(#${id}str)`} />
            <rect x={fb.x} y={y + fb.dy} width={fb.w} height={38} rx={19} fill={C.teal} opacity={0.38 * active} />
            <rect x={fb.x + 16} y={y + fb.dy + 7} width={fb.w - 32} height={5} rx={2.5} fill={C.white} opacity={0.14} />
          </g>
        );
      })}
      <text x={92} y={y + 214} fontFamily={FONT_BODY} fontWeight={600} fontSize={26} fill={C.muted} letterSpacing="0.06em" opacity={0.9}>
        MIŠIĆNA VLAKNA
      </text>
    </g>
  );
};
