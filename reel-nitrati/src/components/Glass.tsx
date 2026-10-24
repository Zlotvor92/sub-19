import React from 'react';
import {C} from '../theme';
import {clamp, rand} from '../lib/anim';
import {useSvgId} from './Produce';

/*
 * Čaša soka od cvekle. Lokalno (0,0) = sredina gornjeg oboda.
 * Vraća i položaj „glavne" čestice (heroLocal) radi prelaza u molekul.
 */
export const GLASS = {topW: 270, botW: 226, h: 340, level: 0.78};
export const HERO_LOCAL = {x: 34, y: 196};

const halfW = (y: number) => GLASS.topW / 2 - ((GLASS.topW - GLASS.botW) / 2) * (y / GLASS.h);

export const Glass: React.FC<{
  x: number;
  y: number;
  scale?: number;
  frame: number;
  dropAt?: number; // lokalni frejm udara kapi
  particles?: number; // 0..1 vidljivost čestica
  hero?: number; // 0..1 isticanje glavne čestice
  opacity?: number;
}> = ({x, y, scale = 1, frame, dropAt, particles = 0, hero = 0, opacity = 1}) => {
  const id = useSvgId('glass');
  const wall = 9;
  const surfY = GLASS.h * (1 - GLASS.level);
  const sw = halfW(surfY) - wall;
  const bottomY = GLASS.h - 34;
  const bw = halfW(bottomY) - wall;
  const liquid = `M${-sw},${surfY} L${-bw},${bottomY} Q0,${bottomY + 16} ${bw},${bottomY} L${sw},${surfY} Z`;

  // talasanje površine nakon kapi
  const since = dropAt !== undefined ? frame - dropAt : -1;
  const wobble = since >= 0 ? Math.exp(-since / 18) * Math.sin(since * 0.9) * 4 : 0;
  const ripples = since >= 0 ? [0, 7, 14].map((d) => clamp((since - d) / 26)) : [];

  // padajuća kap
  const dropT = dropAt !== undefined ? clamp((frame - (dropAt - 10)) / 10) : 1;
  const dropY = -260 + (surfY + 260) * dropT * dropT;

  const pts = Array.from({length: 22}, (_, i) => {
    const u = rand(i * 3.1) * 2 - 1;
    const v = rand(i * 7.7 + 1);
    const py = surfY + 26 + v * (bottomY - surfY - 50);
    const px = u * (halfW(py) - wall - 26);
    const dx = Math.sin(frame * 0.035 + i) * 6;
    const dy = Math.cos(frame * 0.03 + i * 1.7) * 5;
    const r = 2 + rand(i * 11.3) * 2.6;
    return {x: px + dx, y: py + dy, r, a: clamp(particles * 1.6 - rand(i * 5.3) * 0.6)};
  });
  const hx = HERO_LOCAL.x + Math.sin(frame * 0.035 + 99) * 4;
  const hy = HERO_LOCAL.y + Math.cos(frame * 0.03 + 50) * 4;

  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
      <defs>
        <linearGradient id={`${id}liq`} x1="0" y1={surfY} x2="0" y2={bottomY} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A42752" />
          <stop offset="0.35" stopColor="#6E1934" />
          <stop offset="1" stopColor="#2A0712" />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="0" cy="0" r="1">
          <stop offset="0" stopColor="#F5F2EA" stopOpacity={1} />
          <stop offset="0.35" stopColor="#F7B9CB" stopOpacity={0.55} />
          <stop offset="1" stopColor="#F7B9CB" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}hero`} cx="0" cy="0" r="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
          <stop offset="0.3" stopColor={C.teal} stopOpacity={0.8} />
          <stop offset="1" stopColor={C.teal} stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}wall`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F5F2EA" stopOpacity={0.28} />
          <stop offset="0.12" stopColor="#F5F2EA" stopOpacity={0.06} />
          <stop offset="0.85" stopColor="#F5F2EA" stopOpacity={0.04} />
          <stop offset="1" stopColor="#F5F2EA" stopOpacity={0.22} />
        </linearGradient>
        <clipPath id={`${id}clip`}>
          <path d={liquid} />
        </clipPath>
      </defs>
      {/* senka na podlozi */}
      <ellipse cx={8} cy={GLASS.h + 6} rx={GLASS.botW * 0.62} ry={16} fill="#000" opacity={0.45} />
      {/* zadnji zid */}
      <path d={`M${-GLASS.topW / 2},0 L${-GLASS.botW / 2},${GLASS.h} L${GLASS.botW / 2},${GLASS.h} L${GLASS.topW / 2},0 Z`} fill={`url(#${id}wall)`} />
      <ellipse cx={0} cy={0} rx={GLASS.topW / 2} ry={18} fill="none" stroke="#F5F2EA" strokeOpacity={0.22} strokeWidth={2} />
      {/* tečnost */}
      <path d={liquid} fill={`url(#${id}liq)`} />
      <g clipPath={`url(#${id}clip)`}>
        <rect x={-sw} y={surfY} width={sw * 0.35} height={bottomY - surfY} fill="#F5F2EA" opacity={0.05} />
        {pts.map((p, i) => (
          <g key={i} opacity={p.a}>
            <circle cx={p.x} cy={p.y} r={p.r * 3.4} fill={`url(#${id}glow)`} opacity={0.35} />
            <circle cx={p.x} cy={p.y} r={p.r} fill="#FBE3EA" opacity={0.85} />
          </g>
        ))}
      </g>
      {/* glavna čestica */}
      {hero > 0 ? (
        <g opacity={clamp(hero * 2)}>
          <circle cx={hx} cy={hy} r={10 + 26 * hero} fill={`url(#${id}hero)`} />
          <circle cx={hx} cy={hy} r={18 + 14 * hero} fill="none" stroke={C.teal} strokeWidth={2.5} opacity={hero} />
        </g>
      ) : null}
      {/* površina */}
      <ellipse cx={0} cy={surfY + wobble * 0.3} rx={sw} ry={13 + wobble * 0.4} fill="#B83259" />
      <ellipse cx={-sw * 0.25} cy={surfY - 2 + wobble * 0.3} rx={sw * 0.55} ry={5} fill="#E06A8E" opacity={0.35} />
      {ripples.map((r, i) =>
        r > 0 && r < 1 ? (
          <ellipse key={i} cx={0} cy={surfY} rx={sw * 0.95 * r} ry={13 * r} fill="none" stroke="#F5C0D0" strokeWidth={2.4 * (1 - r)} opacity={(1 - r) * 0.8} />
        ) : null,
      )}
      {/* kap */}
      {dropAt !== undefined && frame < dropAt + 1 && frame > dropAt - 12 ? (
        <path d={`M0,${dropY - 26} C 8,${dropY - 10} 12,${dropY} 0,${dropY + 6} C -12,${dropY} -8,${dropY - 10} 0,${dropY - 26} Z`} fill="#B83259" />
      ) : null}
      {since >= 0 && since < 16
        ? [-1, 1, -0.4, 0.5].map((d, i) => {
            const t = since / 16;
            return <circle key={i} cx={d * 46 * t} cy={surfY - 70 * t + 90 * t * t} r={5 * (1 - t) + 1} fill="#C2416A" opacity={1 - t} />;
          })
        : null}
      {/* prednji zid i odsjaji */}
      <path d={`M${-GLASS.topW / 2},0 L${-GLASS.botW / 2},${GLASS.h}`} stroke="#F5F2EA" strokeOpacity={0.45} strokeWidth={3} />
      <path d={`M${GLASS.topW / 2},0 L${GLASS.botW / 2},${GLASS.h}`} stroke="#F5F2EA" strokeOpacity={0.3} strokeWidth={3} />
      <path d={`M${-GLASS.topW / 2 + 26},24 L${-GLASS.botW / 2 + 24},${GLASS.h - 50}`} stroke="#F5F2EA" strokeOpacity={0.28} strokeWidth={10} strokeLinecap="round" />
      <path d={`M${GLASS.topW / 2 - 30},40 L${GLASS.botW / 2 - 26},${GLASS.h * 0.55}`} stroke="#F5F2EA" strokeOpacity={0.14} strokeWidth={5} strokeLinecap="round" />
      <path d={`M${-GLASS.botW / 2},${GLASS.h} Q0,${GLASS.h + 22} ${GLASS.botW / 2},${GLASS.h}`} stroke="#F5F2EA" strokeOpacity={0.35} strokeWidth={3} fill="none" />
      <path d={`M${-GLASS.botW / 2 + 6},${bottomY + 8} Q0,${bottomY + 26} ${GLASS.botW / 2 - 6},${bottomY + 8}`} stroke="#F5F2EA" strokeOpacity={0.12} strokeWidth={14} fill="none" />
      <ellipse cx={0} cy={0} rx={GLASS.topW / 2} ry={18} fill="none" stroke="#F5F2EA" strokeOpacity={0.5} strokeWidth={3} strokeDasharray="0 0" />
    </g>
  );
};

export const heroWorld = (gx: number, gy: number, scale: number, frame: number) => ({
  x: gx + (HERO_LOCAL.x + Math.sin(frame * 0.035 + 99) * 4) * scale,
  y: gy + (HERO_LOCAL.y + Math.cos(frame * 0.03 + 50) * 4) * scale,
});
