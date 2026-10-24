import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Background} from '../components/Background';
import {Bacterium, HeadIcon, Molecule, Muscle, Vessel} from '../components/Bio';
import {Track} from '../components/Props';
import {Arrow, Chem, SourceNote, Tag} from '../components/Type';
import {C, FONT_BODY, FONT_HEAD} from '../theme';
import {clamp, cue, easeInOut, easeOut, lf, mix, prog, rand} from '../lib/anim';
import {MOL_HANDOFF} from './S2Source';

export const TRACK_Y = 1300;
const LENS = {x: 590, y: 905, r: 300};
const VES = {y: 860, r: 125};
const SURF = (x: number) => 1010 + Math.sin(x / 46) * 10 + Math.sin(x / 17) * 4;

/** Zaglavlje: NITRATI → NITRITI → AZOT-MONOKSID / NO₃⁻ → NO₂⁻ → NO. */
export const ChainHeader: React.FC<{active: number; appear: number; out?: number; dimAll?: number}> = ({active, appear, out, dimAll = 0}) => {
  const f = useCurrentFrame();
  const o = prog(f, appear, 16) * (out !== undefined ? 1 - prog(f, out, 14, easeInOut) : 1);
  const items = [
    {t: 'NITRATI', fm: 'NO3-', c: C.beetLight},
    {t: 'NITRITI', fm: 'NO2-', c: C.beetLight},
    {t: 'AZOT-MONOKSID', fm: 'NO', c: C.teal},
  ];
  return (
    <div style={{position: 'absolute', left: 90, top: 222, width: 810, opacity: o, transform: `translateY(${(1 - o) * 20}px)`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between'}}>
      {items.map((it, i) => {
        const on = clamp(active - i + 1);
        const isCur = active >= i && active < i + 1;
        const op = (0.3 + 0.7 * on) * (1 - dimAll * 0.5);
        return (
          <React.Fragment key={i}>
            {i > 0 ? (
              <div style={{paddingTop: 12, opacity: 0.32 + 0.68 * on, color: on > 0.5 ? C.white : C.muted, fontSize: 38}}>
                <Arrow />
              </div>
            ) : null}
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: op}}>
              <div style={{fontFamily: FONT_HEAD, fontWeight: 800, fontSize: 50, letterSpacing: '0.01em', color: isCur ? it.c : C.white, lineHeight: 1}}>{it.t}</div>
              <div style={{fontFamily: FONT_BODY, fontWeight: 600, fontSize: 44, color: isCur ? it.c : C.white, marginTop: 10, lineHeight: 1.1}}>
                <Chem f={it.fm} />
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Lupa sa površinom jezika i bakterijama (deli se sa scenom 7). */
export const TongueLens: React.FC<{t: number; activeIdx?: number; activeAmt?: number; dim?: number; wash?: number; children?: React.ReactNode; ring?: number}> = ({
  t,
  activeIdx = 3,
  activeAmt = 0,
  dim = 0,
  wash = -1,
  ring = 0,
  children,
}) => {
  const {x, y, r} = LENS;
  let d = `M${x - r - 10},${y + r + 10}`;
  for (let xx = x - r - 10; xx <= x + r + 10; xx += 8) d += ` L${xx},${SURF(xx)}`;
  d += ` L${x + r + 10},${y + r + 10} Z`;
  const bact = [430, 505, 560, 615, 690, 760].map((bx, i) => ({x: bx + (i % 2 ? 6 : -4), y: SURF(bx) - 18 - (i % 3) * 8, rot: Math.atan2(SURF(bx + 5) - SURF(bx - 5), 10) * 57 + (i % 2 ? 8 : -10)}));
  const washX = mix(x - r - 260, x + r + 260, clamp(wash));
  return (
    <g>
      <defs>
        <clipPath id="lensClip">
          <circle cx={x} cy={y} r={r} />
        </clipPath>
        <linearGradient id="tongue" x1="0" y1={y} x2="0" y2={y + r} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A13A5C" />
          <stop offset="1" stopColor="#4E1528" />
        </linearGradient>
        <radialGradient id="lensBg" cx={x} cy={y - 80} r={r * 1.2} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2A1520" />
          <stop offset="1" stopColor="#140B10" />
        </radialGradient>
        <linearGradient id="washG" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={C.white} stopOpacity={0} />
          <stop offset="0.5" stopColor="#DDF7F2" stopOpacity={0.5} />
          <stop offset="1" stopColor={C.white} stopOpacity={0} />
        </linearGradient>
      </defs>
      <circle cx={x} cy={y} r={r + 26} fill={C.teal} opacity={0.06 + 0.12 * ring} />
      <g clipPath="url(#lensClip)">
        <circle cx={x} cy={y} r={r} fill="url(#lensBg)" />
        {/* pljuvačka */}
        <path d={`M${x - r},${SURF(x - r) - 70} Q${x},${SURF(x) - 95 + Math.sin(t * 0.05) * 6} ${x + r},${SURF(x + r) - 70} L${x + r},${y + r} L${x - r},${y + r} Z`} fill={C.white} opacity={0.05} />
        <path d={d} fill="url(#tongue)" />
        {Array.from({length: 14}, (_, i) => {
          const bx = x - r + 20 + i * 44;
          return <ellipse key={i} cx={bx} cy={SURF(bx) + 4} rx={16} ry={9} fill="#C25478" opacity={0.5} />;
        })}
        <path d={d} fill="none" stroke="#E07B9B" strokeOpacity={0.5} strokeWidth={3} />
        {bact.map((b, i) => (
          <Bacterium key={i} x={b.x} y={b.y} rot={b.rot} t={t} seed={i * 1.7} active={i === activeIdx ? activeAmt : 0} dim={dim} len={i % 3 === 1 ? 64 : 76} />
        ))}
        {children}
        {wash >= 0 && wash <= 1 ? <rect x={washX - 260} y={y - r} width={520} height={2 * r} fill="url(#washG)" /> : null}
      </g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={C.white} strokeOpacity={0.55} strokeWidth={4} />
      <text x={x} y={y - r + 58} textAnchor="middle" fontFamily={FONT_BODY} fontWeight={600} fontSize={28} fill={C.muted} letterSpacing="0.04em">
        USTA · POVRŠINA JEZIKA
      </text>
    </g>
  );
};

export const S3Pathway: React.FC = () => {
  const f = useCurrentFrame();
  const fPretv = lf(3, cue.pretvaranju);
  const fNitrite = lf(3, cue.nitrite);
  const fAzot = lf(3, cue.azotMonoksid);
  const fMol = lf(3, cue.molekul);
  const fProt = lf(3, cue.protoka);
  const fRadu = lf(3, cue.radu);
  const conv1 = prog(f, fNitrite - 10, 16, easeInOut);
  const conv2 = prog(f, fAzot - 8, 16, easeInOut);
  const pan = prog(f, 138, 38, easeInOut); // „gutanje": lupa ide gore, krvni sud ulazi odozdo
  const toTrack = prog(f, 372, 24, easeInOut);

  // molekul: ulazi u lupu, dodiruje bakteriju, pa vodi kameru do krvnog suda
  const enter = prog(f, 0, 64, easeOut);
  let mx = mix(MOL_HANDOFF.x, 600, enter);
  let my = mix(MOL_HANDOFF.y, 930, enter) + Math.sin(f * 0.08) * 4;
  let ms = mix(MOL_HANDOFF.scale, 0.78, enter);
  mx = mix(mx, 520, pan);
  my = mix(my, VES.y, pan);
  ms = mix(ms, 0.86, pan);
  if (pan >= 1) {
    mx = 520 + (f - 176) * 0.55;
    my = VES.y + Math.sin(f * 0.07) * 10;
  }
  const stage = conv1 + conv2;
  const dilate = prog(f, fProt - 4, 30, easeInOut);
  const r = VES.r * (1 + 0.1 * dilate);
  const musc = prog(f, fRadu - 4, 20);
  const spread = prog(f, fMol - 6, 60, easeOut);
  const activeStep = f < fNitrite - 4 ? 0.5 : f < fAzot - 4 ? 1.5 : 2.5;

  const kids = Array.from({length: 7}, (_, i) => {
    const ang = -150 + i * 50 + rand(i) * 20;
    const toMuscle = i % 2 === 0;
    const tx = mx + Math.cos((ang * Math.PI) / 180) * 260 + (toMuscle ? 40 : 0);
    const ty = toMuscle ? 1080 + rand(i * 3) * 150 : VES.y + (i % 4 === 1 ? -r + 6 : r - 6);
    return {x: mix(mx, tx, spread), y: mix(my, ty, spread), o: spread * clamp(1 - toTrack * 2.2)};
  });

  return (
    <AbsoluteFill>
      <Background glow={C.teal} glowY={900} glowOpacity={0.11} />
      <svg width={1080} height={1920} style={{position: 'absolute'}}>
        {/* korak 1: usta */}
        <g transform={`translate(0,${-pan * 1500})`} opacity={1 - pan * 0.4}>
          <HeadIcon x={90} y={480} scale={0.72} opacity={prog(f, 6, 16)} mouthGlow={prog(f, 20, 20)} />
          <path d={`M250,638 C330,660 330,760 ${LENS.x - LENS.r * 0.92},${LENS.y - 90}`} stroke={C.white} strokeOpacity={0.35 * prog(f, 14, 18)} strokeWidth={2.5} fill="none" strokeDasharray="6 8" />
          <g opacity={prog(f, 4, 18)} transform={`translate(${LENS.x},${LENS.y}) scale(${mix(0.85, 1, prog(f, 4, 22, easeOut))}) translate(${-LENS.x},${-LENS.y})`}>
            <TongueLens t={f} activeAmt={prog(f, fPretv - 6, 14) * (1 - prog(f, fNitrite + 20, 20))} ring={conv1 * (1 - pan)} />
          </g>
        </g>
        {/* korak 2–3: krvni sud i mišić */}
        <g transform={`translate(0,${(1 - pan) * 1500 + toTrack * (TRACK_Y - (VES.y + VES.r))})`}>
          <Vessel y={VES.y} r={r} t={f} lumenOpacity={clamp(1 - toTrack * 2.2)} wallOpacity={clamp(1 - toTrack * 1.6)} />
          <rect x={-10} y={VES.y + r - 1} width={1100} height={4} fill={C.white} opacity={mix(0.18, 0.95, clamp(toTrack * 1.5))} />
          <Muscle y={1068} t={f} active={musc} opacity={clamp(1 - toTrack * 2.2)} />
        </g>
        {toTrack > 0 ? <Track y={TRACK_Y} offset={0} opacity={clamp(toTrack * 1.6 - 0.5)} /> : null}
        {kids.map((k, i) => (
          <Molecule key={i} x={k.x} y={k.y} scale={0.34} stage={2} opacity={k.o} glow={0.22} labels={false} />
        ))}
        <Molecule x={mx} y={my} scale={ms} stage={stage} glow={0.18 + 0.3 * conv2} opacity={clamp(1 - toTrack * 1.4)} />
      </svg>
      <ChainHeader active={activeStep} appear={2} out={360} />
      <Tag at={18} out={136} x={90} y={410} color={C.white}>
        1 · Usta: bakterije
      </Tag>
      <Tag at={182} out={fMol - 10} x={90} y={410} color={C.white}>
        2 · Telo: <Chem f="NO2-" /> <Arrow size={0.8} /> <Chem f="NO" />
      </Tag>
      <Tag at={fMol} out={360} x={90} y={410} color={C.white}>
        3 · Protok krvi i rad mišića
      </Tag>
      <Tag at={fProt} out={360} x={600} y={640} color={C.teal} border="rgba(77,217,192,0.5)">
        protok krvi
      </Tag>
      <Tag at={fRadu} out={360} x={600} y={1288} color={C.teal} border="rgba(77,217,192,0.5)">
        rad mišića
      </Tag>
      <SourceNote text="Izvor: AIS – Dietary Nitrate (2025)" at={30} out={356} y={1360} />
    </AbsoluteFill>
  );
};
