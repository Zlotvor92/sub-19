import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Background} from '../components/Background';
import {BigNumber, Bottle, CheckIcon, Clock} from '../components/Props';
import {Approx, Headline, SourceNote, Tag} from '../components/Type';
import {C, FONT_BODY, FONT_HEAD} from '../theme';
import {clamp, cue, easeInOut, easeOut, lf, mix, prog} from '../lib/anim';

const BOT = {x: 260, y: 1300, s: 1.05};
const ROW = {x: BOT.x, y: BOT.y - 143 * BOT.s}; // red „Nitrati" na etiketi
const CLK = {x: 560, y: 1000, r: 230};

export const S6Dose: React.FC = () => {
  const f = useCurrentFrame();
  const fSest = lf(6, cue.sest);
  const fMil = lf(6, cue.milimola);
  const fDva = lf(6, cue.dva);
  const fGl = lf(6, cue.gledaj);
  const fSamo = lf(6, cue.samo);

  const botIn = prog(f, 0, 26, easeOut);
  const lensIn = prog(f, 22, 18, easeOut);
  const toClock = prog(f, fDva - 6, 26, easeInOut);
  const clockOut = prog(f, fGl - 8, 18, easeInOut);
  const panelIn = prog(f, fGl + 2, 20, easeOut);
  const dimMl = prog(f, fSamo - 4, 16);

  // lupa -> sat (kružni detalj postaje sat)
  const lx = mix(ROW.x + Math.sin(f * 0.07) * 7, CLK.x, toClock);
  const ly = mix(ROW.y + Math.sin(f * 0.06) * 6 + Math.cos(f * 0.05) * 4, CLK.y, toClock);
  const lr = mix(82, CLK.r, toClock);
  const sweep = prog(f, fDva + 14, 46, easeInOut);
  const hand = mix(-75, 0, sweep);

  const botX = mix(BOT.x, mix(BOT.x - 60, 330, panelIn), toClock);
  const botO = botIn * mix(1, 0, toClock * (1 - panelIn));
  const numOut = prog(f, fGl - 10, 14, easeInOut);

  return (
    <AbsoluteFill>
      <Background glow={C.beet} glowX={420} glowY={1050} glowOpacity={0.13} />
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g transform={`translate(0,${(1 - botIn) * 260 + Math.sin(f * 0.06) * 6}) translate(${BOT.x},${BOT.y}) scale(${1 + 0.035 * prog(f, 0, 396, easeInOut)}) translate(${-BOT.x},${-BOT.y})`}>
          <Bottle x={botX} y={BOT.y} scale={mix(BOT.s, 1.15, panelIn)} opacity={botO} labelHi={lensIn * (1 - toClock) + panelIn} />
        </g>
        {/* lupa / sat */}
        <g opacity={lensIn * (1 - clockOut)}>
          {toClock < 0.02 ? (
            <g>
              <circle cx={lx} cy={ly} r={lr} fill="rgba(77,217,192,0.08)" stroke={C.teal} strokeWidth={5} />
              <line x1={lx + lr * 0.7} y1={ly + lr * 0.7} x2={lx + lr * 1.25} y2={ly + lr * 1.25} stroke={C.teal} strokeWidth={10} strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <circle cx={lx} cy={ly} r={lr} fill="none" stroke={C.teal} strokeWidth={mix(5, 0, clamp(toClock * 2))} />
              <g opacity={clamp(toClock * 1.4 - 0.2)}>
                <Clock cx={lx} cy={ly} r={lr} arc={prog(f, fDva + 4, 20)} hand={hand} ticks={clamp(toClock * 2 - 0.6)} />
                {sweep >= 1
                  ? [0, 1].map((k) => {
                      const ph = ((f - (fDva + 60) + k * 22) % 44) / 44;
                      return <circle key={k} cx={lx} cy={ly - lr - 18 - 40} r={20 + ph * 70} fill="none" stroke={C.teal} strokeWidth={3} opacity={(1 - ph) * 0.6} />;
                    })
                  : null}
                <circle cx={lx} cy={ly} r={lr + 10 + Math.sin(f * 0.12) * 3} fill="none" stroke={C.white} strokeOpacity={0.08} strokeWidth={2} />
              </g>
            </g>
          )}
        </g>
      </svg>
      {/* količina */}
      <div style={{position: 'absolute', left: 90, top: 318, opacity: prog(f, fSest - 4, 10) * (1 - numOut), transform: `translateY(${(1 - prog(f, fSest - 4, 14, easeOut)) * 40}px)`}}>
        <BigNumber size={164}>6–8 mmol</BigNumber>
        <div style={{fontFamily: FONT_BODY, fontWeight: 600, fontSize: 48, color: C.beetLight, marginTop: 6}}>nitrata</div>
      </div>
      <div style={{position: 'absolute', left: 90, top: 566, opacity: prog(f, fMil + 8, 10) * (1 - numOut), transform: `translateY(${(1 - prog(f, fMil + 8, 14, easeOut)) * 30}px)`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 104, color: C.white, lineHeight: 1}}>
        <Approx /> 370–500 mg
      </div>
      <Tag at={10} out={fGl - 10} x={90} y={236} size={28} color={C.white}>
        Primer sportskog protokola
      </Tag>
      {/* vreme */}
      <div style={{position: 'absolute', left: 90, width: 810, top: 1262, textAlign: 'center', opacity: prog(f, fDva + 6, 12) * (1 - clockOut), transform: `translateY(${(1 - prog(f, fDva + 6, 14, easeOut)) * 24}px)`, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 76, color: C.white, lineHeight: 1}}>
        <span style={{color: C.beetLight}}>2–3 sata</span> pre napora
      </div>
      <div style={{position: 'absolute', left: CLK.x + 150, top: CLK.y - 330, opacity: prog(f, fDva + 50, 12) * (1 - clockOut), fontFamily: FONT_BODY, fontWeight: 600, fontSize: 30, color: C.teal}}>start</div>
      {/* deklaracija */}
      <Headline lines={[<span key="a" style={{color: C.beetLight}}>Nitrati</span>, 'na deklaraciji']} at={fGl - 2} out={384} y={250} size={120} weight={700} />
      <div
        style={{
          position: 'absolute',
          left: 470,
          top: 820,
          width: 430,
          opacity: panelIn * (1 - prog(f, 384, 10)),
          transform: `translateX(${(1 - panelIn) * 40}px) translateY(${Math.sin(f * 0.055 + 1) * 6}px) rotate(${Math.sin(f * 0.04) * 0.4}deg)`,
          borderRadius: 26,
          background: '#ECE7DB',
          padding: '26px 26px 20px',
          boxSizing: 'border-box',
          fontFamily: FONT_BODY,
          color: '#22272C',
        }}
      >
        <div style={{fontSize: 24, fontWeight: 700, letterSpacing: '0.12em', color: '#6C665C'}}>DEKLARACIJA</div>
        <div style={{height: 2, background: '#BDB6A9', margin: '14px 0 10px'}} />
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px', borderRadius: 14, background: `rgba(77,217,192,${0.35 * panelIn})`}}>
          <span style={{fontSize: 34, fontWeight: 700}}>Nitrati</span>
          <span style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 28, fontWeight: 600, whiteSpace: 'nowrap'}}>
            mg / mmol
            <svg width={34} height={34} style={{overflow: 'visible'}}>
              <CheckIcon x={0} y={0} size={34} color="#127263" sw={4} />
            </svg>
          </span>
        </div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px', opacity: mix(1, 0.4, dimMl), position: 'relative'}}>
          <span style={{fontSize: 32, fontWeight: 600}}>Količina soka</span>
          <span style={{fontSize: 30, fontWeight: 600}}>ml</span>
          <div style={{position: 'absolute', left: 8, right: 8, top: '50%', height: 3, background: '#22272C', transform: `scaleX(${dimMl})`, transformOrigin: 'left'}} />
        </div>
      </div>
      <SourceNote text="AIS 2025 · tipično 6–10 mmol (oko 350–650 mg)" at={fSest + 10} out={386} y={1392} />
    </AbsoluteFill>
  );
};
