import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Background} from '../components/Background';
import {Beet, Leaf} from '../components/Produce';
import {Molecule} from '../components/Bio';
import {Chem, Headline} from '../components/Type';
import {C, FONT_BODY} from '../theme';
import {clamp, cue, easeInOut, easeOut, lf, mix, prog, rand} from '../lib/anim';

export const MOL_HANDOFF = {x: 540, y: 640, scale: 1.05};

export const S2Source: React.FC = () => {
  const f = useCurrentFrame();
  const dur = 252;
  const fNj = lf(2, cue.njihov);
  const fPr = lf(2, cue.preradi);

  const open = prog(f, 0, 22, easeOut); // izlazak iz bljeska
  const reveal = prog(f, 4, 26, easeOut);
  const exit = prog(f, fPr - 22, 46, easeInOut); // kamera prati molekul
  const hx = 540, hy = 700;

  const toMol = prog(f, fNj, 26, easeOut);
  const molX = mix(hx, MOL_HANDOFF.x, exit);
  const molY = mix(hy, MOL_HANDOFF.y, exit);
  const molS = mix(0.2, 1.05, toMol);

  const drift = Array.from({length: 18}, (_, i) => {
    const fromBeet = i % 2 === 0;
    const bx = fromBeet ? 230 + rand(i) * 200 : 690 + rand(i) * 170;
    const by = fromBeet ? 1050 : 1180;
    const cyc = ((f * (0.6 + rand(i * 2) * 0.5) + rand(i * 5) * 220) % 260) / 260;
    return {x: bx + Math.sin(f * 0.03 + i) * 18, y: by - cyc * 420, o: Math.sin(Math.PI * cyc) * reveal, r: 3 + rand(i * 7) * 3};
  });

  return (
    <AbsoluteFill>
      <Background glow={exit > 0.3 ? C.teal : C.beet} glowY={900} glowOpacity={mix(0.18, 0.12, exit)} />
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        <g transform={`translate(0,${exit * 420})`} opacity={(1 - exit) * reveal}>
          <ellipse cx={540} cy={1430} rx={480} ry={40} fill="#000" opacity={0.25} />
          <Beet x={330} y={1190} scale={1.42} rot={-6} sway={Math.sin(f / 24) * 2} />
          <Leaf x={800} y={1450} scale={1.0} rot={16} />
          <Leaf x={700} y={1470} scale={0.78} rot={-8} opacity={0.85} />
          {drift.map((p, i) => (
            <g key={i} opacity={p.o * 0.9}>
              <circle cx={p.x} cy={p.y} r={p.r * 3} fill={C.beetLight} opacity={0.18} />
              <circle cx={p.x} cy={p.y} r={p.r} fill="#FBE3EA" />
            </g>
          ))}
        </g>
        {/* izdvojena čestica -> molekul NO3- */}
        <g opacity={1 - toMol}>
          <circle cx={hx} cy={hy} r={mix(300, 16, open)} fill={C.teal} opacity={mix(0.3, 0.25, open)} />
          <circle cx={hx} cy={hy} r={mix(120, 8, open)} fill="#FFFFFF" />
          <circle cx={hx} cy={hy} r={mix(160, 30, open)} fill="none" stroke={C.teal} strokeWidth={3} opacity={open} />
        </g>
        <Molecule x={molX} y={molY} scale={molS} stage={0} opacity={toMol} glow={0.35 * toMol} />
      </svg>
      {/* oznaka formule prati česticu */}
      <div
        style={{
          position: 'absolute',
          left: mix(hx + 56, hx + 130, toMol),
          top: mix(hy - 70, hy - 160, toMol) + exit * (MOL_HANDOFF.y - hy),
          opacity: prog(f, 22, 16) * (1 - prog(f, fPr - 30, 20)),
          fontFamily: FONT_BODY,
          color: C.white,
        }}
      >
        <div style={{fontSize: 92, fontWeight: 700, lineHeight: 1}}>
          <Chem f="NO3-" />
        </div>
        <div style={{fontSize: 34, fontWeight: 500, color: C.muted, marginTop: 10}}>nitrat</div>
      </div>
      <Headline
        lines={[<span key="a">Nitrati</span>, <span key="b" style={{color: C.beetLight}}>iz hrane</span>]}
        at={8}
        out={fPr - 26}
        y={250}
        size={140}
        weight={700}
      />
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 1330,
          opacity: clamp(prog(f, lf(2, cue.cvekli) - 4, 14) - exit * 2),
          fontFamily: FONT_BODY,
          fontSize: 32,
          fontWeight: 600,
          color: C.white,
          display: 'flex',
          gap: 26,
        }}
      >
        <span style={{color: C.beetLight}}>cvekla</span>
        <span style={{opacity: prog(f, lf(2, cue.zelenom) - 4, 14), color: C.leafLight}}>zeleno lisnato povrće</span>
      </div>
    </AbsoluteFill>
  );
};
