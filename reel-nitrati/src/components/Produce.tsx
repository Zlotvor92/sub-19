import React from 'react';
import {C} from '../theme';

/*
 * Ilustracije namirnica: cvekla (sa listovima) i list spanaća.
 * Lokalni koordinatni sistem: cvekla u kutiji 200×300 (centar glave ~ 100,135).
 */

export const useSvgId = (p: string) => p + React.useId().replace(/[^a-zA-Z0-9]/g, '');

export const Beet: React.FC<{x: number; y: number; scale?: number; rot?: number; sway?: number; leaves?: boolean; opacity?: number}> = ({
  x,
  y,
  scale = 1,
  rot = 0,
  sway = 0,
  leaves = true,
  opacity = 1,
}) => {
  const id = useSvgId('beet');
  const leaf = (angle: number, len: number, w: number, k: number) => {
    const a = angle + sway * (0.6 + 0.4 * k);
    return (
      <g transform={`translate(100,52) rotate(${a})`} key={k}>
        <path d={`M0,0 C ${-4},${-len * 0.35} ${3},${-len * 0.6} 0,${-len * 0.72}`} stroke={`url(#${id}stem)`} strokeWidth={8 - k * 0.4} fill="none" strokeLinecap="round" />
        <path
          d={`M0,${-len * 0.62} C ${w},${-len * 0.7} ${w * 1.05},${-len * 1.02} 0,${-len * 1.18} C ${-w * 1.05},${-len * 1.02} ${-w},${-len * 0.7} 0,${-len * 0.62} Z`}
          fill={`url(#${id}leaf)`}
        />
        <path d={`M0,${-len * 0.62} L0,${-len * 1.14}`} stroke={C.beet} strokeWidth={2.4} opacity={0.85} />
        {[0.72, 0.84, 0.96].map((t, j) => (
          <g key={j} opacity={0.55}>
            <path d={`M0,${-len * t} q ${w * 0.45},${-len * 0.04} ${w * 0.7},${-len * 0.1}`} stroke={C.beet} strokeWidth={1.4} fill="none" />
            <path d={`M0,${-len * t} q ${-w * 0.45},${-len * 0.04} ${-w * 0.7},${-len * 0.1}`} stroke={C.beet} strokeWidth={1.4} fill="none" />
          </g>
        ))}
      </g>
    );
  };
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${scale}) translate(-100,-135)`} opacity={opacity}>
      <defs>
        <radialGradient id={`${id}body`} cx="72" cy="96" r="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E06A8E" />
          <stop offset="0.28" stopColor={C.beet} />
          <stop offset="0.7" stopColor="#6E1934" />
          <stop offset="1" stopColor="#2E0915" />
        </radialGradient>
        <linearGradient id={`${id}stem`} x1="0" y1="0" x2="0" y2="-1" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#8E1C45" />
          <stop offset="1" stopColor={C.beetLight} />
        </linearGradient>
        <linearGradient id={`${id}leaf`} x1="0" y1="1" x2="0.3" y2="0">
          <stop offset="0" stopColor={C.leafDark} />
          <stop offset="1" stopColor={C.leaf} />
        </linearGradient>
        <radialGradient id={`${id}rim`} cx="150" cy="200" r="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4DD9C0" stopOpacity={0.18} />
          <stop offset="1" stopColor="#4DD9C0" stopOpacity={0} />
        </radialGradient>
      </defs>
      {leaves ? [leaf(-48, 190, 52, 0), leaf(46, 200, 54, 1), leaf(-20, 245, 62, 2), leaf(20, 235, 60, 3), leaf(2, 270, 64, 4)] : null}
      {/* koren */}
      <path d="M104,226 C106,250 106,272 102,300" stroke="#5A1229" strokeWidth={5} fill="none" strokeLinecap="round" />
      <path
        d="M100,48 C152,46 190,84 190,134 C190,182 152,212 120,232 C112,238 106,246 102,262 C98,246 92,238 84,232 C50,210 10,182 10,134 C10,84 48,50 100,48 Z"
        fill={`url(#${id}body)`}
      />
      <path d="M100,48 C152,46 190,84 190,134 C190,182 152,212 120,232 C112,238 106,246 102,262" fill="none" stroke={`url(#${id}rim)`} strokeWidth={10} />
      {/* blagi prstenovi i odsjaj */}
      <path d="M40,120 C70,104 130,104 166,122" stroke="#F5F2EA" strokeOpacity={0.08} strokeWidth={2} fill="none" />
      <path d="M30,156 C70,140 140,140 176,158" stroke="#000" strokeOpacity={0.12} strokeWidth={2} fill="none" />
      <path d="M44,96 C56,74 78,64 98,62" stroke="#F5F2EA" strokeOpacity={0.35} strokeWidth={6} fill="none" strokeLinecap="round" />
      <ellipse cx="100" cy="52" rx="20" ry="7" fill="#4A0E22" />
      <path d="M150,214 l14,10 M58,212 l-12,9 M126,236 l8,12" stroke="#5A1229" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
};

/** List spanaća/rukole, lokalno: osnova peteljke u (0,0), list ide nagore. */
export const Leaf: React.FC<{x: number; y: number; scale?: number; rot?: number; opacity?: number}> = ({x, y, scale = 1, rot = 0, opacity = 1}) => {
  const id = useSvgId('leaf');
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${scale})`} opacity={opacity}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" stopColor={C.leafDark} />
          <stop offset="0.6" stopColor={C.leaf} />
          <stop offset="1" stopColor={C.leafLight} />
        </linearGradient>
      </defs>
      <path d="M0,0 C 2,-30 0,-55 0,-80" stroke="#5E8F64" strokeWidth={7} fill="none" strokeLinecap="round" />
      <path d="M0,-70 C 80,-90 120,-190 70,-290 C 50,-330 20,-350 0,-360 C -20,-350 -50,-330 -70,-290 C -120,-190 -80,-90 0,-70 Z" fill={`url(#${id}g)`} />
      <path d="M0,-72 C 4,-160 4,-260 0,-352" stroke="#A9CFA0" strokeOpacity={0.7} strokeWidth={3} fill="none" />
      {[-120, -170, -220, -270].map((yy, i) => (
        <g key={i} opacity={0.45}>
          <path d={`M1,${yy} C 30,${yy - 10} 52,${yy - 26} 66,${yy - 44}`} stroke="#A9CFA0" strokeWidth={1.8} fill="none" />
          <path d={`M-1,${yy} C -30,${yy - 10} -52,${yy - 26} -66,${yy - 44}`} stroke="#A9CFA0" strokeWidth={1.8} fill="none" />
        </g>
      ))}
      <path d="M-60,-280 C -40,-320 -20,-338 -4,-346" stroke="#F5F2EA" strokeOpacity={0.18} strokeWidth={5} fill="none" strokeLinecap="round" />
    </g>
  );
};
