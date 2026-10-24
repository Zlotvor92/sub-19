import React from 'react';
import {useCurrentFrame} from 'remotion';
import timeline from '../timeline.json';
import {C, FONT_BODY, H, SAFE, SAFE_CX} from '../theme';

const KEY: Array<[RegExp, string]> = [
  [/^nitrat/i, C.beetLight],
  [/^nitrit/i, C.beetLight],
  [/^azot-monoksid/i, C.teal],
  [/^bakterij/i, C.teal],
  [/^kiseonik/i, C.teal],
  [/^ekonomičnost/i, C.teal],
];

const colorFor = (w: string) => {
  for (const [re, c] of KEY) if (re.test(w)) return c;
  return undefined;
};

/** Titlovi sinhronizovani sa stvarnim vremenima reči; kratke celine, najviše dva reda. */
export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / timeline.fps;
  const sub = timeline.subs.find((s) => t >= s.start && t < s.end);
  if (!sub) return null;
  const fadeIn = Math.min(1, (t - sub.start) / 0.12);
  const fadeOut = Math.min(1, (sub.end - t) / 0.1);
  const o = Math.max(0, Math.min(fadeIn, fadeOut));
  const fontSize = 50;
  const bottom = H - SAFE.bottom;
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE_CX - 420,
        width: 840,
        top: bottom - (sub.lines.length * fontSize * 1.28 + 30),
        height: sub.lines.length * fontSize * 1.28 + 30,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        opacity: o,
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize,
          lineHeight: 1.26,
          color: C.white,
          textAlign: 'center',
          padding: '10px 22px 12px',
          borderRadius: 18,
          background: 'rgba(12,15,18,0.62)',
          textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          transform: `translateY(${(1 - fadeIn) * 6}px)`,
        }}
      >
        {sub.lines.map((ln, i) => (
          <div key={i} style={{whiteSpace: 'nowrap'}}>
            {ln.split(' ').map((w, j) => (
              <span key={j} style={{color: colorFor(w) ?? C.white}}>
                {w}
                {j < ln.split(' ').length - 1 ? ' ' : ''}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
