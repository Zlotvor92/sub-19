import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Background} from '../components/Background';
import {Glass, heroWorld} from '../components/Glass';
import {Beet} from '../components/Produce';
import {Runner} from '../components/Runner';
import {Headline} from '../components/Type';
import {C} from '../theme';
import {cue, easeIn, easeInOut, lf, mix, prog} from '../lib/anim';

export const S1_DROP = 8; // lokalni frejm udara kapi (zvuk tečnosti)
const GX = 470, GY = 880, GS = 1.3;

export const S1Hook: React.FC = () => {
  const f = useCurrentFrame();
  const dur = 198;
  const fOdg = lf(1, cue.odgovor);
  const fNit = lf(1, cue.nitratiS1);

  // kamera: lagani prilaz, pa ulazak u glavnu česticu
  const push = prog(f, 0, 170, easeInOut);
  const dive = prog(f, 172, dur - 172, easeIn);
  const hero = heroWorld(GX, GY, GS, f);
  const focusX = mix(540, hero.x, Math.max(push * 0.4, dive));
  const focusY = mix(1000, hero.y, Math.max(push * 0.4, dive));
  const scale = mix(1, 1.1, push) * mix(1, 7, dive * dive);

  const runnerX = interpolate(f, [18, 64], [-260, 1360], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const particles = prog(f, 52, 46);
  const heroOn = prog(f, fNit - 6, 22);

  return (
    <AbsoluteFill>
      <Background glow={C.beet} glowY={1000} glowOpacity={0.2} />
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g transform={`translate(${focusX},${focusY}) scale(${scale}) translate(${-focusX},${-focusY})`}>
          {/* trkač u pozadini, zamućen (plitka dubinska oštrina) */}
          {f > 16 && f < 68 ? (
            <g style={{filter: 'blur(9px)'}} opacity={0.42}>
              <Runner x={runnerX} groundY={1290} height={720} phase={f / 20} shadow={false} />
            </g>
          ) : null}
          <rect x={0} y={1288} width={1080} height={2} fill={C.white} opacity={0.06} />
          <Beet x={755} y={1160} scale={1.02} rot={-7} sway={Math.sin(f / 22) * 2.5} />
          <Glass x={GX} y={GY} scale={GS} frame={f} dropAt={S1_DROP} particles={particles} hero={heroOn} />
        </g>
        {/* bljesak čestice na kraju (spaja se sa početkom scene 2) */}
        <circle cx={540} cy={960} r={mix(0, 260, dive)} fill={C.teal} opacity={dive * 0.25} />
      </svg>
      <Headline
        lines={[
          <span key="a" style={{color: C.beetLight}}>CVEKLA</span>,
          <span key="b">I TRČANJE</span>,
        ]}
        at={4}
        out={fOdg - 8}
        y={250}
        size={176}
      />
      <Headline
        lines={[
          <span key="a">Šta rade</span>,
          <span key="b" style={{color: C.beetLight}}>nitrati?</span>,
        ]}
        at={fOdg + 2}
        out={dur - 22}
        y={262}
        size={150}
        weight={700}
      />
    </AbsoluteFill>
  );
};
