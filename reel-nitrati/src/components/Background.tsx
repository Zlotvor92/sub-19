import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, W, H} from '../theme';

/** Grafitna pozadina sa blagim svetlom, vinjetom i statičnim zrnom. */
export const Background: React.FC<{glow?: string; glowX?: number; glowY?: number; glowR?: number; glowOpacity?: number}> = ({
  glow = C.beet,
  glowX = 540,
  glowY = 900,
  glowR = 900,
  glowOpacity = 0.16,
}) => (
  <AbsoluteFill style={{background: C.graphite}}>
    <svg width={W} height={H} style={{position: 'absolute'}}>
      <defs>
        <radialGradient id="bgGlow" cx={glowX} cy={glowY} r={glowR} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={glow} stopOpacity={glowOpacity} />
          <stop offset="0.55" stopColor={glow} stopOpacity={glowOpacity * 0.25} />
          <stop offset="1" stopColor={glow} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="bgVig" cx="540" cy="960" r="1250" gradientUnits="userSpaceOnUse">
          <stop offset="0.45" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.55} />
        </radialGradient>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={7} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.06" />
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width={W} height={H} fill="url(#bgGlow)" />
      <rect width={W} height={H} fill="url(#bgVig)" />
      <rect width={W} height={H} filter="url(#grain)" opacity={0.9} />
    </svg>
  </AbsoluteFill>
);
