import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Background} from '../components/Background';
import {Runner, groundSpeedPerCycle} from '../components/Runner';
import {Meter, Track} from '../components/Props';
import {Chem, Headline, SourceNote, Tag} from '../components/Type';
import {C, FONT_BODY} from '../theme';
import {cue, easeInOut, easeOut, lf, mix, prog, rand} from '../lib/anim';
import {TRACK_Y} from './S3Pathway';

export const RUN_H = 470;
export const RUN_CYCLE = 21; // frejmova po koraku-ciklusu (konstantna kadenca)
export const RUN_X = 420;

/** Konstantna brzina podloge, usklađena sa osloncem stopala (bez proklizavanja). */
export const groundOffset = (frame: number, h = RUN_H) => (frame / RUN_CYCLE) * groundSpeedPerCycle(h);

export const S4Economy: React.FC = () => {
  const f = useCurrentFrame();
  const g = f + 846; // globalni frejm, radi kontinuiteta faze trčanja kroz scene
  const fManju = lf(4, cue.manju);
  const fDrugim = lf(4, cue.drugim);
  const fEko = lf(4, cue.ekonomicnostS4);
  const enter = prog(f, 0, 26, easeOut);
  const o2 = prog(f, fManju, 34, easeInOut);
  const meters = prog(f, 40, 18);
  const swapOut = fDrugim - 8;

  // dah: O2 čestice ispred lica; nešto ređe posle „manju" (ilustracija)
  const headX = RUN_X + 0.17 * RUN_H, headY = TRACK_Y - RUN_H * 0.9;
  const puffs = Array.from({length: 10}, (_, i) => {
    const period = 34;
    const k = (f + i * (period / 10) * 3.4) % period;
    const t = k / period;
    const keep = i < Math.round(mix(10, 7, o2));
    return {x: headX + 30 + t * 150, y: headY + 20 - t * 40 + Math.sin(i * 2 + f * 0.1) * 8, o: keep ? Math.sin(Math.PI * t) * 0.8 : 0, r: 7 + rand(i) * 4};
  });

  return (
    <AbsoluteFill>
      <Background glow={C.teal} glowX={500} glowY={1000} glowOpacity={0.1} />
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <Track y={TRACK_Y} offset={groundOffset(g)} />
        <g opacity={enter} transform={`translate(${(1 - enter) * -240},0)`}>
          <Runner x={RUN_X} groundY={TRACK_Y} height={RUN_H} phase={g / RUN_CYCLE} />
        </g>
        {puffs.map((p, i) => (
          <g key={i} opacity={p.o * enter * meters}>
            <circle cx={p.x} cy={p.y} r={p.r} fill="none" stroke={C.teal} strokeWidth={2.5} />
            <circle cx={p.x + p.r * 1.6} cy={p.y} r={p.r} fill="none" stroke={C.teal} strokeWidth={2.5} />
          </g>
        ))}
        <g opacity={meters * (1 - prog(f, swapOut, 12))}>
          <Meter x={90} y={640} w={560} value={0.64} label="Tempo" note="isti" color={C.white} />
          <Meter x={90} y={770} w={560} value={mix(0.78, 0.68, o2)} ghost={o2 > 0.02 ? 0.78 : undefined} label={<span>Potrošnja <Chem f="O2" /></span>} note={o2 > 0.3 ? 'moguće manja' : ''} color={C.teal} />
        </g>
      </svg>
      <Headline lines={['ISTI TEMPO']} at={8} out={swapOut} y={240} size={150} />
      <Headline
        lines={[<span key="a">Moguća manja</span>, <span key="b">potrošnja <Chem f="O2" /></span>]}
        at={fManju - 6}
        out={swapOut}
        y={400}
        size={70}
        weight={700}
        color={C.teal}
        lineHeight={1.02}
      />
      <Tag at={50} out={swapOut} x={690} y={580} size={26}>
        Ilustracija
      </Tag>
      <Headline
        lines={[<span key="a" style={{color: C.teal}}>EKONOMIČNOST</span>, <span key="b">TRČANJA</span>]}
        at={fDrugim + 2}
        out={300}
        y={240}
        size={128}
      />
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 520,
          width: 810,
          opacity: prog(f, fEko - 30, 16) * (1 - prog(f, 296, 10)),
          transform: `translateY(${(1 - prog(f, fEko - 30, 16, easeOut)) * 16}px)`,
          fontFamily: FONT_BODY,
          fontWeight: 500,
          fontSize: 44,
          color: C.white,
          lineHeight: 1.25,
        }}
      >
        = manje kiseonika <span style={{color: C.muted}}>pri istom tempu</span>
      </div>
      <SourceNote text="Lansley i sar., J Appl Physiol 2011 · laboratorijska studija" at={60} out={298} y={1392} />
    </AbsoluteFill>
  );
};
