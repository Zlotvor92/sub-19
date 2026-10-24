import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Background} from '../components/Background';
import {Glass} from '../components/Glass';
import {Beet} from '../components/Produce';
import {Runner} from '../components/Runner';
import {BookmarkIcon} from '../components/Props';
import {Headline} from '../components/Type';
import {C, FONT_BODY} from '../theme';
import {cue, easeInOut, easeOut, lf, mix, prog} from '../lib/anim';

const GX = 470, GY = 880, GS = 1.3;

/** Završni kadar kompozicijom ponavlja početni (čaša, cvekla, trkač), radi glatke petlje. */
export const S8Outro: React.FC = () => {
  const f = useCurrentFrame();
  const fMali = lf(8, cue.mali);
  const fSac = lf(8, cue.sacuvaj);
  const settle = prog(f, 0, 16, easeOut);
  const scale = mix(1.12, 1, prog(f, 0, 240, easeInOut));
  const runnerX = interpolate(f, [26, 96], [-300, 1380], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const particles = 1 - prog(f, 196, 70, easeInOut);

  return (
    <AbsoluteFill>
      <Background glow={C.beet} glowY={1000} glowOpacity={0.2} />
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g transform={`translate(540,1000) scale(${scale}) translate(-540,-1000)`} opacity={settle}>
          {f > 24 && f < 100 ? (
            <g style={{filter: 'blur(3px)'}} opacity={0.7}>
              <Runner x={runnerX} groundY={1290} height={720} phase={f / 20} shadow={false} />
            </g>
          ) : null}
          <rect x={0} y={1288} width={1080} height={2} fill={C.white} opacity={0.06} />
          <Beet x={755} y={1160} scale={1.02} rot={-7} sway={Math.sin((f + 2142) / 22) * 2.5} />
          <Glass x={GX} y={GY} scale={GS} frame={f + 400} particles={particles} hero={0} />
        </g>
      </svg>
      <Headline
        lines={[<span key="a" style={{color: C.beetLight}}>MALI DODATAK</span>, <span key="b">DOBROJ PRIPREMI</span>]}
        at={fMali - 30}
        out={250}
        y={250}
        size={116}
      />
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 528,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          opacity: prog(f, fSac - 2, 14) * (1 - prog(f, 258, 14)),
          transform: `translateY(${(1 - prog(f, fSac - 2, 16, easeOut)) * 16}px)`,
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: 40,
          color: C.muted,
        }}
      >
        <svg width={44} height={44} style={{overflow: 'visible'}}>
          <BookmarkIcon x={0} y={0} size={44} color={C.white} sw={4} />
        </svg>
        Sačuvaj za kasnije.
      </div>
    </AbsoluteFill>
  );
};
