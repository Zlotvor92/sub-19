import React from 'react';
import {C, FONT_BODY, FONT_HEAD} from '../theme';
import {clamp} from '../lib/anim';
import {useSvgId} from './Produce';

/** Neobeležena bočica (bez brenda). Lokalno (0,0) = sredina dna. */
export const Bottle: React.FC<{x: number; y: number; scale?: number; opacity?: number; labelHi?: number}> = ({x, y, scale = 1, opacity = 1, labelHi = 0}) => {
  const id = useSvgId('btl');
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={opacity}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1C0710" />
          <stop offset="0.3" stopColor="#5E1530" />
          <stop offset="0.6" stopColor="#3A0B1C" />
          <stop offset="1" stopColor="#14050B" />
        </linearGradient>
        <linearGradient id={`${id}cap`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1A2026" />
          <stop offset="0.35" stopColor="#4A545E" />
          <stop offset="1" stopColor="#151A1F" />
        </linearGradient>
      </defs>
      <ellipse cx={6} cy={4} rx={110} ry={14} fill="#000" opacity={0.45} />
      <path d="M-85,0 L-85,-250 C-85,-300 -40,-312 -36,-350 L-36,-420 L36,-420 L36,-350 C40,-312 85,-300 85,-250 L85,0 Q85,10 75,10 L-75,10 Q-85,10 -85,0 Z" fill={`url(#${id}g)`} />
      <rect x={-42} y={-476} width={84} height={60} rx={8} fill={`url(#${id}cap)`} />
      {Array.from({length: 9}, (_, i) => (
        <rect key={i} x={-38 + i * 9} y={-470} width={3} height={48} fill="#000" opacity={0.25} />
      ))}
      <path d="M-66,-262 C-66,-292 -40,-300 -30,-318" stroke={C.white} strokeOpacity={0.22} strokeWidth={8} fill="none" strokeLinecap="round" />
      <rect x={-62} y={-200} width={10} height={170} rx={5} fill={C.white} opacity={0.12} />
      {/* etiketa bez brenda */}
      <rect x={-78} y={-236} width={156} height={190} rx={10} fill="#ECE7DB" />
      <rect x={-56} y={-212} width={92} height={12} rx={6} fill="#B5AFA3" />
      <rect x={-56} y={-190} width={60} height={9} rx={4.5} fill="#CFC9BD" />
      <line x1={-62} x2={62} y1={-168} y2={-168} stroke="#B5AFA3" strokeWidth={2} />
      <rect x={-62} y={-156} width={124} height={26} rx={5} fill={C.teal} opacity={0.28 * labelHi} />
      <text x={-56} y={-137} fontFamily={FONT_BODY} fontWeight={700} fontSize={17} fill="#2A2F35">Nitrati</text>
      <rect x={16} y={-150} width={38} height={10} rx={5} fill="#8B857A" />
      <rect x={-56} y={-118} width={56} height={9} rx={4.5} fill="#CFC9BD" />
      <rect x={16} y={-118} width={38} height={9} rx={4.5} fill="#CFC9BD" />
      <rect x={-56} y={-98} width={70} height={9} rx={4.5} fill="#CFC9BD" />
      <rect x={16} y={-98} width={38} height={9} rx={4.5} fill="#CFC9BD" />
    </g>
  );
};

/** Sat za prikaz vremena do starta. Start je na vrhu (12), prozor za sok 2–3 h ranije. */
export const Clock: React.FC<{cx: number; cy: number; r: number; arc?: number; hand?: number; opacity?: number; ticks?: number}> = ({
  cx,
  cy,
  r,
  arc = 1,
  hand = -75,
  opacity = 1,
  ticks = 1,
}) => {
  const pt = (a: number, rr: number) => ({x: cx + Math.sin((a * Math.PI) / 180) * rr, y: cy - Math.cos((a * Math.PI) / 180) * rr});
  // prozor: 3 h pre starta (-90°) do 2 h pre starta (-60°)
  const a0 = -90, a1 = -90 + 30 * arc;
  const p0 = pt(a0, r * 0.84), p1 = pt(a1, r * 0.84);
  const handEnd = pt(hand, r * 0.7);
  return (
    <g opacity={opacity}>
      <circle cx={cx} cy={cy} r={r} fill="rgba(245,242,234,0.04)" stroke={C.white} strokeOpacity={0.55} strokeWidth={4} />
      {Array.from({length: 12}, (_, i) => {
        const a = i * 30;
        const o = pt(a, r * 0.95), inn = pt(a, i % 3 === 0 ? r * 0.8 : r * 0.87);
        return <line key={i} x1={o.x} y1={o.y} x2={inn.x} y2={inn.y} stroke={C.white} strokeOpacity={0.6 * ticks} strokeWidth={i % 3 === 0 ? 5 : 3} strokeLinecap="round" />;
      })}
      {arc > 0 ? (
        <path d={`M${p0.x},${p0.y} A${r * 0.84},${r * 0.84} 0 0 1 ${p1.x},${p1.y}`} stroke={C.beet} strokeWidth={26} fill="none" strokeLinecap="round" />
      ) : null}
      <line x1={cx} y1={cy} x2={handEnd.x} y2={handEnd.y} stroke={C.teal} strokeWidth={8} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={12} fill={C.teal} />
      {/* start na vrhu */}
      <g transform={`translate(${cx},${cy - r - 18})`} opacity={ticks}>
        <line x1={0} y1={0} x2={0} y2={-62} stroke={C.white} strokeWidth={4} strokeLinecap="round" />
        <path d="M0,-62 L44,-50 L0,-36 Z" fill={C.teal} />
      </g>
    </g>
  );
};

type IconProps = {x: number; y: number; size?: number; color?: string; opacity?: number; sw?: number};
const Icon: React.FC<IconProps & {children: React.ReactNode}> = ({x, y, size = 80, color = C.white, opacity = 1, sw = 4, children}) => (
  <g transform={`translate(${x},${y}) scale(${size / 100})`} opacity={opacity} stroke={color} strokeWidth={(sw * 100) / size} fill="none" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </g>
);

export const StopwatchIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <circle cx={50} cy={56} r={36} />
    <path d="M50,56 L50,34 M40,10 L60,10 M50,10 L50,20 M80,26 L86,20" />
  </Icon>
);
export const FlagIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M22,92 L22,10 M22,12 C40,4 56,22 78,12 L78,52 C56,62 40,44 22,52" />
  </Icon>
);
export const StomachIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M40,6 L40,26 C40,36 30,40 26,52 C20,72 34,92 56,90 C78,88 90,70 84,52 C80,40 66,40 60,48 C56,54 52,50 54,40 L56,6" />
  </Icon>
);
export const BookmarkIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M24,8 L76,8 L76,94 L50,74 L24,94 Z" />
  </Icon>
);
export const CheckIcon: React.FC<IconProps> = (p) => (
  <Icon {...p}>
    <path d="M14,54 L40,78 L88,24" />
  </Icon>
);

/** Atletska staza (bočni pogled) sa linijama koje klize konstantnom brzinom. */
export const Track: React.FC<{y: number; offset: number; opacity?: number; width?: number}> = ({y, offset, opacity = 1, width = 1080}) => {
  const hgt = 80;
  const step = 180;
  const o = ((offset % step) + step) % step;
  return (
    <g opacity={opacity}>
      <rect x={0} y={y} width={width} height={hgt} fill="#1A2026" />
      <rect x={0} y={y} width={width} height={4} fill={C.white} opacity={0.85} />
      <rect x={0} y={y + 56} width={width} height={3} fill={C.white} opacity={0.25} />
      {Array.from({length: Math.ceil(width / step) + 2}, (_, i) => (
        <rect key={i} x={i * step - o} y={y + 26} width={70} height={6} rx={3} fill={C.white} opacity={0.35} />
      ))}
    </g>
  );
};

/** Horizontalni pokazatelj bez numeričke skale (popuna 0..1, opcioni „duh" prethodne vrednosti). */
export const Meter: React.FC<{x: number; y: number; w: number; value: number; ghost?: number; color?: string; label: React.ReactNode; note?: React.ReactNode; opacity?: number}> = ({
  x,
  y,
  w,
  value,
  ghost,
  color = C.teal,
  label,
  note,
  opacity = 1,
}) => (
  <g opacity={opacity}>
    <foreignObject x={x} y={y - 54} width={w + 10} height={50}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: FONT_BODY, color: C.white, fontSize: 32, fontWeight: 600}}>
        <span>{label}</span>
        <span style={{fontSize: 27, color: C.muted, fontWeight: 500}}>{note}</span>
      </div>
    </foreignObject>
    <rect x={x} y={y} width={w} height={22} rx={11} fill="rgba(245,242,234,0.1)" />
    {ghost !== undefined ? <rect x={x} y={y} width={w * ghost} height={22} rx={11} fill="none" stroke={C.white} strokeOpacity={0.45} strokeWidth={2.5} strokeDasharray="8 7" /> : null}
    <rect x={x} y={y} width={w * clamp(value)} height={22} rx={11} fill={color} />
  </g>
);

export const BigNumber: React.FC<{children: React.ReactNode; size?: number; color?: string}> = ({children, size = 150, color = C.white}) => (
  <span style={{fontFamily: FONT_HEAD, fontWeight: 800, fontSize: size, color, letterSpacing: '0.01em', lineHeight: 1}}>{children}</span>
);
