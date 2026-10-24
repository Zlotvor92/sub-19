import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Background} from '../components/Background';
import {Molecule} from '../components/Bio';
import {Runner} from '../components/Runner';
import {StomachIcon, Track} from '../components/Props';
import {Arrow, Chem, Headline, SourceNote, Tag} from '../components/Type';
import {C, FONT_BODY, FONT_HEAD} from '../theme';
import {clamp, cue, easeInOut, easeOut, lf, mix, prog} from '../lib/anim';
import {TongueLens, TRACK_Y} from './S3Pathway';
import {RUN_CYCLE, RUN_H, RUN_X, groundOffset} from './S4Economy';

export const S7_WASH_START = 18;

export const S7Practical: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + 1854;
  const fOsl = lf(7, cue.oslabiti);
  const fSok = lf(7, cue.aSok);
  const fTr = lf(7, cue.treningu);
  const fSt = lf(7, cue.stomaku);

  const lensIn = prog(f, 0, 20, easeOut);
  const wash = clamp((f - S7_WASH_START) / 54);
  const dim = clamp((wash - 0.25) / 0.5) * 0.78;
  const weak = prog(f, fOsl - 4, 22, easeInOut);
  const toTrain = prog(f, fSok - 12, 26, easeInOut);
  const runIn = prog(f, fSok - 2, 24, easeOut);

  return (
    <AbsoluteFill>
      <Background glow={toTrain > 0.5 ? C.teal : C.beet} glowY={950} glowOpacity={0.11} />
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g opacity={lensIn * (1 - toTrain)} transform={`translate(${-toTrain * 420},0)`}>
          <TongueLens t={f + 300} dim={dim} wash={wash} activeIdx={3} activeAmt={0.6 * (1 - dim)}>
            <Molecule x={600} y={890 + Math.sin(f * 0.08) * 6} scale={0.72} stage={0.08 * (1 - weak)} glow={0.2} opacity={1} />
          </TongueLens>
        </g>
        {toTrain > 0 ? (
          <g opacity={runIn}>
            <Track y={TRACK_Y} offset={groundOffset(g)} />
            <g transform={`translate(${(1 - runIn) * 300},0)`}>
              <Runner x={RUN_X} groundY={TRACK_Y} height={RUN_H} phase={g / RUN_CYCLE} />
            </g>
          </g>
        ) : null}
      </svg>
      <Headline lines={['Važne su i bakterije', <span key="b" style={{color: C.teal}}>u ustima.</span>]} at={4} out={fSok - 14} y={240} size={100} weight={700} />
      <Tag at={24} out={fSok - 14} x={90} y={500} color={C.white}>
        antibakterijska vodica za usta
      </Tag>
      {/* konverzija slabi */}
      <div
        style={{
          position: 'absolute',
          left: 90,
          width: 810,
          top: 1240,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 22,
          opacity: prog(f, 30, 14) * (1 - toTrain),
          fontFamily: FONT_BODY,
          fontWeight: 600,
          fontSize: 54,
          color: C.white,
        }}
      >
        <Chem f="NO3-" style={{color: C.beetLight}} />
        <span style={{opacity: mix(1, 0.35, weak), color: C.teal, fontSize: 52}}>
          <Arrow />
        </span>
        <span style={{opacity: mix(1, 0.3, weak)}}>
          <Chem f="NO2-" />
        </span>
        <span style={{fontSize: 32, color: C.muted, opacity: weak, marginLeft: 10}}>slabije</span>
      </div>
      {/* trening */}
      <Headline lines={['Prvo isprobaj', <span key="b" style={{color: C.teal}}>na treningu.</span>]} at={fSok - 6} out={276} y={240} size={112} weight={700} />
      <div style={{position: 'absolute', left: 90, top: 500, display: 'flex', alignItems: 'center', gap: 20, opacity: prog(f, fTr - 6, 14) * (1 - prog(f, 276, 10)), fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 44, letterSpacing: '0.06em'}}>
        <span style={{background: C.teal, color: C.graphite, padding: '8px 20px', borderRadius: 40}}>TRENING</span>
        <span style={{color: C.white, fontSize: 40}}>
          <Arrow />
        </span>
        <span style={{border: `3px solid ${C.white}`, color: C.white, padding: '5px 18px', borderRadius: 40, opacity: 0.6}}>TRKA</span>
      </div>
      <div style={{position: 'absolute', left: 90, top: 610, display: 'flex', alignItems: 'center', gap: 18, opacity: prog(f, fSt - 6, 14) * (1 - prog(f, 276, 10)), fontFamily: FONT_BODY, fontWeight: 600, fontSize: 36, color: C.white}}>
        <svg width={64} height={64} style={{overflow: 'visible'}}>
          <StomachIcon x={0} y={0} size={64} color={C.beetLight} sw={4.5} />
        </svg>
        Kod nekih: stomačne tegobe
      </div>
      <SourceNote text="Izvor: AIS – Dietary Nitrate (2025)" at={34} out={278} y={1392} />
    </AbsoluteFill>
  );
};
