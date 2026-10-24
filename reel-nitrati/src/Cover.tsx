import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Background} from './components/Background';
import {Glass} from './components/Glass';
import {Beet} from './components/Produce';
import {Molecule} from './components/Bio';
import {Arrow, Chem} from './components/Type';
import {C, FONT_BODY, FONT_HEAD} from './theme';

/** Naslovnica 1080×1920; ključni sadržaj je u centralnom isečku 1080×1350 (mreža profila). */
export const Cover: React.FC = () => (
  <AbsoluteFill>
    <Background glow={C.beet} glowY={1050} glowOpacity={0.24} />
    <svg width={1080} height={1920} style={{position: 'absolute'}}>
      <rect x={0} y={1400} width={1080} height={2} fill={C.white} opacity={0.06} />
      <Beet x={735} y={1265} scale={1.08} rot={-7} sway={1} />
      <Glass x={420} y={990} scale={1.2} frame={40} particles={1} hero={0.7} />
      <Molecule x={250} y={870} scale={0.6} stage={0} glow={0.3} />
    </svg>
    <div style={{position: 'absolute', left: 90, top: 330, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 196, lineHeight: 0.95, color: C.white, letterSpacing: '0.005em'}}>
      <div style={{color: C.beetLight}}>NITRATI</div>
      <div>I TRČANJE</div>
    </div>
    <div style={{position: 'absolute', left: 94, top: 720, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 60, color: C.white, opacity: 0.92}}>Kako zapravo deluju?</div>
    <div style={{position: 'absolute', left: 90, width: 810, top: 1452, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, fontFamily: FONT_BODY, fontWeight: 600, fontSize: 52, color: C.white}}>
      <Chem f="NO3-" style={{color: C.beetLight}} />
      <span style={{color: C.muted}}>
        <Arrow />
      </span>
      <Chem f="NO2-" style={{color: C.beetLight}} />
      <span style={{color: C.muted}}>
        <Arrow />
      </span>
      <Chem f="NO" style={{color: C.teal}} />
    </div>
  </AbsoluteFill>
);
