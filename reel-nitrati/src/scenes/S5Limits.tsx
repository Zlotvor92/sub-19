import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Background} from '../components/Background';
import {Runner} from '../components/Runner';
import {FlagIcon, StopwatchIcon, Track} from '../components/Props';
import {Headline, SourceNote, Tag} from '../components/Type';
import {C, FONT_BODY} from '../theme';
import {cue, easeInOut, easeOut, lf, mix, prog} from '../lib/anim';
import {TRACK_Y} from './S3Pathway';
import {RUN_CYCLE, RUN_H, RUN_X, groundOffset} from './S4Economy';

const Card: React.FC<{x: number; y: number; o: number; icon: React.ReactNode; title: string; result: React.ReactNode; accent: string; t: number; seed: number}> = ({x, y, o, icon, title, result, accent, t, seed}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 390,
      height: 560,
      opacity: o,
      transform: `translateY(${(1 - o) * 30 + Math.sin(t * 0.055 + seed) * 6}px) rotate(${Math.sin(t * 0.04 + seed * 2) * 0.35}deg)`,
      borderRadius: 30,
      background: 'rgba(245,242,234,0.05)',
      border: '2px solid rgba(245,242,234,0.14)',
      padding: '34px 30px',
      boxSizing: 'border-box',
      fontFamily: FONT_BODY,
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    <svg width={84} height={84} style={{overflow: 'visible'}}>
      {icon}
    </svg>
    <div style={{fontSize: 42, fontWeight: 600, color: C.white, lineHeight: 1.2, marginTop: 26}}>{title}</div>
    <div style={{flex: 1}} />
    <div style={{fontSize: 35, fontWeight: 600, color: accent, lineHeight: 1.25, borderTop: '2px solid rgba(245,242,234,0.12)', paddingTop: 20}}>{result}</div>
  </div>
);

const ROWS = [
  {len: 0.86, phase: 0.0},
  {len: 0.46, phase: 0.33},
  {len: 0, phase: 0.61},
  {len: 0.24, phase: 0.18},
  {len: 0, phase: 0.8},
];

export const S5Limits: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + 1152;
  const fIstr = lf(5, cue.istrazivanja);
  const fOdg = lf(5, cue.odgovorS5);
  const intro = prog(f, 0, 22, easeInOut); // odjavljivanje trkača iz scene 4 (kamera se povlači)
  const cardsOut = prog(f, fIstr - 12, 16, easeInOut);
  const rowsIn = prog(f, fIstr - 2, 22, easeOut);

  return (
    <AbsoluteFill>
      <Background glow={C.beet} glowX={540} glowY={900} glowOpacity={0.1} />
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        {intro < 1 ? (
          <g opacity={1 - intro} transform={`translate(540,${TRACK_Y}) scale(${mix(1, 0.7, intro)}) translate(-540,${-TRACK_Y})`}>
            <Track y={TRACK_Y} offset={groundOffset(g)} />
            <Runner x={RUN_X} groundY={TRACK_Y} height={RUN_H} phase={g / RUN_CYCLE} />
          </g>
        ) : null}
        <g opacity={rowsIn}>
          {ROWS.map((r, i) => {
            const y = 640 + i * 136;
            const grow = prog(f, fOdg - 18 + i * 6, 22, easeOut);
            return (
              <g key={i} transform={`translate(0,${(1 - rowsIn) * 30})`}>
                <rect x={90} y={y + 58} width={190} height={3} fill={C.white} opacity={0.25} />
                <Runner x={170} groundY={y + 58} height={122} phase={g / RUN_CYCLE + r.phase} shadow={false} />
                <rect x={320} y={y + 18} width={560} height={20} rx={10} fill="rgba(245,242,234,0.08)" />
                {r.len > 0 ? (
                  <rect x={320} y={y + 18} width={560 * r.len * grow} height={20} rx={10} fill={C.teal} opacity={0.9} />
                ) : (
                  <g opacity={grow}>
                    <rect x={320} y={y + 24} width={36} height={8} rx={4} fill={C.muted} />
                    <text x={372} y={y + 37} fontFamily={FONT_BODY} fontWeight={500} fontSize={27} fill={C.muted}>
                      bez jasnog efekta
                    </text>
                  </g>
                )}
              </g>
            );
          })}
          <text x={320} y={604} fontFamily={FONT_BODY} fontWeight={600} fontSize={28} fill={C.muted} letterSpacing="0.03em">
            ODGOVOR RAZLIČITIH TRKAČA
          </text>
        </g>
      </svg>
      <Headline lines={['Brži rezultat', 'nije zagarantovan.']} at={6} out={fIstr - 14} y={240} size={112} weight={700} />
      <Card
        x={90}
        y={560}
        o={prog(f, 26, 18, easeOut) * (1 - cardsOut)}
        icon={<StopwatchIcon x={0} y={0} size={84} color={C.teal} />}
        title="Laboratorijski test do iscrpljenja"
        result={<span>Zbirno: češće duže izdržavanje</span>}
        accent={C.teal}
        t={f}
        seed={0}
      />
      <Card
        x={510}
        y={560}
        o={prog(f, 40, 18, easeOut) * (1 - cardsOut)}
        icon={<FlagIcon x={0} y={0} size={84} color={C.white} />}
        title="Test na zadatu distancu, kao na trci"
        result={<span>Zbirno: bez jasnog poboljšanja</span>}
        accent={C.white}
        t={f}
        seed={1.7}
      />
      <Headline
        lines={['Efekat nije', <span key="b" style={{color: C.beetLight}}>isti kod svih.</span>]}
        at={fIstr}
        out={296}
        y={240}
        size={118}
        weight={700}
      />
      <Tag at={fIstr + 10} out={296} x={690} y={1300} size={26}>
        Ilustracija
      </Tag>
      <SourceNote text="Poon i sar., Sports Med 2025 · pregled 20 meta-analiza" at={30} out={296} y={1360} />
    </AbsoluteFill>
  );
};
