import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C, FONT_BODY, FONT_HEAD, SAFE} from '../theme';
import {easeInOut, easeOut, prog} from '../lib/anim';

/** Hemijska formula: cifre kao indeks, završni minus kao naelektrisanje (npr. "NO3-"). */
export const Chem: React.FC<{f: string; style?: React.CSSProperties}> = ({f, style}) => {
  const charge = f.endsWith('-');
  const body = charge ? f.slice(0, -1) : f;
  const parts = body.split(/(\d+)/).filter(Boolean);
  return (
    <span style={{whiteSpace: 'nowrap', ...style}}>
      {parts.map((p, i) =>
        /\d/.test(p) ? (
          <span key={i} style={{fontSize: '0.62em', position: 'relative', top: '0.32em', marginLeft: '0.02em'}}>
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
      {charge ? (
        <span style={{fontSize: '0.62em', position: 'relative', top: '-0.62em', marginLeft: '0.03em'}}>{'−'}</span>
      ) : null}
    </span>
  );
};

/** Strelica (font nema glif U+2192, pa se crta vektorski). */
export const Arrow: React.FC<{size?: number; color?: string; draw?: number; style?: React.CSSProperties}> = ({
  size = 1,
  color = 'currentColor',
  draw = 1,
  style,
}) => (
  <svg
    viewBox="0 0 48 24"
    style={{width: `${1.25 * size}em`, height: `${0.62 * size}em`, display: 'inline-block', verticalAlign: '0.05em', overflow: 'visible', ...style}}
  >
    <path d="M2 12 H42" stroke={color} strokeWidth={3.4} strokeLinecap="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
    <path d="M33 4 L43 12 L33 20" stroke={color} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={draw > 0.85 ? 1 : 0} />
  </svg>
);

/** Znak „približno" (≈), vektorski. */
export const Approx: React.FC<{color?: string}> = ({color = 'currentColor'}) => (
  <svg viewBox="0 0 30 24" style={{width: '0.62em', height: '0.5em', display: 'inline-block', verticalAlign: '0.08em', overflow: 'visible'}}>
    <path d="M3 9 C8 4, 12 4, 15 8 S22 12, 27 7" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
    <path d="M3 18 C8 13, 12 13, 15 17 S22 21, 27 16" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" />
  </svg>
);

/**
 * Kinetička tipografija: svaki red ulazi kroz masku (klizi odozdo), stagger po redovima,
 * a izlazi klizanjem nagore. Frejmovi su lokalni za scenu.
 */
export const Headline: React.FC<{
  lines: React.ReactNode[];
  at: number;
  out?: number;
  x?: number;
  y: number;
  size?: number;
  weight?: number;
  color?: string;
  font?: string;
  align?: 'left' | 'center';
  lineHeight?: number;
  stagger?: number;
  width?: number;
  letterSpacing?: string;
  uppercase?: boolean;
}> = ({lines, at, out, x = SAFE.left, y, size = 120, weight = 800, color = C.white, font = FONT_HEAD, align = 'left', lineHeight = 0.98, stagger = 4, width = 810, letterSpacing = '0.005em', uppercase = false}) => {
  const frame = useCurrentFrame();
  if (frame < at - 1) return null;
  if (out !== undefined && frame > out + 14 + stagger * lines.length) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, width, textAlign: align, fontFamily: font, fontWeight: weight, fontSize: size, lineHeight, color, letterSpacing, textTransform: uppercase ? 'uppercase' : 'none'}}>
      {lines.map((ln, i) => {
        const pIn = prog(frame, at + i * stagger, 16, easeOut);
        const pOut = out !== undefined ? prog(frame, out + i * stagger * 0.5, 12, easeInOut) : 0;
        const ty = (1 - pIn) * 105 - pOut * 105;
        return (
          <div key={i} style={{overflow: 'hidden', paddingBottom: size * 0.06, marginBottom: -size * 0.06}}>
            <div style={{transform: `translateY(${ty}%)`, opacity: Math.min(1, pIn * 1.4) * (1 - pOut * 0.6)}}>{ln}</div>
          </div>
        );
      })}
    </div>
  );
};

/** Mala etiketa (npr. „Ilustracija", oznaka koraka). */
export const Tag: React.FC<{children: React.ReactNode; at: number; out?: number; x: number; y: number; color?: string; border?: string; size?: number; style?: React.CSSProperties}> = ({
  children,
  at,
  out,
  x,
  y,
  color = C.muted,
  border = 'rgba(245,242,234,0.22)',
  size = 28,
  style,
}) => {
  const frame = useCurrentFrame();
  const o = prog(frame, at, 12) * (out !== undefined ? 1 - prog(frame, out, 10, easeInOut) : 1);
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: o,
        transform: `translateY(${(1 - o) * 10}px)`,
        fontFamily: FONT_BODY,
        fontWeight: 600,
        fontSize: size,
        color,
        letterSpacing: '0.04em',
        padding: `${size * 0.28}px ${size * 0.55}px`,
        border: `2px solid ${border}`,
        borderRadius: size,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Diskretna oznaka izvora uz scenu. */
export const SourceNote: React.FC<{text: string; at: number; out?: number; y?: number; x?: number}> = ({text, at, out, y = 1338, x = SAFE.left}) => {
  const frame = useCurrentFrame();
  const o = prog(frame, at, 14) * (out !== undefined ? 1 - prog(frame, out, 10, easeInOut) : 1);
  if (o <= 0) return null;
  return (
    <div style={{position: 'absolute', left: x, top: y, opacity: o * 0.92, fontFamily: FONT_BODY, fontWeight: 500, fontSize: 27, color: C.muted, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 12}}>
      <span style={{display: 'inline-block', width: 26, height: 2, background: C.muted, opacity: 0.7}} />
      {text}
    </div>
  );
};
